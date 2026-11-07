// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it } from "vitest";
import type { ViewportCollectionSelection } from "@melliatlas/contracts";
import {
  SaturnProvider,
  type SaturnProviderPort,
} from "../src/modules/sources/providers/saturn/SaturnProvider.js";
import { SATURN_JSON_REQUEST_PROFILE } from "../src/modules/sources/providers/saturn/requestProfile.js";

const selection: ViewportCollectionSelection = {
  districtId: 1477,
  bbox: {
    west: 32.409804730540266,
    south: 54.92780435298192,
    east: 33.02984562409493,
    north: 55.210325361370735,
  },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
};

describe("Saturn provider capabilities", () => {
  it("exposes a source-bound request policy and deterministic viewport pages", () => {
    const provider: SaturnProviderPort = new SaturnProvider();
    expect(provider.sourceId).toBe("treatment-feed");
    expect(provider.requestProfiles).toEqual([SATURN_JSON_REQUEST_PROFILE]);
    const first = provider.firstPage(selection);
    const second = provider.pageAt(first, 1);
    expect(first.pageNumber).toBe(0);
    expect(second.pageNumber).toBe(1);
    expect(second.filter).toEqual(first.filter);
    expect(second.filter).toMatchObject({
      district: "1477",
      subject: "55",
      startDateUpdateMap: "2026-08-01T00:00:00.000Z",
    });
    expect(() => provider.pageAt(first, 2000)).toThrow();
  });

  it("validates provider-owned district and map-index response contracts", () => {
    const provider: SaturnProviderPort = new SaturnProvider();
    const districts = [
      { id: 1477, name: "Yartsevo", latitude: 55.06, longitude: 32.68 },
    ];
    expect(provider.parseDirectory(districts)).toHaveLength(1);
    expect(() =>
      provider.parseDirectory([...districts, ...districts]),
    ).toThrow();
    const request = provider.firstPage(selection);
    const parsed = provider.parsePage(
      {
        content: [
          {
            id: 238194,
            planId: 701,
            name: "FICTIONAL field",
            centerX: 32.5,
            centerY: 55,
          },
        ],
        pageable: { pageNumber: 0, pageSize: 10 },
        totalPages: 1,
        totalElements: 1,
        last: true,
        first: true,
        numberOfElements: 1,
        number: 0,
        size: 10,
        empty: false,
      },
      request,
    );
    expect(parsed.entries).toEqual([
      { featureId: "238194", planId: "701", centerX: 32.5, centerY: 55 },
    ]);
    expect(parsed.nextPage).toBeNull();
  });
});
