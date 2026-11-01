// Feature IDs: SOURCES.DOCUMENT_HISTORY, NOTICES.MAP_OVERLAY
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { TreatmentIngestionService } from "../src/modules/sources/treatmentIngestion.js";

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
const portalFixture = {
  content: [
    {
      id: 17,
      beeAcreage: {
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

  it("blocks an unreviewed source before any network operation", async () => {
    let calls = 0;
    const service = new TreatmentIngestionService(pool, {
      fetch: async () => {
        calls++;
        throw new Error("must not fetch");
      },
    });
    await expect(service.syncOnePage()).rejects.toMatchObject({
      code: "SOURCE_NOT_APPROVED",
    });
    expect(calls).toBe(0);
    expect(await service.status()).toMatchObject({
      accessDecision: "pending",
      latestRun: null,
      pendingReview: 0,
      pendingWithGeometry: 0,
      verifiedWithGeometry: 0,
    });
  });

  it("stores raw evidence, requires manual review, and remains idempotent", async () => {
    const requests: string[] = [];
    const service = new TreatmentIngestionService(pool, {
      fetch: async (_source, request) => {
        requests.push(request.body ?? "");
        return {
          canonicalUrl: sourceFixture.url,
          contentType: "application/json",
          bytes: Buffer.from(JSON.stringify(portalFixture)),
        };
      },
    });
    await service.approveAccess({
      reviewer: "Test operator",
      evidenceUrl: "https://plans.example.org/terms",
      permissionBasis:
        "Synthetic permission evidence in isolated PostGIS test only.",
    });
    const first = await service.syncOnePage();
    expect(first).toMatchObject({ received: 1, stored: 1, nextPage: 0 });
    expect(JSON.parse(requests[0])).toMatchObject({
      regionalFilter: { subject: 55 },
      pageNumber: 0,
    });
    expect(await service.published()).toEqual([]);
    const candidates = await service.pending();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].geometryAvailable).toBe(true);
    expect(await service.status()).toMatchObject({
      accessDecision: "approved",
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
      "UPDATE source_catalog SET access_decision='pending', lifecycle='under_review' WHERE id='treatment-feed'",
    );
    expect(await service.published()).toEqual([]);
    await expect(service.syncOnePage()).rejects.toMatchObject({
      code: "SOURCE_NOT_APPROVED",
    });
  });
});
