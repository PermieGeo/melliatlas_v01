// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import {
  type ViewportCollectionResult,
  type ViewportCollectionSelection,
  type ViewportCacheHistoryResponse,
  type SaturnDistrictCatalogResponse,
  type SaturnDistrictPointsResponse,
  type SaturnStoredFieldsResponse,
  type SaturnRequestLogResponse,
} from "@melliatlas/contracts";
import { ApiFailure } from "../../../../lib/errors.js";
import { executeAuditedSourceRequest } from "../../auditedSourceRequest.js";
import { RestrictedSourceFetcher } from "../../httpFetcher.js";
import {
  ProviderRequestThrottle,
  type ProviderRequestGate,
} from "../../providerRequestThrottle.js";
import {
  SaturnViewportIndexRepository,
  type ViewportIndexKey,
} from "./saturnViewportIndexRepository.js";
import { listViewportCacheHistory } from "./saturnViewportCacheHistory.js";
import {
  SaturnDistrictDirectory,
  type DirectoryPort,
} from "./saturnDistrictDirectory.js";
import {
  SaturnRequestJournal,
  type RequestAttempt,
} from "./saturnRequestJournal.js";
import { SaturnStoredIndex } from "./saturnStoredIndex.js";
import {
  SATURN_SOURCE_ID,
  SATURN_CONFIGURED_ENDPOINTS,
  SATURN_INDEX_PREVIEW_LIMIT,
  SATURN_MAX_VIEWPORT_PAGES,
  SATURN_VERIFIED_FALLBACK_DISTRICT_ID,
  SaturnRequestAction,
  SaturnRequestInitiator,
  SaturnRequestOutcome,
  SaturnSourceKind,
  SaturnSourceLifecycle,
  SaturnViewportState,
} from "./sourceProfile.js";
import { SaturnProvider, type SaturnProviderPort } from "./SaturnProvider.js";
import { SaturnViewportPageFetcher } from "./saturnViewportPageFetcher.js";

export { makeViewportFirstRequest } from "./SaturnProvider.js";
type SourceRow = {
  registry_revision: string;
  name: string;
  kind: string;
  lifecycle: string;
  url: string;
  api_request_config: unknown;
};
type IndexPort = Pick<
  SaturnViewportIndexRepository,
  "getStatus" | "appendCapturedPage" | "listFeatures"
>;
type FetchPort = Pick<RestrictedSourceFetcher, "fetch">;
type JournalPort = Pick<SaturnRequestJournal, "start" | "finish" | "list">;
type StoredPort = Pick<SaturnStoredIndex, "districtPoints" | "requestFields">;

/** Explicit one-page collector; all inspection methods read PostgreSQL only. */
export class SaturnViewportCollectionService {
  private readonly index: IndexPort;
  private readonly fetcher: FetchPort;
  private readonly gate: ProviderRequestGate;
  private readonly directory: DirectoryPort;
  private readonly journal: JournalPort;
  private readonly stored: StoredPort;
  private readonly provider: SaturnProviderPort;
  private readonly pageFetcher: SaturnViewportPageFetcher;

  constructor(
    private readonly pool: Pick<Pool, "query">,
    private readonly enabled = false,
    dependencies: {
      index?: IndexPort;
      fetcher?: FetchPort;
      gate?: ProviderRequestGate;
      directory?: DirectoryPort;
      journal?: JournalPort;
      stored?: StoredPort;
      provider?: SaturnProviderPort;
    } = {},
  ) {
    this.provider = dependencies.provider ?? new SaturnProvider();
    this.index =
      dependencies.index ?? new SaturnViewportIndexRepository(pool as Pool);
    this.fetcher =
      dependencies.fetcher ??
      new RestrictedSourceFetcher({
        requestProfiles: this.provider.requestProfiles,
      });
    this.pageFetcher = new SaturnViewportPageFetcher(
      this.fetcher,
      this.provider,
    );
    this.gate = dependencies.gate ?? new ProviderRequestThrottle(pool as Pool);
    this.journal = dependencies.journal ?? new SaturnRequestJournal(pool);
    this.directory =
      dependencies.directory ??
      new SaturnDistrictDirectory(pool, enabled, {
        fetcher: this.fetcher,
        gate: this.gate,
        journal: this.journal,
        provider: this.provider,
      });
    this.stored = dependencies.stored ?? new SaturnStoredIndex(pool);
  }

