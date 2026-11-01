// Feature IDs: MAP.POINT_SELECTION, UX.MOBILE_MAP, NOTICES.MAP_OVERLAY
import type { Coordinates, MapTreatment } from "@melliatlas/contracts";
import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
  Polygon,
  Popup,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

type MapCanvasProps = {
  focus: Coordinates;
  selected: Coordinates | null;
  radiusKm: number;
  onSelect(point: Coordinates): void;
  treatments?: MapTreatment[];
};

function ClickSelection({ onSelect }: Pick<MapCanvasProps, "onSelect">) {
  useMapEvents({
    click: (event) =>
      onSelect({ lat: event.latlng.lat, lon: event.latlng.lng }),
  });
  return null;
}

function FocusControl({ focus }: Pick<MapCanvasProps, "focus">) {
  const map = useMap();
  useEffect(() => {
    map.setView([focus.lat, focus.lon], 10, { animate: true });
  }, [focus, map]);
  return null;
}

export function MapCanvas({
  focus,
  selected,
  radiusKm,
  onSelect,
  treatments = [],
}: MapCanvasProps) {
  return (
    <MapContainer
      center={[focus.lat, focus.lon]}
      zoom={10}
      minZoom={5}
      maxZoom={18}
      className="melliatlas-map"
      scrollWheelZoom={true}
      aria-label="Интерактивная карта Смоленской области"
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
        maxZoom={19}
      />
      <FocusControl focus={focus} />
      <ClickSelection onSelect={onSelect} />
      {treatments.map((notice) => {
        const polygons =
          notice.geometry.type === "Polygon"
            ? [notice.geometry.coordinates]
            : notice.geometry.coordinates;
        return polygons.map((rings, index) => (
          <Polygon
            key={`${notice.id}-${index}`}
            positions={rings.map((ring) =>
              ring.map(([lon, lat]) => [lat, lon] as [number, number]),
            )}
            pathOptions={{
              color: notice.reviewStatus === "pending" ? "#d97706" : "#c2410c",
              weight: 2,
              dashArray: notice.reviewStatus === "pending" ? "5 5" : undefined,
              fillOpacity: notice.reviewStatus === "pending" ? 0.12 : 0.22,
            }}
          >
            <Popup>
              <div className="max-w-xs space-y-1 text-xs">
                <strong>{notice.contractorName || "План обработки"}</strong>
                <p>Кадастр: {notice.cadastralNumber || "не указан"}</p>
                <p>
                  Период: {notice.startAt || "неизвестен"} —{" "}
                  {notice.endAt || "неизвестен"}
                </p>
                <p>
                  Препарат:{" "}
                  {notice.treatments
                    .map((item) => item.name)
                    .filter(Boolean)
                    .join(", ") || "не указан"}
                </p>
                <p>
                  Источник: {notice.sourceName}; загружено {notice.retrievedAt}
                </p>
                <a
                  href={notice.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Открыть источник
                </a>
                <p>
                  {notice.reviewStatus === "pending"
                    ? "Не проверено: предварительная геометрия источника. Не является оценкой безопасности."
                    : "Проверено оператором. Не является оценкой безопасности."}
                </p>
              </div>
            </Popup>
          </Polygon>
        ));
      })}
      {selected && (
        <>
          <Circle
            center={[selected.lat, selected.lon]}
            radius={radiusKm * 1000}
            pathOptions={{
              color: "#4f46e5",
              weight: 1.5,
              dashArray: "6 5",
              fillOpacity: 0.055,
            }}
          />
          <CircleMarker
            center={[selected.lat, selected.lon]}
            radius={7}
            pathOptions={{
              color: "#fff",
              weight: 3,
              fillColor: "#4338ca",
              fillOpacity: 1,
            }}
          />
        </>
      )}
    </MapContainer>
  );
}
