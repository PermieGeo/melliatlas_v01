// Feature IDs: MAP.POINT_SELECTION, UX.MOBILE_MAP, WEATHER.POINT_FORECAST, NOTICES.MAP_OVERLAY
import type { Coordinates, MapTreatment } from "@melliatlas/contracts";
import { Layers3, MapPin, RefreshCw, Info, CircleHelp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { inspectLocation, loadMapTreatments } from "./api/client";
import { MapCanvas } from "./components/MapCanvas";
import { WeatherPanel, type WeatherState } from "./components/WeatherPanel";
import { TreatmentDetailsPanel } from "./components/TreatmentDetailsPanel";
import { HelpPage } from "./components/HelpPage";
import { translate, type Locale, type MessageKey } from "./i18n";

const defaultFocus: Coordinates = { lat: 54.782, lon: 32.045 };
type LayerState =
  { status: "loading" | "error" } | { status: "loaded"; value: MapTreatment[] };

export default function App() {
  const [locale, setLocale] = useState<Locale>("ru");
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `${translate(locale, "appTitle")} — ${translate(locale, "appSubtitle")}`;
  }, [locale]);
  const t = (key: MessageKey) => translate(locale, key);
  const [view, setView] = useState<"map" | "help">("map");
  const [point, setPoint] = useState<Coordinates | null>(null);
  const [radius, setRadius] = useState(3);
  const [refresh, setRefresh] = useState(0);
  const [retry, setRetry] = useState(0);
  const [layers, setLayers] = useState<LayerState>({ status: "loading" });
  const [weather, setWeather] = useState<WeatherState>({ status: "idle" });
  const [showTreatments, setShowTreatments] = useState(true);
  const [selectedTreatment, setSelectedTreatment] =
    useState<MapTreatment | null>(null);
  const [viewport, setViewport] = useState<
    [number, number, number, number] | null
  >(null);
  const onViewportChange = useCallback(
    (bbox: [number, number, number, number]) => {
      setViewport((previous) =>
        previous &&
        previous.every(
          (value, index) => Math.abs(value - bbox[index]) < 0.000001,
        )
          ? previous
          : bbox,
      );
    },
    [],
  );

  useEffect(() => {
    if (!viewport) return;
    const controller = new AbortController();
    setLayers({ status: "loading" });
    loadMapTreatments(controller.signal, viewport)
      .then((value) => {
        if (controller.signal.aborted) return;
        setLayers({ status: "loaded", value });
        setSelectedTreatment((previous) =>
          previous
            ? (value.find((item) => item.id === previous.id) ?? null)
            : null,
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) setLayers({ status: "error" });
      });
    return () => controller.abort();
  }, [refresh, viewport]);

  useEffect(() => {
    if (!point) {
      setWeather({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setWeather({ status: "loading" });
    inspectLocation(point, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setWeather({ status: "loaded", value });
      })
      .catch(() => {
        if (!controller.signal.aborted) setWeather({ status: "error" });
      });
    return () => controller.abort();
  }, [point, retry]);

  return (
    <div className="min-h-screen bg-[var(--ma-page-bg)] text-[var(--ma-ink)]">
      <header className="border-b border-[var(--ma-border)] bg-[var(--ma-surface)]">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-8">
          <div>
            <p className="font-display text-xl font-extrabold tracking-tight">
              Melli<span className="text-emerald-700">Atlas</span>
            </p>
            <p className="text-xs text-slate-500">{t("appSubtitle")}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden items-center gap-1.5 text-xs text-emerald-800 sm:flex">
              <Info size={15} />
              {t("sourceReviewNotice")}
            </span>
            <nav
              aria-label={t("navigation")}
              className="flex items-center gap-1 rounded-lg bg-[var(--ma-soft)] p-1"
            >
              <button
                type="button"
                aria-current={view === "map" ? "page" : undefined}
                onClick={() => setView("map")}
                className={`rounded-md px-3 py-2 text-sm ${view === "map" ? "bg-[var(--ma-accent)] text-white" : "text-slate-700"}`}
              >
                {t("mapNav")}
              </button>
              <button
                type="button"
                aria-current={view === "help" ? "page" : undefined}
                onClick={() => setView("help")}
                className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm ${view === "help" ? "bg-[var(--ma-accent)] text-white" : "text-slate-700"}`}
              >
                <CircleHelp size={16} />
                {t("help")}
              </button>
            </nav>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              {t("language")}
              <select
                aria-label={t("language")}
                value={locale}
                onChange={(event) => setLocale(event.target.value as Locale)}
                className="rounded-lg border border-slate-200 bg-white p-2"
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-5 md:px-8">
        {view === "map" ? (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">
                  {t("overview")}
                </p>
                <h1 className="mt-1 font-display text-2xl font-bold">
                  {t("map")}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setRefresh((value) => value + 1)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--ma-accent-hover)]"
              >
                <RefreshCw size={16} />
                {t("refresh")}
              </button>
            </div>
            <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)_300px]">
              <aside
                aria-label={t("layers")}
                className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <h2 className="flex items-center gap-2 font-semibold">
                  <Layers3 size={17} />
                  {t("layers")}
                </h2>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={showTreatments}
                    onChange={(event) => {
                      setShowTreatments(event.target.checked);
                      setSelectedTreatment(null);
                    }}
                    className="mt-1 accent-emerald-700"
                  />
                  {t("treatments")}
                </label>
                <p className="text-xs leading-relaxed text-slate-500">
                  {t("sourceReviewNotice")}
                </p>
                <div className="border-t border-slate-100 pt-4">
                  <label className="text-sm font-semibold" htmlFor="radius">
                    {t("radius")}: {radius} km
                  </label>
                  <input
                    id="radius"
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={radius}
                    onChange={(event) => setRadius(Number(event.target.value))}
                    className="mt-3 w-full accent-emerald-700"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    {t("radiusVisualizationOnly")}
                  </p>
                </div>
              </aside>
              <section
                aria-label={t("map")}
                className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex flex-wrap justify-between gap-2 px-2 pb-3 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} />
                    {point
                      ? `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`
                      : t("noPoint")}
                  </span>
                  <span role="status">
                    {layers.status === "loaded"
                      ? `${t("polygonCount")}: ${layers.value.length}`
                      : t(
                          layers.status === "error"
                            ? "mapLoadError"
                            : "loading",
                        )}
                  </span>
                </div>
                {layers.status === "loaded" &&
                  layers.value.some((item) =>
                    item.sourceName.startsWith("DEMO —"),
                  ) && (
                    <p
                      role="note"
                      className="mb-2 rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm font-semibold text-amber-950"
                    >
                      {t("syntheticDataNotice")}
                    </p>
                  )}
                {layers.status === "loaded" && layers.value.length === 0 && (
                  <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                    {t("noTreatments")}
                  </p>
                )}
                {layers.status === "loaded" && layers.value.length >= 200 && (
                  <p className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                    {t("mapLimitNotice")}
                  </p>
                )}
                <MapCanvas
                  locale={locale}
                  focus={defaultFocus}
                  selected={point}
                  radiusKm={radius}
                  onSelect={setPoint}
                  onViewportChange={onViewportChange}
                  onSelectTreatment={setSelectedTreatment}
                  selectedTreatmentId={selectedTreatment?.id ?? null}
                  treatments={
                    showTreatments && layers.status === "loaded"
                      ? layers.value
                      : []
                  }
                />
                <p className="px-2 pt-3 text-xs text-slate-500">
                  {t("mapSource")}
                </p>
              </section>
              <aside
                className="min-w-0 space-y-3"
                aria-label={t("locationInfo")}
              >
                <WeatherPanel
                  locale={locale}
                  point={point}
                  state={weather}
                  retry={() => setRetry((value) => value + 1)}
                />
                <TreatmentDetailsPanel
                  locale={locale}
                  notice={selectedTreatment}
                  onClose={() => setSelectedTreatment(null)}
                />
              </aside>
            </div>
          </>
        ) : (
          <HelpPage locale={locale} onShowMap={() => setView("map")} />
        )}
      </main>
    </div>
  );
}
