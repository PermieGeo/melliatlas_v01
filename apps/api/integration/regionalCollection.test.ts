// Feature IDs: SOURCES.DOCUMENT_HISTORY, NOTICES.MAP_OVERLAY
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { RegionalCollectionService } from "../src/modules/sources/regionalCollection.js";
import { TreatmentIngestionService } from "../src/modules/sources/treatmentIngestion.js";
import { SourceFetchFailure } from "../src/modules/sources/httpFetcher.js";

let rootPool: Pool;
let pool: Pool;
let schema: string;
const providerUrl = "https://records.example.org/treatments";

function page(index: number) {
  return {
    content: [
      {
        id: index + 1,
        beeAcreage: {
          planId: index + 1,
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
        allPatList: [],
      },
    ],
    totalElements: 2,
  };
}

describe("regional collection persists progress across worker restarts", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    schema = `regional_collection_${randomBytes(6).toString("hex")}`;
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
    ]) {
      await pool.query(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    }
    await pool.query(
      `UPDATE source_catalog SET lifecycle='configured', url=$1, name='Test publisher',
         api_request_config=$2::jsonb, source_cursor=NULL WHERE id='treatment-feed'`,
      [
        providerUrl,
        JSON.stringify({
          endpoint: providerUrl,
          request: {
            method: "POST",
            regionParameter: "subject",
            regionContainer: "beekeperSearchFilter",
            regionCode: 55,
            parameters: { pageNumber: 0, pageSize: 1 },
          },
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

  it("scans the configured region in bounded pages and resumes from saved progress", async () => {
    let time = new Date("2026-11-02T21:00:00.000Z");
    const requests: number[] = [];
    const ingestion = new TreatmentIngestionService(pool, {
      fetch: async (_source, request) => {
        const index = Number(JSON.parse(request.body ?? "{}").pageNumber);
        requests.push(index);
        return {
          canonicalUrl: providerUrl,
          contentType: "application/json",
          bytes: Buffer.from(JSON.stringify(page(index))),
        };
      },
    });
    const firstWorker = new RegionalCollectionService(
      pool,
      ingestion,
      undefined,
      () => time,
    );
    expect((await firstWorker.start()).scan).toMatchObject({
      state: "running",
      regionCode: 55,
      pagesFetched: 0,
    });
    await expect(firstWorker.start()).rejects.toMatchObject({
      code: "REGION_SCAN_ACTIVE",
    });
    await expect(ingestion.syncOnePage()).rejects.toMatchObject({
      code: "REGION_SCAN_ACTIVE",
    });
    await firstWorker.tick();
    expect(await firstWorker.status()).toMatchObject({
      nextPage: 1,
      scan: { state: "running", pagesFetched: 1, recordsReceived: 1 },
    });
    await firstWorker.tick();
    expect(requests).toEqual([0]);
    const restartedWorker = new RegionalCollectionService(
      pool,
      ingestion,
      undefined,
      () => time,
    );
    time = new Date(time.getTime() + 66_000);
    await restartedWorker.tick();
    expect(requests).toEqual([0, 1]);
    expect(await restartedWorker.status()).toMatchObject({
      nextPage: 0,
      scan: { state: "completed", pagesFetched: 2, recordsReceived: 2 },
    });
    expect(await ingestion.published()).toHaveLength(2);
    await restartedWorker.tick();
    expect(requests).toEqual([0, 1]);
    await restartedWorker.start();
    expect(await restartedWorker.status()).toMatchObject({
      nextPage: 0,
      scan: { state: "running", pagesFetched: 0 },
    });
    await restartedWorker.pause();
    await restartedWorker.tick();
    expect(requests).toEqual([0, 1]);
    expect((await restartedWorker.start()).scan).toMatchObject({
      state: "running",
      pagesFetched: 0,
    });
  });
  it("pauses after three fetch failures without losing the next page", async () => {
    await pool.query(
      "UPDATE source_catalog SET source_cursor=NULL WHERE id='treatment-feed'",
    );
    let time = new Date("2026-11-03T21:00:00.000Z");
    let attempts = 0;
    const ingest = new TreatmentIngestionService(pool, {
      fetch: async () => {
        attempts++;
        throw new SourceFetchFailure("UPSTREAM_STATUS");
      },
    });
    const worker = new RegionalCollectionService(
      pool,
      ingest,
      undefined,
      () => time,
    );
    await worker.start();
    for (let i = 0; i < 3; i++) {
      await worker.tick();
      time = new Date(time.getTime() + 6 * 65_000);
    }
    expect(attempts).toBe(3);
    expect(await worker.status()).toMatchObject({
      nextPage: 0,
      scan: {
        state: "paused",
        pagesFetched: 0,
        consecutiveErrors: 3,
        errorCode: "UPSTREAM_STATUS",
      },
    });
    await worker.tick();
    expect(attempts).toBe(3);
    expect((await worker.start()).scan).toMatchObject({
      state: "running",
      pagesFetched: 0,
    });
  });

  it("starts nightly work only at a configured UTC hour", async () => {
    await pool.query(
      "UPDATE source_catalog SET source_cursor=NULL WHERE id='treatment-feed'",
    );
    let time = new Date("2026-11-04T20:59:00.000Z");
    let fetches = 0;
    const ingest = new TreatmentIngestionService(pool, {
      fetch: async () => {
        fetches++;
        return {
          canonicalUrl: providerUrl,
          contentType: "application/json",
          bytes: Buffer.from(JSON.stringify(page(0))),
        };
      },
    });
    const worker = new RegionalCollectionService(pool, ingest, 21, () => time);
    await worker.tick();
    expect(fetches).toBe(0);
    time = new Date("2026-11-04T21:00:00.000Z");
    await worker.tick();
    expect(fetches).toBe(1);
    expect((await worker.status()).scan).toMatchObject({
      scheduledOn: "2026-11-04",
      pagesFetched: 1,
    });
  });
});
