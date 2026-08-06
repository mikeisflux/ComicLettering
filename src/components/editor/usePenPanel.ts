"use client";
/* "Draw Your Own Panel" tools — a Photoshop-style pen plus one-drag shape
   marquees (rectangle, oval, circle).

   Pen: click places a corner anchor, click-and-DRAG pulls symmetric curve
   handles out of the anchor (so any point can arc), clicking the first
   anchor again (or Enter) closes the shape, Ctrl+Z / Backspace removes the
   last point, Esc cancels — all mirrored by the floating Undo/Close/Cancel
   buttons on the canvas so tablets get them too. The closed outline becomes
   a custom-shaped panel (PanelEl.pts).

   Marquees: one drag sweeps out the shape — rectangle panels stay plain
   rects; ovals/circles get a dense ellipse outline in pts (circle locks the
   drag square).

   Deps are re-supplied every render into a ref (same pattern as
   useSketchDraw) so handlers never run stale closures. */
import React, { useEffect, useRef } from "react";
import { Doc, makePanel } from "@/lib/model";
import { claimDrag, rejectPalm, releaseDrag } from "./penInput";

export interface PenPt { x: number; y: number; hx: number; hy: number }
export type ShapeKind = "rect" | "oval" | "circle";
export interface ShapeBox { x0: number; y0: number; x1: number; y1: number }

interface Ref<T> { current: T }

export interface PenDeps {
  docRef: Ref<Doc | null>;
  pageIndexRef: Ref<number>;
  penMode: boolean;
  penPtsRef: Ref<PenPt[] | null>;
  shapeMode: ShapeKind | null;
  penBoxRef: Ref<ShapeBox | null>;
  zoom: number;
  pendingLockRef: Ref<Set<string>>;
  pagePoint: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  force: () => void;
  commit: () => void;
  setPenMode: (v: boolean) => void;
  setShapeMode: (v: ShapeKind | null) => void;
  setStatus: (s: string) => void;
  setSelId: (id: string | null) => void;
  /* spread canvas: which page a current-page-local x really falls on (see
     useSketchDraw) — identity in single-page view */
  resolveTarget: (cx: number) => { idx: number; shift: number };
  setPageIndex: (i: number) => void;
}

const cubic = (a: number, c1: number, c2: number, b: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * b;
};

/* Flatten the anchor path into a dense polyline. Each anchor's out-handle
   is (hx,hy); the in-handle mirrors it (smooth symmetric point, like the
   default Photoshop pen). Straight segments stay two points; curved ones
   sample the cubic finely enough to read as a true curve. open=true skips
   the closing segment (live preview while still drawing). */
export function flattenPen(pts: PenPt[], open = false): number[][] {
  const out: number[][] = [];
  const segs = open ? pts.length - 1 : pts.length;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    out.push([a.x, a.y]);
    if (a.hx || a.hy || b.hx || b.hy) {
      for (let s = 1; s < 16; s++) {
        const t = s / 16;
        out.push([
          cubic(a.x, a.x + a.hx, b.x - b.hx, b.x, t),
          cubic(a.y, a.y + a.hy, b.y - b.hy, b.y, t),
        ]);
      }
    }
  }
  if (open && pts.length) out.push([pts[pts.length - 1].x, pts[pts.length - 1].y]);
  return out;
}

/* a full ellipse inscribed in the unit box, dense enough to print smooth */
const ellipseFracs = (n = 96): [number, number][] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [(1 + Math.cos(a)) / 2, (1 + Math.sin(a)) / 2] as [number, number];
  });

