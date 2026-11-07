// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { SaturnRequestJournal } from "../src/modules/sources/saturnRequestJournal.js";

describe("Saturn request audit writes and bounded reads", () => {
  it("stores a started attempt, a sanitized result, and reads the bounded log", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("RETURNING id::text")) return { rows: [{ id: "10" }] };
      if (sql.includes("FROM source_saturn_request_log"))
        return {
          rows: [
            {
              id: "10",
              action: "viewport_page",
              initiator: "web",
              district_provider_id: 1477,
              request_hash: "a".repeat(64),
              page_number: 0,
              status: "succeeded",
              received_count: 10,
              error_code: null,
              started_at: new Date("2026-11-07T08:00:00.000Z"),
              finished_at: new Date("2026-11-07T08:00:01.000Z"),
            },
          ],
        };
      return { rows: [] };
    });
    const journal = new SaturnRequestJournal({ query } as unknown as Pool);
    const id = await journal.start({
      action: "viewport_page",
      initiator: "web",
      districtId: 1477,
      requestHash: "a".repeat(64),
      pageNumber: 0,
    });
    await journal.finish(id, "succeeded", 10);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("source_saturn_request_log"),
      ["viewport_page", "web", 1477, "a".repeat(64), 0],
    );
    expect((await journal.list()).entries[0]).toMatchObject({
      id: "10",
      initiator: "web",
      receivedCount: 10,
      status: "succeeded",
    });
    expect(query.mock.calls.at(-1)?.[0]).toContain("LIMIT 100");
  });
});
