import type { MapTreatment } from "@melliatlas/contracts";
import { useState } from "react";
import { MapContainer, Polygon, TileLayer } from "react-leaflet";
import { t, type Locale } from "../i18n";
import { PreviewFieldDetails } from "./PreviewFieldDetails";

/** Render source-derived geometry and keep the selected field in a persistent sidebar. */
export function MapPreview({
  locale,
  notices,
}: {
  locale: Locale;
  notices: MapTreatment[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = notices.find((notice) => notice.id === selectedId) ?? null;
  return (
    <section
      aria-label={t(locale, "map")}
      className="space-y-3 rounded-2xl border border-[var(--ma-border)] bg-white p-3"
    >
      <h2 className="px-2 pt-2 text-lg font-bold">{t(locale, "map")}</h2>
      <p className="px-2 text-xs text-[var(--ma-muted)]">
        {t(locale, "previewHint")}
      </p>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <MapContainer
            center={[54.782, 32.045]}
            zoom={8}
            className="melliatlas-map"
            aria-label={t(locale, "map")}
          >
            <TileLayer
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />
            {notices.flatMap((notice) => {
              const polygons =
                notice.geometry.type === "Polygon"
                  ? [notice.geometry.coordinates]
                  : notice.geometry.coordinates;
              return polygons.map((rings, i) => (
                <Polygon
                  key={`${notice.id}-${i}`}
                  positions={rings.map((ring) =>
                    ring.map(([lon, lat]) => [lat, lon] as [number, number]),
                  )}
                  eventHandlers={{ click: () => setSelectedId(notice.id) }}
                  pathOptions={{
                    color:
                      notice.reviewStatus === "pending" ? "#d97706" : "#15803d",
                    dashArray:
                      notice.reviewStatus === "pending" ? "5 5" : undefined,
                    fillOpacity: 0.12,
                    bubblingMouseEvents: false,
                    weight: selectedId === notice.id ? 4 : 2,
                  }}
                />
              ));
            })}
          </MapContainer>
        </div>
        <PreviewFieldDetails
          locale={locale}
          notice={selected}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </section>
  );
}
