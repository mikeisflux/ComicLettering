/* "Tuck Back" engine — the digital version of the letterer's traced
   clipping mask. Given a region of a panel's artwork, extract the FOREGROUND
   (inked/dark shapes) as a transparent cutout PNG. Placed above an SFX, the
   cutout makes the art read as being in front of the lettering.

   The cutout is generated at the artwork's native resolution for the region,
   so it stays sharp in print export. */

import { SamMask } from "@/lib/sam";

export interface TuckSource {
  img: HTMLImageElement;   // the panel/image element's artwork (already loaded)
  elW: number; elH: number;      // the element's on-page size
  regionX: number; regionY: number; // region in ELEMENT-local page units
  regionW: number; regionH: number;
}

/* How the foreground is decided.
   trace  — the outline the reader drew. Always works; it is their judgement.
   auto   — a segmentation mask from MobileSAM.
   level  — the old luminance cut, kept for flat high-contrast inks. */
export type TuckMode = "trace" | "auto" | "level";

export interface TuckAsk {
  src: TuckSource;
  artKey: string;              // asset id of the panel artwork (for the encoder cache)
  /* page index the cutout lands on. Usually the current page — but a trace
     that reaches across the spread's spine cuts the FACING page's art, and
     the cutout belongs there (pageX/pageY are in THAT page's coordinates). */
  targetPage: number;
  pageX: number; pageY: number; pageW: number; pageH: number;
  pts: number[][];             // traced outline, ELEMENT-local page units
  mode: TuckMode;
  feather: number;
  threshold: number;
  invert: boolean;
  mask: import("@/lib/sam").SamMask | null;
  auto: "idle" | "busy" | "done" | "fail";
  preview: string | null;
}

