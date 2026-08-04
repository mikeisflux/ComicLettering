"use client";
/* Ink-rect measurement for lettering elements, shared by the selection
   overlay (renderEls places the resize handles and warp dots on this rect)
   and the resize drag (useStartDrag pins this rect's opposite corner so the
   letters stay planted while the box resizes around them). */
import { TextEl, applyCrossbarI } from "@/lib/model";
import { arcTextLayout } from "@/lib/geometry";
import { Warp, isWarped, warpPoint } from "@/lib/warp";
import { measureBlock, measureCharWidths } from "./textHelpers";

export interface InkFractions { x0: number; y0: number; x1: number; y1: number }

/* Ink bounds of a lettering element, as FRACTIONS of its box. The layout box
   is often larger than the letters themselves — arc warps lay glyphs out from
   the centre, and a one-axis resize widens the box while the font size (which
   follows the SMALLER ratio) stays put — so the manipulation box hugs the
   measured ink instead of the box. Returns null when the box already fits. */
export function textInkFractions(el: TextEl): InkFractions | null {
  if (!el.text || !el.text.trim() || el.w < 2 || el.h < 2) return null;
  const ts = el.ts;
  const pad = ts.outlineW / 2 + 2; // centred text-stroke spills half out, plus a hair
  if (el.warp) {
    /* arc-warped SFX: replicate the render layout and take the extents of the
       rotated per-glyph boxes */
    let raw = (ts.caps ? el.text.toUpperCase() : el.text).replace(/\s*\n\s*/g, " ");
    if (ts.crossbarI) raw = applyCrossbarI(raw);
    const chars = raw.match(/\P{M}\p{M}*/gu) || [];
    if (!chars.length) return null;
    const widths = measureCharWidths(ts, chars);
    const layout = arcTextLayout(widths, el.warp);
    const cx = el.w / 2, cy = el.h / 2;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === " ") continue;
      const hw = widths[i] / 2, hh = ts.size / 2;
      const c = Math.abs(Math.cos(layout[i].rot)), s = Math.abs(Math.sin(layout[i].rot));
      const ex = c * hw + s * hh, ey = s * hw + c * hh;
      const px = cx + layout[i].x, py = cy + layout[i].y;
      if (px - ex < x0) x0 = px - ex;
      if (px + ex > x1) x1 = px + ex;
      if (py - ey < y0) y0 = py - ey;
      if (py + ey > y1) y1 = py + ey;
    }
    if (x1 <= x0 || y1 <= y0) return null;
    /* snug box → no re-hug (see the straight branch below) */
    const fx = ts.size * 0.18 + ts.outlineW * 1.2 + 3;
    const fy = ts.size * 0.14 + ts.outlineW * 1.2 + 3;
    if (x0 <= fx && el.w - x1 <= fx && y0 <= fy && el.h - y1 <= fy) return null;
    return {
      x0: (x0 - pad) / el.w, y0: (y0 - pad) / el.h,
      x1: (x1 + pad) / el.w, y1: (y1 + pad) / el.h,
    };
  }
  /* straight lettering: the block is centred vertically (the .txt flex column)
     and placed horizontally by ts.align inside the box */
  const m = measureBlock(ts, el.text, el.w);
  if (m.w < 1 || m.h < 1) return null;
  const y0 = (el.h - m.h) / 2;
  const x0 = ts.align === "center" ? (el.w - m.w) / 2
    : ts.align === "right" ? el.w - m.w : 0;
  /* a box that's already snug (what a fresh or migrated element gets) is NOT
     re-hugged: the selection box, resize handles and warp dots then all sit
     on the SAME rect instead of three subtly different ones */
  const fitX = ts.size * 0.18 + ts.outlineW * 1.2 + 3;
  const fitY = ts.size * 0.14 + ts.outlineW * 1.2 + 3;
  if (x0 <= fitX && el.w - (x0 + m.w) <= fitX && y0 <= fitY && el.h - (y0 + m.h) <= fitY) return null;
  return {
    x0: (x0 - pad) / el.w, y0: (y0 - pad) / el.h,
    x1: (x0 + m.w + pad) / el.w, y1: (y0 + m.h + pad) / el.h,
  };
}

/* Ink bounds of an ENVELOPE-warped lettering element: measure the straight
   ink, then push that rect through the warp — the patch bounds alone span the
   whole (often oversized) layout box, which left the manipulation box far from
   the letters on warped SFX. */
export function warpInkBounds(el: TextEl, env: Warp): InkFractions {
  const ink = textInkFractions(el) ?? { x0: 0, y0: 0, x1: 1, y1: 1 };
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (u: number, v: number) => {
    const [x, y] = warpPoint(env, u, v);
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  /* sample the ink rect's boundary — every warp handle's influence peaks on
     an edge or corner, so the boundary carries the extremes */
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    take(ink.x0 + t * (ink.x1 - ink.x0), ink.y0);
    take(ink.x0 + t * (ink.x1 - ink.x0), ink.y1);
    take(ink.x0, ink.y0 + t * (ink.y1 - ink.y0));
    take(ink.x1, ink.y0 + t * (ink.y1 - ink.y0));
  }
  return { x0, y0, x1, y1 };
}

/* The rect the SELECTION HANDLES sit on, in the element's local px frame —
   env-warped, arc-warped and straight lettering all resolve to the same rect
   the overlay uses, falling back to the full box when the box is snug.
   Mirrored for flips, since the ink renders flipped about the box centre. */
export function selectionInkRect(el: TextEl): { x0: number; y0: number; x1: number; y1: number } {
  const env = isWarped(el.ts.env as Warp) ? (el.ts.env as Warp) : null;
  const f = env ? warpInkBounds(el, env) : textInkFractions(el);
  const r = f
    ? { x0: f.x0 * el.w, y0: f.y0 * el.h, x1: f.x1 * el.w, y1: f.y1 * el.h }
    : { x0: 0, y0: 0, x1: el.w, y1: el.h };
  return {
    x0: el.flipH ? el.w - r.x1 : r.x0, x1: el.flipH ? el.w - r.x0 : r.x1,
    y0: el.flipV ? el.h - r.y1 : r.y0, y1: el.flipV ? el.h - r.y0 : r.y1,
  };
}
