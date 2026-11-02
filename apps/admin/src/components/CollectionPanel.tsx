// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { ProviderCollectionStatus } from "@melliatlas/contracts";
import { useEffect, useState } from "react";
import { loadProviderCollectionStatus, syncProviderPage } from "../api/client";
import { t, type Key, type Locale } from "../i18n";
import { DistrictCachePanel } from "./DistrictCachePanel";

export function CollectionPanel({
  locale,
  onChanged,
}: {
  locale: Locale;
  onChanged(): void;
}) {
  const text = (key: Key) => t(locale, key);
  const [status, setStatus] = useState<ProviderCollectionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<{
    received: number;
    stored: number;
    nextPage: number;
  } | null>(null);
  async function refresh() {
    try {
      setStatus(await loadProviderCollectionStatus());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "REQUEST_FAILED");
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function sync() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await syncProviderPage());
      await refresh();
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "REQUEST_FAILED");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      aria-label={text("import")}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {text("reload")}
        </button>
      </div>
      <p className="text-sm text-slate-600">{text("loadHint")}</p>
      {status ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              ["pending", status.pendingReview],
              ["verified", status.verifiedWithGeometry],
              ["missingGeometry", status.missingGeometry],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-500">{text(key)}</p>
              <p className="text-xl font-bold">{value}</p>
            </div>
          ))}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs text-slate-500">{text("sourceStatus")}</p>
            <p className="text-sm font-semibold">
              {text(
                status.sourceConfigured ? "sourceConfigured" : "sourceMissing",
              )}
            </p>
          </div>
        </div>
      ) : (
        !loaded && <p role="status">{text("loading")}</p>
      )}
      {status?.latestRun && (
        <p className="text-xs text-slate-500">
          {text("lastRun")}: {text(status.latestRun.status)}
        </p>
      )}
      <DistrictCachePanel locale={locale} />
      <button
        type="button"
        disabled={busy || !status?.sourceConfigured}
        onClick={() => void sync()}
        className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {text("loadMore")}
      </button>
      {result && (
        <p role="status" className="text-sm text-slate-700">
          {text("loadedCount")}: {result.received}; {text("newCount")}:{" "}
          {result.stored}; {text("nextBatch")}: {result.nextPage}
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
