// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { useState } from "react";
import type {
  ViewportCollectionResult,
  ViewportCollectionSelection,
} from "@melliatlas/contracts";
import { loadViewportProgress, fetchViewportNextPage } from "../api/client";
import { t, type Key, type Locale } from "../i18n";

const initial: ViewportCollectionSelection = {
  districtId: 1477,
  bbox: {
    west: 32.409804730540266,
    south: 54.92780435298192,
    east: 33.02984562409493,
    north: 55.210325361370735,
  },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
};

/** Explicit one-page live collection; never fetch on map movement or field edits. */
export function ViewportCollectionPanel({ locale }: { locale: Locale }) {
  const [selection, setSelection] = useState(initial);
  const [result, setResult] = useState<ViewportCollectionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const text = (key: Key): string => t(locale, key);
  async function run(action: "status" | "next"): Promise<void> {
    setBusy(true);
    setError("");
    try {
      setResult(
        action === "status"
          ? await loadViewportProgress(selection)
          : await fetchViewportNextPage(selection),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  function updateBbox(
    key: keyof ViewportCollectionSelection["bbox"],
    value: string,
  ): void {
    setSelection((current) => ({
      ...current,
      bbox: { ...current.bbox, [key]: Number(value) },
    }));
    setResult(null);
  }
  function updateDate(key: "fromDate" | "toDate", value: string): void {
    setSelection((current) => ({ ...current, [key]: value }));
    setResult(null);
  }
  const complete = result?.progress?.state === "viewport_index_complete";
  return (
    <section
      className="space-y-3 rounded-xl border border-slate-200 p-4"
      aria-label={text("viewportTitle")}
    >
      <h3 className="font-semibold">{text("viewportTitle")}</h3>
      <p className="text-xs text-slate-600">{text("viewportDisclaimer")}</p>
      <p className="text-xs text-slate-600">
        {text("viewportPageExplanation")}
      </p>
      <p className="text-sm font-medium">{text("viewportDistrict")}: 1477</p>
      <p className="text-xs text-slate-600">{text("viewportGuideLimits")}</p>
      <details className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          {text("viewportCoordinates")}
        </summary>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(["west", "south", "east", "north"] as const).map((key) => (
            <label key={key} className="text-xs">
              {text(`viewport${key[0].toUpperCase()}${key.slice(1)}` as Key)}
              <input
                className="mt-1 w-full rounded border p-2"
                type="number"
                step="any"
                value={selection.bbox[key]}
                onChange={(event) => updateBbox(key, event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["fromDate", "toDate"] as const).map((key) => (
            <label key={key} className="text-xs">
              {text(key === "fromDate" ? "viewportFrom" : "viewportTo")}
              <input
                className="mt-1 w-full rounded border p-2"
                type="date"
                value={selection[key]}
                onChange={(event) => updateDate(key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </details>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
          type="button"
          disabled={busy}
          onClick={() => void run("status")}
        >
          {text("viewportCheck")}
        </button>
        <button
          className="rounded-lg bg-emerald-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          type="button"
          disabled={busy || complete || result?.enabled === false}
          onClick={() => void run("next")}
        >
          {text("viewportFetch")}
        </button>
      </div>
      {result?.enabled === false && (
        <p role="status" className="text-sm text-amber-800">
          {text("viewportDisabled")}
        </p>
      )}
      {result?.enabled && !result.progress && (
        <p role="status" className="text-sm">
          {text("viewportEmpty")}
        </p>
      )}
      {result?.progress && (
        <p role="status" className="text-sm">
          {text("viewportPages")}: {result.progress.pagesFetched} /{" "}
          {result.progress.totalPages ?? "?"}; {text("viewportEntries")}:{" "}
          {result.progress.entriesReceived}; {text("viewportNext")}:{" "}
          {result.progress.nextPage ?? "—"}; {text("viewportState")}:{" "}
          {result.progress.state}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-amber-800">
          {text("error")} ({error})
        </p>
      )}
    </section>
  );
}
