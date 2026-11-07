// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { useEffect, useRef, useState } from "react";
import {
  viewportCollectionSelectionSchema,
  type Coordinates,
  type ViewportIndexCenter,
  type ViewportCollectionResult,
  type ViewportCollectionSelection,
} from "@melliatlas/contracts";
import {
  fetchDistrictViewportPage,
  loadDistrictViewportProgress,
} from "../api/client";
import { translate, type Locale, type MessageKey } from "../i18n";

type Props = {
  locale: Locale;
  viewport: readonly [number, number, number, number] | null;
  onFocusDistrict(point: Coordinates): void;
  onCachedCentersChange(points: ViewportIndexCenter[]): void;
};

type Action = "status" | "next";

/** Show a visible, consent-driven local pilot fetch separate from stored treatment polygons. */
export function DistrictViewportPanel({
  locale,
  viewport,
  onFocusDistrict,
  onCachedCentersChange,
}: Props) {
  const t = (key: MessageKey): string => translate(locale, key);
  const [districtId, setDistrictId] = useState("");
  const [fromDate, setFromDate] = useState("2026-08-01");
  const [toDate, setToDate] = useState("2026-11-30");
  const [progress, setProgress] = useState<ViewportCollectionResult | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const key = `${districtId}|${fromDate}|${toDate}|${viewport?.join(",") ?? ""}`;

  const selection: ViewportCollectionSelection | null =
    districtId === "1477" && viewport
      ? {
          districtId: 1477,
          bbox: {
            west: viewport[0],
            south: viewport[1],
            east: viewport[2],
            north: viewport[3],
          },
          fromDate,
          toDate,
        }
      : null;
  const parsed = selection
    ? viewportCollectionSelectionSchema.safeParse(selection)
    : null;
  const valid = parsed?.success === true;
  const invalidDates =
    parsed?.success === false &&
    parsed.error.issues.some(
      (issue) => issue.message === "Invalid bounded UpdateMap window",
    );
  const complete = progress?.progress?.state === "viewport_index_complete";

  // Read only the exact cached selection; never start external collection on navigation.
  useEffect(() => {
    const sequence = ++requestSequence.current;
    setProgress(null);
    setError("");
    onCachedCentersChange([]);
    if (!selection || !valid) return;
    const timer = setTimeout(() => {
      void loadDistrictViewportProgress(selection)
        .then((result) => {
          if (requestSequence.current !== sequence) return;
          setProgress(result);
          onCachedCentersChange(result.cachedCenters ?? []);
        })
        .catch(() => {
          // The explicit cache button remains available for localized error feedback.
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [key, valid, onCachedCentersChange]);

  async function run(action: Action): Promise<void> {
    if (!selection || !valid) return;
    const sequence = ++requestSequence.current;
    setBusy(true);
    setError("");
    try {
      const result =
        action === "status"
          ? await loadDistrictViewportProgress(selection)
          : await fetchDistrictViewportPage(selection);
      if (requestSequence.current === sequence) {
        setProgress(result);
        onCachedCentersChange(result.cachedCenters ?? []);
      }
    } catch (cause) {
      if (requestSequence.current === sequence) {
        const code = cause instanceof Error ? cause.message : "REQUEST_FAILED";
        setError(
          code === "SOURCE_THROTTLED"
            ? t("districtThrottle")
            : code === "SATURN_VIEWPORT_DISABLED"
              ? t("districtDisabled")
              : code === "LOCAL_VIEWPORT_ONLY"
                ? t("districtLocalOnly")
                : t("districtLoadFailed"),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  function limitToFourMonths(): void {
    const end = new Date(`${toDate}T00:00:00.000Z`);
    if (!Number.isFinite(end.valueOf())) return;
    end.setUTCDate(end.getUTCDate() - 123);
    setFromDate(end.toISOString().slice(0, 10));
  }

  return (
    <section
      aria-label={t("districtPanelTitle")}
      className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-bold text-emerald-900">
        {t("districtPanelTitle")}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t("districtSteps")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-sm font-medium">
          {t("districtSelect")}
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5"
            value={districtId}
            disabled={busy}
            onChange={(event) => {
              setDistrictId(event.target.value);
              if (event.target.value === "1477")
                onFocusDistrict({ lat: 55.06, lon: 32.68 });
            }}
          >
            <option value="">{t("districtChoose")}</option>
            <option value="1477">{t("districtYartsevo")}</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium">
            {t("districtFrom")}
            <input
              className="mt-1 block w-full rounded-lg border p-2.5"
              type="date"
              value={fromDate}
              disabled={busy}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label className="text-xs font-medium">
            {t("districtTo")}
            <input
              className="mt-1 block w-full rounded-lg border p-2.5"
              type="date"
              value={toDate}
              disabled={busy}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!valid || busy}
            onClick={() => void run("status")}
            className="rounded-lg border border-emerald-700 px-3 py-2.5 text-sm disabled:opacity-40"
          >
            {t("districtCheck")}
          </button>
          <button
            type="button"
            disabled={
              !valid ||
              busy ||
              complete ||
              progress?.enabled === false ||
              progress?.progress?.sourceRevisionCurrent === false
            }
            onClick={() => void run("next")}
            className="rounded-lg bg-emerald-800 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? t("districtBusy") : t("districtFetch")}
          </button>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-600">{t("districtHint")}</p>
      {districtId && !valid && (
        <div role="status" className="mt-2 space-y-2 text-sm text-amber-800">
          <p>
            {t(invalidDates ? "districtDatesInvalid" : "districtBoundsHint")}
          </p>
          {invalidDates && (
            <button
              type="button"
              onClick={limitToFourMonths}
              className="rounded-lg border border-amber-700 px-3 py-2 font-semibold"
            >
              {t("districtLimitDates")}
            </button>
          )}
        </div>
      )}
      {progress?.enabled === false && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {t("districtDisabled")}
        </p>
      )}
      {progress?.enabled && !progress.progress && (
        <p role="status" className="mt-2 text-sm">
          {t("districtNoPages")}
        </p>
      )}
      {progress?.progress && (
        <div
          role="status"
          className="mt-3 space-y-1 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950"
        >
          <p className="font-semibold">{t("districtCacheSaved")}</p>
          <p>
            {t("districtPageCount")}: {progress.progress.pagesFetched} /{" "}
            {progress.progress.totalPages ?? "?"}; {t("districtItemsCount")}:{" "}
            {progress.progress.entriesReceived}.
          </p>
          <p>
            {t("districtCachedPreview")}: {progress.cachedCenters?.length ?? 0}.
          </p>
          <p>{complete ? t("districtComplete") : t("districtPartial")}</p>
          {progress.progress.sourceRevisionCurrent === false && (
            <p>{t("districtStaleRevision")}</p>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-slate-600">{t("districtCacheKeyNote")}</p>
      {error && (
        <p role="alert" className="mt-2 text-sm text-amber-800">
          {error}
        </p>
      )}
    </section>
  );
}
