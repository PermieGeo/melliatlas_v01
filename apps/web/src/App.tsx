import type {
  Coordinates,
  InspectionResponse,
  SourceCatalogEntry,
} from "@melliatlas/contracts";
import {
  AlertCircle,
  ArrowUpRight,
  Cloud,
  CloudRain,
  Compass,
  Database,
  ExternalLink,
  Layers3,
  MapPin,
  MousePointer2,
  RefreshCw,
  Thermometer,
  Wind,
} from "lucide-react";
import { useEffect, useState } from "react";
import { inspectLocation, loadSourceCatalog } from "./api/client";
import { MapCanvas } from "./components/MapCanvas";

type Tab = "map" | "sources";
type RemoteState<T> =
  | { status: "idle" | "loading" }
  | { status: "loaded"; value: T }
  | { status: "error"; message: string };

const REGIONS = [
  { id: "smolensk", name: "Смоленск", lat: 54.782, lon: 32.045 },
  { id: "roslavl", name: "Рославль", lat: 53.952, lon: 32.863 },
  { id: "vyazma", name: "Вязьма", lat: 55.211, lon: 34.295 },
  { id: "pochinok", name: "Починок", lat: 54.405, lon: 32.44 },
] as const;

const initialFocus: Coordinates = { lat: REGIONS[0].lat, lon: REGIONS[0].lon };

