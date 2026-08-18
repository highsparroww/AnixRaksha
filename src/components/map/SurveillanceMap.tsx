import { Suspense, lazy, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Crosshair, Layers, Radar, RotateCw, SlidersHorizontal, X } from "lucide-react";
import { ACTIVITY_COLORS } from "@/components/ActivityBadge";
import { label } from "@/lib/types";
import type { Clinic, Forecast, MapCell, Outbreak } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Selection } from "./SurveillanceMapCanvas";

const Canvas = lazy(() => import("./SurveillanceMapCanvas"));

const RADII = [5, 10, 25, 50];
const WINDOWS: { label: string; value: number }[] = [
  { label: "24h", value: 1 },
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
];

const glass =
  "rounded-lg border border-slate-700/60 bg-slate-900/85 backdrop-blur-md shadow-[0_10px_30px_-16px_rgba(2,6,23,0.9)]";

function Chip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2.5 py-1.5 text-[11px] font-medium tracking-wide transition-colors",
        active
          ? "bg-slate-100/10 text-slate-100 ring-1 ring-slate-400/40"
          : "text-slate-400 hover:bg-slate-100/5 hover:text-slate-200",
      )}
    >
      {children}
    </button>
  );
}

function LoadingOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-[600] flex items-center justify-center">
      <div className={cn(glass, "flex items-center gap-2 px-3 py-2")}>
        <Radar className="h-3.5 w-3.5 animate-spin text-sky-300" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-200">
          Loading surveillance data…
        </span>
      </div>
    </div>
  );
}

