// Feature IDs: MAP.POINT_SELECTION, NOTICES.MAP_OVERLAY
import { useEffect, useState } from "react";
import type {
  Coordinates,
  TerritoryRegionsResponse,
  TerritoryDistrictsResponse,
} from "@melliatlas/contracts";
import { loadTerritoryRegions, loadTerritoryDistricts } from "../api/client";
import { translate, type Locale, type MessageKey } from "../i18n";

type Props = { locale: Locale; onFocus(point: Coordinates): void };
type Loaded<T> =
  { status: "loading" | "error" } | { status: "ready"; value: T };

/** Read-only navigation over saved territorial names and centers; never fetch source data. */
export function TerritorySelector({ locale, onFocus }: Props) {
  const t = (key: MessageKey) => translate(locale, key);
  const [regions, setRegions] = useState<
    Loaded<TerritoryRegionsResponse["regions"]>
  >({ status: "loading" });
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [districts, setDistricts] = useState<
    Loaded<TerritoryDistrictsResponse["districts"]>
  >({ status: "ready", value: [] });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setRegions({ status: "loading" });
    loadTerritoryRegions(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setRegions({ status: "ready", value: result.regions });
      })
      .catch(() => {
        if (!controller.signal.aborted) setRegions({ status: "error" });
      });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const controller = new AbortController();
    setSelectedDistrict("");
    if (!selectedRegion) {
      setDistricts({ status: "ready", value: [] });
      return () => controller.abort();
    }
    setDistricts({ status: "loading" });
    loadTerritoryDistricts(selectedRegion, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setDistricts({ status: "ready", value: result.districts });
      })
      .catch(() => {
        if (!controller.signal.aborted) setDistricts({ status: "error" });
      });
    return () => controller.abort();
  }, [selectedRegion, retry]);

  return (
    <section
      aria-label={t("territoryTitle")}
      className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm"
    >
      <h2 className="font-semibold text-emerald-900">{t("territoryTitle")}</h2>
      <p className="mt-1 text-sm text-slate-600">{t("territoryExplanation")}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {t("territoryRegion")}
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            <option value="">{t("territoryChooseRegion")}</option>
            {regions.status === "ready" &&
              regions.value.map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t("territoryDistrict")}
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5"
            value={selectedDistrict}
            disabled={!selectedRegion || districts.status !== "ready"}
            onChange={(event) => {
              setSelectedDistrict(event.target.value);
              if (districts.status === "ready") {
                const found = districts.value.find(
                  (item) => item.id === event.target.value,
                );
                if (found) onFocus(found.center);
              }
            }}
          >
            <option value="">{t("territoryChooseDistrict")}</option>
            {districts.status === "ready" &&
              districts.value.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {regions.status === "loading" && (
        <p role="status" className="mt-2 text-sm">
          {t("territoryLoading")}
        </p>
      )}
      {regions.status === "ready" && regions.value.length === 0 && (
        <p role="status" className="mt-2 text-sm text-amber-800">
          {t("territoryEmptyRegions")}
        </p>
      )}
      {regions.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-amber-800">
          {t("territoryLoadError")}
        </p>
      )}
      {districts.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-amber-800">
          {t("territoryLoadError")}
        </p>
      )}
      {selectedRegion &&
        districts.status === "ready" &&
        districts.value.length === 0 && (
          <p role="status" className="mt-2 text-sm text-slate-600">
            {t("territoryEmptyDistricts")}
          </p>
        )}
      {(regions.status === "error" || districts.status === "error") && (
        <button
          type="button"
          className="mt-2 rounded border px-3 py-1.5 text-sm"
          onClick={() => setRetry((value) => value + 1)}
        >
          {t("retry")}
        </button>
      )}
    </section>
  );
}
