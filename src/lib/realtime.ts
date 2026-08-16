import { useEffect, useRef } from "react";
import { API_BASE_URL, getToken } from "./api";

export type RealtimeEvent = {
  type:
    | "NEW_CASE"
    | "SURVEILLANCE_UPDATED"
    | "OUTBREAK_ALERT"
    | "APPOINTMENT_BOOKED"
    | "NOTIFICATION"
    | string;
  data?: unknown;
};

function wsUrl(token: string) {
  const base = API_BASE_URL.replace(/^http/, "ws");
  return `${base}/ws?token=${encodeURIComponent(token)}`;
}

/** Single WebSocket connection with exponential backoff. Never logs the token. */
export function useRealtime(onEvent: (event: RealtimeEvent) => void, enabled = true) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const token = getToken();
    if (!token) return;

    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        socket = new WebSocket(wsUrl(token));
      } catch {
        schedule();
        return;
      }

      socket.onopen = () => {
        attempt = 0;
      };
      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as RealtimeEvent;
          if (parsed && parsed.type) handler.current(parsed);
        } catch {
          /* ignore malformed frames */
        }
      };
      socket.onclose = () => {
        if (!closed) schedule();
      };
      socket.onerror = () => {
        socket?.close();
      };
    };

    const schedule = () => {
      const delay = Math.min(30000, 1000 * 2 ** attempt) + Math.random() * 500;
      attempt += 1;
      timer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [enabled]);
}
