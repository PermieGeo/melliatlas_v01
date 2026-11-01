// Feature IDs: SOURCES.CATALOG
import {
  sourceCatalogResponseSchema,
  type SourceCatalogEntry,
} from "@melliatlas/contracts";
import type { Pool } from "pg";

type SourceRow = {
  id: string;
  name: string;
  kind: SourceCatalogEntry["kind"];
  lifecycle: SourceCatalogEntry["lifecycle"];
  url: string;
  terms_review: SourceCatalogEntry["termsReview"];
  last_successful_ingest_at: Date | null;
};

export class SourceRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<SourceCatalogEntry[]> {
    const result = await this.pool.query<SourceRow>(
      "SELECT id, name, kind, lifecycle, url, terms_review, last_successful_ingest_at FROM source_catalog WHERE disabled_reason IS DISTINCT FROM 'superseded-by-configurable-provider' ORDER BY name",
    );
    return sourceCatalogResponseSchema.parse({
      sources: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        lifecycle: row.lifecycle,
        url: row.url,
        termsReview: row.terms_review,
        lastSuccessfulIngestAt:
          row.last_successful_ingest_at?.toISOString() ?? null,
      })),
    }).sources;
  }
}
