/** These labels describe trusted code-defined workers, not user-selectable privileges. */
export type WorkerKind = "provider" | "algorithm" | "statistics" | "ml" | "llm";

export type AnalysisNode = Readonly<{
  id: string;
  kind: WorkerKind;
  dependsOn: readonly string[];
  execute(inputs: ReadonlyMap<string, unknown>): Promise<unknown>;
}>;

const MAX_NODES = 32;

/** A small sequential DAG runner; persistence, retries, and parallelism are not provided. */
export class AnalysisGraph {
  private readonly order: readonly AnalysisNode[];

  constructor(nodes: readonly AnalysisNode[]) {
    if (nodes.length > MAX_NODES) {
      throw new Error("Analysis graph exceeds its node limit");
    }
    const byId = new Map<string, AnalysisNode>();
    for (const node of nodes) {
      if (!node.id.trim() || byId.has(node.id)) {
        throw new Error(`Invalid or duplicate analysis node: ${node.id}`);
      }
      if (new Set(node.dependsOn).size !== node.dependsOn.length) {
        throw new Error(`Repeated dependencies for analysis node: ${node.id}`);
      }
      byId.set(node.id, node);
    }

    const visited = new Set<string>();
    const visiting = new Set<string>();
    const ordered: AnalysisNode[] = [];
    const visit = (node: AnalysisNode): void => {
      if (visited.has(node.id)) return;
      if (visiting.has(node.id)) {
        throw new Error(`Cyclic analysis graph at: ${node.id}`);
      }
      visiting.add(node.id);
      for (const dependencyId of node.dependsOn) {
        const dependency = byId.get(dependencyId);
        if (!dependency) {
          throw new Error(`Missing analysis dependency: ${dependencyId}`);
        }
        visit(dependency);
      }
      visiting.delete(node.id);
      visited.add(node.id);
      ordered.push(node);
    };
    for (const node of nodes) visit(node);
    this.order = ordered;
  }

  async run(): Promise<ReadonlyMap<string, unknown>> {
    const completed = new Map<string, unknown>();
    for (const node of this.order) {
      const inputs = new Map<string, unknown>();
      for (const dependency of node.dependsOn) {
        inputs.set(dependency, completed.get(dependency));
      }
      completed.set(node.id, await node.execute(inputs));
    }
    return completed;
  }
}
