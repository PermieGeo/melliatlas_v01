// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { useEffect, useState } from "react";
import type { SaturnRequestLogResponse } from "@melliatlas/contracts";
import { loadSaturnRequestLog } from "../api/client";
import { t, type Locale } from "../i18n";

/** Read recent explicit upstream attempts from PostgreSQL, including failures. */
export function SaturnRequestLogPanel({ locale }: { locale: Locale }) {
  const [log, setLog] = useState<SaturnRequestLogResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const text = (key: Parameters<typeof t>[1]) => t(locale, key);

  async function refresh(): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      setLog(await loadSaturnRequestLog());
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section
      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
      aria-label={text("requestLogTitle")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{text("requestLogTitle")}</h3>
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm"
          onClick={() => void refresh()}
        >
          {text("requestLogRefresh")}
        </button>
      </div>
      <p className="text-sm text-slate-600">{text("requestLogExplain")}</p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {text("requestLogError")}
        </p>
      )}
      {log?.entries.length === 0 && (
        <p role="status" className="text-sm">
          {text("requestLogEmpty")}
        </p>
      )}
      {log && log.entries.length > 0 && (
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {log.entries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-lg border bg-white p-3 text-sm"
            >
              <p className="font-semibold">
                {entry.action === "district_directory"
                  ? text("requestLogDirectory")
                  : text("requestLogPage")}
                {entry.districtId !== null ? ` #${entry.districtId}` : ""}
                {entry.pageNumber !== null
                  ? ` · ${text("requestLogBatch")} ${entry.pageNumber + 1}`
                  : ""}
              </p>
              <p>
                {text("requestLogInitiator")}:{" "}
                {entry.initiator === "web"
                  ? text("requestLogWeb")
                  : text("requestLogAdmin")}
                {" · "}
                {text(`requestLogStatus_${entry.status}`)}
              </p>
              <p className="break-all text-xs text-slate-600">
                {text("requestLogEndpoint")}: https://bee-saturn.ru
                {entry.action === "district_directory"
                  ? "/backend/beemaster/district/55"
                  : "/backend/beemaster/query"}
              </p>
              <p>
                {new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
                  dateStyle: "short",
                  timeStyle: "medium",
                }).format(new Date(entry.startedAt))}
                {" · "}
                {text("requestLogRecords")}: {entry.receivedCount ?? "—"}
              </p>
              {entry.errorCode && (
                <p className="text-amber-800">
                  {text("requestLogCode")}: {entry.errorCode}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
