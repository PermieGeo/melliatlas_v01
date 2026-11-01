import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizePage, checkSaturn } from "./check-saturn-api.mjs";

describe("reference provider one-page probe", () => {
  it("counts response records and polygon candidates without making assumptions", () => {
    assert.deepEqual(
      summarizePage({
        content: [
          { beeAcreage: { geo: { type: "Polygon", coordinates: [] } } },
          {},
        ],
        totalElements: 8,
      }),
      {
        responseRecords: 2,
        totalElements: 8,
        polygonCandidates: 1,
        missingOrUnsupportedGeometry: 1,
        firstGeometryType: "Polygon",
      },
    );
    assert.throws(
      () => summarizePage({ data: [] }),
      /content must be an array/,
    );
  });

  it("sends only a single POST page with the preset filter and no credentials", async () => {
    let calls = 0;
    const result = await checkSaturn({
      fetcher: async (url, request) => {
        calls++;
        assert.equal(
          url,
          "https://bee-saturn.ru/backend/beemaster/planapplybees",
        );
        assert.equal(request.method, "POST");
        assert.equal(request.redirect, "manual");
        assert.equal(request.headers.Authorization, undefined);
        assert.deepEqual(JSON.parse(request.body), {
          pageNumber: 0,
          pageSize: 1,
          sortColumn: "datePublishing",
          sortDirection: "desc",
          beekeperSearchFilter: { subject: 55 },
        });
        return new Response(JSON.stringify({ content: [], totalElements: 0 }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.responseRecords, 0);
  });
});
