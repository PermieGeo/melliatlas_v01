// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { createHash, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import {
  SaturnViewportIndexRepository,
  type ViewportIndexKey,
} from "../src/modules/sources/providers/saturn/saturnViewportIndexRepository.js";
import { validateSaturnViewportQuery } from "../src/modules/sources/providers/saturn/saturnViewportQuery.js";

let rootPool: Pool;
let pool: Pool;
let schema: string;
let repo: SaturnViewportIndexRepository;

async function fixture(name: string): Promise<unknown> {
  return JSON.parse(
    await readFile(
      new URL(`../test/fixtures/${name}.json`, import.meta.url),
      "utf8",
    ),
  ) as unknown;
}

const sample = (
  page: number,
  ids: number[],
  total = 22,
): Record<string, unknown> => {
  const pages = Math.ceil(total / 10);
  return {
    content: ids.map((id) => ({
      id,
      planId: 9999,
      name: "FICTIONAL record",
      centerX: 32.9,
      centerY: 55.0,
    })),
    pageable: { pageNumber: page, pageSize: 10 },
    number: page,
    size: 10,
    first: page === 0,
    last: pages === 0 || page === pages - 1,
    totalPages: pages,
    totalElements: total,
    numberOfElements: ids.length,
    empty: ids.length === 0,
  };
};

let baseKey: ViewportIndexKey;

