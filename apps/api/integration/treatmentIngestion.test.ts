// Feature IDs: SOURCES.DOCUMENT_HISTORY, NOTICES.MAP_OVERLAY, NOTICES.SPATIAL_PRECISION
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { TreatmentIngestionService } from "../src/modules/sources/treatmentIngestion.js";
import type { ProviderRequestGate } from "../src/modules/sources/providerRequestThrottle.js";

const sourceFixture = {
  name: "Fixture publisher",
  type: "treatment",
  url: "https://plans.example.org/list",
  request: {
    method: "POST",
    regionParameter: "subject",
    regionContainer: "regionalFilter",
    regionCode: 55,
    parameters: { pageNumber: 0, pageSize: 1 },
  },
};
// Evidence ingestion regressions use a permissive gate; the durable gate has its own integration suite.
const evidenceTestGate: ProviderRequestGate = { reserve: async () => true };

const portalFixture = {
  content: [
    {
      id: 17,
      beeAcreage: {
        id: 71,
        planId: 17,
        contractorName: "Test grower",
        cadNum: "67:01:0000000:42",
        planDate: 1793505600,
        planDateEnd: 1793592000,
        geo: {
          type: "Polygon",
          coordinates: [
            [
              [32, 54],
              [33, 54],
              [33, 55],
              [32, 54],
            ],
          ],
        },
      },
      allPatList: [
        {
          patName: "Declared product",
          regulationCropName: "Test crop",
          patProductDangerClassBee: 2,
        },
      ],
    },
  ],
  totalElements: 1,
};

let rootPool: Pool;
let pool: Pool;
let schema: string;

