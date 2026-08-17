import { Suspense, lazy, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Crosshair, Layers, Radar, RotateCw, SlidersHorizontal, X } from "lucide-react";
import { ACTIVITY_COLORS } from "@/components/ActivityBadge";
import { DISEASES, label } from "@/lib/types";
import type { Clinic, MapCell, Outbreak } from "@/lib/types";
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
  "rounded-lg border border-cyan-300/15 bg-slate-950/70 backdrop-blur-md shadow-[0_0_24px_-12px_rgba(34,211,238,0.6)]";

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
        "rounded-md px-2 py-1 text-[11px] font-medium tracking-wide transition-colors",
        active
          ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/40"
          : "text-slate-400 hover:text-slate-200",
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
        <Radar className="h-3.5 w-3.5 animate-spin text-cyan-300" />
        <span className="text-[11px] uppercase tracking-[0.18em] text-cyan-100">
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
      const color = ACTIVITY_COLORS[c.activity_level] ?? "#22d3ee";
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
  return <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-cyan-300">{title}</div>;
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
  center,
  disease,
  onDiseaseChange,
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
  center: { latitude: number; longitude: number };
  disease: string;
  onDiseaseChange: (value: string) => void;
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
  const [layers, setLayers] = useState({ risk: true, outbreaks: true, clinics: true });
  const [controlsOpen, setControlsOpen] = useState(false);
  const [recenterNonce, setRecenterNonce] = useState(0);

  const totalCases = cells.reduce((sum, c) => sum + (c.case_count || 0), 0);
  const shown = selection ?? hover;

  return (
    <section className="relative overflow-hidden rounded-xl border border-cyan-300/15 bg-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-300/10 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-cyan-200">
          <Radar className="h-3.5 w-3.5" />
          Disease surveillance
        </h2>
        <span className="text-[11px] text-slate-500">
          {cells.length} zones · {totalCases} cases · {radiusKm} km
        </span>
      </header>

      <div className="relative h-[440px] w-full md:h-[620px]">
        <ClientOnly fallback={<LoadingOverlay />}>
          <Suspense fallback={<LoadingOverlay />}>
            <Canvas
              cells={layers.risk ? cells : []}
              center={center}
              radiusKm={radiusKm}
              outbreaks={outbreaks}
              clinics={clinics}
              layers={layers}
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
          className={cn(glass, "absolute left-3 top-3 z-[700] p-2 text-cyan-200 md:hidden")}
          aria-label="Map controls"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>

        <div
          className={cn(
            glass,
            "absolute left-3 top-14 z-[700] w-52 space-y-2.5 p-3 md:top-3",
            controlsOpen ? "block" : "hidden md:block",
          )}
        >
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
            <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Disease
            </div>
            <select
              value={disease}
              onChange={(e) => onDiseaseChange(e.target.value)}
              aria-label="Filter by disease"
              className="h-7 w-full rounded-md border border-cyan-300/20 bg-slate-900/80 px-1.5 text-[11px] text-slate-200 outline-none focus:ring-1 focus:ring-cyan-300/50"
            >
              <option value="">All diseases</option>
              {DISEASES.map((d) => (
                <option key={d} value={d}>
                  {label(d)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              <Layers className="h-3 w-3" /> Layers
            </div>
            <div className="space-y-1">
              {(
                [
                  ["risk", "Disease risk"],
                  ["outbreaks", "Outbreak zones"],
                  ["clinics", "Clinics"],
                ] as const
              ).map(([key, text]) => (
                <label key={key} className="flex items-center gap-2 text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={layers[key]}
                    onChange={(e) => setLayers((l) => ({ ...l, [key]: e.target.checked }))}
                    className="h-3 w-3 accent-cyan-400"
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
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-cyan-300/25 py-1 text-[11px] text-cyan-200 hover:bg-cyan-400/10"
          >
            <Crosshair className="h-3 w-3" /> Locate me
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
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-cyan-300/25 px-2 py-1 text-[11px] text-cyan-200 hover:bg-cyan-400/10"
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
            <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">
              No active disease signal
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              No aggregated cases detected within the selected area and time window.
            </p>
          </div>
        ) : null}

        <div className={cn(glass, "absolute bottom-3 right-3 z-[650] p-2.5 text-[11px]")}>
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Activity
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,#22d3ee,#facc15,#f97316,#e83ca0,#dc1e3c)]" />
          </div>
          <div className="mt-1 flex justify-between text-[9px] uppercase tracking-wide text-slate-500">
            <span>Normal</span>
            <span>Critical</span>
          </div>
        </div>
      </div>

      <p className="border-t border-cyan-300/10 px-4 py-2 text-[10px] text-slate-500">
        Aggregated, anonymised area data only. Individual cases are never shown.
      </p>
    </section>
  );
}
