/* The lasso for "tuck behind art".

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
  force: () => void;
  setStatus: (msg: string) => void;
  setTuckMode: (v: boolean) => void;
  setTuckAsk: (t: TuckAsk | null) => void;
}

/* Points closer than this add nothing but work — the outline is smoothed
   afterwards anyway. */
const MIN_STEP = 2.5;

export function beginTuckLasso(d: TuckDragDeps, e: React.PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
  const p0 = d.pagePoint(e);
  d.ptsRef.current = [[p0.x, p0.y]];
  d.force();

  const onMove = (ev: PointerEvent) => {
    const arr = d.ptsRef.current;
    if (!arr) return;
    const p = d.pagePoint(ev);
    const last = arr[arr.length - 1];
    if (Math.hypot(p.x - last[0], p.y - last[1]) < MIN_STEP) return;
    arr.push([p.x, p.y]);
    d.force();
  };

  const onUp = async () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
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

  /* topmost unrotated panel/image with artwork under the traced area */
  const pg = d.docRef.current!.pages[d.pageIndexRef.current];
  const target = [...pg.els].reverse().find((el) =>
    (el.type === "panel" || el.type === "image") && el.img && !el.rot &&
    b.x < el.x + el.w && b.x + b.w > el.x &&
    b.y < el.y + el.h && b.y + b.h > el.y);
  if (!target || !("img" in target) || !target.img) {
    d.setStatus("No artwork there — draw over a panel or image (unrotated).");
    return null;
  }
  const url = d.assetsRef.current[target.img];
  if (!url) { d.setStatus("That panel's artwork isn't loaded."); return null; }
  const img = await loadImage(url);

  /* clamp the traced area to the artwork element */
  const x0 = Math.max(b.x, target.x), y0 = Math.max(b.y, target.y);
  const x1 = Math.min(b.x + b.w, target.x + target.w);
  const y1 = Math.min(b.y + b.h, target.y + target.h);
  if (x1 - x0 < 10 || y1 - y0 < 10) {
    d.setStatus("The loop barely touches the artwork — try again.");
    return null;
  }
  const src: TuckSource = {
    img, elW: target.w, elH: target.h,
    regionX: x0 - target.x, regionY: y0 - target.y,
    regionW: x1 - x0, regionH: y1 - y0,
  };
  /* the cutout works in element-local units, same space as regionX/regionY */
  const pts = ring.map(([x, y]) => [x - target.x, y - target.y]);
  const cut = makeCutoutFromPath(src, pts, 2);
  d.setStatus(cut
    ? "Traced. Adjust the soft edge, or try auto-detect, then place it."
    : "Could not read this artwork's pixels.");
  return {
    src, artKey: target.img,
    pageX: x0, pageY: y0, pageW: x1 - x0, pageH: y1 - y0,
    pts, mode: "trace", feather: 2, threshold: 45, invert: false,
    mask: null, auto: "idle", preview: cut?.url ?? null,
  };
}