describe("real PostGIS provider ingestion and publication gates", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL)
      throw new Error("DATABASE_URL required for integration tests");
    schema = `treatment_ingestion_${randomBytes(6).toString("hex")}`;
    rootPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await rootPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    for (const name of [
      "001_source_core.sql",
      "002_source_access_registry.sql",
      "003_saturn_api_configuration.sql",
      "004_provider_connection.sql",
      "005_treatment_source_approval.sql",
      "006_optional_provider_api_key.sql",
      "007_treatment_observation_dedupe.sql",
      "008_manual_treatment_fetch.sql",
      "009_legacy_treatment_endpoint_alignment.sql",
      "010_provider_document_last_seen.sql",
      "013_source_request_throttle.sql",
    ]) {
      await pool.query(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    }
    await pool.query(
      `UPDATE source_catalog SET name=$1, url=$2, api_request_config=$3::jsonb
       WHERE id='treatment-feed'`,
      [
        sourceFixture.name,
        sourceFixture.url,
        JSON.stringify({
          endpoint: sourceFixture.url,
          request: sourceFixture.request,
        }),
      ],
    );
  }, 30_000);
  afterAll(async () => {
    if (pool) await pool.end();
    if (rootPool) {
      await rootPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await rootPool.end();
    }
  });

  it("serializes competing ingestion sessions within the same database schema", async () => {
    const blocker = await pool.connect();
    try {
      const lock = await blocker.query<{ acquired: boolean }>(
        "SELECT pg_try_advisory_lock(hashtext(current_schema()), hashtext('melliatlas_treatment_ingestion')) AS acquired",
      );
      expect(lock.rows[0]?.acquired).toBe(true);
      let fetchCount = 0;
      const service = new TreatmentIngestionService(pool, {
        fetch: async () => {
          fetchCount++;
          throw new Error("must not fetch while ingestion is locked");
        },
      });
      await expect(service.syncOnePage()).rejects.toMatchObject({
        code: "INGEST_BUSY",
      });
      expect(fetchCount).toBe(0);
    } finally {
      await blocker.query(
        "SELECT pg_advisory_unlock(hashtext(current_schema()), hashtext('melliatlas_treatment_ingestion'))",
      );
      blocker.release();
    }
  });

  it("blocks an unconfigured source before any network operation", async () => {
    await pool.query(
      "UPDATE source_catalog SET lifecycle='disabled' WHERE id='treatment-feed'",
    );
    let calls = 0;
    const service = new TreatmentIngestionService(pool, {
      fetch: async () => {
        calls++;
        throw new Error("must not fetch");
      },
    });
    await expect(service.syncOnePage()).rejects.toMatchObject({
      code: "SOURCE_NOT_CONFIGURED",
    });
    expect(calls).toBe(0);
    expect(await service.status()).toMatchObject({
      sourceConfigured: false,
      latestRun: null,
      pendingReview: 0,
      pendingWithGeometry: 0,
      verifiedWithGeometry: 0,
    });
    await pool.query(
      "UPDATE source_catalog SET lifecycle='configured' WHERE id='treatment-feed'",
    );
  });

  it("publishes valid attributed structured candidates without operator verification and remains idempotent", async () => {
    const requests: string[] = [];
    const service = new TreatmentIngestionService(
      pool,
      {
        fetch: async (_source, request) => {
          requests.push(request.body ?? "");
          return {
            canonicalUrl: sourceFixture.url,
            contentType: "application/json",
            bytes: Buffer.from(JSON.stringify(portalFixture)),
          };
        },
      },
      evidenceTestGate,
    );
    const first = await service.syncOnePage();
    expect(first).toMatchObject({ received: 1, stored: 1, nextPage: 0 });
    const storedIdentity = await pool.query<{
      external_id: string;
      plan_id: string;
    }>(
      `SELECT attributes->>'externalId' AS external_id,
              attributes->>'planId' AS plan_id
       FROM source_observations WHERE observation_type='treatment_plan'`,
    );
    expect(storedIdentity.rows).toEqual([{ external_id: "71", plan_id: "17" }]);
    expect(JSON.parse(requests[0])).toMatchObject({
      regionalFilter: { subject: 55 },
      pageNumber: 0,
    });
    const publicPending = await service.published();
    expect(publicPending).toHaveLength(1);
    expect(publicPending[0]).toMatchObject({
      reviewStatus: "pending",
      geometry: { type: "Polygon" },
      sourceUrl: sourceFixture.url,
    });
    expect(await service.published([0, 0, 1, 1])).toEqual([]);
    const preview = await service.preview();
    expect(preview).toHaveLength(1);
    expect(preview[0]).toMatchObject({
      reviewStatus: "pending",
      geometry: { type: "Polygon" },
    });
    const candidates = await service.pending();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].geometryAvailable).toBe(true);
    await pool.query(
      "UPDATE source_observations SET extraction_method='model' WHERE id=$1",
      [candidates[0].id],
    );
    expect(await service.published()).toEqual([]);
    expect(await service.preview()).toHaveLength(1);
    await pool.query(
      "UPDATE source_observations SET extraction_method='structured', review_status='rejected' WHERE id=$1",
      [candidates[0].id],
    );
    expect(await service.published()).toEqual([]);
    expect(await service.preview()).toEqual([]);
    await pool.query(
      "UPDATE source_observations SET review_status='pending' WHERE id=$1",
      [candidates[0].id],
    );
    expect(await service.published()).toHaveLength(1);
    expect(await service.status()).toMatchObject({
      sourceConfigured: true,
      pendingReview: 1,
      pendingWithGeometry: 1,
      verifiedWithGeometry: 0,
      latestRun: { status: "succeeded", received: 1, accepted: 1 },
    });
    await expect(
      service.review(candidates[0].id, "verified", "X", "short"),
    ).rejects.toMatchObject({ code: "INVALID_REVIEW" });
    await service.review(
      candidates[0].id,
      "verified",
      "Test reviewer",
      "Compared the published polygon with source document evidence.",
    );
    expect(await service.published()).toHaveLength(1);
    expect((await service.preview())[0].reviewStatus).toBe("verified");
    expect(await service.status()).toMatchObject({
      pendingReview: 0,
      verifiedWithGeometry: 1,
    });
    expect(await service.published([0, 0, 1, 1])).toEqual([]);
    const second = await service.syncOnePage();
    expect(second.stored).toBe(0);
    const raw = await pool.query(
      "SELECT count(*) AS count FROM source_documents WHERE source_id='treatment-feed'",
    );
    expect(raw.rows[0].count).toBe("1");
    const reviews = await pool.query(
      "SELECT count(*) AS count FROM source_observation_reviews",
    );
    expect(reviews.rows[0].count).toBe("1");
    await pool.query(
      "UPDATE source_catalog SET lifecycle='disabled' WHERE id='treatment-feed'",
    );
    expect(await service.published()).toEqual([]);
    expect(await service.preview()).toEqual([]);
    await expect(service.syncOnePage()).rejects.toMatchObject({
      code: "SOURCE_NOT_CONFIGURED",
    });
  });

  it("recovers orphaned started runs after a worker crash", async () => {
    await pool.query(
      "UPDATE source_catalog SET lifecycle='configured' WHERE id='treatment-feed'",
    );
    const orphan = await pool.query<{ id: string }>(
      "INSERT INTO ingestion_runs(source_id, status) VALUES('treatment-feed', 'started') RETURNING id",
    );
    const service = new TreatmentIngestionService(
      pool,
      {
        fetch: async () => ({
          canonicalUrl: sourceFixture.url,
          contentType: "application/json",
          bytes: Buffer.from(JSON.stringify(portalFixture)),
        }),
      },
      evidenceTestGate,
    );
    await service.syncOnePage();
    const recovery = await pool.query<{ status: string; error_code: string }>(
      "SELECT status, error_code FROM ingestion_runs WHERE id=$1",
      [orphan.rows[0]!.id],
    );
    expect(recovery.rows[0]).toEqual({
      status: "failed",
      error_code: "INGEST_INTERRUPTED",
    });
  });

  it("uses the persistent source gate before issuing another provider request", async () => {
    await pool.query(
      "UPDATE source_catalog SET lifecycle='configured' WHERE id='treatment-feed'",
    );
    let calls = 0;
    const service = new TreatmentIngestionService(pool, {
      fetch: async () => {
        calls++;
        return {
          canonicalUrl: sourceFixture.url,
          contentType: "application/json",
          bytes: Buffer.from(JSON.stringify(portalFixture)),
        };
      },
    });
    await service.syncOnePage();
    await expect(service.syncOnePage()).rejects.toMatchObject({
      statusCode: 429,
      code: "SOURCE_THROTTLED",
    });
    expect(calls).toBe(1);
  });

  it("does not release a request slot when upstream fetching fails", async () => {
    await pool.query(
      `UPDATE source_request_throttle
       SET next_allowed_at=clock_timestamp()-interval '1 second'
       WHERE source_id='treatment-feed'`,
    );
    let calls = 0;
    const service = new TreatmentIngestionService(pool, {
      fetch: async () => {
        calls++;
        throw new Error("Synthetic network failure");
      },
    });
    await expect(service.syncOnePage()).rejects.toThrow(
      "Synthetic network failure",
    );
    await expect(service.syncOnePage()).rejects.toMatchObject({
      statusCode: 429,
      code: "SOURCE_THROTTLED",
    });
    expect(calls).toBe(1);
  });
  it("does not store a replayed page or advance its cursor when Saturn ignores pageNumber", async () => {
    await pool.query(
      "UPDATE source_catalog SET lifecycle='configured', source_cursor='{}'::jsonb WHERE id='treatment-feed'",
    );
    const existing = await pool.query<{ count: string }>(
      "SELECT count(*) AS count FROM source_observations WHERE observation_type='treatment_plan'",
    );
    const response = {
      ...portalFixture,
      totalElements: 2,
      totalPages: 2,
      number: 0,
      size: 1,
      numberOfElements: 1,
      last: false,
      pageable: { pageNumber: 0, pageSize: 1 },
    };
    const requests: number[] = [];
    const service = new TreatmentIngestionService(
      pool,
      {
        fetch: async (_source, request) => {
          const body = JSON.parse(request.body ?? "{}") as {
            pageNumber: number;
          };
          requests.push(body.pageNumber);
          return {
            canonicalUrl: sourceFixture.url,
            contentType: "application/json",
            bytes: Buffer.from(JSON.stringify(response)),
          };
        },
      },
      evidenceTestGate,
    );
    const first = await service.syncOnePage();
    expect(first).toMatchObject({ pageNumber: 0, received: 1, nextPage: 1 });
    await expect(service.syncOnePage()).rejects.toMatchObject({
      code: "INCONSISTENT_SOURCE_PAGE",
      statusCode: 502,
    });
    expect(requests).toEqual([0, 1]);
    const cursor = await pool.query<{ source_cursor: { pageNumber: number } }>(
      "SELECT source_cursor FROM source_catalog WHERE id='treatment-feed'",
    );
    expect(cursor.rows[0].source_cursor.pageNumber).toBe(1);
    const after = await pool.query<{ count: string }>(
      "SELECT count(*) AS count FROM source_observations WHERE observation_type='treatment_plan'",
    );
    expect(Number(after.rows[0].count) - Number(existing.rows[0].count)).toBe(
      1,
    );
    expect(await service.status()).toMatchObject({
      latestRun: { status: "failed", errorCode: "INCONSISTENT_SOURCE_PAGE" },
    });
  });

  it("projects separate same-plan polygons and source publication dates after PostGIS ingestion", async () => {
    const firstPublished = 1785000000;
    const secondPublished = 1785100000;
    const originalStart = 1785200000;
    const revisedStart = 1785300000;
    const sourcePage = {
      content: [
        {
          beeAcreage: {
            id: 88101,
            planId: 99191,
            datePublishing: firstPublished,
            planDate: originalStart,
            planDateEnd: originalStart,
            geo: {
              type: "Polygon",
              coordinates: [
                [
                  [30.1, 54.1],
                  [30.3, 54.1],
                  [30.3, 54.3],
                  [30.1, 54.1],
                ],
              ],
            },
          },
          allPatList: [{ patName: "Product A", patProductDangerClassBee: 2 }],
        },
        {
          beeAcreage: {
            id: 88102,
            planId: 99191,
            isUpdated: true,
            datePublishing: secondPublished,
            planDate: originalStart,
            planDateEnd: originalStart,
            planDateUpdate: revisedStart,
            planDateEndUpdate: revisedStart,
            geo: {
              type: "MultiPolygon",
              coordinates: [
                [
                  [
                    [34.1, 54.1],
                    [34.3, 54.1],
                    [34.3, 54.3],
                    [34.1, 54.1],
                  ],
                ],
              ],
            },
          },
          allPatList: [{ patName: "Product B", patProductDangerClassBee: 3 }],
        },
      ],
      number: 0,
      size: 2,
      numberOfElements: 2,
      totalElements: 2,
      totalPages: 1,
      last: true,
    };
    await pool.query(
      `UPDATE source_catalog SET lifecycle='configured', source_cursor='{}'::jsonb,
         api_request_config=$1::jsonb WHERE id='treatment-feed'`,
      [
        JSON.stringify({
          endpoint: sourceFixture.url,
          request: {
            ...sourceFixture.request,
            parameters: { pageNumber: 0, pageSize: 2 },
          },
        }),
      ],
    );
    const service = new TreatmentIngestionService(
      pool,
      {
        fetch: async () => ({
          canonicalUrl: sourceFixture.url,
          contentType: "application/json",
          bytes: Buffer.from(JSON.stringify(sourcePage)),
        }),
      },
      evidenceTestGate,
    );
    expect(await service.syncOnePage()).toMatchObject({
      pageNumber: 0,
      received: 2,
      stored: 2,
      nextPage: 0,
    });
    const rows = await pool.query<{
      id: string;
      external_id: string;
      plan_id: string;
      published_at: string | null;
    }>(
      `SELECT id, attributes->>'externalId' AS external_id,
         attributes->>'planId' AS plan_id,
         attributes->>'publishedAt' AS published_at
       FROM source_observations
       WHERE attributes->>'externalId' IN ('88101', '88102')
       ORDER BY attributes->>'externalId'`,
    );
    expect(
      rows.rows.map((row) => [row.external_id, row.plan_id, row.published_at]),
    ).toEqual([
      ["88101", "99191", new Date(firstPublished * 1000).toISOString()],
      ["88102", "99191", new Date(secondPublished * 1000).toISOString()],
    ]);
    const displayed = await service.published([30, 53, 36, 56]);
    const byId = new Map(displayed.map((item) => [item.id, item]));
    expect(byId.get(rows.rows[0]!.id)).toMatchObject({
      publishedAt: new Date(firstPublished * 1000).toISOString(),
      startAt: new Date(originalStart * 1000).toISOString(),
      geometry: { type: "Polygon" },
      treatments: [{ name: "Product A", crop: null, beeHazardClass: 2 }],
      reviewStatus: "pending",
    });
    expect(byId.get(rows.rows[1]!.id)).toMatchObject({
      publishedAt: new Date(secondPublished * 1000).toISOString(),
      startAt: new Date(revisedStart * 1000).toISOString(),
      geometry: { type: "MultiPolygon" },
      treatments: [{ name: "Product B", crop: null, beeHazardClass: 3 }],
      reviewStatus: "pending",
    });
  });
});
