import { describe, expect, it, vi } from "vitest";
import { AnalysisGraph } from "../src/modules/core/index.js";

describe("core analysis graph", () => {
  it("executes trusted provider and algorithm nodes in dependency order", async () => {
    const provider = vi.fn(async () => ({ observations: 3 }));
    const algorithm = vi.fn(async (inputs: ReadonlyMap<string, unknown>) => {
      const source = inputs.get("source") as { observations: number };
      return { count: source.observations };
    });
    const graph = new AnalysisGraph([
      {
        id: "analysis",
        kind: "algorithm",
        dependsOn: ["source"],
        execute: algorithm,
      },
      { id: "source", kind: "provider", dependsOn: [], execute: provider },
    ]);

    const output = await graph.run();
    expect(provider).toHaveBeenCalledOnce();
    expect(algorithm).toHaveBeenCalledOnce();
    expect(output.get("analysis")).toEqual({ count: 3 });
    expect([...algorithm.mock.calls[0]![0].keys()]).toEqual(["source"]);
  });

  it("rejects missing dependencies, cycles, and repeated nodes before execution", () => {
    const task = async () => null;
    expect(
      () =>
        new AnalysisGraph([
          { id: "a", kind: "ml", dependsOn: ["missing"], execute: task },
        ]),
    ).toThrow("Missing");
    expect(
      () =>
        new AnalysisGraph([
          { id: "a", kind: "llm", dependsOn: ["b"], execute: task },
          { id: "b", kind: "statistics", dependsOn: ["a"], execute: task },
        ]),
    ).toThrow("Cyclic");
    expect(
      () =>
        new AnalysisGraph([
          { id: "a", kind: "algorithm", dependsOn: [], execute: task },
          { id: "a", kind: "provider", dependsOn: [], execute: task },
        ]),
    ).toThrow("duplicate");
  });

  it("stops without running dependent nodes after a failure", async () => {
    const dependent = vi.fn(async () => null);
    const graph = new AnalysisGraph([
      {
        id: "source",
        kind: "provider",
        dependsOn: [],
        execute: async () => {
          throw new Error("source unavailable");
        },
      },
      {
        id: "analysis",
        kind: "algorithm",
        dependsOn: ["source"],
        execute: dependent,
      },
    ]);
    await expect(graph.run()).rejects.toThrow("source unavailable");
    expect(dependent).not.toHaveBeenCalled();
  });
});
