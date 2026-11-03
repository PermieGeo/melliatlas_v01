import { translate, type Locale, type MessageKey } from "../i18n";

const steps: Array<{ title: MessageKey; body: MessageKey }> = [
  { title: "helpSelectField", body: "helpSelectFieldBody" },
  { title: "helpInspectSource", body: "helpInspectSourceBody" },
  { title: "helpWeather", body: "helpWeatherBody" },
  { title: "helpRefreshMap", body: "helpRefreshMapBody" },
];

/** Public, localized usage guidance without source-verified safety claims. */
export function HelpPage({
  locale,
  onShowMap,
}: {
  locale: Locale;
  onShowMap(): void;
}) {
  const t = (key: MessageKey): string => translate(locale, key);
  return (
    <section
      aria-label={t("help")}
      className="mx-auto max-w-4xl space-y-5 rounded-2xl bg-white p-5 shadow-sm md:p-8"
    >
      <h1 className="font-display text-2xl font-bold">{t("helpTitle")}</h1>
      <p className="text-sm leading-relaxed text-slate-700">{t("helpIntro")}</p>
      <ol className="grid gap-4 md:grid-cols-2">
        {steps.map(({ title, body }, index) => (
          <li key={title} className="rounded-xl border border-slate-200 p-4">
            <h2 className="font-bold">
              {index + 1}. {t(title)}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {t(body)}
            </p>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <h2 className="font-bold">{t("helpDemoTitle")}</h2>
        <p className="mt-2">{t("helpDemoBody")}</p>
      </div>
      <p className="text-sm text-slate-700">{t("helpLimitations")}</p>
      <button
        type="button"
        onClick={onShowMap}
        className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
      >
        {t("backToMap")}
      </button>
    </section>
  );
}
