import { useEffect, useMemo } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import HoloHeatLayer from "./HoloHeatLayer";
import type { Clinic, MapCell, Outbreak } from "@/lib/types";

export type Selection =
  | { kind: "cell"; cell: MapCell }
  | { kind: "outbreak"; outbreak: Outbreak }
  | { kind: "clinic"; clinic: Clinic }
  | null;

const SEVERITY_COLOR: Record<string, string> = {
  LOW: "#22d3ee",
  MODERATE: "#22d3ee",
  ELEVATED: "#facc15",
  HIGH: "#f97316",
  SEVERE: "#e83ca0",
  CRITICAL: "#e83ca0",
};

function Recenter({ lat, lng, nonce }: { lat: number; lng: number; nonce: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [lat, lng, nonce, map]);
  return null;
}

function FitRadius({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(lat, lng).toBounds(radiusKm * 2000);
    map.fitBounds(bounds, { animate: true, padding: [24, 24] });
  }, [lat, lng, radiusKm, map]);
  return null;
}

/** Picks the aggregated cell nearest to the pointer (never an individual case). */
function CellPicker({
  cells,
  onSelect,
  onHover,
}: {
  cells: MapCell[];
  onSelect: (cell: MapCell | null) => void;
  onHover: (cell: MapCell | null) => void;
}) {
  const map = useMap();
  const pick = (e: L.LeafletMouseEvent) => {
    let best: MapCell | null = null;
    let bestDist = Infinity;
    for (const cell of cells) {
      const p = map.latLngToContainerPoint([cell.latitude, cell.longitude]);
      const d = p.distanceTo(e.containerPoint);
      if (d < 42 && d < bestDist) {
        best = cell;
        bestDist = d;
      }
    }
    return best;
  };
  useMapEvents({
    mousemove: (e) => onHover(pick(e)),
    click: (e) => onSelect(pick(e)),
  });
  return null;
}

const userIcon = () =>
  L.divIcon({
    className: "",
    html: `<div class="ww-user"><span class="ww-user-ring"></span><span class="ww-user-ring ww-user-ring--delay"></span><span class="ww-user-dot"></span><span class="ww-user-label">YOUR LOCATION</span></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

const clinicIcon = () =>
  L.divIcon({
    className: "",
    html: `<div class="ww-clinic"><svg viewBox="0 0 12 12" width="10" height="10"><path d="M5 1h2v3h3v2H7v3H5V6H2V4h3z" fill="currentColor"/></svg></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

export default function SurveillanceMapCanvas({
  cells,
  center,
  radiusKm,
  zoom = 12,
  outbreaks = [],
  clinics = [],
  layers,
  recenterNonce = 0,
  onSelect,
  onHover,
}: {
  cells: MapCell[];
  center: { latitude: number; longitude: number };
  radiusKm: number;
  zoom?: number | undefined;
  outbreaks?: Outbreak[] | undefined;
  clinics?: Clinic[] | undefined;
  layers: { risk: boolean; outbreaks: boolean; clinics: boolean };
  recenterNonce?: number | undefined;
  onSelect: (s: Selection) => void;
  onHover: (s: Selection) => void;
}) {
  const uIcon = useMemo(userIcon, []);
  const cIcon = useMemo(clinicIcon, []);

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={zoom}
      scrollWheelZoom
      zoomControl={false}
      className="h-full w-full ww-map"
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <Recenter lat={center.latitude} lng={center.longitude} nonce={recenterNonce} />
      <FitRadius lat={center.latitude} lng={center.longitude} radiusKm={radiusKm} />

      {layers.risk ? <HoloHeatLayer cells={cells} /> : null}
      {layers.risk ? <CellPicker
        cells={cells}
        onSelect={(c) => onSelect(c ? { kind: "cell", cell: c } : null)}
        onHover={(c) => onHover(c ? { kind: "cell", cell: c } : null)}
      /> : null}

      {/* selected radius perimeter */}
      <Circle
        center={[center.latitude, center.longitude]}
        radius={radiusKm * 1000}
        pathOptions={{
          color: "#22d3ee",
          weight: 1,
          opacity: 0.35,
          dashArray: "4 8",
          fill: false,
        }}
        interactive={false}
      />

      {layers.outbreaks
        ? outbreaks.map((o, i) => {
            const lat = o.center_latitude ?? o.latitude;
            const lng = o.center_longitude ?? o.longitude;
            if (lat === undefined || lng === undefined) return null;
            const radius = o.radius_meters ?? (o.radius_km ?? 1) * 1000;
            const color = SEVERITY_COLOR[(o.severity ?? "").toUpperCase()] ?? "#f97316";
            return (
              <Circle
                key={o.id ?? `${lat},${lng},${i}`}
                center={[lat, lng]}
                radius={radius}
                pathOptions={{
                  color,
                  weight: 1.5,
                  opacity: 0.8,
                  fillColor: color,
                  fillOpacity: 0.08,
                  className: "ww-outbreak",
                }}
                eventHandlers={{ click: () => onSelect({ kind: "outbreak", outbreak: o }) }}
              />
            );
          })
        : null}

      {layers.clinics
        ? clinics
            .filter((c) => c.latitude !== undefined && c.longitude !== undefined)
            .map((c, i) => (
              <Marker
                key={c.id ?? i}
                position={[c.latitude as number, c.longitude as number]}
                icon={cIcon}
                eventHandlers={{ click: () => onSelect({ kind: "clinic", clinic: c }) }}
              />
            ))
        : null}

      <Marker
        position={[center.latitude, center.longitude]}
        icon={uIcon}
        interactive={false}
        zIndexOffset={1000}
      />
    </MapContainer>
  );
}
