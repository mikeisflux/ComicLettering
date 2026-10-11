"use client";
/* Lettering the browser cannot style on its own — a Lightning glow's
   filaments are generated from the letters' alpha mask, not a CSS filter —
   is drawn in the editor through the very same canvas routine the exporter
   uses, so the screen shows exactly what prints. The canvas is padded all
   round so the bolts and halo are not cut at the box edge. */
import { useEffect, useRef } from "react";
import { TextRun, TextStyle } from "@/lib/model";
import { drawStyledText } from "@/lib/exportPng";
import { boltReach } from "@/lib/lightning";

export function rasterPad(ts: TextStyle): number {
  return Math.ceil(ts.size * (0.8 + Math.max(boltReach(ts.glowW ?? 1) * 1.1, 0.36 * (ts.glowW ?? 1) * 2.4)) + ts.outlineW * 2);
}

export function RasterText({ ts, text, runs, rect, warp, zoom }: {
  ts: TextStyle; text: string; runs?: TextRun[]; rect: [number, number, number, number]; warp: number; zoom: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [x, y, w, h] = rect;
  const pad = rasterPad(ts);
  const sig = JSON.stringify([text, ts, runs, w, h, warp, zoom]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(3, Math.max(1, zoom * (window.devicePixelRatio || 1)));
    const cw = Math.max(1, Math.round(w) + pad * 2), ch = Math.max(1, Math.round(h) + pad * 2);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    drawStyledText(ctx, ts, text, [pad, pad, w, h], warp, runs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return (
    <canvas ref={ref} className="warpCv"
      style={{ left: x - pad, top: y - pad, width: Math.round(w) + pad * 2, height: Math.round(h) + pad * 2 }} />
  );
}
