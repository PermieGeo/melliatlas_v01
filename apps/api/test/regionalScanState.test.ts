// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it } from "vitest";
import {
  advanceSourceCursor,
  readSourceCursor,
} from "../src/modules/sources/regionalScanState.js";

const startedAt = "2026-11-02T20:00:00.000Z";
const scan = {
  state: "running" as const,
  revision: "5",
  regionCode: 55,
  scheduledOn: "2026-11-02",
  startedAt,
  completedAt: null,
  nextAllowedAt: startedAt,
  pagesFetched: 0,
  recordsReceived: 0,
  recordsStored: 0,
  totalElements: null,
  errorCode: null,
  consecutiveErrors: 0,
};

describe("durable region scan cursor", () => {
  it("advances a page without marking the region complete", () => {
    const value = advanceSourceCursor(
      { pageNumber: 0, scan },
      1,
      40,
      38,
      200,
      new Date(startedAt),
    );
    expect(value).toMatchObject({
      pageNumber: 1,
      scan: {
        state: "running",
        pagesFetched: 1,
        recordsReceived: 40,
        recordsStored: 38,
        totalElements: 200,
      },
    });
    expect(readSourceCursor(value)).toEqual(value);
  });
  it("marks completion only after terminal pagination", () => {
    const value = advanceSourceCursor(
      { pageNumber: 4, scan },
      0,
      40,
      20,
      40,
      new Date(startedAt),
    );
    expect(value.scan).toMatchObject({
      state: "completed",
      completedAt: startedAt,
    });
  });
  it("pauses at the bounded page limit instead of claiming completion", () => {
    const value = advanceSourceCursor(
      { pageNumber: 1999, scan },
      2000,
      40,
      40,
      null,
      new Date(startedAt),
    );
    expect(value.scan).toMatchObject({
      state: "paused",
      errorCode: "REGION_PAGE_LIMIT",
    });
  });
  it("recovers an absent cursor and keeps manual pagination independent", () => {
    expect(readSourceCursor(null)).toEqual({ pageNumber: 0 });
    expect(
      advanceSourceCursor(
        { pageNumber: 2 },
        3,
        1,
        1,
        null,
        new Date(startedAt),
      ),
    ).toEqual({ pageNumber: 3 });
  });
  it("rejects malformed scan metadata without accidentally resuming it", () => {
    expect(
      readSourceCursor({ pageNumber: -1, scan: { state: "running" } }),
    ).toEqual({ pageNumber: 0 });
  });
});
