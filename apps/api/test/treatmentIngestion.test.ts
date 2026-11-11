// Feature IDs: NOTICES.EXTRACTION, NOTICES.MAP_OVERLAY, NOTICES.SPATIAL_PRECISION
import { describe, expect, it } from "vitest";
import { safePlanGeometry } from "../src/modules/sources/treatmentIngestion.js";

const ring = [
  [32, 54],
  [33, 54],
  [33, 55],
  [32, 54],
] as [number, number][];

describe("provider map geometry evidence", () => {
  it("keeps a source polygon without converting longitude and latitude", () => {
    expect(safePlanGeometry({ type: "Polygon", coordinates: [ring] })).toEqual({
      type: "Polygon",
      coordinates: [ring],
    });
  });
  it("rejects an unclosed polygon rather than guessing a field boundary", () => {
    expect(
      safePlanGeometry({
        type: "Polygon",
        coordinates: [ring.slice(0, 3).concat([[32, 56] as [number, number]])],
      }),
    ).toBeNull();
  });
  it("does not fabricate geometry for an absent polygon", () => {
    expect(safePlanGeometry(null)).toBeNull();
  });
});
