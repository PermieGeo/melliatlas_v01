// Feature IDs: SOURCES.DOCUMENT_HISTORY
import type { DistrictCacheStatus } from "@melliatlas/contracts";
import { useEffect, useState } from "react";
import { loadDistrictCacheStatus } from "../api/client";
import { t, type Key, type Locale } from "../i18n";
import { FieldHelp } from "./FieldHelp";

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
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{text("districtCache")}</h3>
        <FieldHelp
          locale={locale}
          subject="districtCache"
          message="helpDistrictCache"
        />
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
          {text("plannedFeature")}
        </span>
      </div>
      <p className="text-sm text-slate-600">{text("districtTtl")}</p>
      <p className="text-xs text-amber-800">
        {text("districtContractPending")}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          className="rounded-lg bg-emerald-800 px-3 py-2 text-sm text-white opacity-50"
        >
          {text("refreshDistrict")}
        </button>
        <FieldHelp
          locale={locale}
          subject="refreshDistrict"
          message="helpRefreshDistrict"
        />
      </div>
      {status?.entries.length === 0 && (
        <p className="text-sm text-slate-600">{text("districtNoCoverage")}</p>
      )}
      {status?.entries.map((entry) => (
        <div
          key={`${entry.revision}-${entry.districtId}-${entry.filterHash}`}
          className="rounded-md bg-slate-50 p-3 text-sm"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              {text("districtId")}: {entry.districtId}
              <FieldHelp
                locale={locale}
                subject="districtId"
                message="helpDistrictId"
              />
            </span>
            <span className="inline-flex items-center gap-1">
              {text("districtCoverage")}: {text(entry.coverage)}
              <FieldHelp
                locale={locale}
                subject="districtCoverage"
                message="helpDistrictCoverage"
              />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1">
              {text("regionProgress")}: {entry.pagesFetched}
              <FieldHelp
                locale={locale}
                subject="regionProgress"
                message="helpRegionProgress"
              />
            </span>
            <span className="inline-flex items-center gap-1">
              {text("districtLastCompleted")}:{" "}
              {entry.completedAt ?? text("never")}
              <FieldHelp
                locale={locale}
                subject="districtLastCompleted"
                message="helpDistrictLastCompleted"
              />
            </span>
          </div>
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
