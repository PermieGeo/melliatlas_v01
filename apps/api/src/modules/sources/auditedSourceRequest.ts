// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { ApiFailure } from "../../lib/errors.js";
import type { ProviderRequestGate } from "./providerRequestThrottle.js";

export type SourceRequestOutcome =
  "succeeded" | "failed" | "throttled" | "cache_hit";

export interface SourceRequestAudit<Attempt> {
  start(attempt: Attempt): Promise<string>;
  finish(
    id: string,
    outcome: SourceRequestOutcome,
    receivedCount: number,
    errorCode?: string,
  ): Promise<void>;
}

export type SourceRequestPreflight<Value> =
  { kind: "proceed" } | { kind: "cache_hit"; value: Value };

export type SourceRequestFailureDecision = {
  error: unknown;
  code: string;
  outcome: "failed" | "throttled";
};

export interface AuditedSourceOperation<Attempt, Value> {
  sourceId: string;
  attempt: Attempt;
  journal: SourceRequestAudit<Attempt>;
  gate: ProviderRequestGate;
  preflight?: () => Promise<SourceRequestPreflight<Value>>;
  perform: () => Promise<{ value: Value; receivedCount: number }>;
  classifyFailure: (cause: unknown) => SourceRequestFailureDecision;
}

/**
 * Run a single explicit provider operation under one shared throttle and audit.
 * Record cache hits without reserving a source slot; a failed fetch consumes its
 * reservation and never retries implicitly. Provider adapters own validation,
 * persistence, and their public error mapping.
 *
 * @throws The provider-mapped failure, or an audit write failure.
 */
export async function executeAuditedSourceRequest<Attempt, Value>(
  operation: AuditedSourceOperation<Attempt, Value>,
): Promise<Value> {
  const auditId = await operation.journal.start(operation.attempt);
  let outcome: SourceRequestOutcome = "failed";
  let receivedCount = 0;
  let errorCode: string | undefined;
  try {
    const preflight = await operation.preflight?.();
    if (preflight?.kind === "cache_hit") {
      outcome = "cache_hit";
      return preflight.value;
    }
    if (!(await operation.gate.reserve(operation.sourceId))) {
      throw new ApiFailure(
        429,
        "SOURCE_THROTTLED",
        "Provider request cooldown is active",
      );
    }
    const result = await operation.perform();
    receivedCount = result.receivedCount;
    outcome = "succeeded";
    return result.value;
  } catch (cause) {
    const failure = operation.classifyFailure(cause);
    outcome = failure.outcome;
    errorCode = failure.code;
    throw failure.error;
  } finally {
    const committedCount = outcome === "succeeded" ? receivedCount : 0;
    if (errorCode === undefined) {
      await operation.journal.finish(auditId, outcome, committedCount);
    } else {
      await operation.journal.finish(
        auditId,
        outcome,
        committedCount,
        errorCode,
      );
    }
  }
}
