import { Fragment, useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import HoloHeatLayer from "./HoloHeatLayer";
import type { Clinic, MapCell, Outbreak } from "@/lib/types";

export type Selection =
  | { kind: "cell"; cell: MapCell }
  | { kind: "outbreak"; outbreak: Outbreak }
  | { kind: "clinic"; clinic: Clinic }
  | null;

const SEVERITY_COLOR: Record<string, string> = {
  LOW: "#38bdf8",
  MODERATE: "#2dd4bf",
  ELEVATED: "#facc15",
  HIGH: "#f97316",
  SEVERE: "#e13d5c",
  CRITICAL: "#e13d5c",
};

/** Keeps the neighbourhood readable while preserving city context. */
const LOCAL_MAX_ZOOM = 14;

function Recenter({ lat, lng, nonce }: { lat: number; lng: number; nonce: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 13), { duration: 0.9 });
  }, [lat, lng, nonce, map]);
  return null;
}

function FitRadius({ lat, lng, radiusKm }: { lat: number; lng: number; radiusKm: number }) {
  const map = useMap();
  useEffect(() => {
    const bounds = L.latLng(lat, lng).toBounds(radiusKm * 2000);
    map.flyToBounds(bounds, { duration: 0.8, padding: [28, 28], maxZoom: LOCAL_MAX_ZOOM });
  }, [lat, lng, radiusKm, map]);
  return null;
}

/** Wheel zoom proportional to delta, with cursor kept anchored by Leaflet. */
function SmoothWheel() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const delta = -dy * 0.0022;
      const next = Math.max(
        map.getMinZoom(),
        Math.min(map.getMaxZoom(), map.getZoom() + Math.max(-1.2, Math.min(1.2, delta))),
      );
      if (Math.abs(next - map.getZoom()) < 0.001) return;
      const point = map.mouseEventToContainerPoint(e);
      map.setZoomAround(map.containerPointToLatLng(point), next, { animate: true });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [map]);
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
  const overRef = useRef(false);
  const pick = (e: L.LeafletMouseEvent) => {
    let best: MapCell | null = null;
    let bestDist = Infinity;
    for (const cell of cells) {
      const p = map.latLngToContainerPoint([cell.latitude, cell.longitude]);
      const d = p.distanceTo(e.containerPoint);
      if (d < 46 && d < bestDist) {
        best = cell;
        bestDist = d;
      }
    }
    return best;
  };
  useMapEvents({
    mousemove: (e) => {
      const cell = pick(e);
      const over = !!cell;
      if (over !== overRef.current) {
        overRef.current = over;
        map.getContainer().classList.toggle("ww-map--pointer", over);
      }
      onHover(cell);
    },
    mouseout: () => {
      overRef.current = false;
      map.getContainer().classList.remove("ww-map--pointer");
      onHover(null);
    },
    click: (e) => onSelect(pick(e)),
  });
  return null;
}

/** Grab / grabbing cursor feedback while panning. */
function DragCursor() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const on = () => el.classList.add("ww-map--grabbing");
    const off = () => el.classList.remove("ww-map--grabbing");
    map.on("dragstart", on);
    map.on("dragend", off);
    return () => {
      map.off("dragstart", on);
      map.off("dragend", off);
    };
  }, [map]);
  return null;
}

const userIcon = () =>
  L.divIcon({
    className: "",
    html: `<div class="ww-user"><span class="ww-user-pulse"></span><span class="ww-user-dot"></span></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const clinicIcon = () =>
  L.divIcon({
    className: "",
    html: `<div class="ww-clinic"><span class="ww-clinic-dot"></span></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });

const outbreakIcon = (count?: number) =>
  L.divIcon({
    className: "",
    html: `<div class="ww-cluster">${count ?? ""}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

export default function SurveillanceMapCanvas({
  cells,
  center,
  radiusKm,
  zoom = 13,
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
      scrollWheelZoom={false}
      zoomControl={false}
      zoomSnap={0}
      zoomDelta={0.5}
      doubleClickZoom
      className="h-full w-full ww-map"
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <SmoothWheel />
      <DragCursor />
      <Recenter lat={center.latitude} lng={center.longitude} nonce={recenterNonce} />
      <FitRadius lat={center.latitude} lng={center.longitude} radiusKm={radiusKm} />

      {layers.risk ? <HoloHeatLayer cells={cells} /> : null}
      {layers.risk ? (
        <CellPicker
          cells={cells}
          onSelect={(c) => onSelect(c ? { kind: "cell", cell: c } : null)}
          onHover={(c) => onHover(c ? { kind: "cell", cell: c } : null)}
        />
      ) : null}

      {/* soft neighbourhood boundary, no dashed HUD ring */}
      <Circle
        center={[center.latitude, center.longitude]}
        radius={radiusKm * 1000}
        pathOptions={{
          color: "#64748b",
          weight: 1,
          opacity: 0.28,
          fillColor: "#0f172a",
          fillOpacity: 0.02,
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
            const key = o.id ?? `${lat},${lng},${i}`;
            return (
              <Fragment key={key}>
                <Circle
                  center={[lat, lng]}
                  radius={radius}
                  pathOptions={{
                    color,
                    weight: 1.25,
                    opacity: 0.7,
                    fillColor: color,
                    fillOpacity: 0.06,
                    className: "ww-outbreak",
                  }}
                  eventHandlers={{ click: () => onSelect({ kind: "outbreak", outbreak: o }) }}
                />
                <Marker
                  position={[lat, lng]}
                  icon={outbreakIcon(o.case_count)}
                  eventHandlers={{
                    click: () => onSelect({ kind: "outbreak", outbreak: o }),
                    mouseover: () => onHover({ kind: "outbreak", outbreak: o }),
                    mouseout: () => onHover(null),
                  }}
                />
              </Fragment>
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
                eventHandlers={{
                  click: () => onSelect({ kind: "clinic", clinic: c }),
                  mouseover: () => onHover({ kind: "clinic", clinic: c }),
                  mouseout: () => onHover(null),
                }}
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
