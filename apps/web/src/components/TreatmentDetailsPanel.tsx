// Feature IDs: NOTICES.MAP_OVERLAY, NOTICES.SPATIAL_PRECISION
import type { MapTreatment } from "@melliatlas/contracts";
import { ExternalLink, X } from "lucide-react";
import { formatTime, translate, type Locale, type MessageKey } from "../i18n";

/** Split source-provided cadastral references into separate display entries. */
export function cadastralEntries(value: string | null): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(/[;,\n]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

/** Render source-attributed treatment facts without claiming independent safety verification. */
export function TreatmentFacts({
  locale,
  notice,
}: {
  locale: Locale;
  notice: MapTreatment;
}) {
  const t = (key: MessageKey): string => translate(locale, key);
  const cadastral = cadastralEntries(notice.cadastralNumber);
  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold break-words">
        {notice.contractorName ?? t("unknown")}
      </p>
      <div>
        <p className="text-xs font-semibold text-slate-600">
          {t("cadastralNumbers")}
        </p>
        {cadastral.length ? (
          <ul className="mt-1 space-y-1 break-all" data-testid="cadastral-list">
            {cadastral.map((value) => (
              <li
                key={value}
                className="rounded bg-slate-50 px-2 py-1 font-mono text-xs"
              >
                {value}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("unknown")}</p>
        )}
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-600">{t("period")}</p>
        <p>
          {notice.startAt ? formatTime(locale, notice.startAt) : t("unknown")} —{" "}
          {notice.endAt ? formatTime(locale, notice.endAt) : t("unknown")}
        </p>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-600">{t("substance")}</p>
        {notice.treatments.length ? (
          <ul className="mt-1 space-y-2">
            {notice.treatments.map((item, index) => (
              <li key={index} className="rounded bg-slate-50 p-2">
                <p className="font-medium break-words">
                  {item.name ?? t("unknown")}
                </p>
                {item.crop && (
                  <p className="text-xs text-slate-600">
                    {t("crop")}: {item.crop}
                  </p>
                )}
                {item.beeHazardClass !== null && (
                  <p className="text-xs text-slate-600">
                    {t("beeHazardClass")}: {item.beeHazardClass}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("noProducts")}</p>
        )}
      </div>
      <div className="border-t border-slate-100 pt-2 text-xs text-slate-600">
        <p>
          {t("source")}: {notice.sourceName}
        </p>
        <p>
          {t("retrievedAt")}: {formatTime(locale, notice.retrievedAt)}
        </p>
        <p className="mt-1">
          {notice.reviewStatus === "verified" ? t("verified") : t("unverified")}
        </p>
        <a
          href={notice.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-indigo-700"
        >
          {t("original")} <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}

/** Display selected field details below the compact weather card. */
export function TreatmentDetailsPanel({
  locale,
  notice,
  onClose,
}: {
  locale: Locale;
  notice: MapTreatment | null;
  onClose(): void;
}) {
  const t = (key: MessageKey): string => translate(locale, key);
  return (
    <section
      aria-label={t("treatmentDetails")}
      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h2 className="font-display text-base font-bold">
          {t("treatmentDetails")}
        </h2>
        {notice && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeDetails")}
            className="rounded p-1 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {notice ? (
        <TreatmentFacts locale={locale} notice={notice} />
      ) : (
        <p className="text-sm text-slate-500">{t("chooseTreatment")}</p>
      )}
    </section>
  );
}
