// Feature IDs: SOURCES.SATURN_CONFIGURATION
import { describe, expect, it, vi } from "vitest";
import { buildSaturnRequest, SaturnConfigurationRepository, validateSaturnEndpoint } from "../src/modules/sources/saturnConfiguration.js";

const request = {
  method: "POST" as const,
  regionParameter: "subject",
  regionCode: 55,
  parameters: { page: 2, archived: false },
};

describe("Saturn request configuration", () => {
  it("builds POST payload from explicitly supplied parameters without a network call", () => {
    const result = buildSaturnRequest("https://example.org/backend/plans", request);
    expect(result).toEqual({
      url: "https://example.org/backend/plans",
      method: "POST",
      body: JSON.stringify({ page: 2, archived: false, subject: 55 }),
    });
    expect(request.parameters).toEqual({ page: 2, archived: false });
  });

  it("supports a parametrized GET endpoint for a future approved provider", () => {
    const result = buildSaturnRequest("https://example.org/plans", { ...request, method: "GET" });
    expect(result.method).toBe("GET");
    const url = new URL(result.url);
    expect(url.searchParams.get("subject")).toBe("55");
    expect(url.searchParams.get("page")).toBe("2");
    expect(url.searchParams.get("archived")).toBe("false");
    expect(result.body).toBeUndefined();
  });

  it.each([
    "http://example.org/plans",
    "https://127.0.0.1/plans",
    "https://[::1]/plans",
    "https://localhost/plans",
    "https://example.org:8443/plans",
    "https://user:pass@example.org/plans",
    "https://example.org/plans#fragment",
    "https://example.org/plans?redirect=https://private.local",
    "https://example.org/%2e%2e/admin",
  ])("rejects an unsafe candidate endpoint %s", (endpoint) => {
    expect(() => validateSaturnEndpoint(endpoint)).toThrow("Invalid HTTPS endpoint");
  });

  it("rejects overriding the region field and malformed parameters", () => {
    expect(() => buildSaturnRequest("https://example.org/plans", {
      ...request,
      parameters: { subject: 1 },
    })).toThrow();
    expect(() => buildSaturnRequest("https://example.org/plans", {
      ...request,
      parameters: { "__proto__": "oops", "bad-parameter": "x" },
    })).toThrow();
  });

  it("stores an inert endpoint revision with a compare-and-set query", async () => {
    const query = vi.fn(async () => ({ rows: [{
      api_request_config: { endpoint: "https://example.org/plans", request },
      registry_revision: "7",
      access_decision: "pending",
    }] }));
    const repo = new SaturnConfigurationRepository({ query } as never);
    const result = await repo.update({ endpoint: "https://example.org/plans", request, expectedRevision: "6" });
    expect(result.collectionEnabled).toBe(false);
    expect(result.revision).toBe("7");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("registry_revision = $2::bigint"), [
      JSON.stringify({ endpoint: "https://example.org/plans", request }), "6",
    ]);
  });

  it("rejects a concurrent update instead of overwriting a newer policy", async () => {
    const repo = new SaturnConfigurationRepository({ query: async () => ({ rows: [] }) } as never);
    await expect(repo.update({ endpoint: "https://example.org/plans", request, expectedRevision: "3" }))
      .rejects.toMatchObject({ code: "SATURN_REVISION_CONFLICT", statusCode: 409 });
  });
});
