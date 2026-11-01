// Feature IDs: SOURCES.DOCUMENT_HISTORY, NOTICES.EXTRACTION, NOTICES.MAP_OVERLAY, NOTICES.SPATIAL_PRECISION
import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { ApiFailure } from "../../lib/errors.js";
import {
  parseBeekeeperPlanPage,
  type BeekeeperPlan,
} from "./beekeeperPlanPage.js";
import { RestrictedSourceFetcher, SourceFetchFailure } from "./httpFetcher.js";
import { validateProviderEndpoint } from "./providerConfiguration.js";
import { buildProviderRequest } from "./providerConfiguration.js";
import { sourceDefinitionSchema, type SourceDefinition } from "./contracts.js";
import {
  providerCollectionStatusSchema,
  providerRequestSettingsSchema,
  type ProviderCollectionStatus,
} from "@melliatlas/contracts";

const SOURCE_ID = "treatment-feed";
export type MapTreatment = {
  id: string;
  sourceName: string;
  sourceUrl: string;
  retrievedAt: string;
  publishedAt: string | null;
  startAt: string | null;
  endAt: string | null;
  contractorName: string | null;
  cadastralNumber: string | null;
  treatments: BeekeeperPlan["treatments"];
  geometry: NonNullable<BeekeeperPlan["geometry"]>;
  spatialPrecision: "exact_polygon";
  reviewStatus?: "pending" | "verified";
};

const geometrySchema = z
  .object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.unknown(),
  })
  .passthrough();

/** Geographic validation before PostGIS topology checks; never substitute a guessed centroid. */
export function safePlanGeometry(
  input: BeekeeperPlan["geometry"],
): NonNullable<BeekeeperPlan["geometry"]> | null {
  if (!input || !geometrySchema.safeParse(input).success) return null;
  const rings: unknown[][] =
    input.type === "Polygon" ? input.coordinates : input.coordinates.flat();
  let points = 0;
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) return null;
    points += ring.length;
    if (
      points > 5000 ||
      JSON.stringify(ring[0]) !== JSON.stringify(ring[ring.length - 1])
    )
      return null;
  }
  if (rings.length > 150 || JSON.stringify(input).length > 150_000) return null;
  return input;
}

type ConnectionRow = {
  api_request_config: unknown;
  registry_revision: string;
  name: string;
  kind: string;
  lifecycle: string;
  url: string;
  source_cursor: { pageNumber?: number } | null;
};

const connectionSchema = z
  .object({
    endpoint: z.string().url(),
    request: providerRequestSettingsSchema,
  })
  .strict();

export class TreatmentIngestionService {
  constructor(
    private readonly pool: Pool,
    private readonly fetcher: Pick<
      RestrictedSourceFetcher,
      "fetch"
    > = new RestrictedSourceFetcher(),
  ) {}

  /** Build a narrow, operator-controlled fetch registration from the persisted endpoint. */
  private configuredSource(row: ConnectionRow): SourceDefinition {
    if (row.lifecycle !== "configured" || row.kind !== "treatment") {
      throw new ApiFailure(
        409,
        "SOURCE_NOT_CONFIGURED",
        "Configure the treatment source before fetching",
      );
    }
    const connection = connectionSchema.parse(row.api_request_config);
    const endpoint = validateProviderEndpoint(connection.endpoint);
    if (row.url !== endpoint) {
      throw new ApiFailure(
        409,
        "SOURCE_CHANGED",
        "Source endpoint is inconsistent",
      );
    }
    const url = new URL(endpoint);
    return sourceDefinitionSchema.parse({
      id: SOURCE_ID,
      name: row.name,
      kind: "treatment",
      enabled: true,
      locations: [
        {
          hostname: url.hostname,
          pathPrefixes: [url.pathname.replace(/\/$/, "") || "/"],
        },
      ],
      review: { decision: "configured" },
      parserVersion: "beekeeper-plan-v1",
      fetchPolicy: {
        timeoutMs: 8000,
        maxResponseBytes: 2_000_000,
        minIntervalMs: 60_000,
        maxRedirects: 0,
        maxRetries: 1,
        allowedContentTypes: ["application/json"],
      },
    });
  }

