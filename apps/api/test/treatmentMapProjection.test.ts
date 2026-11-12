// Feature IDs: NOTICES.MAP_OVERLAY, NOTICES.SPATIAL_PRECISION
import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { listStoredMapTreatments } from "../src/modules/sources/treatmentMapProjection.js";

const geometry = {
  type: "Polygon",
  coordinates: [
    [
      [32, 54],
      [33, 54],
      [33, 55],
      [32, 54],
    ],
  ],
};

describe("stored treatment map response validation", () => {
  it("projects only safe treatment fields from JSONB and rejects malformed entries", async () => {
    const attributes = {
      treatments: [
        { name: "Known", crop: null, beeHazardClass: 2, secret: "not-public" },
        { name: "Unknown", crop: "Plant", beeHazardClass: 0 },
        { name: "Broken", crop: ["Plant"], beeHazardClass: 3 },
        { name: null, crop: null, beeHazardClass: null },
        "untrusted",
        null,
      ],
    };
    const row = {
      id: "observation-1",
      name: "Source",
      canonical_url: "https://example.org/plans",
      retrieved_at: new Date("2026-11-03T00:00:00Z"),
      published_at: null,
      start_at: null,
      end_at: null,
      attributes,
      geometry,
      review_status: "pending" as const,
    };
    const db = {
      query: async () => ({ rows: [row] }),
    } as unknown as Pick<Pool, "query">;
    const records = await listStoredMapTreatments(db, "treatment-feed", false);
    expect(records).toHaveLength(1);
    expect(records[0]?.treatments).toEqual([
      { name: "Known", crop: null, beeHazardClass: 2 },
      { name: null, crop: null, beeHazardClass: null },
    ]);
    expect(JSON.stringify(records)).not.toContain("not-public");
  });

  it("uses record-level publication evidence and ignores malformed persisted dates", async () => {
    const documentPublishedAt = new Date("2026-07-01T00:00:00.000Z");
    const row = {
      id: "observation-published",
      name: "Source",
      canonical_url: "https://example.org/plans",
      retrieved_at: new Date("2026-11-03T00:00:00.000Z"),
      published_at: documentPublishedAt,
      start_at: null,
      end_at: null,
      attributes: { publishedAt: "2026-07-02T13:05:20.000Z", treatments: [] },
      geometry,
      review_status: "pending" as const,
    };
    const db = {
      query: async () => ({
        rows: [
          row,
          { ...row, id: "fallback", attributes: { publishedAt: "invalid" } },
          { ...row, id: "missing", published_at: null, attributes: {} },
        ],
      }),
    } as unknown as Pick<Pool, "query">;
    const records = await listStoredMapTreatments(db, "treatment-feed", false);
    expect(records.map((item) => item.publishedAt)).toEqual([
      "2026-07-02T13:05:20.000Z",
      documentPublishedAt.toISOString(),
      null,
    ]);
  });

  it("returns no treatment claims for a malformed persisted array", async () => {
    const db = {
      query: async () => ({
        rows: [
          {
            id: "observation-2",
            name: "Source",
            canonical_url: "https://example.org/plans",
            retrieved_at: new Date("2026-11-03T00:00:00Z"),
            published_at: null,
            start_at: null,
            end_at: null,
            attributes: { treatments: "invalid" },
            geometry,
            review_status: "verified",
          },
        ],
      }),
    } as unknown as Pick<Pool, "query">;
    const records = await listStoredMapTreatments(db, "treatment-feed", false);
    expect(records[0]?.treatments).toEqual([]);
  });
});
