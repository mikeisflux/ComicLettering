/* The lasso for Tuck Back.

   Threshold cutting and even a segmentation model both guess at where the
   foreground ends. On painted or busy art they guess wrong, because figure
   and background share the same brightness range and the same edges. A
   letterer tracing a clipping mask by hand never has that problem — they
   simply draw around what should sit in front.

   So that is the default here: drag around the shape, and the enclosed art
   becomes the cutout. The model and the brightness cut stay available in the
   dialog for the cases where they are quicker. */

import type React from "react";
import type { Assets, Doc } from "@/lib/model";
import { loadImage } from "@/lib/exportPng";
import { closeSketchLoop, resampleRing, smoothSketchRing } from "./sketch";
import { TuckAsk, TuckSource, makeCutoutFromPath, pathBounds } from "./tuck";

export interface TuckDragDeps {
  docRef: React.RefObject<Doc | null>;
  assetsRef: React.RefObject<Assets>;
  pageIndexRef: React.RefObject<number>;
  ptsRef: React.RefObject<number[][] | null>;
  pagePoint: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  zoom: number;
  force: () => void;
  setStatus: (msg: string) => void;
  setTuckMode: (v: boolean) => void;
  setTuckAsk: (t: TuckAsk | null) => void;
  /* spread view: the facing page and where its origin sits in CURRENT-page
     units (screen mapping) — lets a trace sweep across the spine and cut the
     facing page's artwork */
  facing: { index: number; offX: number; offY: number } | null;
  /* stamped on trace end so the facing page's click-to-switch can ignore the
     click that ends a cross-spine trace */
  justEndedRef?: { current: number };
}

/* Points closer than this add nothing but work — the outline is smoothed
   afterwards anyway. */
const MIN_STEP = 2.5;

/* ---------------- magnetic trace (edge snapping) ----------------

   The lasso works like a magnetic pen: a Sobel edge map of the artwork under
   the cursor is built once when the drag starts, and every sampled point then
   snaps to the strongest nearby edge (weighted toward the cursor, so a faint
   line right under the pen beats a bold one at the search rim). Where the art
   has no edges the raw hand line is kept — and holding Alt draws freehand. */

interface EdgeField {
  mag: Float32Array;         // gradient magnitude, normalised 0..1
  w: number; h: number;      // field dimensions in pixels
  ex: number; ey: number;    // element origin in page coords
  scale: number;             // field px per page unit
}

function buildEdgeField(
  img: HTMLImageElement, ex: number, ey: number, elW: number, elH: number,
): EdgeField | null {
  const scale = Math.min(1, 1100 / Math.max(elW, elH));
  const w = Math.max(2, Math.round(elW * scale));
  const h = Math.max(2, Math.round(elH * scale));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  /* same cover-crop the editor uses to show the artwork */
  const natW = img.naturalWidth, natH = img.naturalHeight;
  const s = Math.max(elW / natW, elH / natH);
  const sw = elW / s, sh = elH / s;
  ctx.drawImage(img, (natW - sw) / 2, (natH - sh) / 2, sw, sh, 0, 0, w, h);
  let data: ImageData;
  try { data = ctx.getImageData(0, 0, w, h); } catch { return null; } // tainted
  const dpx = data.data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    lum[i] = 0.2126 * dpx[i * 4] + 0.7152 * dpx[i * 4 + 1] + 0.0722 * dpx[i * 4 + 2];
  }
  const mag = new Float32Array(w * h);
  let maxM = 1e-6;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -lum[i - w - 1] - 2 * lum[i - 1] - lum[i + w - 1]
        + lum[i - w + 1] + 2 * lum[i + 1] + lum[i + w + 1];
      const gy = -lum[i - w - 1] - 2 * lum[i - w] - lum[i - w + 1]
        + lum[i + w - 1] + 2 * lum[i + w] + lum[i + w + 1];
      const m = Math.hypot(gx, gy);
      mag[i] = m;
      if (m > maxM) maxM = m;
    }
  }
  for (let i = 0; i < mag.length; i++) mag[i] /= maxM;
  return { mag, w, h, ex, ey, scale };
}

/* An edge weaker than this is noise — keep the hand's own line there. */
const SNAP_FLOOR = 0.14;

