// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { useEffect, useRef, useState } from "react";
import {
  viewportCollectionSelectionSchema,
  type Coordinates,
  type ViewportIndexCenter,
  type ViewportCollectionResult,
  type ViewportCollectionSelection,
  type SaturnDistrictCatalogResponse,
} from "@melliatlas/contracts";
import {
  fetchDistrictViewportPage,
  loadDistrictViewportProgress,
  loadSaturnDistrictCatalog,
  loadSavedDistrictPoints,
  refreshSaturnDistrictCatalog,
} from "../api/client";
import { translate, type Locale, type MessageKey } from "../i18n";

type Props = {
  locale: Locale;
  viewport: readonly [number, number, number, number] | null;
  onFocusDistrict(point: Coordinates): void;
  onCachedCentersChange(points: ViewportIndexCenter[]): void;
};
type Action = "status" | "next";
const pilotDistrict = {
  id: 1477,
  name: "Ярцевский район",
  latitude: 55.06,
  longitude: 32.68,
};

/** One explicit click fetches one page; selected-district markers always read the shared DB archive. */
export function DistrictViewportPanel({
  locale,
  viewport,
  onFocusDistrict,
  onCachedCentersChange,
}: Props) {
  const t = (key: MessageKey): string => translate(locale, key);
  const [districtId, setDistrictId] = useState("");
  const [catalog, setCatalog] = useState<SaturnDistrictCatalogResponse | null>(
    null,
  );
  const [fromDate, setFromDate] = useState("2026-08-01");
  const [toDate, setToDate] = useState("2026-11-30");
  const [progress, setProgress] = useState<ViewportCollectionResult | null>(
    null,
  );
  const [knownCenters, setKnownCenters] = useState<number | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);
  const districtSequence = useRef(0);
  const key = `${districtId}|${fromDate}|${toDate}|${viewport?.join(",") ?? ""}`;
  const districts = (
    catalog?.districts.length ? catalog.districts : [pilotDistrict]
  )
    .slice()
    .sort((a, b) =>
      a.name.localeCompare(b.name, locale === "ru" ? "ru-RU" : "en-GB"),
    );
  const selection: ViewportCollectionSelection | null =
    districtId && viewport
      ? {
          districtId: Number(districtId),
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

  useEffect(() => {
    let alive = true;
    void loadSaturnDistrictCatalog()
      .then((value) => {
        if (alive) setCatalog(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Loaded centers are shared between viewports, not restricted to the current UpdateMap filter.
  useEffect(() => {
    const sequence = ++districtSequence.current;
    setKnownCenters(null);
    onCachedCentersChange([]);
    if (!districtId) return;
    void loadSavedDistrictPoints(Number(districtId))
      .then((value) => {
        if (sequence !== districtSequence.current) return;
        setKnownCenters(value.totalKnown);
        onCachedCentersChange(value.centers);
      })
      .catch(() => {
        if (sequence === districtSequence.current) setKnownCenters(0);
      });
  }, [districtId, onCachedCentersChange]);

  // Inspection reads only the exact selection and never starts a provider request.
  useEffect(() => {
    const sequence = ++requestSequence.current;
    setProgress(null);
    setError("");
    if (!selection || !valid) return;
    const timer = setTimeout(() => {
      void loadDistrictViewportProgress(selection)
        .then((value) => {
          if (requestSequence.current === sequence) setProgress(value);
        })
        .catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [key, valid]);

  async function refreshCenters(id: number): Promise<void> {
    const result = await loadSavedDistrictPoints(id);
    if (districtId === String(id)) {
      setKnownCenters(result.totalKnown);
      onCachedCentersChange(result.centers);
    }
  }

  async function refreshDirectory(): Promise<void> {
    setCatalogBusy(true);
    setError("");
    try {
      setCatalog(await refreshSaturnDistrictCatalog());
    } catch (cause) {
      setError(localizeError(cause));
    } finally {
      setCatalogBusy(false);
    }
  }

  function localizeError(cause: unknown): string {
    const code = cause instanceof Error ? cause.message : "REQUEST_FAILED";
    return code === "SOURCE_THROTTLED"
      ? t("districtThrottle")
      : code === "SATURN_VIEWPORT_DISABLED"
        ? t("districtDisabled")
        : code === "LOCAL_VIEWPORT_ONLY"
          ? t("districtLocalOnly")
          : code === "DISTRICT_NOT_IN_CATALOG"
            ? t("districtCatalogMissing")
            : t("districtLoadFailed");
  }

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
        await refreshCenters(selection.districtId);
      }
    } catch (cause) {
      if (requestSequence.current === sequence) setError(localizeError(cause));
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
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
        <button
          type="button"
          disabled={catalogBusy}
          onClick={() => void refreshDirectory()}
          className="rounded-lg border border-emerald-700 px-3 py-2 font-semibold text-emerald-900 disabled:opacity-40"
        >
          {catalogBusy ? t("districtBusy") : t("districtRefreshCatalog")}
        </button>
        <span>
          {catalog?.retrievedAt
            ? `${t("districtCatalogUpdated")}: ${new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", { dateStyle: "medium" }).format(new Date(catalog.retrievedAt))}`
            : t("districtCatalogMissing")}
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="text-sm font-medium">
          {t("districtSelect")}
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5"
            value={districtId}
            disabled={busy}
            onChange={(event) => {
              setDistrictId(event.target.value);
              const selected = districts.find(
                (item) => String(item.id) === event.target.value,
              );
              if (selected)
                onFocusDistrict({
                  lat: selected.latitude,
                  lon: selected.longitude,
                });
            }}
          >
            <option value="">{t("districtChoose")}</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
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
      {districtId && (
        <p role="status" className="mt-2 text-sm font-semibold text-blue-800">
          {t("districtArchiveCount")}: {knownCenters ?? "…"}.{" "}
          {t("districtArchiveNote")}
        </p>
      )}
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
          <p>{complete ? t("districtComplete") : t("districtPartial")}</p>
          {!progress.progress.sourceRevisionCurrent && (
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