  async syncOnePage(): Promise<{
    runId: string;
    pageNumber: number;
    received: number;
    stored: number;
    nextPage: number;
  }> {
    const client = await this.pool.connect();
    let locked = false;
    let runId: string | undefined;
    try {
      const result = await client.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_lock(hashtext('melliatlas_treatment_ingestion')) AS acquired",
      );
      if (!result.rows[0]?.acquired)
        throw new ApiFailure(
          409,
          "INGEST_BUSY",
          "Another ingestion is running",
        );
      locked = true;
      const row = await client.query<ConnectionRow>(
        "SELECT name, kind, lifecycle, url, api_request_config, registry_revision, source_cursor FROM source_catalog WHERE id=$1",
        [SOURCE_ID],
      );
      if (!row.rows[0]) {
        throw new ApiFailure(
          404,
          "PROVIDER_NOT_CONFIGURED",
          "Source not configured",
        );
      }
      const source = this.configuredSource(row.rows[0]);
      const revision = row.rows[0].registry_revision;
      const connection = connectionSchema.parse(
        row.rows[0]?.api_request_config,
      );
      const size = connection.request.parameters.pageSize;
      if (!Number.isInteger(size) || Number(size) < 1 || Number(size) > 100) {
        throw new ApiFailure(
          400,
          "UNSUPPORTED_PAGINATION",
          "Configure a pageSize between 1 and 100",
        );
      }
      const pageNumber = Math.max(
        0,
        Math.min(100000, Number(row.rows[0]?.source_cursor?.pageNumber ?? 0)),
      );
      const request = buildProviderRequest(connection.endpoint, {
        ...connection.request,
        parameters: { ...connection.request.parameters, pageNumber },
      });
      const started = await client.query<{ id: string }>(
        "INSERT INTO ingestion_runs(source_id, status) VALUES($1, 'started') RETURNING id",
        [SOURCE_ID],
      );
      runId = started.rows[0].id;
      try {
        const response = await this.fetcher.fetch(source, request);
        let page: ReturnType<typeof parseBeekeeperPlanPage>;
        try {
          page = parseBeekeeperPlanPage(
            JSON.parse(response.bytes.toString("utf8")),
          );
        } catch (error) {
          // Log only schema issue paths and codes, never upstream record contents.
          const issuePaths =
            error instanceof z.ZodError
              ? error.issues.slice(0, 5).map((issue) => ({
                  path: issue.path
                    .map((part) =>
                      typeof part === "number" ? "[]" : String(part),
                    )
                    .join("."),
                  code: issue.code,
                }))
              : [];
          console.error("Treatment provider page validation failed", {
            reason:
              error instanceof SyntaxError
                ? "INVALID_JSON"
                : error instanceof z.ZodError
                  ? "SCHEMA_MISMATCH"
                  : "PARSER_ERROR",
            issuePaths,
          });
          throw new ApiFailure(
            502,
            "INVALID_SOURCE_RESPONSE",
            "Source returned an unsupported JSON page",
          );
        }
        const hash = createHash("sha256").update(response.bytes).digest("hex");
        const nextPage =
          page.plans.length === 0 ||
          page.plans.length < Number(size) ||
          (page.totalElements !== null &&
            (pageNumber + 1) * Number(size) >= page.totalElements)
            ? 0
            : pageNumber + 1;
        await client.query("BEGIN");
        const registry = await client.query<{
          registry_revision: string;
          lifecycle: string;
          url: string;
        }>(
          "SELECT registry_revision, lifecycle, url FROM source_catalog WHERE id=$1 FOR UPDATE",
          [SOURCE_ID],
        );
        if (
          registry.rows[0]?.registry_revision !== revision ||
          registry.rows[0]?.lifecycle !== "configured" ||
          registry.rows[0]?.url !== connection.endpoint
        ) {
          throw new ApiFailure(
            409,
            "SOURCE_CHANGED",
            "Source configuration changed during collection",
          );
        }
        const document = await client.query<{ id: string }>(
          `WITH inserted AS (
             INSERT INTO source_documents(source_id, ingestion_run_id, canonical_url, retrieved_at,
               content_hash_sha256, content_type, raw_json)
             VALUES($1,$2,$3,now(),$4,$5,$6::jsonb)
             ON CONFLICT(source_id, canonical_url, content_hash_sha256) DO NOTHING RETURNING id
           ) SELECT id FROM inserted UNION ALL
           SELECT id FROM source_documents WHERE source_id=$1 AND canonical_url=$3 AND content_hash_sha256=$4 LIMIT 1`,
          [
            SOURCE_ID,
            runId,
            response.canonicalUrl,
            hash,
            response.contentType,
            response.bytes.toString("utf8"),
          ],
        );
        const documentId = document.rows[0]?.id;
        if (!documentId) throw new Error("Source document insert failed");
        let stored = 0;
        for (const [index, plan] of page.plans.entries()) {
          const geometry = safePlanGeometry(plan.geometry);
          // SQL enforces valid polygon topology; rejected geometry remains text-only evidence.
          let valid = false;
          if (geometry) {
            await client.query("SAVEPOINT source_geometry_validation");
            try {
              const candidate = await client.query<{ valid: boolean }>(
                "SELECT ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($1),4326)) AS valid",
                [JSON.stringify(geometry)],
              );
              valid = candidate.rows[0]?.valid === true;
            } catch {
              // A malformed upstream geometry must not abort the remaining transaction.
              await client.query(
                "ROLLBACK TO SAVEPOINT source_geometry_validation",
              );
            } finally {
              await client.query(
                "RELEASE SAVEPOINT source_geometry_validation",
              );
            }
          }
          const attrs = {
            recordIndex: index,
            sourceName: source.name,
            externalId: plan.externalId,
            contractorName: plan.contractorName,
            cadastralNumber: plan.cadastralNumber,
            treatments: plan.treatments,
            evidenceState: "unreviewed",
          };
          const inserted = await client.query(
            `INSERT INTO source_observations(source_document_id, observation_type, start_at, end_at,
               geometry, spatial_precision, extraction_method, review_status, attributes)
             VALUES($1, 'treatment_plan', $2, $3,
               CASE WHEN $4::boolean THEN ST_SetSRID(ST_GeomFromGeoJSON($5),4326) ELSE NULL END,
               CASE WHEN $4::boolean THEN 'exact_polygon' ELSE 'text_only' END,
               'structured', 'pending', $6::jsonb)
             ON CONFLICT DO NOTHING`,
            [
              documentId,
              plan.startAt,
              plan.endAt,
              valid,
              valid ? JSON.stringify(geometry) : null,
              JSON.stringify(attrs),
            ],
          );
          stored += inserted.rowCount ?? 0;
        }
        await client.query(
          `UPDATE ingestion_runs SET status='succeeded', completed_at=now(), discovered_count=$2,
             accepted_count=$3, rejected_count=$4 WHERE id=$1`,
          [runId, page.plans.length, stored, page.plans.length - stored],
        );
        await client.query(
          `UPDATE source_catalog SET last_successful_ingest_at=now(), source_cursor=$2::jsonb WHERE id=$1`,
          [SOURCE_ID, JSON.stringify({ pageNumber: nextPage })],
        );
        await client.query("COMMIT");
        return {
          runId,
          pageNumber,
          received: page.plans.length,
          stored,
          nextPage,
        };
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        const code =
          error instanceof SourceFetchFailure
            ? error.code
            : error instanceof ApiFailure
              ? error.code
              : "INVALID_UPSTREAM_RESPONSE";
        await client.query(
          "UPDATE ingestion_runs SET status='failed', completed_at=now(), error_code=$2 WHERE id=$1 AND status='started'",
          [runId, code],
        );
        throw error instanceof SourceFetchFailure
          ? new ApiFailure(503, code, "Source fetch unavailable")
          : error;
      }
    } finally {
      if (locked)
        await client.query(
          "SELECT pg_advisory_unlock(hashtext('melliatlas_treatment_ingestion'))",
        );
      client.release();
    }
  }

  /** Read-only operator diagnostics. Empty maps must not conceal missing access, collection or review. */
  async status(): Promise<ProviderCollectionStatus> {
    const result = await this.pool.query<{
      lifecycle: string;
      pending_review: string;
      pending_with_geometry: string;
      verified_with_geometry: string;
      missing_geometry: string;
      run_status: "started" | "succeeded" | "failed" | "partial" | null;
      run_started_at: Date | null;
      run_completed_at: Date | null;
      run_received: number | null;
      run_accepted: number | null;
      run_error_code: string | null;
    }>(
      `SELECT s.lifecycle,
         (SELECT count(*) FROM source_observations o JOIN source_documents d
           ON d.id = o.source_document_id
           WHERE d.source_id = s.id AND o.observation_type = 'treatment_plan'
             AND o.review_status = 'pending') AS pending_review,
         (SELECT count(*) FROM source_observations o JOIN source_documents d
           ON d.id = o.source_document_id
           WHERE d.source_id = s.id AND o.observation_type = 'treatment_plan'
             AND o.review_status = 'pending' AND o.geometry IS NOT NULL) AS pending_with_geometry,
         (SELECT count(*) FROM source_observations o JOIN source_documents d
           ON d.id = o.source_document_id
           WHERE d.source_id = s.id AND o.observation_type = 'treatment_plan'
             AND o.review_status = 'verified' AND o.geometry IS NOT NULL) AS verified_with_geometry,
         (SELECT count(*) FROM source_observations o JOIN source_documents d
           ON d.id = o.source_document_id
           WHERE d.source_id = s.id AND o.observation_type = 'treatment_plan'
             AND o.geometry IS NULL) AS missing_geometry,
         r.status AS run_status, r.started_at AS run_started_at,
         r.completed_at AS run_completed_at, r.discovered_count AS run_received,
         r.accepted_count AS run_accepted, r.error_code AS run_error_code
       FROM source_catalog s
       LEFT JOIN LATERAL (SELECT status, started_at, completed_at, discovered_count,
         accepted_count, error_code FROM ingestion_runs
         WHERE source_id = s.id ORDER BY started_at DESC, id DESC LIMIT 1) r ON TRUE
       WHERE s.id = $1`,
      [SOURCE_ID],
    );
    const row = result.rows[0];
    if (!row)
      throw new ApiFailure(
        404,
        "PROVIDER_NOT_CONFIGURED",
        "Source not configured",
      );
    return providerCollectionStatusSchema.parse({
      sourceConfigured: row.lifecycle === "configured",
      pendingReview: Number(row.pending_review),
      pendingWithGeometry: Number(row.pending_with_geometry),
      verifiedWithGeometry: Number(row.verified_with_geometry),
      missingGeometry: Number(row.missing_geometry),
      latestRun:
        row.run_status === null
          ? null
          : {
              status: row.run_status,
              startedAt: row.run_started_at?.toISOString(),
              completedAt: row.run_completed_at?.toISOString() ?? null,
              received: row.run_received,
              accepted: row.run_accepted,
              errorCode: row.run_error_code,
            },
    });
  }

  async pending(limit = 40): Promise<
    Array<{
      id: string;
      sourceUrl: string;
      retrievedAt: string;
      contractorName: string | null;
      cadastralNumber: string | null;
      geometryAvailable: boolean;
      startAt: string | null;
      endAt: string | null;
      treatments: BeekeeperPlan["treatments"];
    }>
  > {
    const result = await this.pool.query<{
      id: string;
      canonical_url: string;
      retrieved_at: Date;
      start_at: Date | null;
      end_at: Date | null;
      attributes: {
        contractorName?: string;
        cadastralNumber?: string;
        treatments?: BeekeeperPlan["treatments"];
      };
      geometry_available: boolean;
    }>(
      `SELECT o.id, d.canonical_url, d.retrieved_at, o.start_at, o.end_at, o.attributes,
              (o.geometry IS NOT NULL) AS geometry_available
       FROM source_observations o JOIN source_documents d ON d.id=o.source_document_id
       WHERE d.source_id=$1 AND o.review_status='pending' AND o.observation_type='treatment_plan'
       ORDER BY d.retrieved_at DESC, o.id LIMIT $2`,
      [SOURCE_ID, limit],
    );
    return result.rows.map((r) => ({
      id: r.id,
      sourceUrl: r.canonical_url,
      retrievedAt: r.retrieved_at.toISOString(),
      contractorName: r.attributes.contractorName ?? null,
      cadastralNumber: r.attributes.cadastralNumber ?? null,
      geometryAvailable: r.geometry_available,
      startAt: r.start_at?.toISOString() ?? null,
      endAt: r.end_at?.toISOString() ?? null,
      treatments: r.attributes.treatments ?? [],
    }));
  }

  async review(
    id: string,
    decision: "verified" | "rejected",
    reviewer: string,
    evidenceNote: string,
  ): Promise<void> {
    if (!z.string().uuid().safeParse(id).success)
      throw new ApiFailure(
        400,
        "INVALID_OBSERVATION",
        "Invalid observation ID",
      );
    if (
      reviewer.trim().length < 2 ||
      reviewer.length > 120 ||
      evidenceNote.trim().length < 20 ||
      evidenceNote.length > 2000
    ) {
      throw new ApiFailure(
        400,
        "INVALID_REVIEW",
        "Reviewer and evidence note required",
      );
    }
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        `UPDATE source_observations o SET review_status=$2
       FROM source_documents d WHERE o.id=$1 AND d.id=o.source_document_id
         AND d.source_id=$3 AND o.observation_type='treatment_plan'
         AND o.review_status='pending' AND ($2 <> 'verified' OR o.geometry IS NOT NULL)`,
        [id, decision, SOURCE_ID],
      );
      if (!result.rowCount)
        throw new ApiFailure(
          409,
          "REVIEW_UNAVAILABLE",
          "Observation unavailable or lacks validated geometry",
        );
      await client.query(
        "INSERT INTO source_observation_reviews(observation_id, reviewer, decision, evidence_note) VALUES($1,$2,$3,$4)",
        [id, reviewer.trim(), decision, evidenceNote.trim()],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async published(
    bbox?: [number, number, number, number],
  ): Promise<MapTreatment[]> {
    return this.spatial(false, bbox);
  }

  /** Local administrator map preview includes validated but unreviewed polygons. */
  async preview(): Promise<MapTreatment[]> {
    return this.spatial(true);
  }

  private async spatial(
    includePending: boolean,
    bbox?: [number, number, number, number],
  ): Promise<MapTreatment[]> {
    const result = await this.pool.query<{
      id: string;
      name: string;
      canonical_url: string;
      retrieved_at: Date;
      published_at: Date | null;
      start_at: Date | null;
      end_at: Date | null;
      attributes: Record<string, unknown>;
      geometry: unknown;
      review_status: "pending" | "verified";
    }>(
      `SELECT o.id, s.name, d.canonical_url, d.retrieved_at, d.published_at,
           o.start_at, o.end_at, o.attributes, o.review_status, ST_AsGeoJSON(o.geometry)::json AS geometry
       FROM source_observations o JOIN source_documents d ON d.id=o.source_document_id
       JOIN source_catalog s ON s.id=d.source_id
       WHERE d.source_id=$1 AND s.lifecycle='configured' AND d.canonical_url=s.url
         AND o.observation_type='treatment_plan' AND (o.review_status='verified' OR ($6::boolean AND o.review_status='pending'))
         AND o.geometry IS NOT NULL
         AND ($2::float8 IS NULL OR ST_Intersects(o.geometry,ST_MakeEnvelope($2,$3,$4,$5,4326)))
       ORDER BY d.retrieved_at DESC, o.id LIMIT 200`,
      [SOURCE_ID, ...(bbox ?? [null, null, null, null]), includePending],
    );
    return result.rows.map((r) => ({
      id: r.id,
      sourceName:
        typeof r.attributes.sourceName === "string"
          ? r.attributes.sourceName
          : r.name,
      sourceUrl: r.canonical_url,
      retrievedAt: r.retrieved_at.toISOString(),
      publishedAt: r.published_at?.toISOString() ?? null,
      startAt: r.start_at?.toISOString() ?? null,
      endAt: r.end_at?.toISOString() ?? null,
      contractorName:
        typeof r.attributes.contractorName === "string"
          ? r.attributes.contractorName
          : null,
      cadastralNumber:
        typeof r.attributes.cadastralNumber === "string"
          ? r.attributes.cadastralNumber
          : null,
      treatments: Array.isArray(r.attributes.treatments)
        ? (r.attributes.treatments as MapTreatment["treatments"])
        : [],
      geometry: r.geometry as MapTreatment["geometry"],
      spatialPrecision: "exact_polygon",
      reviewStatus: r.review_status,
    }));
  }
}
