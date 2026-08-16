import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title?: string | undefined;
  icon?: ReactNode | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon}
            {title}
          </h2>
          {action}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

export function Row({
  left,
  right,
  sub,
}: {
  left: ReactNode;
  right?: ReactNode | undefined;
  sub?: ReactNode | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2 last:border-0 last:pb-0 first:pt-0">
      <div className="min-w-0">
        <div className="truncate text-sm text-foreground">{left}</div>
        {sub ? <div className="text-xs text-muted-foreground">{sub}</div> : null}
      </div>
      {right ? <div className="shrink-0 text-xs text-muted-foreground">{right}</div> : null}
    </div>
  );
}
