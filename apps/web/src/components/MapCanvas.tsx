// Feature IDs: MAP.POINT_SELECTION, UX.MOBILE_MAP, NOTICES.MAP_OVERLAY, SOURCES.DOCUMENT_HISTORY
import type { Coordinates, MapTreatment } from "@melliatlas/contracts";
import { useEffect } from "react";
import { translate, type Locale, type MessageKey } from "../i18n";
import {
  Circle,
  CircleMarker,
  Polygon,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

type MapCanvasProps = {
  locale: Locale;
  focus: Coordinates;
  focusZoom?: number;
  selected: Coordinates | null;
  radiusKm: number;
  onSelect(point: Coordinates): void;
  onSelectTreatment(notice: MapTreatment): void;
  selectedTreatmentId?: string | null;
  onViewportChange?(bbox: [number, number, number, number]): void;
  treatments?: MapTreatment[];
};

function ClickSelection({ onSelect }: Pick<MapCanvasProps, "onSelect">) {
  useMapEvents({
    click: (event) =>
      onSelect({ lat: event.latlng.lat, lon: event.latlng.lng }),
  });
  return null;
}

function FocusControl({
  focus,
  focusZoom = 10,
}: Pick<MapCanvasProps, "focus" | "focusZoom">) {
  const map = useMap();
  useEffect(() => {
    map.setView([focus.lat, focus.lon], focusZoom, { animate: true });
  }, [focus, focusZoom, map]);
  return null;
}

function ViewportObserver({
  onViewportChange,
}: Pick<MapCanvasProps, "onViewportChange">) {
  const map = useMapEvents({ moveend: publish, zoomend: publish });
  function publish() {
    if (!onViewportChange) return;
    const bounds = map.getBounds();
    onViewportChange([
      Math.max(-180, bounds.getWest()),
      Math.max(-90, bounds.getSouth()),
      Math.min(180, bounds.getEast()),
      Math.min(90, bounds.getNorth()),
    ]);
  }
  useEffect(() => {
    publish();
  }, [map, onViewportChange]);
  return null;
}

export function MapCanvas({
  locale,
  focus,
  focusZoom,
  selected,
  radiusKm,
  onSelect,
  onSelectTreatment,
  selectedTreatmentId,
  onViewportChange,
  treatments = [],
}: MapCanvasProps) {
  const t = (key: MessageKey) => translate(locale, key);
  return (
    <MapContainer
      center={[focus.lat, focus.lon]}
      zoom={10}
      minZoom={5}
      maxZoom={18}
      className="melliatlas-map"
      scrollWheelZoom={true}
      aria-label={t("map")}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
        maxZoom={19}
      />
      <FocusControl focus={focus} focusZoom={focusZoom} />
      <ClickSelection onSelect={onSelect} />
      <ViewportObserver onViewportChange={onViewportChange} />
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
            eventHandlers={{ click: () => onSelectTreatment(notice) }}
            pathOptions={{
              bubblingMouseEvents: false,
              color: notice.reviewStatus !== "verified" ? "#d97706" : "#c2410c",
              weight: selectedTreatmentId === notice.id ? 4 : 2,
              dashArray: notice.reviewStatus !== "verified" ? "5 5" : undefined,
              fillOpacity: notice.reviewStatus !== "verified" ? 0.12 : 0.22,
            }}
          />
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
