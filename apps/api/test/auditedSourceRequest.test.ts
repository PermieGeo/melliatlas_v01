// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { describe, expect, it, vi } from "vitest";
import { ApiFailure } from "../src/lib/errors.js";
import {
  executeAuditedSourceRequest,
  type AuditedSourceOperation,
} from "../src/modules/sources/auditedSourceRequest.js";

type TestAttempt = { action: "test_page" };

function setup() {
  const events: string[] = [];
  const journal = {
    start: vi.fn(async (_attempt: TestAttempt) => {
      events.push("audit:start");
      return "7";
    }),
    finish: vi.fn(async () => {
      events.push("audit:finish");
    }),
  };
  const gate = {
    reserve: vi.fn(async (_sourceId: string) => {
      events.push("gate:reserve");
      return true;
    }),
  };
  const perform = vi.fn(async () => {
    events.push("provider:perform");
    return { value: "committed", receivedCount: 3 };
  });
  const operation: AuditedSourceOperation<TestAttempt, string> = {
    sourceId: "fixture-source",
    attempt: { action: "test_page" },
    journal,
    gate,
    perform,
    classifyFailure: (cause) => {
      if (cause instanceof ApiFailure) {
        return {
          error: cause,
          code: cause.code,
          outcome: cause.code === "SOURCE_THROTTLED" ? "throttled" : "failed",
        };
      }
      return {
        error: new ApiFailure(502, "SOURCE_UNAVAILABLE", "Source failed"),
        code: "NETWORK_ERROR",
        outcome: "failed",
      };
    },
  };
  return { operation, events, journal, gate, perform };
}

describe("audited explicit source request lifecycle", () => {
  it("audits a successful persisted result after reserving a source slot", async () => {
    const { operation, events, journal, gate } = setup();
    expect(await executeAuditedSourceRequest(operation)).toBe("committed");
    expect(events).toEqual([
      "audit:start",
      "gate:reserve",
      "provider:perform",
      "audit:finish",
    ]);
    expect(gate.reserve).toHaveBeenCalledWith("fixture-source");
    expect(journal.finish).toHaveBeenCalledTimes(1);
    expect(journal.finish).toHaveBeenCalledWith("7", "succeeded", 3);
  });

  it("records a cache hit without consuming the source throttle", async () => {
    const { operation, events, journal, gate, perform } = setup();
    operation.preflight = async () => ({
      kind: "cache_hit",
      value: "previous checkpoint",
    });
    expect(await executeAuditedSourceRequest(operation)).toBe(
      "previous checkpoint",
    );
    expect(events).toEqual(["audit:start", "audit:finish"]);
    expect(journal.finish).toHaveBeenCalledWith("7", "cache_hit", 0);
    expect(gate.reserve).not.toHaveBeenCalled();
    expect(perform).not.toHaveBeenCalled();
  });

  it("records a throttled attempt once and never starts transport", async () => {
    const { operation, journal, gate, perform } = setup();
    gate.reserve.mockResolvedValueOnce(false);
    await expect(executeAuditedSourceRequest(operation)).rejects.toMatchObject({
      code: "SOURCE_THROTTLED",
      statusCode: 429,
    });
    expect(journal.finish).toHaveBeenCalledTimes(1);
    expect(journal.finish).toHaveBeenCalledWith(
      "7",
      "throttled",
      0,
      "SOURCE_THROTTLED",
    );
    expect(perform).not.toHaveBeenCalled();
  });

  it("keeps preflight denials ahead of throttle reservation", async () => {
    const { operation, journal, gate, perform } = setup();
    operation.preflight = async () => {
      throw new ApiFailure(409, "SOURCE_CHANGED", "Outdated revision");
    };
    await expect(executeAuditedSourceRequest(operation)).rejects.toMatchObject({
      code: "SOURCE_CHANGED",
    });
    expect(journal.finish).toHaveBeenCalledWith(
      "7",
      "failed",
      0,
      "SOURCE_CHANGED",
    );
    expect(gate.reserve).not.toHaveBeenCalled();
    expect(perform).not.toHaveBeenCalled();
  });

  it("uses provider error classification and never records failed data as received", async () => {
    const { operation, journal, gate, perform } = setup();
    perform.mockRejectedValueOnce(new Error("Untrusted transport detail"));
    await expect(executeAuditedSourceRequest(operation)).rejects.toMatchObject({
      code: "SOURCE_UNAVAILABLE",
    });
    expect(gate.reserve).toHaveBeenCalledTimes(1);
    expect(journal.finish).toHaveBeenCalledWith(
      "7",
      "failed",
      0,
      "NETWORK_ERROR",
    );
  });

  it("does not reserve or fetch when the initial audit insert fails", async () => {
    const { operation, journal, gate, perform } = setup();
    journal.start.mockRejectedValueOnce(new Error("Audit unavailable"));
    await expect(executeAuditedSourceRequest(operation)).rejects.toThrow(
      "Audit unavailable",
    );
    expect(journal.finish).not.toHaveBeenCalled();
    expect(gate.reserve).not.toHaveBeenCalled();
    expect(perform).not.toHaveBeenCalled();
  });
});