function snapToEdge(f: EdgeField, x: number, y: number, radiusPage: number): [number, number] | null {
  const fx = (x - f.ex) * f.scale, fy = (y - f.ey) * f.scale;
  const r = Math.min(28, Math.max(2, radiusPage * f.scale));
  const x0 = Math.max(1, Math.round(fx - r)), x1 = Math.min(f.w - 2, Math.round(fx + r));
  const y0 = Math.max(1, Math.round(fy - r)), y1 = Math.min(f.h - 2, Math.round(fy + r));
  let best = 0, bx = -1, by = -1;
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const dist = Math.hypot(px - fx, py - fy);
      if (dist > r) continue;
      /* distance falloff: the pen's own neighbourhood wins ties */
      const score = f.mag[py * f.w + px] * (1 - 0.45 * (dist / r));
      if (score > best) { best = score; bx = px; by = py; }
    }
  }
  if (best < SNAP_FLOOR || bx < 0) return null;   // no edge here — caller keeps the hand line
  return [f.ex + bx / f.scale, f.ey + by / f.scale];
}

/* Topmost unrotated panel/image with artwork at a point on the given page,
   skipping cutouts this tool already placed (they sit on top, mostly
   transparent). */
function artAtOn(d: TuckDragDeps, pageIdx: number, x: number, y: number) {
  const pg = d.docRef.current!.pages[pageIdx];
  return [...pg.els].reverse().find((el) =>
    (el.type === "panel" || el.type === "image") && el.img && !el.rot &&
    !(el.type === "image" && el.cut) &&
    x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h);
}

function artTargetAt(d: TuckDragDeps, x: number, y: number) {
  return artAtOn(d, d.pageIndexRef.current, x, y);
}

export function beginTuckLasso(d: TuckDragDeps, e: React.PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
  const p0 = d.pagePoint(e);
  d.ptsRef.current = [[p0.x, p0.y]];
  d.force();

  /* build the magnetic field in the background; until it arrives (or if the
     art is unreadable) the lasso is plain freehand */
  let field: EdgeField | null = null;
  const target = artTargetAt(d, p0.x, p0.y);
  if (target && "img" in target && target.img) {
    const url = d.assetsRef.current[target.img];
    if (url) {
      loadImage(url).then((img) => {
        field = buildEdgeField(img, target.x, target.y, target.w, target.h);
        if (field && d.ptsRef.current) {
          d.setStatus("Magnetic trace: the line snaps to the art's edges — hold Alt to draw freehand.");
        }
      }).catch(() => { /* freehand */ });
    }
  }
  /* a comfortable magnet reach: ~10 screen px, expressed in page units */
  const snapRadius = Math.min(40, Math.max(6, 10 / Math.max(0.05, d.zoom)));

  /* second magnetic field for the FACING page's art, built lazily the first
     time the trace crosses the spine (spread view) */
  let fieldF: EdgeField | null = null;
  let fieldFStarted = false;
  const maybeStartFacingField = (p: { x: number; y: number }) => {
    const f = d.facing;
    if (!f || fieldFStarted) return;
    const tF = artAtOn(d, f.index, p.x - f.offX, p.y - f.offY);
    if (!tF || !("img" in tF) || !tF.img) return;
    fieldFStarted = true;
    const url = d.assetsRef.current[tF.img];
    if (!url) return;
    loadImage(url).then((img) => {
      /* field origin expressed in CURRENT-page units so snapping stays in
         one coordinate space for the whole gesture */
      fieldF = buildEdgeField(img, tF.x + f.offX, tF.y + f.offY, tF.w, tF.h);
    }).catch(() => { /* freehand on the far side */ });
  };
  /* on the spread canvas the lasso can START on the other page — arm its
     magnetic field from the very first point, not only after crossing */
  maybeStartFacingField(p0);

  const onMove = (ev: PointerEvent) => {
    const arr = d.ptsRef.current;
    if (!arr) return;
    let p = d.pagePoint(ev);
    maybeStartFacingField(p);
    if (!ev.altKey) {
      const s = (field && snapToEdge(field, p.x, p.y, snapRadius))
        || (fieldF && snapToEdge(fieldF, p.x, p.y, snapRadius))
        || null;
      if (s) p = { x: s[0], y: s[1] };
    }
    const last = arr[arr.length - 1];
    if (Math.hypot(p.x - last[0], p.y - last[1]) < MIN_STEP) return;
    arr.push([p.x, p.y]);
    d.force();
  };

  const onUp = async () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
    if (d.justEndedRef) d.justEndedRef.current = Date.now();
    const raw = d.ptsRef.current;
    d.ptsRef.current = null;
    d.setTuckMode(false);
    if (!raw) return;
    const ask = await buildTuckAsk(d, raw);
    if (ask) d.setTuckAsk(ask);
    d.force();
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}

