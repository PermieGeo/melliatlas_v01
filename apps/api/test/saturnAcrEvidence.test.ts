// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it } from "vitest";
import { inspectSaturnAcrEvidence } from "../src/modules/sources/providers/saturn/saturnAcrEvidence.js";

describe("offline Saturn ACR structural evidence", () => {
  it("summarizes observed detail fields without emitting source attributes", () => {
    const report = inspectSaturnAcrEvidence({
      id: 1881891,
      name: "Sensitive company name",
      cadNum: "Private cadastral identifier",
      centerX: 31.782385,
      startPlanDate: "2026-10-28T00:00:00Z",
      finishPlanDate: "2026-10-30T00:00:00Z",
      patAllList: [
        {
          id: 10628369,
          name: "Sensitive pesticide name",
          activeSubstance: "Sensitive chemical details",
          dosage: "Sensitive dosage",
          patProductDangerClassBee: 3,
          patProductDangerClassMan: 2,
        },
      ],
      patUpdateAllList: [],
      datePublishing: 1792648956,
    });
    expect(report).toEqual({
      responseId: "1881891",
      reportedPlanInterval: "ordered",
      reportedProductCount: 1,
      reportedUpdatedProductCount: 0,
      publishingTimestampPresent: true,
    });
    expect(JSON.stringify(report)).not.toMatch(
      /Sensitive|cadNum|centerX|activeSubstance|dosage|2026-10/,
    );
  });

  it("distinguishes missing, partial and reversed dates without inventing a plan", () => {
    expect(inspectSaturnAcrEvidence({ id: 1 })).toMatchObject({
      reportedPlanInterval: "missing",
      reportedProductCount: null,
      reportedUpdatedProductCount: null,
      publishingTimestampPresent: false,
    });
    expect(
      inspectSaturnAcrEvidence({ id: 1, startPlanDate: "2026-07-01T00:00:00Z" })
        .reportedPlanInterval,
    ).toBe("partial");
    expect(
      inspectSaturnAcrEvidence({
        id: 1,
        startPlanDate: "2026-07-02T00:00:00Z",
        finishPlanDate: "2026-07-01T00:00:00Z",
      }).reportedPlanInterval,
    ).toBe("reversed");
    expect(
      inspectSaturnAcrEvidence({
        id: 1,
        startPlanDate: "2026-07-01T00:00:00Z",
        finishPlanDate: "2026-07-01T00:00:00.000Z",
      }).reportedPlanInterval,
    ).toBe("ordered");
  });

  it("rejects invalid IDs, malformed dates, fields and excessive product lists", () => {
    for (const invalid of [
      {},
      { id: "1881891" },
      { id: 0 },
      { id: 1, startPlanDate: "2026-02-30T00:00:00Z" },
      { id: 1, finishPlanDate: "2026-08-01T00:00:00+03:00" },
      { id: 1, datePublishing: "1792648956" },
      { id: 1, patAllList: [{}] },
      { id: 1, patAllList: [{ id: 2, patProductDangerClassBee: "3" }] },
      {
        id: 1,
        patAllList: Array.from({ length: 501 }, (_, i) => ({ id: i + 1 })),
      },
      { id: 1, patUpdateAllList: Array.from({ length: 501 }, () => ({})) },
    ]) {
      expect(() => inspectSaturnAcrEvidence(invalid)).toThrow();
    }
  });
});
