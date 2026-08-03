/* Auto panel detection op — the ONE handler every entry point routes
   through (context menu on artwork, Layouts tab button, Insert menu).
   Finds the panel grid drawn into a piece of page art and lays real
   PanelEl frames over it, so balloons and lettering get panels to hang
   off without tracing the grid by hand. Detection itself lives in
   src/lib/panelDetect.ts. */
import { ImageEl, deg2rad, makePanel } from "@/lib/model";
import { loadImage } from "@/lib/exportPng";
import { detectPanels } from "@/lib/panelDetect";
import { EditorCtx } from "./ctx";

/* Detect panels from a specific image element, or — with no id — from the
   selected artwork, falling back to the largest artwork image on the
   current page. Acts on page DATA, so it behaves identically on the
   single-page canvas and the spread canvas (the spread's claimPage has
   already pointed pageIndexRef at the right half). */
export async function detectPanelsFromArt(ed: EditorCtx, imgId?: string) {
  const { docRef, pageIndexRef, assetsRef, commit, setSelId, setStatus, pendingLockRef } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const isArt = (e: { type: string }): e is ImageEl =>
    e.type === "image" && !(e as ImageEl).cut && !(e as ImageEl).stamp;
  let el = (imgId ? p.els.find((e) => e.id === imgId) : undefined) as ImageEl | undefined;
  if (!el || !isArt(el)) el = p.els.find((e) => e.id === ed.selId && isArt(e)) as ImageEl | undefined;
  if (!el) {
    el = (p.els.filter(isArt) as ImageEl[]).sort((a, b) => b.w * b.h - a.w * a.h)[0];
  }
  if (!el) { setStatus("No page art to detect panels from — import your drawn page first."); return; }
  const url = assetsRef.current[el.img];
  if (!url) { setStatus("That image's file isn't loaded."); return; }
  setStatus("Looking for panels…");
  let found;
  try { found = detectPanels(await loadImage(url)); }
  catch { setStatus("Couldn't read that image."); return; }
  if (!found.length) {
    setStatus("No panel grid found — detection needs clear gutters between panels.");
    return;
  }
  /* map artwork-fraction rects through the image's placement (position,
     scale, flips, rotation about the image centre) */
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  const a = deg2rad(el.rot || 0), cos = Math.cos(a), sin = Math.sin(a);
  const made = found.map((r) => {
    const fx = el!.flipH ? 1 - r.x - r.w : r.x;
    const fy = el!.flipV ? 1 - r.y - r.h : r.y;
    const w = Math.round(r.w * el!.w), h = Math.round(r.h * el!.h);
    const lx = (fx + r.w / 2 - 0.5) * el!.w, ly = (fy + r.h / 2 - 0.5) * el!.h;
    const px = cx + lx * cos - ly * sin, py = cy + lx * sin + ly * cos;
    const pn = makePanel(Math.round(px - w / 2), Math.round(py - h / 2), w, h);
    /* a frame OVER finished art: transparent fill so the drawing shows
       through, ink border like the tray's panels */
    pn.fill = { kind: "solid", a: "#ffffff00" };
    pn.rot = el!.rot || 0;
    return pn;
  });
  /* just above the artwork, so lettering already on the page stays on top */
  const at = p.els.indexOf(el) + 1;
  p.els.splice(at, 0, ...made);
  made.forEach((pn) => pendingLockRef.current.add(pn.id));
  commit();
  setSelId(made[0].id);
  setStatus(`Detected ${made.length} panel${made.length > 1 ? "s" : ""} — frames added over the art (transparent fill; restyle or delete any of them).`);
}
