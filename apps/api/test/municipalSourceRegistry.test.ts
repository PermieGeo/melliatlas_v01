// Feature IDs: SOURCES.CATALOG, SOURCES.SAFE_FETCH
import type { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import { MunicipalSourceRegistry } from "../src/modules/sources/municipalSourceRegistry.js";
import { evaluateSourceDestination } from "../src/modules/sources/destinationPolicy.js";

const row = {
  id: "example-municipal",
  name: "Synthetic municipal fixture",
  kind: "municipal_notice",
  lifecycle: "configured",
  access_decision: "approved",
  allowed_locations: [
    { hostname: "notices.example.org", pathPrefixes: ["/public"] },
  ],
  reviewed_by: "test-operator",
  reviewed_at: new Date("2026-10-31T12:00:00.000Z"),
  permission_evidence_url: "https://example.org/terms",
  permission_basis: "Synthetic source registration used only by a unit test",
  parser_version: "html-v1",
  fetch_policy: {
    timeoutMs: 5000,
    maxResponseBytes: 100_000,
    minIntervalMs: 60_000,
    maxRedirects: 0,
    maxRetries: 1,
    allowedContentTypes: ["text/html"],
  },
  registry_revision: "2",
};

describe("internal municipal source registry", () => {
  it("returns only a schema-validated approved registration with its revision", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = new MunicipalSourceRegistry({
      query,
    } as unknown as Pool);
    const registration = await repository.getApproved("example-municipal");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("access_decision = 'approved'"),
      ["example-municipal"],
    );
    expect(registration?.registryRevision).toBe("2");
    expect(registration?.source.review.decision).toBe("approved");
    expect(
      evaluateSourceDestination(
        registration?.source,
        "https://notices.example.org/public/1",
      ),
    ).toMatchObject({ allowed: true });
    expect(
      evaluateSourceDestination(
        registration?.source,
        "https://notices.example.org/private",
      ),
    ).toEqual({ allowed: false, reason: "FORBIDDEN_PATH" });
  });

  it("does not query the database for an invalid or injected identifier", async () => {
    const query = vi.fn();
    const repository = new MunicipalSourceRegistry({
      query,
    } as unknown as Pool);
    await expect(
      repository.getApproved("example-municipal' OR true --"),
    ).resolves.toBeNull();
    await expect(
      repository.getApproved("../example-municipal"),
    ).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it("treats missing or non-approved rows as ineligible", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    await expect(
      new MunicipalSourceRegistry({ query } as unknown as Pool).getApproved(
        "example-municipal",
      ),
    ).resolves.toBeNull();
  });

  it("fails closed when stored approval evidence or allowlists are malformed", async () => {
    for (const badRow of [
      { ...row, permission_basis: null },
      {
        ...row,
        allowed_locations: [{ hostname: "127.0.0.1", pathPrefixes: ["/"] }],
      },
      { ...row, registry_revision: "0" },
    ]) {
      const query = vi.fn().mockResolvedValue({ rows: [badRow] });
      await expect(
        new MunicipalSourceRegistry({ query } as unknown as Pool).getApproved(
          "example-municipal",
        ),
      ).rejects.toThrow("Invalid approved source registration");
    }
  });
});
