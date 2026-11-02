// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { DistrictCacheStatus } from "@melliatlas/contracts";
import { useEffect, useState } from "react";
import { loadDistrictCacheStatus } from "../api/client";
import { t, type Key, type Locale } from "../i18n";

/** Read-only cache status until the district API contract is verified. */
export function DistrictCachePanel({ locale }: { locale: Locale }) {
  const text = (key: Key): string => t(locale, key);
  const [status, setStatus] = useState<DistrictCacheStatus | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    async function reload(): Promise<void> {
      try {
        const result = await loadDistrictCacheStatus();
        if (active) {
          setStatus(result);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    }
    void reload();
    return () => {
      active = false;
    };
  }, []);
  return (
    <section
      aria-label={text("districtCache")}
      className="space-y-3 rounded-xl border border-slate-200 p-4"
    >
      <h3 className="font-semibold">{text("districtCache")}</h3>
      <p className="text-sm text-slate-600">{text("districtTtl")}</p>
      <p className="text-xs text-amber-800">
        {text("districtContractPending")}
      </p>
      <button
        type="button"
        disabled
        className="rounded-lg bg-emerald-800 px-3 py-2 text-sm text-white opacity-50"
      >
        {text("refreshDistrict")}
      </button>
      {status?.entries.length === 0 && (
        <p className="text-sm text-slate-600">{text("districtNoCoverage")}</p>
      )}
      {status?.entries.map((entry) => (
        <div
          key={`${entry.revision}-${entry.districtId}-${entry.filterHash}`}
          className="rounded-md bg-slate-50 p-3 text-sm"
        >
          <p>
            {text("districtId")}: {entry.districtId} ·{" "}
            {text("districtCoverage")}: {text(entry.coverage)}
          </p>
          <p>
            {text("regionProgress")}: {entry.pagesFetched} ·{" "}
            {text("districtLastCompleted")}:{" "}
            {entry.completedAt ?? text("never")}
          </p>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-amber-800">
          {text("districtUnavailable")}
        </p>
      )}
    </section>
  );
}
