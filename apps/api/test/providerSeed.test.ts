// Feature IDs: SOURCES.PROVIDER_CONFIGURATION
import { describe, expect, it } from "vitest";
import {
  parseProviderSeed,
  seedProvider,
} from "../src/modules/sources/providerSeed.js";

const preset = parseProviderSeed({
  name: "Beekeeper portal",
  type: "treatment",
  url: "https://example.org/api/plans",
  request: {
    method: "POST",
    regionParameter: "subject",
    regionContainer: "filter",
    regionCode: 55,
    parameters: { pageSize: 40 },
  },
});

function fakePool(existing: Record<string, unknown> | null) {
  const statements: { sql: string; params?: unknown[] }[] = [];
  return {
    statements,
    pool: {
      connect: async () => ({
        query: async (sql: string, params?: unknown[]) => {
          statements.push({ sql, params });
          return {
            rows: sql.includes("FOR UPDATE")
              ? existing
                ? [existing]
                : []
              : [],
          };
        },
        release: () => {},
      }),
    } as never,
  };
}

const connection = { endpoint: preset.url, request: preset.request };

const base = {
  name: "External treatment provider",
  kind: "treatment",
  url: "https://example.org/",
  api_key: null,
  api_request_config: connection,
  lifecycle: "under_review",
  access_decision: "pending",
};

describe("Provider seed preset", () => {
  it("accepts a credential-free treatment provider", () => {
    expect(preset.type).toBe("treatment");
    expect(preset.apiKeyEnv).toBeUndefined();
  });

  it.each([
    { ...preset, url: "http://example.org/api/plans" },
    { ...preset, url: "https://127.0.0.1/plans" },
    { ...preset, type: "weather" },
    { ...preset, apiKey: "must-not-appear-in-source" },
    { ...preset, apiKeyEnv: "bad-var-name" },
    {
      ...preset,
      request: {
        ...preset.request,
        parameters: { ...preset.request.parameters, sortDirection: undefined },
      },
    },
  ])("rejects malformed or unsafe preset data", (value) => {
    expect(() => parseProviderSeed(value)).toThrow();
  });

  it("inserts a pending source without a credential", async () => {
    const { pool, statements } = fakePool(null);
    expect(await seedProvider(pool, preset)).toBe("inserted");
    const insert = statements.find((item) =>
      item.sql.includes("INSERT INTO source_catalog"),
    );
    expect(insert?.params?.[4]).toBeNull();
    expect(insert?.params?.[3]).toBe("https://example.org/api/plans");
    expect(insert?.sql).toContain("'pending'");
  });

  it("replaces an untouched legacy placeholder once and revokes permission", async () => {
    const { pool, statements } = fakePool(base);
    expect(await seedProvider(pool, preset)).toBe("updated");
    const update = statements.find((item) =>
      item.sql.includes("UPDATE source_catalog"),
    );
    expect(update?.sql).toContain("access_decision = 'pending'");
    expect(update?.params?.[4]).toBeNull();
  });

  it("does not update an already initialized source", async () => {
    const { pool, statements } = fakePool({
      ...base,
      name: preset.name,
      url: preset.url,
    });
    expect(await seedProvider(pool, preset)).toBe("unchanged");
    expect(
      statements.filter((s) => s.sql.includes("UPDATE source_catalog")),
    ).toHaveLength(0);
  });

  it("uses a schema-scoped lock and treats JSONB-compatible optional values as equal", async () => {
    const seed = parseProviderSeed({
      ...preset,
      request: {
        ...preset.request,
        regionContainer: undefined,
      },
    });
    const savedConnection = JSON.parse(
      JSON.stringify({ endpoint: seed.url, request: seed.request }),
    );
    const { pool, statements } = fakePool({
      ...base,
      name: seed.name,
      url: seed.url,
      api_request_config: savedConnection,
    });
    expect(await seedProvider(pool, seed)).toBe("unchanged");
    expect(
      statements.some((entry) =>
        entry.sql.includes("pg_advisory_xact_lock(hashtext(current_schema())"),
      ),
    ).toBe(true);
    expect(
      statements.some((entry) => entry.sql.includes("UPDATE source_catalog")),
    ).toBe(false);
  });

  it("preserves an operator customization unless replacement is explicit", async () => {
    const { pool, statements } = fakePool({ ...base, name: "Custom source" });
    expect(await seedProvider(pool, preset)).toBe("preserved_customization");
    expect(
      statements.filter((s) => s.sql.includes("UPDATE source_catalog")),
    ).toHaveLength(0);
    expect(await seedProvider(pool, preset, { replace: true })).toBe("updated");
  });

  it("revokes an existing approval only on explicit replacement", async () => {
    const approved = {
      ...base,
      name: preset.name,
      url: preset.url,
      lifecycle: "configured",
      access_decision: "approved",
    };
    const { pool, statements } = fakePool(approved);
    expect(await seedProvider(pool, preset)).toBe("unchanged");
    expect(await seedProvider(pool, preset, { replace: true })).toBe("updated");
    expect(
      statements.some((entry) =>
        entry.sql.includes("access_decision = 'pending'"),
      ),
    ).toBe(true);
  });

  it("reads optional provider keys from the environment, never a preset secret", async () => {
    const credentialPreset = parseProviderSeed({
      ...preset,
      apiKeyEnv: "TEST_PROVIDER_KEY",
    });
    const { pool, statements } = fakePool(null);
    await expect(
      seedProvider(pool, credentialPreset, { environment: {} }),
    ).rejects.toThrow("TEST_PROVIDER_KEY");
    expect(statements).toHaveLength(0);
    await seedProvider(pool, credentialPreset, {
      environment: { TEST_PROVIDER_KEY: "private-key" },
    });
    const insert = statements.find((item) =>
      item.sql.includes("INSERT INTO source_catalog"),
    );
    expect(insert?.params?.[4]).toBe("private-key");
  });
});
