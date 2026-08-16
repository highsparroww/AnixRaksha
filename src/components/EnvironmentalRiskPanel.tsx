import { CloudRain } from "lucide-react";
import type { EnvironmentalRisk } from "@/lib/types";
import { label } from "@/lib/types";
import { ActivityBadge } from "@/components/ActivityBadge";
import { EmptyText, Panel } from "@/components/Panel";

const LEVEL_MAP: Record<string, string> = {
  LOW: "NORMAL",
  MODERATE: "WATCH",
  ELEVATED: "ELEVATED",
  HIGH: "HIGH",
  SEVERE: "CRITICAL",
};

export function EnvironmentalRiskPanel({ risk }: { risk: EnvironmentalRisk | null }) {
  return (
    <Panel
      title="Environmental risk"
      icon={<CloudRain className="h-4 w-4 text-muted-foreground" />}
      action={
        risk ? <ActivityBadge level={LEVEL_MAP[risk.risk_level] ?? risk.risk_level} /> : null
      }
    >
      {!risk ? (
        <EmptyText>Environmental assessment unavailable.</EmptyText>
      ) : risk.data_status === "NO_LIVE_ENVIRONMENTAL_DATA" ? (
        <EmptyText>No live environmental data is available for your area right now.</EmptyText>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="text-muted-foreground">
            Risk score{" "}
            <span className="font-medium text-foreground">
              {Math.round((risk.risk_score ?? 0) * 100)}%
            </span>
          </div>

          {risk.contributing_factors?.length ? (
            <div className="space-y-1">
              {risk.contributing_factors.map((f) => (
                <div key={f.factor} className="text-xs">
                  <span className="font-medium text-foreground">{label(f.factor)}</span>{" "}
                  <span className="text-muted-foreground">
                    ({label(f.severity)}) — {f.reason}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {[...(risk.potential_water_borne_diseases ?? []), ...(risk.potential_vector_borne_diseases ?? [])].length ? (
            <div className="flex flex-wrap gap-1.5">
              {[
                ...(risk.potential_water_borne_diseases ?? []),
                ...(risk.potential_vector_borne_diseases ?? []),
              ].map((d) => (
                <span
                  key={d}
                  className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {label(d)}
                </span>
              ))}
            </div>
          ) : null}

          {risk.prevention_guidance?.length ? (
            <ul className="list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
              {risk.prevention_guidance.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : null}

          <p className="rounded-md bg-muted p-2 text-[11px] text-muted-foreground">
            {risk.disclaimer ??
              "Environmental conditions only — not a diagnosis or outbreak prediction."}
          </p>
        </div>
      )}
    </Panel>
  );
}
