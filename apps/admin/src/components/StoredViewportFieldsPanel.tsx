// Feature IDs: SOURCES.DOCUMENT_HISTORY
import { useState } from "react";
import type { SaturnStoredFieldsResponse } from "@melliatlas/contracts";
import { loadStoredViewportFields } from "../api/client";
import { t, type Locale } from "../i18n";

/** Expand a saved viewport into actual stored feature/plan center IDs without source requests. */
export function StoredViewportFieldsPanel({
  locale,
  hash,
}: {
  locale: Locale;
  hash: string;
}) {
  const [data, setData] = useState<SaturnStoredFieldsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const text = (key: Parameters<typeof t>[1]) => t(locale, key);

  async function load(): Promise<void> {
    setBusy(true);
    setError(false);
    try {
      setData(await loadStoredViewportFields(hash));
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => void load()}
        className="rounded-lg border border-blue-700 px-3 py-2 text-sm font-semibold"
      >
        {text("cacheHistoryShowFields")}
      </button>
      {error && (
        <p role="alert" className="text-red-700">
          {text("cacheHistoryFieldsError")}
        </p>
      )}
      {data && (
        <div className="max-h-56 overflow-y-auto rounded-lg border p-2">
          <p className="text-xs text-slate-600">
            {text("cacheHistoryFieldsNote")}
          </p>
          {data.centers.length === 0 && (
            <p>{text("cacheHistoryFieldsEmpty")}</p>
          )}
          <ul className="mt-2 space-y-1 text-xs">
            {data.centers.map((center) => (
              <li key={center.featureId}>
                {text("cacheHistoryField")}: {center.featureId};{" "}
                {text("cacheHistoryPlan")}: {center.planId};{" "}
                {center.centerY.toFixed(5)}, {center.centerX.toFixed(5)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
