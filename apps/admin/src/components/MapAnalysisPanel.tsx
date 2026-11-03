// Feature IDs: NOTICES.MAP_OVERLAY
import type { MapTreatment } from "@melliatlas/contracts";
import { t, type Locale } from "../i18n";

/** Summarize only the records present in the currently loaded preview response. */
export function MapAnalysisPanel({
  locale,
  notices,
}: {
  locale: Locale;
  notices: MapTreatment[];
}) {
  const verified = notices.filter(
    (notice: MapTreatment): boolean => notice.reviewStatus === "verified",
  ).length;
  const metrics = [
    { key: "analysisVisible", value: notices.length },
    { key: "analysisVerified", value: verified },
    { key: "analysisUnreviewed", value: notices.length - verified },
  ] as const;

  return (
    <section
      aria-label={t(locale, "analysisSummary")}
      className="space-y-3 rounded-2xl border border-[var(--ma-border)] bg-white p-4"
    >
      <h3 className="text-lg font-bold">{t(locale, "analysisSummary")}</h3>
      <p className="text-sm text-[var(--ma-muted)]">
        {t(locale, "analysisScope")}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {metrics.map(({ key, value }) => (
          <div key={key} className="rounded-xl bg-[var(--ma-soft)] p-4">
            <p className="text-sm text-[var(--ma-muted)]">{t(locale, key)}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-[var(--ma-muted)]">
        {notices.length === 0
          ? t(locale, "analysisEmpty")
          : t(locale, "analysisFuture")}
      </p>
    </section>
  );
}
