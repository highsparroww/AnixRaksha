import { useEffect, useMemo } from "react";
import { Circle, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { ACTIVITY_COLORS } from "@/components/ActivityBadge";
import type { ActivityLevel, MapCell } from "@/lib/types";
import { label } from "@/lib/types";

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], map.getZoom(), { animate: false });
  }, [lat, lng, map]);
  return null;
}

function colorFor(level: string) {
  return ACTIVITY_COLORS[(level?.toUpperCase() as ActivityLevel) ?? "NORMAL"] ?? "#64748b";
}

export default function SurveillanceMapCanvas({
  cells,
  center,
  zoom = 12,
}: {
  cells: MapCell[];
  center: { latitude: number; longitude: number };
  zoom?: number;
}) {
  const maxCount = useMemo(
    () => Math.max(1, ...cells.map((c) => c.case_count || 0)),
    [cells],
  );

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={zoom}
      scrollWheelZoom
      className="h-full w-full"
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      <Recenter lat={center.latitude} lng={center.longitude} />

      {cells.map((cell) => {
        const color = colorFor(cell.activity_level);
        const intensity = Math.min(1, (cell.case_count || 0) / maxCount);
        const core = 350 + intensity * 450;
        const halo = core * 2.1;
        return (
          <div key={cell.cell_id}>
            <Circle
              center={[cell.latitude, cell.longitude]}
              radius={halo}
              pathOptions={{
                color,
                weight: 0,
                fillColor: color,
                fillOpacity: 0.12 + intensity * 0.1,
              }}
              interactive={false}
            />
            <Circle
              center={[cell.latitude, cell.longitude]}
              radius={core}
              pathOptions={{
                color,
                weight: 1.5,
                opacity: 0.7,
                fillColor: color,
                fillOpacity: 0.3 + intensity * 0.35,
              }}
            >
              <Popup>
                <div className="min-w-40 space-y-1.5">
                  <div
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color }}
                  >
                    {label(cell.activity_level)}
                  </div>
                  <div className="text-sm font-medium text-slate-900">
                    {cell.case_count} reported case{cell.case_count === 1 ? "" : "s"}
                  </div>
                  <div className="space-y-0.5">
                    {Object.entries(cell.diseases || {}).map(([disease, count]) => (
                      <div
                        key={disease}
                        className="flex justify-between gap-4 text-xs text-slate-600"
                      >
                        <span>{label(disease)}</span>
                        <span className="font-medium text-slate-900">{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-1 text-[11px] text-slate-500">Aggregated area data</div>
                </div>
              </Popup>
            </Circle>
          </div>
        );
      })}
    </MapContainer>
  );
}
