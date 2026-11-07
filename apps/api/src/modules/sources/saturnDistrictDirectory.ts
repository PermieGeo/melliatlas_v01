// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import {
  saturnDistrictCatalogResponseSchema,
  type SaturnDistrictCatalogResponse,
} from "@melliatlas/contracts";
import { ApiFailure } from "../../lib/errors.js";
import { RestrictedSourceFetcher, SourceFetchFailure } from "./httpFetcher.js";
import { parseSaturnDistrictCatalog } from "./saturnMapEvidence.js";
import {
  ProviderRequestThrottle,
  type ProviderRequestGate,
} from "./providerRequestThrottle.js";
import { SaturnRequestJournal } from "./saturnRequestJournal.js";
import {
  SATURN_DISTRICT_URL,
  SATURN_SOURCE_ID,
  saturnJsonSource,
} from "./providers/saturn/sourceProfile.js";
import {
  SATURN_JSON_PROFILE_ID,
  SATURN_JSON_REQUEST_PROFILE,
} from "./providers/saturn/requestProfile.js";

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

  constructor(
    private readonly db: Pick<Pool, "query">,
    private readonly enabled: boolean,
    deps: {
      fetcher?: Pick<RestrictedSourceFetcher, "fetch">;
      gate?: ProviderRequestGate;
      journal?: Pick<SaturnRequestJournal, "start" | "finish">;
    } = {},
  ) {
    this.fetcher =
      deps.fetcher ??
      new RestrictedSourceFetcher({
        requestProfiles: [SATURN_JSON_REQUEST_PROFILE],
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
      districts: row ? parseSaturnDistrictCatalog(row.catalog) : [],
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
    const auditId = await this.journal.start({
      action: "district_directory",
      initiator,
    });
    try {
      if (!(await this.gate.reserve(SATURN_SOURCE_ID))) {
        await this.journal.finish(auditId, "throttled", 0, "SOURCE_THROTTLED");
        throw new ApiFailure(
          429,
          "SOURCE_THROTTLED",
          "Provider cooldown is active",
        );
      }
      const reply = await this.fetcher.fetch(
        saturnJsonSource(row.name, "/backend/beemaster/district/55"),
        {
          url: SATURN_DISTRICT_URL,
          method: "GET",
          requestProfile: SATURN_JSON_PROFILE_ID,
        },
      );
      const raw = JSON.parse(reply.bytes.toString("utf8")) as unknown;
      const districts = parseSaturnDistrictCatalog(raw);
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
      await this.journal.finish(auditId, "succeeded", districts.length);
      return this.list();
    } catch (error) {
      if (!(error instanceof ApiFailure && error.code === "SOURCE_THROTTLED")) {
        await this.journal.finish(
          auditId,
          "failed",
          0,
          error instanceof SourceFetchFailure
            ? error.code
            : "DISTRICT_DIRECTORY_FAILED",
        );
      }
      if (error instanceof ApiFailure) throw error;
      throw new ApiFailure(
        502,
        "DISTRICT_DIRECTORY_FAILED",
        "Cannot load Saturn district directory",
      );
    }
  }
}
