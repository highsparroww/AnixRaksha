import { useState } from "react";
import { Bell, Check, Droplets, LogOut, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { Notification } from "@/lib/types";
import { EmptyText } from "@/components/Panel";

function isUnread(n: Notification) {
  return !(n.is_read ?? n.read ?? false);
}

export function Header({
  name,
  notifications,
  unreadCount,
  onRefresh,
}: {
  name?: string | undefined;
  notifications: Notification[];
  unreadCount: number;
  onRefresh: () => void;
}) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const markAll = async () => {
    try {
      await api("/api/v1/notifications/read-all", { method: "PATCH" });
      onRefresh();
    } catch {
      /* toast already shown */
    }
  };

  const markOne = async (id: string) => {
    try {
      await api(`/api/v1/notifications/${id}/read`, { method: "PATCH" });
      onRefresh();
    } catch {
      /* toast already shown */
    }
  };

  return (
    <header className="sticky top-0 z-[900] border-b border-border bg-card">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight">WaterWatch</span>
        </div>

        <div className="flex items-center gap-1">
          {name ? (
            <span className="mr-2 hidden text-sm text-muted-foreground sm:inline">{name}</span>
          ) : null}

          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setOpen((v) => !v)}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>

            {open ? (
              <div className="absolute right-0 mt-1 w-80 rounded-md border border-border bg-card shadow-md">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                  <span className="text-sm font-medium">Notifications</span>
                  <button
                    type="button"
                    onClick={markAll}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Check className="h-3 w-3" /> Mark all read
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <div className="p-2">
                      <EmptyText>No notifications yet.</EmptyText>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => isUnread(n) && markOne(n.id)}
                        className="block w-full rounded-md p-2 text-left hover:bg-accent"
                      >
                        <div className="flex items-start gap-2">
                          {isUnread(n) ? (
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          ) : (
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="truncate text-sm">{n.title ?? n.type ?? "Update"}</div>
                            <div className="text-xs text-muted-foreground">
                              {n.message ?? n.body}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh dashboard"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
