import { describe, expect, it } from "vitest";
import {
  DEMO_OBSERVATIONS,
  DEMO_SOURCE_NAME,
} from "../src/modules/sources/demoFixtures.js";
import { requireDemoDatabase } from "../src/db/demoSafety.js";

describe("local synthetic demo fixtures", () => {
  it("does not contain purported source evidence or duplicated IDs", () => {
    expect(DEMO_SOURCE_NAME).toContain("SYNTHETIC");
    expect(DEMO_OBSERVATIONS).toHaveLength(12);
    expect(new Set(DEMO_OBSERVATIONS.map((row) => row.id)).size).toBe(12);
    expect(
      DEMO_OBSERVATIONS.every((row) => row.externalId.startsWith("DEMO-")),
    ).toBe(true);
    expect(
      DEMO_OBSERVATIONS.every((row) => row.contractorName.startsWith("DEMO")),
    ).toBe(true);
    expect(
      DEMO_OBSERVATIONS.filter((row) => row.reviewStatus === "verified"),
    ).toHaveLength(4);
    expect(
      DEMO_OBSERVATIONS.filter((row) => row.reviewStatus === "rejected"),
    ).toHaveLength(1);
    expect(
      DEMO_OBSERVATIONS.filter((row) => row.geometry === null),
    ).toHaveLength(1);
  });

  it("refuses non-demo and remote database targets", () => {
    expect(() =>
      requireDemoDatabase("postgresql://localhost/melliatlas", "melliatlas"),
    ).toThrow();
    expect(() =>
      requireDemoDatabase(
        "postgresql://example.com/melliatlas_demo",
        "melliatlas_demo",
      ),
    ).toThrow();
    expect(() =>
      requireDemoDatabase("postgresql://localhost/melliatlas_demo", "other"),
    ).toThrow();
    expect(() =>
      requireDemoDatabase(
        "postgresql://localhost/melliatlas_demo",
        "melliatlas_demo",
      ),
    ).not.toThrow();
    expect(() =>
      requireDemoDatabase(
        "postgresql://localhost/melliatlas_demo_e2e",
        "melliatlas_demo_e2e",
      ),
    ).not.toThrow();
  });
});
