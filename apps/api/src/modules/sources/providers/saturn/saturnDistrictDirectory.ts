// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  saturnDistrictCatalogResponseSchema,
  type SaturnDistrictCatalogResponse,
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
  SATURN_DISTRICT_URL,
  SATURN_SOURCE_ID,
  saturnJsonSource,
} from "./sourceProfile.js";
import { SATURN_JSON_PROFILE_ID } from "./requestProfile.js";

export type DirectoryPort = {
  list(): Promise<SaturnDistrictCatalogResponse>;
  refresh(initiator: "web" | "admin"): Promise<SaturnDistrictCatalogResponse>;
  includes(districtId: number): Promise<boolean>;
};

/** Read cached provider district centers; only refresh on an explicit action. */
export class SaturnDistrictDirectory implements DirectoryPort {
  private readonly fetcher: Pick<RestrictedSourceFetcher, "fetch">;
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
    this.fetcher =
      deps.fetcher ??
      new RestrictedSourceFetcher({
        requestProfiles: this.provider.requestProfiles,
      });
    this.gate = deps.gate ?? new ProviderRequestThrottle(db as Pool);
    this.journal = deps.journal ?? new SaturnRequestJournal(db);
  }

  async list(): Promise<SaturnDistrictCatalogResponse> {
    const result = await this.db.query<{
      catalog: unknown;
      retrieved_at: Date;
    }>(
      `SELECT catalog, retrieved_at FROM source_saturn_district_catalog
       WHERE source_id=$1`,
      [SATURN_SOURCE_ID],
    );
    const row = result.rows[0];
    return saturnDistrictCatalogResponseSchema.parse({
      enabled: this.enabled,
      districts: row ? this.provider.parseDirectory(row.catalog) : [],
      retrievedAt: row?.retrieved_at.toISOString() ?? null,
    });
  }

  async includes(districtId: number): Promise<boolean> {
    const result = await this.list();
    return result.districts.some((district) => district.id === districtId);
  }

  async refresh(
    initiator: "web" | "admin",
  ): Promise<SaturnDistrictCatalogResponse> {
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
    if (!row || row.kind !== "treatment" || row.lifecycle !== "configured") {
      throw new ApiFailure(
        409,
        "SATURN_VIEWPORT_NOT_CONFIGURED",
        "Saturn source is not configured",
      );
    }
    return executeAuditedSourceRequest({
      sourceId: SATURN_SOURCE_ID,
      attempt: { action: "district_directory", initiator },
      gate: this.gate,
      journal: this.journal,
      perform: async () => {
        const reply = await this.fetcher.fetch(
          saturnJsonSource(row.name, "/backend/beemaster/district/55"),
          {
            url: SATURN_DISTRICT_URL,
            method: "GET",
            requestProfile: SATURN_JSON_PROFILE_ID,
          },
        );
        const raw = JSON.parse(reply.bytes.toString("utf8")) as unknown;
        const districts = this.provider.parseDirectory(raw);
        if (districts.length === 0) throw new Error("Empty district directory");
        const json = JSON.stringify(districts);
        await this.db.query(
          `INSERT INTO source_saturn_district_catalog
           (source_id, source_revision, subject_code, catalog, catalog_sha256, retrieved_at)
           VALUES ($1,$2,'55',$3::jsonb,$4,now())
           ON CONFLICT (source_id) DO UPDATE SET source_revision=EXCLUDED.source_revision,
            catalog=EXCLUDED.catalog, catalog_sha256=EXCLUDED.catalog_sha256, retrieved_at=now()`,
          [
            SATURN_SOURCE_ID,
            row.registry_revision,
            json,
            createHash("sha256").update(json).digest("hex"),
          ],
        );
        return { value: await this.list(), receivedCount: districts.length };
      },
      classifyFailure: (error) => {
        if (error instanceof ApiFailure) {
          return {
            error,
            code: error.code,
            outcome: error.code === "SOURCE_THROTTLED" ? "throttled" : "failed",
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
          outcome: "failed" as const,
        };
      },
    });
  }
}
