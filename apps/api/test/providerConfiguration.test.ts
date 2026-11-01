// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
import { describe, expect, it, vi } from "vitest";
import {
  buildProviderRequest,
  ProviderConfigurationRepository,
  validateProviderEndpoint,
} from "../src/modules/sources/providerConfiguration.js";

const request = {
  method: "POST" as const,
  regionParameter: "subject",
  regionCode: 55,
  parameters: { page: 2, archived: false },
};

describe("Provider request configuration", () => {
  it("builds POST payload from explicitly supplied parameters without a network call", () => {
    const result = buildProviderRequest(
      "https://example.org/backend/plans",
      request,
    );
    expect(result).toEqual({
      url: "https://example.org/backend/plans",
      method: "POST",
      body: JSON.stringify({ page: 2, archived: false, subject: 55 }),
    });
    expect(request.parameters).toEqual({ page: 2, archived: false });
  });

  it("supports a parametrized GET endpoint for a future approved provider", () => {
    const result = buildProviderRequest("https://example.org/plans", {
      ...request,
      method: "GET",
    });
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
    expect(() => validateProviderEndpoint(endpoint)).toThrow(
      "Invalid HTTPS endpoint",
    );
  });

  it("rejects overriding the region field and malformed parameters", () => {
    expect(() =>
      buildProviderRequest("https://example.org/plans", {
        ...request,
        parameters: { subject: 1 },
      }),
    ).toThrow();
    expect(() =>
      buildProviderRequest("https://example.org/plans", {
        ...request,
        parameters: { __proto__: "oops", "bad-parameter": "x" },
      }),
    ).toThrow();
  });

  it("builds the nested portal filter without embedding an external provider URL", () => {
    const output = buildProviderRequest("https://example.org/backend/plans", {
      method: "POST",
      regionParameter: "subject",
      regionContainer: "beekeperSearchFilter",
      regionCode: 55,
      parameters: {
        pageNumber: 0,
        pageSize: 40,
        sortColumn: "datePublishing",
        sortDirection: "desc",
      },
    });
    expect(JSON.parse(output.body!)).toEqual({
      pageNumber: 0,
      pageSize: 40,
      sortColumn: "datePublishing",
      sortDirection: "desc",
      beekeperSearchFilter: { subject: 55 },
    });
  });

  it("rejects JSON parameter pollution and nested payloads exceeding safe limits", () => {
    expect(() =>
      buildProviderRequest("https://example.org/plans", {
        ...request,
        regionContainer: "filters",
        parameters: { filters: { subject: 999 } },
      }),
    ).toThrow();
    expect(() =>
      buildProviderRequest("https://example.org/plans", {
        ...request,
        parameters: { evil: { constructor: { prototype: "x" } } },
      }),
    ).toThrow();
    expect(() =>
      buildProviderRequest("https://example.org/plans", {
        ...request,
        regionParameter: "constructor",
      }),
    ).toThrow();
  });

  it("stores an inert endpoint revision with a compare-and-set query", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          name: "Example Provider",
          api_request_config: {
            endpoint: "https://example.org/plans",
            request,
          },
          registry_revision: "7",
          access_decision: "pending",
        },
      ],
    }));
    const repo = new ProviderConfigurationRepository({ query } as never);
    const result = await repo.update({
      providerName: "Example Provider",
      endpoint: "https://example.org/plans",
      request,
      expectedRevision: "6",
    });
    expect(result.collectionEnabled).toBe(false);
    expect(result.revision).toBe("7");
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("registry_revision = $4::bigint"),
      [
        "Example Provider",
        "https://example.org/plans",
        JSON.stringify({ endpoint: "https://example.org/plans", request }),
        "6",
      ],
    );
  });

  it("rejects a concurrent update instead of overwriting a newer policy", async () => {
    const repo = new ProviderConfigurationRepository({
      query: async () => ({ rows: [] }),
    } as never);
    await expect(
      repo.update({
        providerName: "Example Provider",
        endpoint: "https://example.org/plans",
        request,
        expectedRevision: "3",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_REVISION_CONFLICT",
      statusCode: 409,
    });
  });
});
