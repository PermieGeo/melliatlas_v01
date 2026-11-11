// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { useEffect, useState } from "react";
import type { ViewportCacheHistoryResponse } from "@melliatlas/contracts";
import { loadViewportCacheHistory } from "../api/client";
import { StoredViewportFieldsPanel } from "./StoredViewportFieldsPanel";
import { t, type Key, type Locale } from "../i18n";

/** Display committed DB checkpoints, including those collected from the beekeeper map. */
export function ViewportCacheHistoryPanel({ locale }: { locale: Locale }) {
  const [data, setData] = useState<ViewportCacheHistoryResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const text = (key: Key): string => t(locale, key);

  async function refresh(): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      setData(await loadViewportCacheHistory());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  const stamp = (iso: string): string =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(iso)) + " UTC";

  return (
    <section
      aria-label={text("cacheHistoryTitle")}
      className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-blue-950">
          {text("cacheHistoryTitle")}
        </h3>
        <button
          type="button"
          className="rounded-lg border border-blue-700 px-3 py-2 text-sm"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {text("cacheHistoryRefresh")}
        </button>
      </div>
      <p className="text-sm text-blue-950">{text("cacheHistoryExplain")}</p>
      {busy && (
        <p role="status" className="text-sm">
          {text("loading")}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-800">
          {text("cacheHistoryError")}
        </p>
      )}
      {data && data.entries.length === 0 && (
        <p role="status" className="text-sm">
          {text("cacheHistoryEmpty")}
        </p>
      )}
      {data && data.entries.length > 0 && (
        <div className="space-y-3">
          {data.entries.map((entry) => (
            <article
              key={`${entry.sourceRevision}-${entry.requestHash}`}
              className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm"
            >
              <p className="font-semibold">
                {text("cacheHistoryDistrict")}: {entry.regionCode} /{" "}
                {entry.districtId}
                <span className="ml-2 font-normal text-slate-600">
                  {entry.fromDate} — {entry.toDate}
                </span>
              </p>
              <p>
                {text("cacheHistorySaved")}: {entry.entriesReceived};{" "}
                {text("cacheHistoryPages")}: {entry.pagesFetched} /{" "}
                {entry.totalPages ?? "?"}
              </p>
              <p>
                {text("cacheHistoryUpdated")}: {stamp(entry.updatedAt)};{" "}
                {entry.state === "viewport_index_complete"
                  ? text("cacheHistoryComplete")
                  : text("cacheHistoryPartial")}
              </p>
              {!entry.sourceRevisionCurrent && (
                <p className="text-amber-800">{text("cacheHistoryRevision")}</p>
              )}
              <StoredViewportFieldsPanel
                locale={locale}
                hash={entry.requestHash}
              />
              <details>
                <summary className="cursor-pointer font-medium">
                  {text("cacheHistoryDetails")}
                </summary>
                <p className="mt-1 text-xs text-slate-700">
                  {text("cacheHistoryBounds")}:{" "}
                  {[
                    entry.bbox.west,
                    entry.bbox.south,
                    entry.bbox.east,
                    entry.bbox.north,
                  ]
                    .map((v) => v.toFixed(5))
                    .join(", ")}
                </p>
                <p className="text-xs text-slate-700">
                  {text("cacheHistoryKey")}: {entry.requestHash.slice(0, 12)}
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {entry.recentPages.map((page) => (
                    <li key={page.pageNumber}>
                      {text("cacheHistoryBatch")}: {page.pageNumber + 1};{" "}
                      {text("cacheHistorySaved")}: {page.recordCount};{" "}
                      {stamp(page.storedAt)}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-slate-500">
                  {text("cacheHistoryLastFive")}
                </p>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
