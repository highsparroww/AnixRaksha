import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { ActivityLevel, MapCell } from "@/lib/types";

/**
 * Ordered severity ramp. Intensity (density) drives opacity, severity drives hue,
 * so the layer reads like a geographic data surface rather than neon bubbles.
 */
const LEVELS: ActivityLevel[] = ["NORMAL", "WATCH", "ELEVATED", "HIGH", "CRITICAL"];

const LEVEL_COLOR: Record<ActivityLevel, [number, number, number]> = {
  NORMAL: [56, 189, 248],
  WATCH: [45, 212, 191],
  ELEVATED: [250, 204, 21],
  HIGH: [249, 115, 22],
  CRITICAL: [225, 61, 92],
};

function severityIndex(level?: string) {
  const i = LEVELS.indexOf((level?.toUpperCase() as ActivityLevel) ?? "NORMAL");
  return i < 0 ? 0 : i;
}

function mixColor(t: number): [number, number, number] {
  const clamped = Math.min(LEVELS.length - 1, Math.max(0, t));
  const lo = Math.floor(clamped);
  const hi = Math.min(LEVELS.length - 1, lo + 1);
  const f = clamped - lo;
  const a = LEVEL_COLOR[LEVELS[lo] as ActivityLevel];
  const b = LEVEL_COLOR[LEVELS[hi] as ActivityLevel];
  return [
    Math.round(a[0] + (b[0] - a[0]) * f),
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
  ];
}

/**
 * Smooth diffusion heat field: density is accumulated at half resolution into an
 * offscreen buffer, then colourised, so neighbouring zones blend into organic
 * regions instead of stacked circles. Redraws on map movement only (no idle loop).
 */
export default function HoloHeatLayer({ cells }: { cells: MapCell[] }) {
  const map = useMap();
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  useEffect(() => {
    const container = map.getContainer();
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:absolute;inset:0;z-index:350;pointer-events:none;transition:opacity 200ms ease";
    container.appendChild(canvas);

    const buffer = document.createElement("canvas");
    let raf = 0;

    const render = () => {
      const ctx = canvas.getContext("2d");
      const bctx = buffer.getContext("2d", { willReadFrequently: true });
      if (!ctx || !bctx) return;

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

      const list = cellsRef.current;
      if (!list.length) return;

      // Half-resolution accumulation buffer -> natural diffusion when scaled up.
      const scale = 0.5;
      const bw = Math.max(1, Math.round(size.x * scale));
      const bh = Math.max(1, Math.round(size.y * scale));
      if (buffer.width !== bw || buffer.height !== bh) {
        buffer.width = bw;
        buffer.height = bh;
      }
      bctx.clearRect(0, 0, bw, bh);
      bctx.globalCompositeOperation = "lighter";

      const maxCount = Math.max(1, ...list.map((c) => c.case_count || 0));

      // metres per pixel at the current view
      const a = map.containerPointToLatLng([0, size.y / 2]);
      const b = map.containerPointToLatLng([100, size.y / 2]);
      const mpp = Math.max(0.01, map.distance(a, b) / 100);

      for (const cell of list) {
        const p = map.latLngToContainerPoint([cell.latitude, cell.longitude]);
        const x = p.x * scale;
        const y = p.y * scale;
        const intensity = Math.min(1, (cell.case_count || 0) / maxCount);
        const sev = severityIndex(cell.activity_level);
        const metres = 620 + intensity * 1100;
        const r = Math.max(18, (metres / mpp) * scale);
        if (x < -r || y < -r || x > bw + r || y > bh + r) continue;

        // R channel carries severity, alpha carries density.
        const sevByte = Math.round((sev / (LEVELS.length - 1)) * 255);
        const alpha = 0.25 + intensity * 0.55;
        const g = bctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${sevByte},0,0,${alpha})`);
        g.addColorStop(0.55, `rgba(${sevByte},0,0,${alpha * 0.45})`);
        g.addColorStop(1, `rgba(${sevByte},0,0,0)`);
        bctx.fillStyle = g;
        bctx.beginPath();
        bctx.arc(x, y, r, 0, Math.PI * 2);
        bctx.fill();
      }

      // Colourise the accumulated density field.
      const img = bctx.getImageData(0, 0, bw, bh);
      const data = img.data;
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3] as number;
        if (!alpha) continue;
        const density = Math.min(1, alpha / 255);
        // severity stored in R, pre-multiplied by accumulated alpha
        const sevNorm = Math.min(1, (data[i] as number) / Math.max(1, alpha));
        const [r, g, bl] = mixColor(sevNorm * (LEVELS.length - 1));
        data[i] = r;
        data[i + 1] = g;
        data[i + 2] = bl;
        // eased opacity keeps roads and labels legible underneath
        data[i + 3] = Math.round(Math.min(0.62, Math.pow(density, 0.8) * 0.62) * 255);
      }
      bctx.globalCompositeOperation = "source-over";
      bctx.putImageData(img, 0, 0);

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.filter = "blur(6px)";
      ctx.drawImage(buffer, 0, 0, size.x, size.y);
      ctx.filter = "none";
    };

    const draw = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(render);
    };

    map.on("move zoom zoomend moveend resize viewreset", draw);
    draw();

    return () => {
      window.cancelAnimationFrame(raf);
      map.off("move zoom zoomend moveend resize viewreset", draw);
      canvas.remove();
    };
  }, [map]);

  useEffect(() => {
    map.fire("viewreset");
  }, [cells, map]);

  return null;
}
