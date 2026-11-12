// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { useEffect, useRef, useState } from "react";
import {
  viewportCollectionSelectionSchema,
  type SaturnRegionCatalogResponse,
  type SaturnDistrictCatalogResponse,
} from "@melliatlas/contracts";
import type {
  ViewportCollectionResult,
  ViewportCollectionSelection,
} from "@melliatlas/contracts";
import {
  loadViewportProgress,
  fetchViewportNextPage,
  loadOperatorSaturnRegions,
  loadOperatorSaturnDistricts,
  refreshOperatorSaturnDistricts,
} from "../api/client";
import { t, type Key, type Locale } from "../i18n";

const initial: ViewportCollectionSelection = {
  regionCode: "",
  districtId: 0,
  bbox: {
    west: 0,
    south: 0,
    east: 0,
    north: 0,
  },
  fromDate: "2026-08-01",
  toDate: "2026-11-30",
};

/** Explicit one-page live collection; never fetch on map movement or field edits. */
export function ViewportCollectionPanel({ locale }: { locale: Locale }) {
  const [selection, setSelection] = useState(initial);
  const selectedRegionRef = useRef(selection.regionCode);
  selectedRegionRef.current = selection.regionCode;
  const [regions, setRegions] = useState<
    SaturnRegionCatalogResponse["regions"]
  >([]);
  const [districts, setDistricts] = useState<
    SaturnDistrictCatalogResponse["districts"]
  >([]);
  const [result, setResult] = useState<ViewportCollectionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const [regionsError, setRegionsError] = useState("");
  const [regionsLoaded, setRegionsLoaded] = useState(false);
  const [districtsError, setDistrictsError] = useState("");
  const [error, setError] = useState("");
  const text = (key: Key): string => t(locale, key);
  useEffect(() => {
    let active = true;
    setRegionsError("");
    setRegionsLoaded(false);
    void loadOperatorSaturnRegions()
      .then((value) => {
        if (active) {
          setRegions(value.regions);
          setRegionsLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setRegionsError(text("viewportDirectoryFailed"));
          setRegionsLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setDistricts([]);
    setDistrictsError("");
    if (!selection.regionCode) return;
    void loadOperatorSaturnDistricts(selection.regionCode)
      .then((value) => {
        if (active) setDistricts(value.districts);
      })
      .catch(() => {
        if (active) setDistrictsError(text("viewportDirectoryFailed"));
      });
    return () => {
      active = false;
    };
  }, [selection.regionCode]);
  async function refreshDirectory(): Promise<void> {
    if (!selection.regionCode) return;
    const regionCode = selection.regionCode;
    setCatalogBusy(true);
    setCatalogError("");
    try {
      const result = await refreshOperatorSaturnDistricts(regionCode);
      if (regionCode === selectedRegionRef.current) {
        setDistricts(result.districts);
        setDistrictsError("");
      }
    } catch (cause) {
      if (regionCode === selectedRegionRef.current)
        setCatalogError(
          cause instanceof Error ? cause.message : "REQUEST_FAILED",
        );
    } finally {
      setCatalogBusy(false);
    }
  }
  const valid = viewportCollectionSelectionSchema.safeParse(selection).success;
  async function run(action: "status" | "next"): Promise<void> {
    if (!valid) return;
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
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          {text("viewportRegion")}
          <select
            aria-label={text("viewportRegion")}
            className="mt-1 w-full rounded border p-2"
            value={selection.regionCode}
            onChange={(event) => {
              selectedRegionRef.current = event.target.value;
              setSelection((value) => ({
                ...value,
                regionCode: event.target.value,
                districtId: 0,
              }));
              setResult(null);
            }}
          >
            <option value="">—</option>
            {regions.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          {text("viewportDistrict")}
          <select
            aria-label={text("viewportDistrict")}
            className="mt-1 w-full rounded border p-2"
            value={selection.districtId}
            onChange={(event) => {
              setSelection((value) => ({
                ...value,
                districtId: Number(event.target.value),
              }));
              setResult(null);
            }}
          >
            <option value={0}>—</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {regionsLoaded && regions.length === 0 && !regionsError && (
        <p role="status" className="text-sm text-amber-800">
          {text("viewportNoRegions")}
        </p>
      )}
      {regionsError && (
        <p role="alert" className="text-sm text-amber-800">
          {regionsError}
        </p>
      )}
      {districtsError && (
        <p role="alert" className="text-sm text-amber-800">
          {districtsError}
        </p>
      )}
      {selection.regionCode && districts.length === 0 && !districtsError && (
        <p role="status" className="text-sm text-slate-600">
          {text("viewportNoDistricts")}
        </p>
      )}
      <button
        type="button"
        disabled={!selection.regionCode || catalogBusy}
        onClick={() => void refreshDirectory()}
        className="rounded-lg border border-emerald-700 px-3 py-2 text-sm font-medium text-emerald-900 disabled:opacity-50"
      >
        {catalogBusy ? text("loading") : text("viewportRefreshDirectory")}
      </button>
      {catalogError && (
        <p role="alert" className="text-sm text-amber-800">
          {catalogError}
        </p>
      )}
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
          disabled={busy || !valid}
          onClick={() => void run("status")}
        >
          {text("viewportCheck")}
        </button>
        <button
          className="rounded-lg bg-emerald-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          type="button"
          disabled={!valid || busy || complete || result?.enabled === false}
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