  /**
   * Resolve one immutable listing identity from the selected provider revision,
   * exact bbox/district/UpdateMap filter, and approved source configuration.
   * District center membership does not prove district boundary coverage.
   */
  private async key(
    selection: ViewportCollectionSelection,
  ): Promise<{ key: ViewportIndexKey; name: string }> {
    const firstPageRequest = this.provider.firstPage(selection);
    const result = await this.pool.query<SourceRow>(
      `SELECT registry_revision::text, name, kind, lifecycle, url, api_request_config
       FROM source_catalog WHERE id=$1`,
      [SATURN_SOURCE_ID],
    );
    const source = result.rows[0];
    const config = z
      .object({ endpoint: z.string() })
      .passthrough()
      .safeParse(source?.api_request_config);
    if (
      !source ||
      source.kind !== SaturnSourceKind.Treatment ||
      source.lifecycle !== SaturnSourceLifecycle.Configured ||
      !SATURN_CONFIGURED_ENDPOINTS.has(source.url) ||
      !config.success ||
      config.data.endpoint !== source.url
    ) {
      throw new ApiFailure(
        409,
        "SATURN_VIEWPORT_NOT_CONFIGURED",
        "Configure the Saturn provider endpoint first",
      );
    }
    // The observed Yartsevo ID remains available before the catalog is first refreshed.
    if (
      selection.districtId !== SATURN_VERIFIED_FALLBACK_DISTRICT_ID &&
      !(await this.directory.includes(selection.districtId))
    ) {
      throw new ApiFailure(
        400,
        "DISTRICT_NOT_IN_CATALOG",
        "Refresh the district catalog before selecting this district",
      );
    }
    return {
      key: {
        sourceId: SATURN_SOURCE_ID,
        sourceRevision: source.registry_revision,
        firstPageRequest,
      },
      name: source.name,
    };
  }

  districts(): Promise<SaturnDistrictCatalogResponse> {
    return this.directory.list();
  }
  refreshDistricts(
    initiator: `${SaturnRequestInitiator}` = SaturnRequestInitiator.Admin,
  ): Promise<SaturnDistrictCatalogResponse> {
    return this.directory.refresh(initiator);
  }
  districtPoints(districtId: number): Promise<SaturnDistrictPointsResponse> {
    return this.stored.districtPoints(districtId);
  }
  storedFields(requestHash: string): Promise<SaturnStoredFieldsResponse> {
    return this.stored.requestFields(requestHash);
  }
  requestLog(): Promise<SaturnRequestLogResponse> {
    return this.journal.list();
  }
  history(): Promise<ViewportCacheHistoryResponse> {
    return listViewportCacheHistory(this.pool);
  }

  /** Read a persisted filter checkpoint and a bounded sample without upstream I/O. */
  async status(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult> {
    const { key } = await this.key(selection);
    const progress = await this.index.getStatus(key);
    return this.snapshot(key, progress);
  }

  private async snapshot(
    key: ViewportIndexKey,
    progress: ViewportCollectionResult["progress"],
  ): Promise<ViewportCollectionResult> {
    return {
      enabled: this.enabled,
      progress,
      cachedCenters: progress
        ? await this.index.listFeatures(key, SATURN_INDEX_PREVIEW_LIMIT)
        : [],
    };
  }

  /**
   * Explicitly fetch at most one next map-index page. A completed filter returns
   * cached evidence; a new page first passes the shared audit/throttle gate,
   * then source validation, then an atomic page/checkpoint database commit.
   * This never retrieves treatment detail or performs a district-wide scan.
   */
  async fetchNext(
    selection: ViewportCollectionSelection,
    initiator: `${SaturnRequestInitiator}` = SaturnRequestInitiator.Admin,
  ): Promise<ViewportCollectionResult> {
    if (!this.enabled) {
      throw new ApiFailure(
        409,
        "SATURN_VIEWPORT_DISABLED",
        "Explicit Saturn viewport access is disabled",
      );
    }
    const { key, name } = await this.key(selection);
    const previous = await this.index.getStatus(key);
    const pageNumber = previous?.nextPage ?? 0;
    const requestHash =
      previous?.requestHash ??
      createHash("sha256")
        .update(JSON.stringify(key.firstPageRequest))
        .digest("hex");
    return executeAuditedSourceRequest<
      RequestAttempt,
      ViewportCollectionResult
    >({
      sourceId: SATURN_SOURCE_ID,
      attempt: {
        action: SaturnRequestAction.ViewportPage,
        initiator,
        districtId: selection.districtId,
        requestHash,
        pageNumber: pageNumber ?? undefined,
      },
      gate: this.gate,
      journal: this.journal,
      preflight: async () => {
        if (previous?.state === SaturnViewportState.Complete) {
          return {
            kind: "cache_hit" as const,
            value: await this.snapshot(key, previous),
          };
        }
        if (previous && !previous.sourceRevisionCurrent) {
          throw new ApiFailure(
            409,
            "SOURCE_CHANGED",
            "Provider configuration has changed",
          );
        }
        if (pageNumber >= SATURN_MAX_VIEWPORT_PAGES) {
          throw new ApiFailure(
            409,
            "VIEWPORT_PAGE_LIMIT",
            "Viewport page limit reached",
          );
        }
        return { kind: "proceed" as const };
      },
      perform: async () => {
        const captured = await this.pageFetcher.fetch(
          name,
          key.firstPageRequest,
          pageNumber,
        );
        const progress = await this.index.appendCapturedPage(
          key,
          captured.body,
        );
        return {
          value: await this.snapshot(key, progress),
          receivedCount: captured.receivedCount,
        };
      },
      classifyFailure: (error) => {
        const code =
          error instanceof ApiFailure ? error.code : "VIEWPORT_STORE_FAILED";
        return {
          error,
          code,
          outcome:
            code === "SOURCE_THROTTLED"
              ? SaturnRequestOutcome.Throttled
              : SaturnRequestOutcome.Failed,
        };
      },
    });
  }
}
