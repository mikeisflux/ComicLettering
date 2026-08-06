"use client";
/* "Draw Your Own" panel pen tool — Photoshop-style path drawing:
   click places a corner anchor, click-and-DRAG pulls symmetric curve
   handles out of the anchor (so any point can arc), clicking the first
   anchor again (or Enter) closes the shape, Esc cancels. The closed
   outline becomes a custom-shaped panel (PanelEl.pts) that fills, clips
   artwork and strokes its border along the drawn path.

   Deps are re-supplied every render into a ref (same pattern as
   useSketchDraw) so handlers never run stale closures. */
import React, { useEffect, useRef } from "react";
import { Doc, makePanel } from "@/lib/model";
import { claimDrag, rejectPalm, releaseDrag } from "./penInput";

export interface PenPt { x: number; y: number; hx: number; hy: number }

interface Ref<T> { current: T }

export interface PenDeps {
  docRef: Ref<Doc | null>;
  pageIndexRef: Ref<number>;
  penMode: boolean;
  penPtsRef: Ref<PenPt[] | null>;
  zoom: number;
  pendingLockRef: Ref<Set<string>>;
  pagePoint: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  force: () => void;
  commit: () => void;
  setPenMode: (v: boolean) => void;
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

export function usePenPanel(deps: PenDeps) {
  const ref = useRef(deps);
  ref.current = deps;

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
    const body = flattenPen(anchors);
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
    p.pts = body.map(([qx, qy]) => [(qx - x0) / bw, (qy - y0) / bh] as [number, number]);
    pg.els.unshift(p);   // panels sit behind everything, same as applyLayout
    d.pendingLockRef.current.add(p.id);
    d.commit();
    d.setSelId(p.id);
    d.setStatus("Custom panel created — drop artwork into it like any panel.");
  };

  const cancel = () => {
    const d = ref.current;
    d.penPtsRef.current = null;
    d.setPenMode(false);
    d.setStatus("Pen cancelled.");
    d.force();
  };

  /* Enter closes, Esc cancels — capture phase so the pen wins over the
     editor's global keymap while it is armed */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!ref.current.penMode) return;
      if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); finish(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
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

  return { startPenDown };
}