/* Clean the raw stroke into a closed ring, find the artwork underneath, and
   build the first preview. Returns null (with a status message) when there is
   nothing usable. */
async function buildTuckAsk(d: TuckDragDeps, raw: number[][]): Promise<TuckAsk | null> {
  if (raw.length < 6) {
    d.setStatus("Draw a loop around the art that should sit in front of the lettering.");
    return null;
  }
  /* the stroke rarely closes exactly where it started; trim the overshoot,
     even out the spacing, then take the hand-shake out of it */
  let ring = closeSketchLoop(raw);
  if (ring.length < 6) ring = raw;
  ring = smoothSketchRing(resampleRing(ring, Math.min(200, Math.max(48, ring.length))), 2);

  const b = pathBounds(ring);
  if (b.w < 12 || b.h < 12) {
    d.setStatus("That loop is too small — draw around the whole shape.");
    return null;
  }

  /* Topmost unrotated panel/image with artwork under the traced area —
     skipping cutouts already placed by this tool. A word usually needs one
     pass per letter, and every pass has to read the ORIGINAL art: without
     this, the second trace lands on the first cutout (which is on top and
     mostly transparent) and comes back with nothing.

     Tried on the CURRENT page first; in spread view a trace that swept
     across the spine falls through to the FACING page's artwork, and the
     cutout is built in (and destined for) THAT page's coordinates. */
  const attempt = async (pageIdx: number, ringIn: number[][]) => {
    const bb = pathBounds(ringIn);
    const pg = d.docRef.current!.pages[pageIdx];
    const target = [...pg.els].reverse().find((el) =>
      (el.type === "panel" || el.type === "image") && el.img && !el.rot &&
      !(el.type === "image" && el.cut) &&
      bb.x < el.x + el.w && bb.x + bb.w > el.x &&
      bb.y < el.y + el.h && bb.y + bb.h > el.y);
    if (!target || !("img" in target) || !target.img) return null;
    const url = d.assetsRef.current[target.img];
    if (!url) return null;
    const img = await loadImage(url);

    /* clamp the traced area to the artwork element */
    const x0 = Math.max(bb.x, target.x), y0 = Math.max(bb.y, target.y);
    const x1 = Math.min(bb.x + bb.w, target.x + target.w);
    const y1 = Math.min(bb.y + bb.h, target.y + target.h);
    if (x1 - x0 < 10 || y1 - y0 < 10) return null;
    const src: TuckSource = {
      img, elW: target.w, elH: target.h,
      regionX: x0 - target.x, regionY: y0 - target.y,
      regionW: x1 - x0, regionH: y1 - y0,
    };
    /* the cutout works in element-local units, same space as regionX/regionY */
    const pts = ringIn.map(([x, y]) => [x - target.x, y - target.y]);
    const cut = makeCutoutFromPath(src, pts, 2);
    const ask: TuckAsk = {
      src, artKey: target.img, targetPage: pageIdx,
      pageX: x0, pageY: y0, pageW: x1 - x0, pageH: y1 - y0,
      pts, mode: "trace", feather: 2, threshold: 45, invert: false,
      mask: null, auto: "idle", preview: cut?.url ?? null,
    };
    return ask;
  };

  let ask = await attempt(d.pageIndexRef.current, ring);
  let crossed = false;
  if (!ask && d.facing) {
    const f = d.facing;
    ask = await attempt(f.index, ring.map(([x, y]) => [x - f.offX, y - f.offY]));
    crossed = !!ask;
  }
  if (!ask) {
    d.setStatus("No artwork there — draw over a panel or image (unrotated).");
    return null;
  }
  d.setStatus(!ask.preview
    ? "Could not read this artwork's pixels."
    : crossed
      ? `Traced across the spine — the cutout will land on page ${ask.targetPage + 1}. Adjust, then place it.`
      : "Traced. Adjust the soft edge, or try auto-detect, then place it.");
  return ask;
}
