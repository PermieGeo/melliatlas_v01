import type { MapTreatment } from "@melliatlas/contracts";
import { MapContainer, Polygon, Popup, TileLayer } from "react-leaflet";
import { t, type Locale } from "../i18n";

export function MapPreview({
  locale,
  notices,
}: {
  locale: Locale;
  notices: MapTreatment[];
}) {
  return (
    <section
      aria-label={t(locale, "map")}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3"
    >
      <h2 className="px-2 pt-2 text-lg font-bold">{t(locale, "map")}</h2>
      <p className="px-2 text-xs text-slate-600">{t(locale, "previewHint")}</p>
      <MapContainer
        center={[54.782, 32.045]}
        zoom={8}
        className="melliatlas-map"
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
              pathOptions={{
                color:
                  notice.reviewStatus === "pending" ? "#d97706" : "#15803d",
                dashArray:
                  notice.reviewStatus === "pending" ? "5 5" : undefined,
                fillOpacity: 0.12,
              }}
            >
              <Popup>
                <p>{notice.contractorName || notice.id}</p>
                <a
                  href={notice.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t(locale, "original")}
                </a>
              </Popup>
            </Polygon>
          ));
        })}
      </MapContainer>
    </section>
  );
}
