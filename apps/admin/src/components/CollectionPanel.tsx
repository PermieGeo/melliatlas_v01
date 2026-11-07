// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { ProviderCollectionStatus } from "@melliatlas/contracts";
import { useEffect, useState } from "react";
import { loadProviderCollectionStatus, syncProviderPage } from "../api/client";
import { t, type Key, type Locale } from "../i18n";
import { ViewportCollectionPanel } from "./ViewportCollectionPanel";
import { DistrictCachePanel } from "./DistrictCachePanel";
import { FieldHelp } from "./FieldHelp";

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
      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
        <h3 className="font-semibold text-emerald-950">
          {text("viewportGuideTitle")}
        </h3>
        <ol className="space-y-1 text-sm text-emerald-950">
          <li>{text("viewportGuideOne")}</li>
          <li>{text("viewportGuideTwo")}</li>
          <li>{text("viewportGuideThree")}</li>
        </ol>
        <p className="text-xs text-emerald-900">
          {text("viewportGuideLimits")}
        </p>
        <a
          href="http://127.0.0.1:5173"
          className="inline-block rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-950 underline"
        >
          {text("viewportGuideOpen")}
        </a>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {text("reload")}
        </button>
      </div>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        <p className="font-semibold">{text("developmentOnly")}</p>
        <p className="mt-1">{text("manualImportReplacement")}</p>
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
      <ViewportCollectionPanel locale={locale} />
      <DistrictCachePanel locale={locale} />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy || !status?.sourceConfigured}
          onClick={() => void sync()}
          className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {text("loadMore")}
        </button>
        <FieldHelp locale={locale} subject="loadMore" message="helpLoadMore" />
      </div>
      {result && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700"
        >
          <span className="inline-flex items-center gap-1">
            {text("loadedCount")}: {result.received}
            <FieldHelp
              locale={locale}
              subject="loadedCount"
              message="helpLoadedCount"
            />
          </span>
          <span className="inline-flex items-center gap-1">
            {text("newCount")}: {result.stored}
            <FieldHelp
              locale={locale}
              subject="newCount"
              message="helpNewCount"
            />
          </span>
          <span className="inline-flex items-center gap-1">
            {text("nextBatch")}: {result.nextPage}
            <FieldHelp
              locale={locale}
              subject="nextBatch"
              message="helpNextBatch"
            />
          </span>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-amber-800">
          {text("error")} ({error})
        </p>
      )}
    </section>
  );
}
