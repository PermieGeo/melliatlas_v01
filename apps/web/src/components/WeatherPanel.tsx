import type { Coordinates, InspectionResponse } from "@melliatlas/contracts";
import { Cloud, Droplets, ExternalLink, Thermometer, Wind } from "lucide-react";
import type { Locale, MessageKey } from "../i18n";
import { formatTime, translate } from "../i18n";

export type WeatherState =
  | { status: "idle" | "loading" | "error" }
  | { status: "loaded"; value: InspectionResponse };

export function WeatherPanel({
  locale,
  point,
  state,
  retry,
}: {
  locale: Locale;
  point: Coordinates | null;
  state: WeatherState;
  retry(): void;
}) {
  const t = (key: MessageKey) => translate(locale, key);
  const metrics =
    state.status === "loaded"
      ? [
          {
            key: "temperature" as const,
            value: `${state.value.weather.temperatureC.toFixed(1)} °C`,
            icon: Thermometer,
          },
          {
            key: "humidity" as const,
            value: `${state.value.weather.relativeHumidityPct.toFixed(0)} %`,
            icon: Droplets,
          },
          {
            key: "wind" as const,
            value: `${state.value.weather.windSpeedMs.toFixed(1)} m/s`,
            icon: Wind,
          },
          {
            key: "precipitation" as const,
            value: `${state.value.weather.precipitationMm.toFixed(1)} mm`,
            icon: Cloud,
          },
        ]
      : [];
  return (
    <section
      aria-label={t("weather")}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="font-display text-lg font-bold">{t("weather")}</h2>
      <p className="mt-2 text-xs text-slate-500">
        {point
          ? `${point.lat.toFixed(4)}, ${point.lon.toFixed(4)}`
          : t("noPoint")}
      </p>
      {state.status === "idle" && (
        <p className="mt-5 text-sm text-slate-600">{t("selectPoint")}</p>
      )}
      {state.status === "loading" && (
        <p className="mt-5 text-sm" role="status">
          {t("weatherLoading")}
        </p>
      )}
      {state.status === "error" && (
        <div className="mt-5 space-y-3" role="alert">
          <p className="text-sm text-amber-800">{t("weatherError")}</p>
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white"
            onClick={retry}
          >
            {t("retry")}
          </button>
        </div>
      )}
      {state.status === "loaded" && (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2">
            {metrics.map(({ key, value, icon: Icon }) => (
              <div key={key} className="rounded-xl bg-slate-50 p-3">
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Icon size={14} />
                  {t(key)}
                </p>
                <p className="mt-1 font-display text-lg font-semibold">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <dl className="mt-4 space-y-2 text-xs text-slate-600">
            <div>
              <dt>{t("forecastTime")}</dt>
              <dd>{formatTime(locale, state.value.provenance.observedAt)}</dd>
            </div>
            <div>
              <dt>{t("retrievedAt")}</dt>
              <dd>{formatTime(locale, state.value.provenance.retrievedAt)}</dd>
            </div>
          </dl>
          <a
            href={state.value.provenance.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-700"
          >
            {state.value.provenance.sourceName}
            <ExternalLink size={14} />
          </a>
        </>
      )}
      <p className="mt-5 border-t border-slate-100 pt-3 text-xs text-slate-500">
        {t("weatherSource")}
      </p>
    </section>
  );
}
