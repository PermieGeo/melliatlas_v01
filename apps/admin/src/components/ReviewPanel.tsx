import { useEffect, useState } from "react";
import {
  loadPendingTreatments,
  reviewTreatment,
  type PendingTreatment,
} from "../api/client";
import { t, type Key, type Locale } from "../i18n";

export function ReviewPanel({
  locale,
  refreshKey,
  onChanged,
}: {
  locale: Locale;
  refreshKey: number;
  onChanged(): void;
}) {
  const text = (key: Key) => t(locale, key);
  const [items, setItems] = useState<PendingTreatment[]>([]);
  const [reviewer, setReviewer] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  async function reload() {
    try {
      setItems(await loadPendingTreatments());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, [refreshKey]);
  async function decide(id: string, decision: "verified" | "rejected") {
    setBusy(true);
    try {
      await reviewTreatment(id, decision, reviewer, evidence);
      await reload();
      onChanged();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const valid =
    reviewer.trim().length > 0 && evidence.trim().length >= 20 && !busy;
  return (
    <section
      aria-label={text("review")}
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{text("review")}</h2>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          {text("reload")}
        </button>
      </div>
      <p className="text-sm text-slate-600">{text("reviewHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          {text("reviewer")}
          <input
            aria-label={text("reviewer")}
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
            className="mt-1 w-full rounded-lg border p-2"
          />
        </label>
        <label className="text-sm font-medium">
          {text("evidence")}
          <textarea
            aria-label={text("evidence")}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            rows={2}
            className="mt-1 w-full rounded-lg border p-2"
          />
        </label>
      </div>
      {loading && <p role="status">{text("loading")}</p>}
      {items.length === 0 && !error && !loading && (
        <p role="status" className="text-sm text-slate-600">
          {text("missing")}
        </p>
      )}
      {items.map((item) => (
        <article
          key={item.id}
          className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm"
        >
          <p className="font-semibold">
            {item.contractorName || item.cadastralNumber || item.id}
          </p>
          <p className="text-xs text-slate-600">
            {text("period")}: {item.startAt || text("unknown")} —{" "}
            {item.endAt || text("unknown")}
          </p>
          <p className="text-xs text-slate-600">
            {text("geometry")}: {text(item.geometryAvailable ? "yes" : "no")}
          </p>
          <a
            href={item.sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
            className="text-indigo-700 underline"
          >
            {text("original")}
          </a>
          <div className="flex flex-wrap gap-2">
            <button
              disabled={!valid || !item.geometryAvailable}
              onClick={() => void decide(item.id, "verified")}
              className="rounded-lg bg-emerald-800 px-3 py-2 text-xs text-white disabled:opacity-40"
            >
              {text("approve")}
            </button>
            <button
              disabled={!valid}
              onClick={() => void decide(item.id, "rejected")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs disabled:opacity-40"
            >
              {text("reject")}
            </button>
          </div>
        </article>
      ))}
      {error && (
        <p role="alert" className="text-amber-800">
          {text("error")}
        </p>
      )}
    </section>
  );
}