function utcTime(iso: string): string {
  return `${new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(iso))} UTC`;
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Cloud;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5 text-slate-500" />
        {label}
      </div>
      <div className="mt-1.5 font-display text-lg font-bold text-slate-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function SourceCard({ source }: { source: SourceCatalogEntry }) {
  const kindNames: Record<SourceCatalogEntry["kind"], string> = {
    weather: "Метеоданные",
    basemap: "Картография",
    municipal_notice: "Муниципальные объявления",
    treatment: "Планы обработок",
    imagery: "Спутниковые данные",
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
            {kindNames[source.kind]}
          </p>
          <h3 className="mt-1 font-display text-base font-bold text-slate-900">
            {source.name}
          </h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
          {source.lifecycle === "configured"
            ? "Настроен"
            : source.lifecycle === "under_review"
              ? "Проверка"
              : "Отключён"}
        </span>
      </div>
      <dl className="mt-5 space-y-2.5 text-xs">
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Условия использования</dt>
          <dd className="text-right font-semibold text-slate-700">
            {source.termsReview === "reviewed"
              ? "Проверены"
              : "Ожидают проверки"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">Последняя загрузка в хранилище</dt>
          <dd className="text-right font-medium text-slate-700">
            {source.lastSuccessfulIngestAt
              ? utcTime(source.lastSuccessfulIngestAt)
              : "Не выполнялась"}
          </dd>
        </div>
      </dl>
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
      >
        Перейти к источнику <ExternalLink className="h-3 w-3" />
      </a>
    </article>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("map");
  const [regionId, setRegionId] =
    useState<(typeof REGIONS)[number]["id"]>("smolensk");
  const [focus, setFocus] = useState<Coordinates>(initialFocus);
  const [selected, setSelected] = useState<Coordinates | null>(null);
  const [radiusKm, setRadiusKm] = useState(3);
  const [refreshKey, setRefreshKey] = useState(0);
  const [inspection, setInspection] = useState<RemoteState<InspectionResponse>>(
    { status: "idle" },
  );
  const [sourceCatalog, setSourceCatalog] = useState<
    RemoteState<SourceCatalogEntry[]>
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    loadSourceCatalog(controller.signal)
      .then((sources) => setSourceCatalog({ status: "loaded", value: sources }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setSourceCatalog({
            status: "error",
            message: error instanceof Error ? error.message : "Ошибка загрузки",
          });
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selected) {
      setInspection({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    setInspection({ status: "loading" });
    inspectLocation(selected, controller.signal)
      .then((result) => setInspection({ status: "loaded", value: result }))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setInspection({
            status: "error",
            message:
              error instanceof Error ? error.message : "Источник недоступен",
          });
        }
      });
    return () => controller.abort();
  }, [selected, refreshKey]);

  const chooseRegion = (id: (typeof REGIONS)[number]["id"]) => {
    const region = REGIONS.find((item) => item.id === id)!;
    setRegionId(id);
    setFocus({ lat: region.lat, lon: region.lon });
    setSelected(null);
    setTab("map");
  };

  const locationLabel = selected
    ? `${selected.lat.toFixed(4)}° N, ${selected.lon.toFixed(4)}° E`
    : "Точка не выбрана";

  return (
    <div className="flex min-h-screen flex-col bg-[#F8FAFC] font-sans text-[#0F172A]">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-6 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
        <button
          type="button"
          onClick={() => setTab("map")}
          className="shrink-0 font-display text-lg font-extrabold tracking-tight text-slate-900"
        >
          Melli<span className="text-amber-600">Atlas</span>
        </button>
        <nav
          aria-label="Главное меню"
          className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex"
        >
          {(
            [
              ["map", "Карта и радиусы"],
              ["sources", "Источники данных"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`border-b-2 py-1 transition-colors ${tab === id ? "border-amber-600 font-semibold text-slate-900" : "border-transparent hover:text-slate-900"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:inline-flex">
            Пилот · Смоленская область
          </span>
          <span className="rounded-lg bg-slate-900 px-3 py-2 text-white">
            GIS · 67
          </span>
        </div>
      </header>

      <nav
        aria-label="Мобильное меню"
        className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2 md:hidden"
      >
        {(
          [
            ["map", "Карта"],
            ["sources", "Источники"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-semibold ${tab === id ? "bg-slate-900 text-white" : "text-slate-600"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <MapPin className="h-3.5 w-3.5 text-amber-600" /> Район обзора:
            </span>
            <div className="flex max-w-full flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
              {REGIONS.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => chooseRegion(region.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${region.id === regionId ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                >
                  {region.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              {locationLabel}
            </span>
            <button
              type="button"
              disabled={!selected || inspection.status === "loading"}
              onClick={() => setRefreshKey((value) => value + 1)}
              className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Обновить сводку
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-5 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
              MelliAtlas / геоинформационная платформа
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              {tab === "map"
                ? "Карта и обзор территории"
                : "Источники и происхождение данных"}
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
              {tab === "map"
                ? "Выберите любую точку карты, чтобы получить актуальную метеосводку с указанием источника и времени обновления."
                : "Текущие интеграции, условия доступа и история фактических загрузок в систему."}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Открытые
            данные · пилотный регион
          </div>
        </div>

        {tab === "map" ? (
          <div className="space-y-5">
            <section
              aria-label="Параметры карты"
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <Layers3 className="h-4 w-4 text-emerald-700" />{" "}
                Картографическая основа: OpenStreetMap
              </div>
              <label className="flex flex-wrap items-center gap-3 text-xs font-medium text-slate-600">
                Радиус обзора{" "}
                <strong className="font-mono text-indigo-700 tabular-nums">
                  {radiusKm.toFixed(1)} км
                </strong>
                <input
                  aria-label="Радиус обзора территории"
                  type="range"
                  min={1}
                  max={8}
                  step={0.5}
                  value={radiusKm}
                  onChange={(event) => setRadiusKm(Number(event.target.value))}
                  className="w-32 accent-amber-600 sm:w-40"
                />
              </label>
            </section>

            <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12">
              <section
                aria-label="Карта"
                className="rounded-xl border border-slate-200 bg-white p-3.5 lg:col-span-7"
              >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
                    <Compass className="h-3.5 w-3.5 text-amber-600" />{" "}
                    Территория Смоленской области
                  </div>
                  <span className="font-mono text-[11px] text-indigo-700 tabular-nums">
                    {locationLabel}
                  </span>
                </div>
                <MapCanvas
                  focus={focus}
                  selected={selected}
                  radiusKm={radiusKm}
                  onSelect={setSelected}
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-1 pt-3 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />{" "}
                    Выбранная точка
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full border border-dashed border-indigo-600 bg-indigo-100" />{" "}
                    Радиус обзора
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Данные карты © OpenStreetMap contributors
                  </span>
                </div>
              </section>

              <section
                aria-label="Сводка по точке"
                className="flex flex-col gap-3 lg:col-span-5"
              >
                <div className="inline-flex items-center gap-2 rounded-xl bg-slate-200/80 p-1 text-xs font-semibold text-slate-700">
                  <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2.5 shadow-sm">
                    <MousePointer2 className="h-3.5 w-3.5 text-indigo-600" />{" "}
                    Сводка выбранной точки
                  </span>
                </div>
                <div className="flex flex-1 flex-col rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">
                        Геосводка
                      </p>
                      <h2 className="mt-1 font-display text-lg font-bold text-slate-900">
                        {selected
                          ? "Метеоданные по координатам"
                          : "Выберите точку карты"}
                      </h2>
                      <p className="mt-1 font-mono text-xs text-slate-500 tabular-nums">
                        {locationLabel}
                      </p>
                    </div>
                    <span className="rounded-lg bg-slate-100 p-2 text-slate-600">
                      <Cloud className="h-5 w-5" />
                    </span>
                  </div>

                  {inspection.status === "idle" && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-14 text-center text-slate-500">
                      <MapPin className="h-9 w-9 text-slate-300" />
                      <p className="max-w-xs text-sm leading-relaxed">
                        Нажмите на карту, чтобы запросить прогноз для
                        конкретного места.
                      </p>
                    </div>
                  )}
                  {inspection.status === "loading" && (
                    <p
                      role="status"
                      className="py-10 text-center text-sm text-slate-600"
                    >
                      Получаем метеоданные из Open-Meteo…
                    </p>
                  )}
                  {inspection.status === "error" && (
                    <div
                      role="alert"
                      className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle className="h-4 w-4" /> Источник временно
                        недоступен
                      </div>
                      <p className="mt-2 text-xs leading-relaxed">
                        {inspection.message}
                      </p>
                      <button
                        onClick={() => setRefreshKey((key) => key + 1)}
                        className="mt-3 text-xs font-semibold underline underline-offset-2"
                      >
                        Повторить запрос
                      </button>
                    </div>
                  )}
                  {inspection.status === "loaded" && (
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-2.5">
                        <Metric
                          label="Температура воздуха"
                          value={`${inspection.value.weather.temperatureC.toFixed(1)} °C`}
                          icon={Thermometer}
                        />
                        <Metric
                          label="Влажность"
                          value={`${inspection.value.weather.relativeHumidityPct.toFixed(0)} %`}
                          icon={Cloud}
                        />
                        <Metric
                          label="Скорость ветра"
                          value={`${inspection.value.weather.windSpeedMs.toFixed(1)} м/с`}
                          icon={Wind}
                        />
                        <Metric
                          label="Осадки"
                          value={`${inspection.value.weather.precipitationMm.toFixed(1)} мм`}
                          icon={CloudRain}
                        />
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                        <p className="font-semibold text-slate-900">
                          Прогнозная модель
                        </p>
                        <p className="mt-1.5">
                          Время расчётного значения:{" "}
                          {utcTime(inspection.value.provenance.observedAt)}
                        </p>
                        <p className="mt-1">
                          Получено системой:{" "}
                          {utcTime(inspection.value.provenance.retrievedAt)}
                        </p>
                        <p className="mt-1">
                          Направление ветра:{" "}
                          {inspection.value.weather.windDirectionDeg.toFixed(0)}
                          °
                        </p>
                      </div>
                      <a
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
                        href={inspection.value.provenance.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {inspection.value.provenance.sourceName}{" "}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                  <p className="mt-auto border-t border-slate-100 pt-4 text-[11px] leading-relaxed text-slate-500">
                    Погодные значения предоставляются прогнозной моделью.
                    Решения об обработках и размещении пасек требуют
                    дополнительных подтверждённых источников.
                  </p>
                </div>
              </section>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <article className="flex gap-3 rounded-xl border border-slate-200 bg-white p-5">
                <Database className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Источники и достоверность
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Для каждой сводки указываются провайдер, время получения и
                    характер данных. Список подключений доступен отдельно.
                  </p>
                  <button
                    onClick={() => setTab("sources")}
                    className="mt-3 text-xs font-semibold text-indigo-700"
                  >
                    Посмотреть источники →
                  </button>
                </div>
              </article>
              <article className="flex gap-3 rounded-xl border border-slate-200 bg-white p-5">
                <Layers3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900">
                    Географический контекст
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Масштабируйте карту, выбирайте районы и задавайте радиус
                    вокруг интересующей точки. Пространственные наблюдения
                    появятся по мере синхронизации подтверждённых источников.
                  </p>
                </div>
              </article>
            </div>
          </div>
        ) : (
          <section aria-label="Реестр источников" className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-700" />
                <h2 className="font-display text-base font-bold">
                  Реестр подключений
                </h2>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">
                Статус «Настроен» означает наличие интеграции, а не
                подтверждённую полноту или свежесть всех геоданных. Отметка
                условий использования ведётся отдельно.
              </p>
            </div>
            {sourceCatalog.status === "loading" && (
              <p
                role="status"
                className="rounded-xl border border-slate-200 bg-white p-5 text-sm"
              >
                Загрузка реестра…
              </p>
            )}
            {sourceCatalog.status === "error" && (
              <div
                role="alert"
                className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
              >
                <AlertCircle className="mr-2 inline h-4 w-4" /> Не удалось
                загрузить реестр источников: {sourceCatalog.message}
              </div>
            )}
            {sourceCatalog.status === "loaded" && (
              <div className="grid gap-4 md:grid-cols-2">
                {sourceCatalog.value.map((source) => (
                  <SourceCard key={source.id} source={source} />
                ))}
                {sourceCatalog.value.length === 0 && (
                  <p className="text-sm text-slate-600">
                    Подключённые источники отсутствуют.
                  </p>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="mt-auto border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-2">
          <span>MelliAtlas · Геоданные и планирование для пчеловодов</span>
          <span>Пилотный регион: Смоленская область</span>
        </div>
      </footer>
    </div>
  );
}
