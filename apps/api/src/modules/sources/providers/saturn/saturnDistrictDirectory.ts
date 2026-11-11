// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  saturnDistrictCatalogResponseSchema,
  saturnRegionCatalogResponseSchema,
  type SaturnDistrictCatalogResponse,
  type SaturnRegionCatalogResponse,
} from "@melliatlas/contracts";
import { ApiFailure } from "../../../../lib/errors.js";
import { executeAuditedSourceRequest } from "../../auditedSourceRequest.js";
import {
  RestrictedSourceFetcher,
  SourceFetchFailure,
} from "../../httpFetcher.js";
import type { DistrictDirectoryProvider } from "../../providerPorts.js";
import type { SaturnDistrict } from "./saturnMapEvidence.js";
import { SaturnProvider } from "./SaturnProvider.js";
import {
  ProviderRequestThrottle,
  type ProviderRequestGate,
} from "../../providerRequestThrottle.js";
import { SaturnRequestJournal } from "./saturnRequestJournal.js";
import {
  SATURN_SOURCE_ID,
  SaturnRequestAction,
  SaturnRequestInitiator,
  SaturnRequestOutcome,
  SaturnSourceKind,
  SaturnSourceLifecycle,
  saturnJsonSource,
  saturnDistrictPath,
  saturnDistrictUrl,
} from "./sourceProfile.js";
import {
  SATURN_JSON_PROFILE_ID,
  saturnDirectoryRequestProfile,
} from "./requestProfile.js";

export type DirectoryPort = {
  regions(): Promise<SaturnRegionCatalogResponse>;
  includesRegion(regionCode: string): Promise<boolean>;
  list(regionCode: string): Promise<SaturnDistrictCatalogResponse>;
  refresh(
    regionCode: string,
    initiator: `${SaturnRequestInitiator}`,
  ): Promise<SaturnDistrictCatalogResponse>;
  includes(regionCode: string, districtId: number): Promise<boolean>;
};

/** Read cached provider district centers; only refresh on an explicit action. */
export class SaturnDistrictDirectory implements DirectoryPort {
  private readonly fetcher?: Pick<RestrictedSourceFetcher, "fetch">;
  private readonly gate: ProviderRequestGate;
  private readonly journal: Pick<SaturnRequestJournal, "start" | "finish">;
  private readonly provider: DistrictDirectoryProvider<SaturnDistrict>;

  constructor(
    private readonly db: Pick<Pool, "query">,
    private readonly enabled: boolean,
    deps: {
      fetcher?: Pick<RestrictedSourceFetcher, "fetch">;
      gate?: ProviderRequestGate;
      journal?: Pick<SaturnRequestJournal, "start" | "finish">;
      provider?: DistrictDirectoryProvider<SaturnDistrict>;
    } = {},
  ) {
    this.provider = deps.provider ?? new SaturnProvider();
    this.fetcher = deps.fetcher;
    this.gate = deps.gate ?? new ProviderRequestThrottle(db as Pool);
    this.journal = deps.journal ?? new SaturnRequestJournal(db);
  }

  /** The only supported live regions are explicitly registered in PostgreSQL. */
  async regions(): Promise<SaturnRegionCatalogResponse> {
    const result = await this.db.query<{
      subject_code: string;
      display_name: string;
    }>(
      `SELECT subject_code, display_name FROM source_saturn_regions ORDER BY display_name, subject_code LIMIT 256`,
    );
    return saturnRegionCatalogResponseSchema.parse({
      regions: result.rows.map((row) => ({
        code: row.subject_code,
        name: row.display_name,
      })),
    });
  }

  async includesRegion(regionCode: string): Promise<boolean> {
    const result = await this.db.query<{ subject_code: string }>(
      `SELECT subject_code FROM source_saturn_regions WHERE subject_code=$1`,
      [regionCode],
    );
    return result.rows.length > 0;
  }

  /** Return previously saved names and center coordinates for one region; never fetch online. */
  async list(regionCode: string): Promise<SaturnDistrictCatalogResponse> {
    await this.requireRegion(regionCode);
    const result = await this.db.query<{
      catalog: unknown;
      retrieved_at: Date;
    }>(
      `SELECT catalog, retrieved_at FROM source_saturn_district_catalog
       WHERE source_id=$1 AND subject_code=$2`,
      [SATURN_SOURCE_ID, regionCode],
    );
    const row = result.rows[0];
    return saturnDistrictCatalogResponseSchema.parse({
      regionCode,
      enabled: this.enabled,
      districts: row ? this.provider.parseDirectory(row.catalog) : [],
      retrievedAt: row?.retrieved_at.toISOString() ?? null,
    });
  }

