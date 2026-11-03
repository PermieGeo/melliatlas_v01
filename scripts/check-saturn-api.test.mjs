import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  it("preserves the captured viewport-query contract without mistaking it for polygon evidence", () => {
    const fixtureRoot = new URL("../apps/api/test/fixtures/", import.meta.url);
    const request = JSON.parse(
      readFileSync(
        new URL("saturn-map-query-request.json", fixtureRoot),
        "utf8",
      ),
    );
    const response = JSON.parse(
      readFileSync(
        new URL("saturn-map-query-response.json", fixtureRoot),
        "utf8",
      ),
    );
    assert.deepEqual(Object.keys(request.filter).sort(), [
      "leftTop",
      "query",
      "rightDown",
      "subject",
    ]);
    assert.equal(request.filter.subject, "55");
    assert.equal(request.filter.query, null);
    assert.ok(
      request.filter.leftTop.longitude < request.filter.rightDown.longitude &&
        request.filter.leftTop.latitude > request.filter.rightDown.latitude,
    );
    assert.equal(response.totalElements, 7319);
    assert.equal(response.totalPages, 732);
    assert.equal(response.content.length, request.pageSize);
    assert.equal(response.numberOfElements, response.content.length);
    assert.ok(response.content.every((item) => item.beeAcreage === undefined));
    assert.ok(
      new Set(response.content.map((item) => item.planId)).size <
        response.content.length,
    );
    assert.throws(() => summarizePage(response), /map-query summaries/);
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
