// Feature IDs: MAP.POINT_SELECTION, UX.MOBILE_MAP
import type { Coordinates } from "@melliatlas/contracts";
import { useEffect } from "react";
import {
  Circle,
  CircleMarker,
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
