import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { ActivityLevel, MapCell } from "@/lib/types";

/** Holographic risk gradient per activity level: [core, mid, edge] rgb triples. */
const RAMP: Record<ActivityLevel, [number[], number[], number[]]> = {
  NORMAL: [
    [125, 249, 255],
    [34, 211, 238],
    [14, 116, 144],
  ],
  WATCH: [
    [190, 255, 240],
    [34, 211, 238],
    [190, 200, 60],
  ],
  ELEVATED: [
    [255, 244, 170],
    [250, 204, 21],
    [234, 120, 20],
  ],
  HIGH: [
    [255, 220, 150],
    [249, 115, 22],
    [217, 70, 200],
  ],
  CRITICAL: [
    [255, 190, 220],
    [232, 60, 160],
    [220, 30, 60],
  ],
};

const rgba = (c: number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function ramp(level?: string) {
  return RAMP[(level?.toUpperCase() as ActivityLevel) ?? "NORMAL"] ?? RAMP.NORMAL;
}

/**
 * Canvas heat field drawn above the tiles. One canvas for all cells, so the
 * cost stays constant regardless of how many aggregated cells arrive.
 */
export default function HoloHeatLayer({ cells }: { cells: MapCell[] }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  useEffect(() => {
    const container = map.getContainer();
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;inset:0;z-index:400;pointer-events:none;mix-blend-mode:screen";
    container.appendChild(canvas);
    canvasRef.current = canvas;

    let frame = 0;
    let raf = 0;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const size = map.getSize();
      if (canvas.width !== size.x * dpr || canvas.height !== size.y * dpr) {
        canvas.width = size.x * dpr;
        canvas.height = size.y * dpr;
        canvas.style.width = `${size.x}px`;
        canvas.style.height = `${size.y}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size.x, size.y);
      ctx.globalCompositeOperation = "lighter";

      const list = cellsRef.current;
      const maxCount = Math.max(1, ...list.map((c) => c.case_count || 0));

      // metres per pixel at the current view
      const a = map.containerPointToLatLng([0, size.y / 2]);
      const b = map.containerPointToLatLng([100, size.y / 2]);
      const mpp = Math.max(0.01, map.distance(a, b) / 100);

      const breathe = 0.94 + 0.06 * Math.sin(frame / 32);

      for (const cell of list) {
        const p = map.latLngToContainerPoint([cell.latitude, cell.longitude]);
        const intensity = Math.min(1, (cell.case_count || 0) / maxCount);
        const metres = 500 + intensity * 900;
        const r = Math.max(26, (metres / mpp) * breathe);
        if (p.x < -r || p.y < -r || p.x > size.x + r || p.y > size.y + r) continue;

        const [core, mid, edge] = ramp(cell.activity_level);
        const alpha = 0.3 + intensity * 0.4;

        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, rgba(core, alpha));
        g.addColorStop(0.35, rgba(mid, alpha * 0.75));
        g.addColorStop(0.7, rgba(edge, alpha * 0.35));
        g.addColorStop(1, rgba(edge, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();

        // thin holographic perimeter
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 0.55, 0, Math.PI * 2);
        ctx.strokeStyle = rgba(mid, 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    const loop = () => {
      frame += 1;
      if (frame % 2 === 0) draw();
      raf = window.requestAnimationFrame(loop);
    };

    map.on("move zoom resize viewreset", draw);
    loop();

    return () => {
      window.cancelAnimationFrame(raf);
      map.off("move zoom resize viewreset", draw);
      canvas.remove();
    };
  }, [map]);

  return null;
}
