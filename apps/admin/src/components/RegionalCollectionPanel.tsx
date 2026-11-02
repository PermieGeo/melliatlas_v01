// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { RegionalScanStatus } from "@melliatlas/contracts";
import { useEffect, useState } from "react";
import {
  loadRegionalScanStatus,
  pauseRegionalScan,
  startRegionalScan,
} from "../api/client";
import { t, type Key, type Locale } from "../i18n";

export function RegionalCollectionPanel({
  locale,
  onChanged,
}: {
  locale: Locale;
  onChanged(): void;
}) {
  const text = (key: Key) => t(locale, key);
  const [status, setStatus] = useState<RegionalScanStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function reload() {
      try {
        const response = await loadRegionalScanStatus();
        if (active) {
          setStatus(response);
          setError("");
        }
      } catch (cause) {
        if (active)
          setError(cause instanceof Error ? cause.message : "REQUEST_FAILED");
      }
    }
    void reload();
    const timer = setInterval(() => {
      void reload();
    }, 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const scan = status?.scan;
  async function act(action: "start" | "pause") {
    setBusy(true);
    setError("");
    try {
      const result =
        action === "start"
          ? await startRegionalScan()
          : await pauseRegionalScan();
      setStatus(result);
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={text("regionScan")}
      className="space-y-3 rounded-xl border border-slate-200 p-4"
    >
      <h3 className="font-semibold">{text("regionScan")}</h3>
      <p className="text-xs text-slate-600">{text("regionIncomplete")}</p>
      {status && (
        <p className="text-sm">
          {text("regionCodeLabel")}: {status.regionCode ?? text("unknown")}
        </p>
      )}
      <p role="status" className="text-sm">
        {scan
          ? text(
              scan.state === "running"
                ? "regionRunning"
                : scan.state === "paused"
                  ? "regionPaused"
                  : "regionCompleted",
            )
          : text("regionNotStarted")}
      </p>
      {scan && (
        <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-3">
          <p>
            {text("regionProgress")}: {scan.pagesFetched}
          </p>
          <p>
            {text("regionRecords")}: {scan.recordsReceived}
          </p>
          <p>
            {text("regionTotal")}: {scan.totalElements ?? text("unknown")}
          </p>
        </div>
      )}
      {scan?.errorCode && (
        <p role="alert" className="text-sm text-amber-800">
          {text("error")}: {scan.errorCode}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !status || scan?.state === "running"}
          onClick={() => void act("start")}
          className="rounded-lg bg-emerald-800 px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {text(
            scan?.state === "paused" ? "resumeRegionScan" : "startRegionScan",
          )}
        </button>
        <button
          type="button"
          disabled={busy || scan?.state !== "running"}
          onClick={() => void act("pause")}
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        >
          {text("pauseRegionScan")}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-amber-800">
          {text("error")}: {error}
        </p>
      )}
    </section>
  );
}