export function usePenPanel(deps: PenDeps) {
  const ref = useRef(deps);
  ref.current = deps;

  /* drop a finished outline onto the page as a panel */
  const placePanel = (body: number[][], shape: "poly" | "ellipse" | "rect") => {
    const d = ref.current;
    const xs = body.map((q) => q[0]), ys = body.map((q) => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), y1 = Math.max(...ys);
    const bw = x1 - x0, bh = y1 - y0;
    if (bw < 40 || bh < 40) {
      d.setStatus("Panel cancelled — draw a bigger shape.");
      d.force();
      return;
    }
    const doc = d.docRef.current!;
    /* the panel lands on whichever page of the spread it was drawn over */
    const t = d.resolveTarget(x0 + bw / 2);
    const pg = doc.pages[t.idx];
    if (t.idx !== d.pageIndexRef.current) {
      (d.pageIndexRef as { current: number }).current = t.idx;
      d.setPageIndex(t.idx);
    }
    const p = makePanel(Math.round(x0 + t.shift), Math.round(y0), Math.round(bw), Math.round(bh));
    if (shape === "ellipse") p.pts = ellipseFracs();
    else if (shape === "poly") p.pts = body.map(([qx, qy]) => [(qx - x0) / bw, (qy - y0) / bh] as [number, number]);
    /* shape === "rect": a plain rectangular panel, no outline needed */
    pg.els.unshift(p);   // panels sit behind everything, same as applyLayout
    d.pendingLockRef.current.add(p.id);
    d.commit();
    d.setSelId(p.id);
    d.setStatus("Custom panel created — drop artwork into it like any panel.");
  };

  const finish = () => {
    const d = ref.current;
    const anchors = d.penPtsRef.current;
    d.penPtsRef.current = null;
    d.setPenMode(false);
    if (!anchors || anchors.length < 3) {
      d.setStatus("Panel cancelled — place at least three points.");
      d.force();
      return;
    }
    placePanel(flattenPen(anchors), "poly");
  };

  const cancel = () => {
    const d = ref.current;
    d.penPtsRef.current = null;
    d.penBoxRef.current = null;
    d.setPenMode(false);
    d.setShapeMode(null);
    d.setStatus("Panel drawing cancelled.");
    d.force();
  };

  /* Ctrl+Z / Backspace while the pen is armed: take back the last point */
  const undoPoint = () => {
    const d = ref.current;
    const pts = d.penPtsRef.current;
    if (!pts || !pts.length) { cancel(); return; }
    pts.pop();
    d.setStatus(pts.length
      ? `Point removed — ${pts.length} left. Keep clicking, or Esc to cancel.`
      : "All points removed — click to start again, or Esc to leave the pen.");
    d.force();
  };

  /* Enter closes, Ctrl+Z/Backspace undo a point, Esc cancels — capture
     phase so the pen wins over the editor's global keymap while armed */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const d = ref.current;
      if (!d.penMode && !d.shapeMode) return;
      const undoKey = ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") ||
        e.key === "Backspace" || e.key === "Delete";
      if (e.key === "Enter" && d.penMode) { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
      else if (undoKey && d.penMode) { e.preventDefault(); e.stopPropagation(); undoPoint(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startPenDown = (e: React.PointerEvent) => {
    if (rejectPalm(e)) return;
    const pid = e.pointerId;
    if (!claimDrag(pid)) return;
    e.preventDefault();
    e.stopPropagation();
    const d0 = ref.current;
    const pt = d0.pagePoint(e);
    const pts = d0.penPtsRef.current ?? (d0.penPtsRef.current = []);
    /* clicking the first anchor again closes the shape */
    if (pts.length >= 3 && Math.hypot(pt.x - pts[0].x, pt.y - pts[0].y) < 14 / d0.zoom) {
      releaseDrag(pid);
      finish();
      return;
    }
    const anchor: PenPt = { x: pt.x, y: pt.y, hx: 0, hy: 0 };
    pts.push(anchor);
    d0.force();
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const d = ref.current;
      const p = d.pagePoint(ev);
      anchor.hx = p.x - anchor.x;
      anchor.hy = p.y - anchor.y;
      d.force();
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;   // a palm lifting must not end the gesture
      releaseDrag(pid);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const d = ref.current;
      /* a tiny wiggle while clicking is a corner, not a curve */
      if (Math.hypot(anchor.hx, anchor.hy) < 6 / d.zoom) { anchor.hx = 0; anchor.hy = 0; }
      d.force();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  /* rectangle/oval/circle marquee: one drag sweeps out the panel */
  const startShapeDown = (e: React.PointerEvent) => {
    if (rejectPalm(e)) return;
    const pid = e.pointerId;
    if (!claimDrag(pid)) return;
    e.preventDefault();
    e.stopPropagation();
    const d0 = ref.current;
    const pt = d0.pagePoint(e);
    const box: ShapeBox = { x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y };
    d0.penBoxRef.current = box;
    d0.force();
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const d = ref.current;
      const p = d.pagePoint(ev);
      if (d.shapeMode === "circle") {
        /* a circle stays a circle: lock the sweep square */
        const s = Math.max(Math.abs(p.x - box.x0), Math.abs(p.y - box.y0));
        box.x1 = box.x0 + Math.sign(p.x - box.x0 || 1) * s;
        box.y1 = box.y0 + Math.sign(p.y - box.y0 || 1) * s;
      } else {
        box.x1 = p.x;
        box.y1 = p.y;
      }
      d.force();
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      releaseDrag(pid);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const d = ref.current;
      const kind = d.shapeMode;
      d.penBoxRef.current = null;
      d.setShapeMode(null);
      if (!kind) { d.force(); return; }
      const x = Math.min(box.x0, box.x1), y = Math.min(box.y0, box.y1);
      const w = Math.abs(box.x1 - box.x0), h = Math.abs(box.y1 - box.y0);
      placePanel([[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
        kind === "rect" ? "rect" : "ellipse");
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return { startPenDown, startShapeDown, penUndoPoint: undoPoint, penClose: finish, penCancel: cancel };
}
