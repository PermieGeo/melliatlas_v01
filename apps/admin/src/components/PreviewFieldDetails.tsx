import type { MapTreatment } from "@melliatlas/contracts";
import { ExternalLink, X } from "lucide-react";
import { t, type Locale } from "../i18n";

/** Display persisted source claims without interpreting pesticide safety. */
export function PreviewFieldDetails({
  locale,
  notice,
  onClose,
}: {
  locale: Locale;
  notice: MapTreatment | null;
  onClose(): void;
}) {
  const formatDate = (value: string | null): string =>
    value
      ? new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(new Date(value)) + " UTC"
      : t(locale, "unknown");
  const cadastre = notice?.cadastralNumber
    ? [
        ...new Set(
          notice.cadastralNumber
            .split(/[;,\n]+/)
            .map((value) => value.trim())
            .filter(Boolean),
        ),
      ]
    : [];

  return (
    <aside
      aria-label={t(locale, "fieldDetails")}
      className="min-w-0 rounded-xl border border-[var(--ma-border)] bg-[var(--ma-soft)] p-4"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <h3 className="text-base font-bold">{t(locale, "fieldDetails")}</h3>
        {notice && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t(locale, "closeFieldDetails")}
            className="rounded p-1 hover:bg-slate-200"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {!notice ? (
        <p className="text-sm text-slate-600">{t(locale, "chooseField")}</p>
      ) : (
        <div className="space-y-3 text-sm">
          <p className="font-semibold break-words">
            {notice.contractorName ?? t(locale, "unknown")}
          </p>
          <div>
            <p className="text-xs font-semibold text-slate-600">
              {t(locale, "cadastralNumbers")}
            </p>
            {cadastre.length ? (
              <ul className="mt-1 space-y-1" data-testid="admin-cadastral-list">
                {cadastre.map((value) => (
                  <li
                    key={value}
                    className="break-all rounded bg-white p-1 font-mono text-xs"
                  >
                    {value}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t(locale, "unknown")}</p>
            )}
          </div>
          <p>
            <span className="font-semibold">{t(locale, "period")}:</span>{" "}
            {formatDate(notice.startAt)} — {formatDate(notice.endAt)}
          </p>
          <div>
            <p className="font-semibold">{t(locale, "products")}</p>
            {notice.treatments.length ? (
              <ul className="mt-1 space-y-2">
                {notice.treatments.map((item, index) => (
                  <li key={index} className="rounded bg-white p-2">
                    <p className="break-words">
                      {item.name ?? t(locale, "unknown")}
                    </p>
                    {item.crop && (
                      <p className="text-xs">
                        {t(locale, "crop")}: {item.crop}
                      </p>
                    )}
                    {item.beeHazardClass !== null && (
                      <p className="text-xs">
                        {t(locale, "hazardClass")}: {item.beeHazardClass}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t(locale, "noProducts")}</p>
            )}
          </div>
          <p className="text-xs font-semibold">
            {t(
              locale,
              notice.reviewStatus === "verified"
                ? "verifiedField"
                : "unverified",
            )}
          </p>
          <p className="break-words text-xs">
            {t(locale, "source")}: {notice.sourceName}
          </p>
          <p className="text-xs">
            {t(locale, "retrievedAt")}: {formatDate(notice.retrievedAt)}
          </p>
          <a
            href={notice.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 break-all text-indigo-700 underline"
          >
            {t(locale, "original")} <ExternalLink size={14} />
          </a>
          <p className="text-xs text-slate-600">
            {t(locale, "fieldSafetyCaveat")}
          </p>
        </div>
      )}
    </aside>
  );
}
