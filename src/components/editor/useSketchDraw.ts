"use client";
/* Hand-drawn balloon sketching, split from Editor.tsx (1500-line cap).
   Deps are re-supplied each render into a ref, so the drag handlers always
   run the current render's closures. */
import React, { useRef } from "react";
import { Doc, makeBalloon } from "@/lib/model";
import { closeSketchLoop, detectSketchTail, resampleRing, smoothSketchRing } from "./sketch";
import { claimDrag, rejectPalm, releaseDrag } from "./penInput";

interface Ref<T> { current: T }

export interface SketchDeps {
  docRef: Ref<Doc | null>;
  pageIndexRef: Ref<number>;
  drawPtsRef: Ref<number[][] | null>;
  pendingLockRef: Ref<Set<string>>;
  pagePoint: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  force: () => void;
  commit: () => void;
  setDrawMode: (v: boolean) => void;
  setStatus: (s: string) => void;
  setSelId: (id: string | null) => void;
  setTailAsk: (id: string | null) => void;
  /* spread canvas: which page a current-page-local x really falls on, and
     the shift that converts the coordinate into that page's local space
     (identity in single view) */
  resolveTarget: (cx: number) => { idx: number; shift: number };
  setPageIndex: (i: number) => void;
}

export function useSketchDraw(deps: SketchDeps) {
  const ref = useRef(deps);
  ref.current = deps;
  return (e: React.PointerEvent) => {
    if (rejectPalm(e)) return;   // palm resting near the pen
    const pid = e.pointerId;     // the stroke belongs to this pointer only
    if (!claimDrag(pid)) return; // one gesture at a time
    e.preventDefault();
    e.stopPropagation();
    const d0 = ref.current;
    const pt = d0.pagePoint(e);
    d0.drawPtsRef.current = [[pt.x, pt.y]];
    d0.force();
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const d = ref.current;
      const arr = d.drawPtsRef.current;
      if (!arr) return;
      const p = d.pagePoint(ev);
      const last = arr[arr.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) > 6) { arr.push([p.x, p.y]); d.force(); }
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;   // a palm lifting must not end the stroke
      releaseDrag(pid);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const d = ref.current;
      const arr = d.drawPtsRef.current;
      d.drawPtsRef.current = null;
      d.setDrawMode(false);
      if (!arr || arr.length < 8) { d.setStatus("Sketch cancelled — drag a full outline in one stroke."); d.force(); return; }
      /* clean seam → even spacing → pull out a drawn tail → round out */
      let ring = closeSketchLoop(arr);
      if (ring.length < 8) { d.setStatus("Sketch cancelled — drag a full outline in one stroke."); d.force(); return; }
      ring = resampleRing(ring, 96);
      const tailInfo = detectSketchTail(ring);
      const body = smoothSketchRing(tailInfo ? resampleRing(tailInfo.body, 80) : ring);
      const xs = body.map((q) => q[0]), ys = body.map((q) => q[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 40 || bh < 40) { d.setStatus("Sketch cancelled — draw a bigger outline."); d.force(); return; }
      const pts = body.map(([qx, qy]) => [(qx - x0) / bw, (qy - y0) / bh] as [number, number]);
      const doc = d.docRef.current!;
      /* the balloon lands on whichever page of the spread it was drawn
         over, in that page's own coordinates */
      const t = d.resolveTarget(x0 + bw / 2);
      const pg = doc.pages[t.idx];
      if (t.idx !== d.pageIndexRef.current) {
        (d.pageIndexRef as { current: number }).current = t.idx;
        d.setPageIndex(t.idx);
      }
      const el = makeBalloon("custom", Math.round(x0 + t.shift), Math.round(y0), Math.round(bw), Math.round(bh));
      el.pts = pts;
      if (tailInfo) {
        /* they drew the tail — aim the real one at its tip */
        el.tail = {
          dx: Math.round(tailInfo.tip[0] - (x0 + bw / 2)),
          dy: Math.round(tailInfo.tip[1] - (y0 + bh / 2)),
        };
        el.tailStyle = "speech";
      } else {
        el.tail = null;
      }
      pg.els.push(el);
      d.pendingLockRef.current.add(el.id);
      d.commit();
      d.setSelId(el.id);
      if (tailInfo) d.setStatus("Custom balloon created with your drawn tail — double-click to type.");
      else d.setTailAsk(el.id);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
}