function InfoCard({ selection, onClose }: { selection: Selection; onClose: () => void }) {
  if (!selection) return null;

  const body = (() => {
    if (selection.kind === "cell") {
      const c = selection.cell;
      const color = ACTIVITY_COLORS[c.activity_level] ?? "#38bdf8";
      const entries = Object.entries(c.diseases ?? {});
      const max = Math.max(1, ...entries.map(([, n]) => n));
      return (
        <>
          <Head title="Surveillance zone" />
          <Field label="Risk" value={label(c.activity_level)} color={color} />
          <Field label="Cases" value={String(c.case_count ?? 0)} />
          {entries.length ? (
            <div className="mt-2 space-y-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Diseases</div>
              {entries.map(([d, n]) => (
                <div key={d} className="space-y-0.5">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>{label(d)}</span>
                    <span className="font-medium text-slate-100">{n}</span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-800">
                    <div
                      className="h-1 rounded-full"
                      style={{ width: `${(n / max) * 100}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[10px] text-slate-500">Aggregated, anonymised area data.</p>
        </>
      );
    }
    if (selection.kind === "outbreak") {
      const o = selection.outbreak;
      const radiusKm = (o.radius_meters ?? (o.radius_km ?? 0) * 1000) / 1000;
      return (
        <>
          <Head title="Outbreak alert" />
          <Field label="Disease" value={label(o.disease) || "—"} />
          <Field label="Severity" value={label(o.severity) || "—"} />
          <Field label="Cases" value={String(o.case_count ?? 0)} />
          {o.growth_rate !== undefined ? (
            <Field label="Growth" value={`${Math.round(o.growth_rate)}%`} />
          ) : null}
          {radiusKm ? <Field label="Radius" value={`${radiusKm.toFixed(1)} km`} /> : null}
          {o.message ? <p className="mt-2 text-[11px] text-slate-400">{o.message}</p> : null}
          {o.prevention_guidance?.length ? (
            <ul className="mt-2 list-inside list-disc space-y-0.5 text-[11px] text-slate-400">
              {o.prevention_guidance.slice(0, 4).map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : null}
        </>
      );
    }
    const c = selection.clinic;
    return (
      <>
        <Head title={c.name ?? "Clinic"} />
        {c.clinic_type || c.type ? (
          <Field label="Type" value={label(c.clinic_type ?? c.type)} />
        ) : null}
        {c.address ? <Field label="Address" value={c.address} /> : null}
        {c.distance_km !== undefined ? (
          <Field label="Distance" value={`${c.distance_km.toFixed(1)} km`} />
        ) : null}
        {c.opening_hours ? <Field label="Hours" value={c.opening_hours} /> : null}
      </>
    );
  })();

  return (
    <div
      className={cn(
        glass,
        "absolute z-[700] p-3 text-slate-200",
        "inset-x-3 bottom-3 md:inset-x-auto md:bottom-auto md:right-3 md:top-3 md:w-64",
      )}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className="absolute right-2 top-2 text-slate-500 hover:text-slate-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      {body}
    </div>
  );
}

function Head({ title }: { title: string }) {
  return <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">{title}</div>;
}

function Field({ label: l, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5 text-[11px]">
      <span className="text-slate-500">{l}</span>
      <span className="font-medium" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

export function SurveillanceMap({
  cells,
  forecasts = [],
  center,
  days,
  onDaysChange,
  onCenter,
  loading,
  radiusKm = 10,
  onRadiusChange,
  outbreaks = [],
  clinics = [],
  error,
  onRetry,
}: {
  cells: MapCell[];
  forecasts?: Forecast[] | undefined;
  center: { latitude: number; longitude: number };
  days: number;
  onDaysChange: (value: number) => void;
  onCenter: () => void;
  loading?: boolean | undefined;
  radiusKm?: number | undefined;
  onRadiusChange?: ((value: number) => void) | undefined;
  outbreaks?: Outbreak[] | undefined;
  clinics?: Clinic[] | undefined;
  error?: boolean | undefined;
  onRetry?: (() => void) | undefined;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const [hover, setHover] = useState<Selection>(null);
  const [mapMode, setMapMode] = useState<"observed" | "forecast">("observed");
  const [layers, setLayers] = useState({ outbreaks: true, clinics: true });
  const [controlsOpen, setControlsOpen] = useState(false);
  const [recenterNonce, setRecenterNonce] = useState(0);

  const totalCases = cells.reduce((sum, c) => sum + (c.case_count || 0), 0);
  const shown = selection ?? hover;

  return (
    <section className="relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-700/60 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-slate-200">
          <Radar className="h-3.5 w-3.5" />
          Disease surveillance
        </h2>
        <span className="text-[11px] text-slate-500">
          {mapMode === "observed"
            ? `${cells.length} live-report zones`
            : `${forecasts.length} forecast zones`}{" "}
          · {radiusKm} km
        </span>
      </header>

      <div className="relative h-[440px] w-full md:h-[620px]">
        <ClientOnly fallback={<LoadingOverlay />}>
          <Suspense fallback={<LoadingOverlay />}>
            <Canvas
              cells={cells}
              forecasts={forecasts}
              center={center}
              radiusKm={radiusKm}
              outbreaks={outbreaks}
              clinics={clinics}
              layers={{
                observed: mapMode === "observed",
                forecast: mapMode === "forecast",
                ...layers,
              }}
              recenterNonce={recenterNonce}
              onSelect={setSelection}
              onHover={setHover}
            />
          </Suspense>
        </ClientOnly>

        {loading ? <LoadingOverlay /> : null}

        {/* mobile controls toggle */}
        <button
          type="button"
          onClick={() => setControlsOpen((v) => !v)}
          className={cn(glass, "absolute left-3 top-3 z-[700] p-2.5 text-slate-200 md:hidden")}
          aria-label="Map controls"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        <div
          className={cn(
            glass,
            "absolute left-3 top-14 z-[700] w-52 space-y-2.5 p-3 md:top-3 md:w-56",
            controlsOpen ? "block" : "hidden md:block",
          )}
        >
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Map view
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-md bg-slate-800/75 p-1">
              <button
                type="button"
                onClick={() => setMapMode("observed")}
                className={cn(
                  "rounded px-2 py-1.5 text-[10px] font-medium",
                  mapMode === "observed"
                    ? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-400/40"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                Live reports
              </button>
              <button
                type="button"
                onClick={() => setMapMode("forecast")}
                className={cn(
                  "rounded px-2 py-1.5 text-[10px] font-medium",
                  mapMode === "forecast"
                    ? "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/40"
                    : "text-slate-400 hover:text-slate-200",
                )}
              >
                5-day forecast
              </button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Radius
            </div>
            <div className="flex gap-1">
              {RADII.map((r) => (
                <Chip key={r} active={r === radiusKm} onClick={() => onRadiusChange?.(r)}>
                  {r} km
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Time</div>
            <div className="flex gap-1">
              {WINDOWS.map((w) => (
                <Chip key={w.value} active={w.value === days} onClick={() => onDaysChange(w.value)}>
                  {w.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <Layers className="h-3 w-3" /> Layers
            </div>
            <div className="space-y-1">
              {(
                [
                  ["outbreaks", "Outbreak zones"],
                  ["clinics", "Clinics"],
                ] as const
              ).map(([key, text]) => (
                <label key={key} className="flex items-center gap-2 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))}
                    className="h-3.5 w-3.5 accent-sky-500"
                  />
                  {text}
                </label>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setRecenterNonce((n) => n + 1);
              onCenter();
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-600/70 py-1.5 text-[11px] text-slate-200 transition-colors hover:bg-slate-100/10"
          >
            <Crosshair className="h-3.5 w-3.5" /> Focus on my area
          </button>
        </div>

        <InfoCard selection={shown} onClose={() => setSelection(null)} />

        {error ? (
          <div className={cn(glass, "absolute inset-x-3 top-3 z-[700] p-3 md:left-60 md:right-3")}>
            <div className="text-[10px] uppercase tracking-[0.22em] text-rose-300">
              Surveillance data unavailable
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Unable to retrieve current map data.</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-slate-600/70 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-slate-100/10"
            >
              <RotateCw className="h-3 w-3" /> Retry
            </button>
          </div>
        ) : !loading && cells.length === 0 ? (
          <div
            className={cn(
              glass,
              "pointer-events-none absolute left-1/2 top-1/2 z-[650] w-64 -translate-x-1/2 -translate-y-1/2 p-3 text-center",
            )}
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-300">
              No active disease signal
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              No aggregated cases detected within the selected area and time window.
            </p>
          </div>
        ) : null}

        <div className={cn(glass, "absolute bottom-3 left-3 z-[650] p-2.5 text-[11px]")}>
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Activity
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-28 rounded-full bg-[linear-gradient(90deg,#38bdf8,#2dd4bf,#facc15,#f97316,#e13d5c)]" />
          </div>
          <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wide text-slate-500">
            <span>Low</span>
            <span>Critical</span>
          </div>
          <div className="mt-2 border-t border-slate-700/60 pt-1.5 text-[9px] uppercase tracking-wide text-slate-400">
            {mapMode === "observed"
              ? "Live, confirmed reports only"
              : "Violet risk surface · modelled forecast"}
          </div>
        </div>
      </div>

      <p className="border-t border-slate-700/60 px-4 py-2 text-[10px] text-slate-500">
        Aggregated, anonymised area data only. Individual cases are never shown.
      </p>
    </section>
  );
}
