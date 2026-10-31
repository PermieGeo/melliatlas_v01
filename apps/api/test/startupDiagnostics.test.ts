import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { describeStartupFailure } from "../src/startupDiagnostics.js";

function invalidConfig(): unknown {
  try {
    loadConfig({ DATABASE_URL: "" });
  } catch (error) {
    return error;
  }
  throw new Error("Expected config validation to fail");
}

describe("API startup diagnostics", () => {
  it("names invalid configuration keys without printing their values", () => {
    const hint = describeStartupFailure(invalidConfig());
    expect(hint).toContain("DATABASE_URL");
    expect(hint).toContain("apps/api/.env");
    expect(hint).not.toContain("password");
  });

  it.each([
    ["ECONNREFUSED", "127.0.0.1:5433"],
    ["28P01", "authentication failed"],
    ["3D000", "database does not exist"],
    ["42P01", "pnpm db:migrate"],
    ["ENOTFOUND", "host could not be resolved"],
    ["ETIMEDOUT", "timed out"],
  ])("maps %s to an actionable, redacted hint", (code, expected) => {
    const error = Object.assign(new Error("secret-password"), { code });
    const hint = describeStartupFailure(error);
    expect(hint).toContain(expected);
    expect(hint).not.toContain("secret-password");
  });

  it("detects connection refusal in an aggregate error", () => {
    const error = new AggregateError([
      Object.assign(new Error("private host"), { code: "ECONNREFUSED" }),
    ]);
    expect(describeStartupFailure(error)).toContain("PostgreSQL");
    expect(describeStartupFailure(error)).not.toContain("private host");
  });

  it("keeps unknown errors redacted", () => {
    const hint = describeStartupFailure(
      new Error("postgresql://user:password@internal.example:5432/db"),
    );
    expect(hint).toContain("apps/api/.env");
    expect(hint).not.toContain("password@internal.example");
  });
});
