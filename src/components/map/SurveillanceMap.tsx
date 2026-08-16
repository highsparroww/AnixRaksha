import { Suspense, lazy } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { Crosshair, Loader2, Map as MapIcon } from "lucide-react";
import { ACTIVITY_COLORS, ACTIVITY_ORDER } from "@/components/ActivityBadge";
import { DISEASES, label } from "@/lib/types";
import type { MapCell } from "@/lib/types";

const Canvas = lazy(() => import("./SurveillanceMapCanvas"));

const selectClass =
  "h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring";

function Skeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
}: {
  cells: MapCell[];
  center: { latitude: number; longitude: number };
  disease: string;
  onDiseaseChange: (value: string) => void;
  days: number;
  onDaysChange: (value: number) => void;
  onCenter: () => void;
  loading?: boolean;
}) {
  const totalCases = cells.reduce((sum, c) => sum + (c.case_count || 0), 0);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <MapIcon className="h-4 w-4 text-muted-foreground" />
          Disease surveillance
          <span className="text-xs font-normal text-muted-foreground">
            {cells.length} areas · {totalCases} cases
          </span>
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className={selectClass}
            value={disease}
            onChange={(e) => onDiseaseChange(e.target.value)}
            aria-label="Filter by disease"
          >
            <option value="">All diseases</option>
            {DISEASES.map((d) => (
              <option key={d} value={d}>
                {label(d)}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={days}
            onChange={(e) => onDaysChange(Number(e.target.value))}
            aria-label="Time window"
          >
            <option value={1}>Last 24h</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
          </select>
          <button
            type="button"
            onClick={onCenter}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-foreground hover:bg-accent"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Center on my area
          </button>
        </div>
      </header>

      <div className="relative h-[420px] w-full md:h-[560px]">
        <ClientOnly fallback={<Skeleton />}>
          <Suspense fallback={<Skeleton />}>
            <Canvas cells={cells} center={center} />
          </Suspense>
        </ClientOnly>

        {loading ? (
          <div className="absolute right-3 top-3 z-[500] rounded-md border border-border bg-card/95 px-2 py-1 text-xs text-muted-foreground">
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
            Updating
          </div>
        ) : null}

        <div className="absolute bottom-6 left-3 z-[500] rounded-md border border-border bg-card/95 p-2.5 text-xs shadow-sm">
          <div className="mb-1.5 font-medium text-foreground">Activity level</div>
          <div className="space-y-1">
            {ACTIVITY_ORDER.map((lvl) => (
              <div key={lvl} className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: ACTIVITY_COLORS[lvl] }}
                />
                {label(lvl)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
        Aggregated, anonymised area data only. Individual cases are never shown.
      </p>
    </section>
  );
}