/** Bounding box of a point ring. */
export function pathBounds(pts: number[][]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Re-render the cutout for whatever mode the dialog is currently in. */
export function tuckPreview(t: TuckAsk): string | null {
  if (t.mode === "trace") return makeCutoutFromPath(t.src, t.pts, t.feather)?.url ?? null;
  if (t.mode === "auto" && t.mask) return makeCutoutFromMask(t.src, t.mask)?.url ?? null;
  if (t.mode === "auto") return null;
  return makeCutout(t.src, t.threshold, t.invert)?.url ?? null;
}

/* Replicates the editor's cover-crop: the image fills the element box like
   CSS object-fit: cover. Returns the source-pixel rect for an element-local
   rect. */
export function coverRect(s: TuckSource) { return coverMap(s); }

function coverMap(s: TuckSource) {
  const natW = s.img.naturalWidth, natH = s.img.naturalHeight;
  const scale = Math.max(s.elW / natW, s.elH / natH);
  const sw = s.elW / scale, sh = s.elH / scale;
  const sx = (natW - sw) / 2, sy = (natH - sh) / 2;
  return {
    sx: sx + (s.regionX / s.elW) * sw,
    sy: sy + (s.regionY / s.elH) * sh,
    sw: (s.regionW / s.elW) * sw,
    sh: (s.regionH / s.elH) * sh,
    scale,
  };
}


/* Same cutout, but the foreground comes from a segmentation mask instead of a
   brightness cut. The mask covers the WHOLE artwork, so it is sampled through
   the same cover-crop mapping the region uses. */
export function makeCutoutFromMask(
  s: TuckSource, mask: SamMask, feather = 1.2,
): { url: string; pxW: number; pxH: number } | null {
  const m = coverMap(s);
  const pxW = Math.max(1, Math.round(m.sw));
  const pxH = Math.max(1, Math.round(m.sh));
  if (pxW < 2 || pxH < 2) return null;
  const cv = document.createElement("canvas");
  cv.width = pxW; cv.height = pxH;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(s.img, m.sx, m.sy, m.sw, m.sh, 0, 0, pxW, pxH);
  let data: ImageData;
  try { data = ctx.getImageData(0, 0, pxW, pxH); } catch { return null; }
  const d = data.data;
  const kx = mask.w / s.img.naturalWidth, ky = mask.h / s.img.naturalHeight;
  for (let y = 0; y < pxH; y++) {
    /* map this cutout pixel back to a mask pixel */
    const my = Math.min(mask.h - 1, Math.max(0, Math.round((m.sy + (y / pxH) * m.sh) * ky)));
    for (let x = 0; x < pxW; x++) {
      const mx = Math.min(mask.w - 1, Math.max(0, Math.round((m.sx + (x / pxW) * m.sw) * kx)));
      let a = mask.data[my * mask.w + mx];
      if (feather > 0 && a === 1) {
        /* soften one pixel in from the mask edge so the cut is not a staircase */
        let n = 0;
        if (mx > 0) n += mask.data[my * mask.w + mx - 1];
        if (mx < mask.w - 1) n += mask.data[my * mask.w + mx + 1];
        if (my > 0) n += mask.data[(my - 1) * mask.w + mx];
        if (my < mask.h - 1) n += mask.data[(my + 1) * mask.w + mx];
        if (n < 4) a = 0.55;
      }
      const i = (y * pxW + x) * 4;
      d[i + 3] = Math.round(d[i + 3] * a);
    }
  }
  ctx.putImageData(data, 0, 0);
  return { url: cv.toDataURL("image/png"), pxW, pxH };
}


/* Cutout from a traced outline — the letterer's clipping mask, done by hand.

   No threshold and no model: whatever you draw around is what sits in front.
   On painted art this is the only thing that reliably works, because figure
   and background occupy the same brightness range and there is no cut that
   separates them.

   `pts` are in ELEMENT-local page units, the same space as regionX/regionY. */
export function makeCutoutFromPath(
  s: TuckSource, pts: number[][], feather = 2,
): { url: string; pxW: number; pxH: number } | null {
  if (pts.length < 3) return null;
  const m = coverMap(s);
  const pxW = Math.max(1, Math.round(m.sw));
  const pxH = Math.max(1, Math.round(m.sh));
  if (pxW < 2 || pxH < 2) return null;
  const cv = document.createElement("canvas");
  cv.width = pxW; cv.height = pxH;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  /* element-local page units -> pixels within this cutout */
  const kx = pxW / s.regionW, ky = pxH / s.regionH;
  const P = pts.map(([x, y]) => [(x - s.regionX) * kx, (y - s.regionY) * ky]);

  /* draw the traced shape as the mask, then keep only the art inside it.
     Midpoint-quadratic all the way round the ring — a smooth closed outline
     rather than the polygon the pointer actually emitted. */
  const n = P.length;
  ctx.beginPath();
  ctx.moveTo((P[n - 1][0] + P[0][0]) / 2, (P[n - 1][1] + P[0][1]) / 2);
  for (let i = 0; i < n; i++) {
    const c = P[i], q = P[(i + 1) % n];
    ctx.quadraticCurveTo(c[0], c[1], (c[0] + q[0]) / 2, (c[1] + q[1]) / 2);
  }
  ctx.closePath();
  if (feather > 0) { ctx.filter = `blur(${feather}px)`; }
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.filter = "none";
  ctx.globalCompositeOperation = "source-in";
  ctx.drawImage(s.img, m.sx, m.sy, m.sw, m.sh, 0, 0, pxW, pxH);
  ctx.globalCompositeOperation = "source-over";
  /* a cross-origin source taints the canvas and toDataURL throws — match
     makeCutoutFromMask and fail soft rather than crash the dialog */
  try { return { url: cv.toDataURL("image/png"), pxW, pxH }; }
  catch { return null; }
}

/* Build the transparent foreground cutout for a region.
   threshold: 0..100 — how dark a pixel must be to count as foreground.
   invert: keep LIGHT pixels instead (art with light foreground on dark bg).
   Returns a PNG data URL sized to the region at native art resolution. */
export function makeCutout(
  s: TuckSource, threshold: number, invert = false
): { url: string; pxW: number; pxH: number } | null {
  const m = coverMap(s);
  const pxW = Math.max(1, Math.round(m.sw));
  const pxH = Math.max(1, Math.round(m.sh));
  if (pxW < 2 || pxH < 2) return null;
  const cv = document.createElement("canvas");
  cv.width = pxW; cv.height = pxH;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(s.img, m.sx, m.sy, m.sw, m.sh, 0, 0, pxW, pxH);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, pxW, pxH);
  } catch {
    return null; // tainted canvas (non-local artwork)
  }
  const d = data.data;
  /* soft threshold: feather ±8 luminance steps around the cut so edges keep
     a hint of anti-aliasing instead of jaggies */
  const t = (threshold / 100) * 255;
  const lo = t - 8, hi = t + 8;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    let a: number;
    if (lum <= lo) a = 1;
    else if (lum >= hi) a = 0;
    else a = 1 - (lum - lo) / (hi - lo);
    if (invert) a = 1 - a;
    d[i + 3] = Math.round(d[i + 3] * a);
  }
  ctx.putImageData(data, 0, 0);
  return { url: cv.toDataURL("image/png"), pxW, pxH };
}
