"use client";
/* Warped lettering in the editor. An envelope is not a CSS transform, so the
   block is drawn through the very same canvas routine the exporter uses —
   which is what keeps the screen and the printed page identical. */
import { useEffect, useRef } from "react";
import { TextEl, TextStyle } from "@/lib/model";
import { drawStyledText } from "@/lib/exportPng";
import { Warp, drawWarped, warpBounds } from "@/lib/warp";

export function WarpedText({ el, env, zoom }: { el: TextEl; env: Warp; zoom: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  /* redraw whenever anything that affects the picture moves */
  const sig = JSON.stringify([el.text, el.ts, el.runs, el.w, el.h, el.warp, env, zoom]);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    /* render above 1:1 so the warp stays crisp when the page is zoomed in */
    const dpr = Math.min(3, Math.max(1, zoom * (window.devicePixelRatio || 1)));
    const w = Math.max(1, Math.round(el.w)), h = Math.max(1, Math.round(el.h));
    /* a warp routinely pushes letters outside the box they started in, so the
       canvas covers the warped bounds rather than the element rect */
    const b = warpBounds(env);
    const ox = Math.min(0, b.x0) * w, oy = Math.min(0, b.y0) * h;
    const cw = Math.max(w, (Math.max(1, b.x1) - Math.min(0, b.x0)) * w);
    const chh = Math.max(h, (Math.max(1, b.y1) - Math.min(0, b.y0)) * h);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr);
    Object.assign(cv.style, { left: `${ox}px`, top: `${oy}px`, width: `${cw}px`, height: `${chh}px` });
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, chh);
    const flat = document.createElement("canvas");
    flat.width = Math.round(w * dpr); flat.height = Math.round(h * dpr);
    const fctx = flat.getContext("2d");
    if (!fctx) return;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawStyledText(fctx, { ...el.ts, env: undefined } as TextStyle, el.text,
      [0, 0, w, h], el.warp || 0, el.runs);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.translate(-ox * dpr, -oy * dpr);
    drawWarped(ctx, flat, flat.width, flat.height, env, w * dpr, h * dpr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return <canvas ref={ref} className="warpCv" />;
}
