import type { ActivityLevel } from "@/lib/types";
import { label } from "@/lib/types";
import { cn } from "@/lib/utils";

export const ACTIVITY_COLORS: Record<ActivityLevel, string> = {
  NORMAL: "#16a34a",
  WATCH: "#eab308",
  ELEVATED: "#f97316",
  HIGH: "#ea580c",
  CRITICAL: "#dc2626",
};

export const ACTIVITY_ORDER: ActivityLevel[] = [
  "NORMAL",
  "WATCH",
  "ELEVATED",
  "HIGH",
  "CRITICAL",
];

export function ActivityBadge({
  level,
  className,
}: {
  level?: string | null | undefined;
  className?: string | undefined;
}) {
  const key = (level ?? "NORMAL").toUpperCase() as ActivityLevel;
  const color = ACTIVITY_COLORS[key] ?? "#64748b";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ borderColor: `${color}55`, backgroundColor: `${color}14`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label(key)}
    </span>
  );
}
