import type { MapTreatment, SourceCatalogEntry } from "@melliatlas/contracts";
import {
  Database,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { loadPreviewMapTreatments, loadSourceCatalog } from "./api/client";
import { CollectionPanel } from "./components/CollectionPanel";
import { MapPreview } from "./components/MapPreview";
import { ProviderConfigurationForm } from "./components/ProviderConfigurationForm";
import { ReviewPanel } from "./components/ReviewPanel";
import { t, type Key, type Locale } from "./i18n";

type Tab = "import" | "sources" | "configuration" | "review";
const tabs: { id: Tab; key: Key; icon: typeof Database }[] = [
  { id: "import", key: "import", icon: LayoutDashboard },
  { id: "sources", key: "sources", icon: Database },
  { id: "configuration", key: "configuration", icon: Settings2 },
  { id: "review", key: "review", icon: ShieldCheck },
];
export default function App() {
  const [locale, setLocale] = useState<Locale>("ru");
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = `MelliAtlas — ${t(locale, "title")}`;
  }, [locale]);
  const text = (key: Key) => t(locale, key);
  const [tab, setTab] = useState<Tab>("import");
  const [refreshKey, setRefreshKey] = useState(0);
  const [preview, setPreview] = useState<MapTreatment[]>([]);
  const [catalog, setCatalog] = useState<SourceCatalogEntry[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    loadPreviewMapTreatments(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setPreview(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    loadSourceCatalog(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setCatalog(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [refreshKey]);
  const changed = () => setRefreshKey((key) => key + 1);
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h1 className="text-xl font-extrabold">
              MelliAtlas <span className="text-emerald-700">Admin</span>
            </h1>
            <p className="text-xs text-slate-500">{text("subtitle")}</p>
          </div>
          <label className="flex items-center gap-2 text-xs">
            {text("language")}
            <select
              aria-label={text("language")}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              className="rounded-lg border p-2"
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] gap-5 px-4 py-6 md:grid-cols-[210px_minmax(0,1fr)] md:px-6">
        <nav
          aria-label={text("title")}
          className="flex gap-2 overflow-x-auto md:flex-col"
        >
          {tabs.map(({ id, key, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => setTab(id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium ${id === tab ? "bg-emerald-800 text-white" : "bg-white text-slate-700"}`}
            >
              <Icon size={17} />
              {text(key)}
            </button>
          ))}
        </nav>
        <main className="min-w-0 space-y-4">
          <div>
            <h2 className="text-2xl font-bold">{text(tab)}</h2>
            <p className="mt-1 text-xs text-amber-800">{text("localOnly")}</p>
          </div>
          {tab === "import" && (
            <>
              <CollectionPanel locale={locale} onChanged={changed} />
              <MapPreview locale={locale} notices={preview} />
            </>
          )}
          {tab === "configuration" && (
            <ProviderConfigurationForm locale={locale} />
          )}
          {tab === "review" && (
            <ReviewPanel
              locale={locale}
              refreshKey={refreshKey}
              onChanged={changed}
            />
          )}
          {tab === "sources" && (
            <section
              aria-label={text("sources")}
              className="grid gap-3 lg:grid-cols-2"
            >
              {catalog?.map((source) => (
                <article
                  key={source.id}
                  className="rounded-xl border bg-white p-4"
                >
                  <h3 className="font-bold">{source.name}</h3>
                  <p className="mt-2 break-all text-xs text-slate-500">
                    {source.url}
                  </p>
                  <p className="mt-2 text-xs text-slate-600">
                    {text("terms")}:{" "}
                    {text(
                      source.termsReview === "reviewed"
                        ? "reviewedTerms"
                        : "unreviewedTerms",
                    )}
                  </p>
                </article>
              ))}
              {catalog?.length === 0 && <p>{text("emptyCatalog")}</p>}
            </section>
          )}
          {error && (
            <p role="alert" className="text-sm text-amber-800">
              {text("error")}
            </p>
          )}
        </main>
      </div>
    </div>
  );
}
