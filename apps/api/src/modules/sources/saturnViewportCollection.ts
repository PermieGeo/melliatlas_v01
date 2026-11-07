// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import { z } from "zod";
import type { Pool } from "pg";
import {
  viewportCollectionSelectionSchema,
  type ViewportCollectionResult,
  type ViewportCollectionSelection,
  type ViewportCacheHistoryResponse,
  type SaturnDistrictCatalogResponse,
  type SaturnDistrictPointsResponse,
  type SaturnStoredFieldsResponse,
  type SaturnRequestLogResponse,
} from "@melliatlas/contracts";
import { ApiFailure } from "../../lib/errors.js";
import { RestrictedSourceFetcher, SourceFetchFailure } from "./httpFetcher.js";
import {
  ProviderRequestThrottle,
  type ProviderRequestGate,
} from "./providerRequestThrottle.js";
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
  type RequestOutcome,
} from "./saturnRequestJournal.js";
import { SaturnStoredIndex } from "./saturnStoredIndex.js";
import {
  SATURN_SOURCE_ID,
  SATURN_VIEWPORT_URL,
  saturnJsonSource,
} from "./providers/saturn/sourceProfile.js";
import {
  SATURN_JSON_PROFILE_ID,
  SATURN_JSON_REQUEST_PROFILE,
} from "./providers/saturn/requestProfile.js";
import {
  parseSaturnViewportPage,
  validateSaturnViewportQuery,
  type SaturnViewportQuery,
} from "./saturnViewportQuery.js";

const CONFIGURED_ENDPOINTS = new Set([
  "https://bee-saturn.ru/backend/beemaster/planapplybees",
  SATURN_VIEWPORT_URL,
]);
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

/** Request shape is a viewport index, never a treatment or whole-district query. */
export function makeViewportFirstRequest(
  selection: ViewportCollectionSelection,
): SaturnViewportQuery {
  const parsed = viewportCollectionSelectionSchema.parse(selection);
  return validateSaturnViewportQuery({
    filter: {
      leftTop: { longitude: parsed.bbox.west, latitude: parsed.bbox.north },
      rightDown: { longitude: parsed.bbox.east, latitude: parsed.bbox.south },
      subject: "55",
      district: String(parsed.districtId),
      startDateUpdateMap: `${parsed.fromDate}T00:00:00.000Z`,
      endDateUpdateMap: `${parsed.toDate}T00:00:00.000Z`,
      culture: [],
      classesDangerBee: [],
      classesDangerMan: [],
      query: null,
    },
    pageNumber: 0,
    pageSize: 10,
  });
}

/** Explicit one-page collector; all inspection methods read PostgreSQL only. */
export class SaturnViewportCollectionService {
  private readonly index: IndexPort;
  private readonly fetcher: FetchPort;
  private readonly gate: ProviderRequestGate;
  private readonly directory: DirectoryPort;
  private readonly journal: JournalPort;
  private readonly stored: StoredPort;

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
    } = {},
  ) {
    this.index =
      dependencies.index ?? new SaturnViewportIndexRepository(pool as Pool);
    this.fetcher =
      dependencies.fetcher ??
      new RestrictedSourceFetcher({
        requestProfiles: [SATURN_JSON_REQUEST_PROFILE],
      });
    this.gate = dependencies.gate ?? new ProviderRequestThrottle(pool as Pool);
    this.journal = dependencies.journal ?? new SaturnRequestJournal(pool);
    this.directory =
      dependencies.directory ??
      new SaturnDistrictDirectory(pool, enabled, {
        fetcher: this.fetcher,
        gate: this.gate,
        journal: this.journal,
      });
    this.stored = dependencies.stored ?? new SaturnStoredIndex(pool);
  }

  private async key(
    selection: ViewportCollectionSelection,
  ): Promise<{ key: ViewportIndexKey; name: string }> {
    const firstPageRequest = makeViewportFirstRequest(selection);
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
      source.kind !== "treatment" ||
      source.lifecycle !== "configured" ||
      !CONFIGURED_ENDPOINTS.has(source.url) ||
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
      selection.districtId !== 1477 &&
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
    initiator: "web" | "admin" = "admin",
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

  async status(
    selection: ViewportCollectionSelection,
  ): Promise<ViewportCollectionResult> {
    const { key } = await this.key(selection);
    const progress = await this.index.getStatus(key);
    return {
      enabled: this.enabled,
      progress,
      cachedCenters: progress ? await this.index.listFeatures(key, 100) : [],
    };
  }

  /** A cache hit and each attempted external call are auditable without storing user identity. */
  async fetchNext(
    selection: ViewportCollectionSelection,
    initiator: "web" | "admin" = "admin",
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
    const auditId = await this.journal.start({
      action: "viewport_page",
      initiator,
      districtId: selection.districtId,
      requestHash,
      pageNumber: pageNumber ?? undefined,
    });
    let outcome: RequestOutcome = "failed";
    let records = 0;
    let errorCode: string | undefined;
    try {
      if (previous?.state === "viewport_index_complete") {
        outcome = "cache_hit";
        return {
          enabled: true,
          progress: previous,
          cachedCenters: await this.index.listFeatures(key, 100),
        };
      }
      if (previous && !previous.sourceRevisionCurrent) {
        throw new ApiFailure(
          409,
          "SOURCE_CHANGED",
          "Provider configuration has changed",
        );
      }
      if (pageNumber >= 2000) {
        throw new ApiFailure(
          409,
          "VIEWPORT_PAGE_LIMIT",
          "Viewport page limit reached",
        );
      }
      if (!(await this.gate.reserve(SATURN_SOURCE_ID))) {
        throw new ApiFailure(
          429,
          "SOURCE_THROTTLED",
          "Provider request cooldown is active",
        );
      }
      const request = validateSaturnViewportQuery({
        ...key.firstPageRequest,
        pageNumber,
      });
      let body: unknown;
      try {
        const response = await this.fetcher.fetch(
          saturnJsonSource(name, "/backend/beemaster/query"),
          {
            url: SATURN_VIEWPORT_URL,
            method: "POST",
            body: JSON.stringify(request),
            requestProfile: SATURN_JSON_PROFILE_ID,
          },
        );
        body = JSON.parse(response.bytes.toString("utf8")) as unknown;
        records = parseSaturnViewportPage(body, request).entries.length;
      } catch (error) {
        if (error instanceof SourceFetchFailure) {
          throw new ApiFailure(
            error.code === "RATE_LIMITED" ? 429 : 502,
            error.code === "RATE_LIMITED"
              ? "SOURCE_THROTTLED"
              : "SOURCE_UNAVAILABLE",
            "Unable to retrieve the requested Saturn page",
          );
        }
        throw new ApiFailure(
          502,
          "INVALID_SOURCE_RESPONSE",
          "Saturn returned an invalid map-index page",
        );
      }
      const progress = await this.index.appendCapturedPage(key, body);
      outcome = "succeeded";
      return {
        enabled: true,
        progress,
        cachedCenters: await this.index.listFeatures(key, 100),
      };
    } catch (error) {
      errorCode =
        error instanceof ApiFailure ? error.code : "VIEWPORT_STORE_FAILED";
      outcome = errorCode === "SOURCE_THROTTLED" ? "throttled" : "failed";
      throw error;
    } finally {
      await this.journal.finish(
        auditId,
        outcome,
        outcome === "succeeded" ? records : 0,
        errorCode,
      );
    }
  }
}