/** SQL verification requires a local disposable PostGIS schema; no public provider calls occur. */
describe("Saturn viewport index persistence and restart", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
    schema = `viewport_index_${randomBytes(6).toString("hex")}`;
    rootPool = new Pool({ connectionString: process.env.DATABASE_URL });
    await rootPool.query(`CREATE SCHEMA "${schema}"`);
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      options: `-c search_path=${schema},public`,
    });
    for (const name of [
      "001_source_core.sql",
      "002_source_access_registry.sql",
      "014_saturn_viewport_index.sql",
    ]) {
      await pool.query(
        await readFile(
          new URL(`../migrations/${name}`, import.meta.url),
          "utf8",
        ),
      );
    }
    await pool.query(
      `INSERT INTO source_catalog (id,name,kind,lifecycle,url)
       VALUES ('saturn-viewport-fixture','Fixture','treatment','configured','https://example.invalid/query')`,
    );
    baseKey = {
      sourceId: "saturn-viewport-fixture",
      sourceRevision: "1",
      firstPageRequest: validateSaturnViewportQuery(
        await fixture("saturn-yartsevo-viewport-request"),
      ),
    };
    repo = new SaturnViewportIndexRepository(pool);
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (rootPool) {
      await rootPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await rootPool.end();
    }
  });

  it("stores page zero atomically, resumes after restart, and completes only the viewport index", async () => {
    expect(await repo.getStatus(baseKey)).toBeNull();
    const first = await repo.appendCapturedPage(
      baseKey,
      await fixture("saturn-yartsevo-viewport-response"),
    );
    expect(first).toMatchObject({
      state: "partial",
      nextPage: 1,
      pagesFetched: 1,
      entriesReceived: 10,
      totalElements: 22,
      totalPages: 3,
      sourceRevisionCurrent: true,
    });
    expect(await repo.listFeatures(baseKey)).toHaveLength(10);
    const restarted = new SaturnViewportIndexRepository(pool);
    expect(await restarted.getStatus(baseKey)).toMatchObject({
      nextPage: 1,
      pagesFetched: 1,
    });
    const second = await restarted.appendCapturedPage(
      baseKey,
      sample(
        1,
        Array.from({ length: 10 }, (_, i) => 9000000 + i),
      ),
    );
    expect(second).toMatchObject({
      state: "partial",
      nextPage: 2,
      entriesReceived: 20,
    });
    const done = await restarted.appendCapturedPage(
      baseKey,
      sample(2, [9000010, 9000011]),
    );
    expect(done).toMatchObject({
      state: "viewport_index_complete",
      nextPage: null,
      pagesFetched: 3,
      entriesReceived: 22,
    });
    expect(done.completedAt).not.toBeNull();
    const features = await restarted.listFeatures(baseKey);
    expect(features).toHaveLength(22);
    expect(features.filter((entry) => entry.planId === "1811436")).toHaveLength(
      7,
    );
    expect(
      features.find((entry) => entry.featureId === "2038836")?.centerX,
    ).toBe(32.917616);
    await expect(
      restarted.appendCapturedPage(baseKey, sample(2, [9000010, 9000011])),
    ).rejects.toThrow("already complete");
    expect(
      await pool.query(
        "SELECT COUNT(*)::int AS n FROM source_viewport_index_pages",
      ),
    ).toMatchObject({ rows: [{ n: 3 }] });
    const evidence = await pool.query<{
      response_text: string;
      response_sha256: string;
    }>(
      "SELECT response_text, response_sha256 FROM source_viewport_index_pages WHERE page_number=0 AND request_hash=$1",
      [done.requestHash],
    );
    expect(evidence.rows).toHaveLength(1);
    const firstEvidence = evidence.rows[0];
    if (!firstEvidence) throw new Error("Missing saved response evidence");
    expect(firstEvidence.response_sha256).toBe(
      createHash("sha256").update(firstEvidence.response_text).digest("hex"),
    );
    await expect(
      pool.query(
        "UPDATE source_viewport_index_pages SET response_text='rewritten' WHERE request_hash=$1",
        [done.requestHash],
      ),
    ).rejects.toThrow("immutable");
  });

  it("rolls back invalid/missing/duplicate pages without writing partial evidence", async () => {
    const key = {
      ...baseKey,
      firstPageRequest: {
        ...baseKey.firstPageRequest,
        filter: {
          ...baseKey.firstPageRequest.filter,
          endDateUpdateMap: "2026-12-01T00:00:00.000Z",
        },
      },
    };
    await expect(
      repo.appendCapturedPage(key, sample(1, [], 0)),
    ).rejects.toThrow();
    expect(await repo.getStatus(key)).toBeNull();
    await repo.appendCapturedPage(
      key,
      sample(
        0,
        Array.from({ length: 10 }, (_, i) => 100 + i),
      ),
    );
    await expect(
      repo.appendCapturedPage(
        key,
        sample(
          1,
          Array.from({ length: 10 }, (_, i) => 100 + i),
        ),
      ),
    ).rejects.toMatchObject({ code: "23505" });
    expect(await repo.getStatus(key)).toMatchObject({
      nextPage: 1,
      entriesReceived: 10,
    });
    await expect(
      repo.appendCapturedPage(
        key,
        sample(
          1,
          Array.from({ length: 10 }, (_, i) => 200 + i),
          23,
        ),
      ),
    ).rejects.toThrow("pagination changed");
    expect(await repo.getStatus(key)).toMatchObject({
      nextPage: 1,
      totalElements: 22,
    });
    expect(await repo.listFeatures(key)).toHaveLength(10);
  });

  it("does not conflate separate viewports or permit stale source revisions", async () => {
    const otherKey: ViewportIndexKey = {
      ...baseKey,
      firstPageRequest: {
        ...baseKey.firstPageRequest,
        filter: {
          ...baseKey.firstPageRequest.filter,
          rightDown: {
            ...baseKey.firstPageRequest.filter.rightDown,
            longitude: 33.01,
          },
        },
      },
    };
    expect(await repo.getStatus(otherKey)).toBeNull();
    await repo.appendCapturedPage(otherKey, sample(0, [], 0));
    expect(await repo.getStatus(otherKey)).toMatchObject({
      state: "viewport_index_complete",
      entriesReceived: 0,
      pagesFetched: 1,
    });
    await pool.query(
      "UPDATE source_catalog SET name='Changed fixture revision' WHERE id=$1",
      [baseKey.sourceId],
    );
    expect(await repo.getStatus(baseKey)).toMatchObject({
      sourceRevisionCurrent: false,
    });
    const newKey: ViewportIndexKey = { ...otherKey, sourceRevision: "2" };
    await expect(
      repo.appendCapturedPage(baseKey, sample(0, [], 0)),
    ).rejects.toThrow("revision");
    await repo.appendCapturedPage(newKey, sample(0, [], 0));
    expect(await repo.getStatus(newKey)).toMatchObject({
      sourceRevisionCurrent: true,
    });
    expect(await repo.listFeatures(otherKey)).toHaveLength(0);
  });

  it("serializes competing page writes with an exact filter and never doubles a page", async () => {
    const key: ViewportIndexKey = {
      ...baseKey,
      sourceRevision: "2",
      firstPageRequest: {
        ...baseKey.firstPageRequest,
        filter: {
          ...baseKey.firstPageRequest.filter,
          startDateUpdateMap: "2026-07-01T00:00:00.000Z",
        },
      },
    };
    const body = sample(0, [], 0);
    const outcomes = await Promise.allSettled([
      repo.appendCapturedPage(key, body),
      repo.appendCapturedPage(key, body),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === "rejected"),
    ).toHaveLength(1);
    expect(await repo.getStatus(key)).toMatchObject({
      pagesFetched: 1,
      entriesReceived: 0,
    });
  });
});