  async includes(regionCode: string, districtId: number): Promise<boolean> {
    const result = await this.list(regionCode);
    return result.districts.some((district) => district.id === districtId);
  }

  private async requireRegion(regionCode: string): Promise<void> {
    if (
      !/^[1-9][0-9]{0,5}$/.test(regionCode) ||
      !(await this.includesRegion(regionCode))
    ) {
      throw new ApiFailure(
        400,
        "REGION_NOT_REGISTERED",
        "Select a registered Saturn region",
      );
    }
  }

  /**
   * One explicitly approved directory request runs through the source-wide
   * audit and throttle. The resulting catalog is a list of provider centers,
   * not administrative polygons or verified coverage of any district.
   */
  async refresh(
    regionCode: string,
    initiator: `${SaturnRequestInitiator}`,
  ): Promise<SaturnDistrictCatalogResponse> {
    await this.requireRegion(regionCode);
    if (!this.enabled)
      throw new ApiFailure(
        409,
        "SATURN_VIEWPORT_DISABLED",
        "Saturn access is disabled",
      );
    const source = await this.db.query<{
      name: string;
      registry_revision: string;
      kind: string;
      lifecycle: string;
    }>(
      `SELECT name, registry_revision::text, kind, lifecycle FROM source_catalog WHERE id=$1`,
      [SATURN_SOURCE_ID],
    );
    const row = source.rows[0];
    if (
      !row ||
      row.kind !== SaturnSourceKind.Treatment ||
      row.lifecycle !== SaturnSourceLifecycle.Configured
    ) {
      throw new ApiFailure(
        409,
        "SATURN_VIEWPORT_NOT_CONFIGURED",
        "Saturn source is not configured",
      );
    }
    return executeAuditedSourceRequest({
      sourceId: SATURN_SOURCE_ID,
      attempt: {
        action: SaturnRequestAction.DistrictDirectory,
        initiator,
        regionCode,
      },
      gate: this.gate,
      journal: this.journal,
      perform: async () => {
        const path = saturnDistrictPath(regionCode);
        const url = saturnDistrictUrl(regionCode);
        const fetcher =
          this.fetcher ??
          new RestrictedSourceFetcher({
            requestProfiles: [saturnDirectoryRequestProfile(url)],
          });
        const reply = await fetcher.fetch(saturnJsonSource(row.name, path), {
          url,
          method: "GET",
          requestProfile: SATURN_JSON_PROFILE_ID,
        });
        const raw = JSON.parse(reply.bytes.toString("utf8")) as unknown;
        const districts = this.provider.parseDirectory(raw);
        if (districts.length === 0) throw new Error("Empty district directory");
        const json = JSON.stringify(districts);
        await this.db.query(
          `INSERT INTO source_saturn_district_catalog
           (source_id, source_revision, subject_code, catalog, catalog_sha256, retrieved_at)
           VALUES ($1,$2,$3,$4::jsonb,$5,now())
           ON CONFLICT (source_id, subject_code) DO UPDATE SET source_revision=EXCLUDED.source_revision,
            catalog=EXCLUDED.catalog, catalog_sha256=EXCLUDED.catalog_sha256, retrieved_at=now()`,
          [
            SATURN_SOURCE_ID,
            row.registry_revision,
            regionCode,
            json,
            createHash("sha256").update(json).digest("hex"),
          ],
        );
        return {
          value: await this.list(regionCode),
          receivedCount: districts.length,
        };
      },
      classifyFailure: (error) => {
        if (error instanceof ApiFailure) {
          return {
            error,
            code: error.code,
            outcome:
              error.code === "SOURCE_THROTTLED"
                ? SaturnRequestOutcome.Throttled
                : SaturnRequestOutcome.Failed,
          };
        }
        return {
          error: new ApiFailure(
            502,
            "DISTRICT_DIRECTORY_FAILED",
            "Cannot load Saturn district directory",
          ),
          code:
            error instanceof SourceFetchFailure
              ? error.code
              : "DISTRICT_DIRECTORY_FAILED",
          outcome: SaturnRequestOutcome.Failed,
        };
      },
    });
  }
}
