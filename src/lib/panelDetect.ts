/* Auto panel detection: find the panel grid drawn into a page of comic art.
   Pure client-side image analysis — no network, no models. Works on the
   classic structure of a lettered page: panels separated by gutters of a
   near-uniform colour (usually white, sometimes black).

   Method: recursive X-Y cut. Estimate the gutter colour from the artwork's
   border ring, then repeatedly split the page along full-width rows (then
   full-height columns) that are almost entirely gutter-coloured. Regions
   that cannot be split any further are panels; each is trimmed of the
   gutter margin that surrounds it. Returns rects normalised 0..1 to the
   artwork so callers can map them through however the art is placed. */

export interface DetectedPanel { x: number; y: number; w: number; h: number }

const MAX_DIM = 760;        // analysis resolution (longest side)
const GUTTER_TOL = 30;      // per-channel distance still counting as gutter
const ROW_FRAC = 0.955;     // fraction of gutter pixels for a row/col to count
const MIN_AREA = 0.015;     // discard regions under 1.5% of the artwork
const MAX_DEPTH = 5;

interface Region { x0: number; y0: number; x1: number; y1: number }

export function detectPanels(img: HTMLImageElement | HTMLCanvasElement): DetectedPanel[] {
  const iw = img instanceof HTMLCanvasElement ? img.width : img.naturalWidth;
  const ih = img instanceof HTMLCanvasElement ? img.height : img.naturalHeight;
  if (!iw || !ih) return [];
  const s = Math.min(1, MAX_DIM / Math.max(iw, ih));
  const w = Math.max(8, Math.round(iw * s)), h = Math.max(8, Math.round(ih * s));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  if (!cx) return [];
  cx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try { data = cx.getImageData(0, 0, w, h).data; }
  catch { return []; } // tainted canvas — cross-origin art
  const [gr, gg, gb] = gutterColor(data, w, h);
  /* per-pixel gutter mask, once */
  const mask = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    mask[i] = Math.abs(data[p] - gr) <= GUTTER_TOL &&
      Math.abs(data[p + 1] - gg) <= GUTTER_TOL &&
      Math.abs(data[p + 2] - gb) <= GUTTER_TOL ? 1 : 0;
  }
  const out: Region[] = [];
  splitRegion({ x0: 0, y0: 0, x1: w, y1: h }, mask, w, 0, out);
  const minPx = MIN_AREA * w * h;
  return out
    .filter((r) => (r.x1 - r.x0) * (r.y1 - r.y0) >= minPx)
    .sort((a, b) => (rowBand(a, h) - rowBand(b, h)) || (a.x0 - b.x0))
    .map((r) => ({ x: r.x0 / w, y: r.y0 / h, w: (r.x1 - r.x0) / w, h: (r.y1 - r.y0) / h }));
}

/* panels on roughly the same tier sort left-to-right, tiers top-to-bottom */
const rowBand = (r: Region, h: number) => Math.round(r.y0 / (h * 0.08));

/* median colour of the border ring — comic gutters run to the page edge
   far more often than any single artwork colour does */
function gutterColor(d: Uint8ClampedArray, w: number, h: number): [number, number, number] {
  const rs: number[] = [], gs: number[] = [], bs: number[] = [];
  const ring = Math.max(2, Math.round(Math.min(w, h) * 0.01));
  const take = (x: number, y: number) => {
    const p = (y * w + x) * 4;
    rs.push(d[p]); gs.push(d[p + 1]); bs.push(d[p + 2]);
  };
  for (let x = 0; x < w; x += 2) for (let t = 0; t < ring; t++) { take(x, t); take(x, h - 1 - t); }
  for (let y = 0; y < h; y += 2) for (let t = 0; t < ring; t++) { take(t, y); take(w - 1 - t, y); }
  const med = (a: number[]) => a.sort((x, y) => x - y)[a.length >> 1] ?? 255;
  return [med(rs), med(gs), med(bs)];
}

function splitRegion(r: Region, mask: Uint8Array, w: number, depth: number, out: Region[]) {
  const t = trimGutter(r, mask, w);
  if (!t) return;
  if (depth >= MAX_DEPTH) { out.push(t); return; }
  const parts = cut(t, mask, w, true) ?? cut(t, mask, w, false);
  if (!parts) { out.push(t); return; }
  for (const p of parts) splitRegion(p, mask, w, depth + 1, out);
}

/* find gutter bands crossing the whole region; horizontal=true scans rows */
function cut(r: Region, mask: Uint8Array, w: number, horizontal: boolean): Region[] | null {
  const lo = horizontal ? r.y0 : r.x0, hi = horizontal ? r.y1 : r.x1;
  const span = horizontal ? r.x1 - r.x0 : r.y1 - r.y0;
  const need = Math.max(2, Math.round((hi - lo) * 0.006));
  const isGutterLine = (i: number) => {
    let n = 0;
    if (horizontal) { for (let x = r.x0; x < r.x1; x++) n += mask[i * w + x]; }
    else { for (let y = r.y0; y < r.y1; y++) n += mask[y * w + i]; }
    return n >= span * ROW_FRAC;
  };
  const bands: [number, number][] = [];
  let start = -1;
  for (let i = lo; i <= hi; i++) {
    const g = i < hi && isGutterLine(i);
    if (g && start < 0) start = i;
    if (!g && start >= 0) {
      /* interior bands split; bands touching the region edge just trim */
      if (i - start >= need && start > lo && i < hi) bands.push([start, i]);
      start = -1;
    }
  }
  if (!bands.length) return null;
  const parts: Region[] = [];
  let prev = lo;
  for (const [a, b] of bands) {
    push(parts, r, prev, a, horizontal);
    prev = b;
  }
  push(parts, r, prev, hi, horizontal);
  return parts.length > 1 ? parts : null;
}

function push(parts: Region[], r: Region, a: number, b: number, horizontal: boolean) {
  if (b - a < 3) return;
  parts.push(horizontal ? { x0: r.x0, y0: a, x1: r.x1, y1: b } : { x0: a, y0: r.y0, x1: b, y1: r.y1 });
}

/* peel fully-gutter rows/cols off every side; null if nothing is left */
function trimGutter(r: Region, mask: Uint8Array, w: number): Region | null {
  let { x0, y0, x1, y1 } = r;
  const rowG = (y: number) => { let n = 0; for (let x = x0; x < x1; x++) n += mask[y * w + x]; return n >= (x1 - x0) * ROW_FRAC; };
  const colG = (x: number) => { let n = 0; for (let y = y0; y < y1; y++) n += mask[y * w + x]; return n >= (y1 - y0) * ROW_FRAC; };
  while (y0 < y1 && rowG(y0)) y0++;
  while (y1 > y0 && rowG(y1 - 1)) y1--;
  while (x0 < x1 && colG(x0)) x0++;
  while (x1 > x0 && colG(x1 - 1)) x1--;
  return x1 - x0 > 3 && y1 - y0 > 3 ? { x0, y0, x1, y1 } : null;
}
