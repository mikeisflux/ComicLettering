/* Where a NEW element lands: in the middle of what the letterer is LOOKING
   AT, not the middle of the page.

   Every add path (tray, Insert menu, B/T/L/P shortcuts, word/emoji/SFX
   stamps, image import, paste) used to spawn at the page's centre. Zoomed
   into a corner, the new balloon appeared somewhere off-screen and the
   only way to find it was to zoom back out. The helpers here read the
   scroll container and the page's on-screen rectangle to find the part of
   the current page that is actually in view, on both canvases (the spread
   canvas spans two pages; `spreadOffX` makes the result page-local). */
import type { EditorCtx } from "./ctx";

export interface Rect { x: number; y: number; w: number; h: number }

const RULER = 22;   // the sticky rulers cover the top/left strip of the viewport

/* the visible part of the current page, in page coordinates; the whole
   page when the geometry is unavailable (SSR, first paint, page scrolled
   fully out of view) */
export function visiblePageRect(ed: Pick<EditorCtx, "areaRef" | "pageDivRef" | "zoom" | "spreadOffX" | "pageIndex" | "page">): Rect {
  const p = ed.page!;
  const whole = { x: 0, y: 0, w: p.w, h: p.h };
  const area = ed.areaRef?.current, pg = ed.pageDivRef?.current;
  if (!area || !pg || !(ed.zoom > 0)) return whole;
  const a = area.getBoundingClientRect(), r = pg.getBoundingClientRect();
  const off = ed.spreadOffX(ed.pageIndex);
  const z = ed.zoom;
  const x0 = (a.left + RULER - r.left) / z - off, y0 = (a.top + RULER - r.top) / z;
  const x1 = (a.right - r.left) / z - off, y1 = (a.bottom - r.top) / z;
  const x = Math.max(0, x0), y = Math.max(0, y0);
  const w = Math.min(p.w, x1) - x, h = Math.min(p.h, y1) - y;
  if (!(w > 8) || !(h > 8)) return whole;
  return { x, y, w, h };
}

/* top-left for a w×h element centred in the view. `stagger` nudges
   successive adds so they do not stack exactly, but never out of view;
   the element always stays on the page. */
export function spawnAt(ed: Parameters<typeof visiblePageRect>[0], w: number, h: number, stagger = 0): { x: number; y: number } {
  const v = visiblePageRect(ed);
  const p = ed.page!;
  const fit = (want: number, lo: number, hi: number, pageMax: number) =>
    Math.round(Math.max(0, Math.min(pageMax, hi < lo ? lo : Math.max(lo, Math.min(hi, want)))));
  const cx = v.x + v.w / 2 - w / 2 + stagger, cy = v.y + v.h / 2 - h / 2 + stagger;
  return {
    x: fit(cx, v.x, v.x + v.w - w, p.w - w),
    y: fit(cy, v.y, v.y + v.h - h, p.h - h),
  };
}

/* shift a group of freshly pasted/duplicated elements into view when none
   of them would be visible where they landed */
export function bringGroupIntoView(ed: Parameters<typeof visiblePageRect>[0], els: { x: number; y: number; w: number; h: number }[]) {
  if (!els.length) return;
  const v = visiblePageRect(ed);
  const bx0 = Math.min(...els.map((e) => e.x)), by0 = Math.min(...els.map((e) => e.y));
  const bx1 = Math.max(...els.map((e) => e.x + e.w)), by1 = Math.max(...els.map((e) => e.y + e.h));
  const overlaps = bx1 > v.x && bx0 < v.x + v.w && by1 > v.y && by0 < v.y + v.h;
  if (overlaps) return;
  const to = spawnAt(ed, bx1 - bx0, by1 - by0);
  const dx = to.x - bx0, dy = to.y - by0;
  for (const e of els) { e.x += dx; e.y += dy; }
}
