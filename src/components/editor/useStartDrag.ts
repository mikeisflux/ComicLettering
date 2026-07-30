"use client";
/* Pointer-drag machinery for page elements — move (with snapping, convoys and
   the joined-balloon melt reset), resize (aspect locks, edge snapping,
   lettering scale-with-box), rotate, the balloon tail/bend/tilt levers and the
   lettering envelope. Split out of Editor.tsx verbatim (the 1500-line rule);
   behaviour is unchanged. */
import React, { useCallback } from "react";
import {
  BalloonEl, Doc, El, TextEl, aabbOverlap, clamp, pageMargins, rotVec,
} from "@/lib/model";
import { FLAT } from "@/lib/warp";

export const MIN_SIZE = 24;

export type DragMode =
  | "move" | "resize" | "rotate" | "tail" | "bow" | "tilt" | "envelope";

/* plain structural ref shape — the hook only needs `.current` */
interface Ref<T> { current: T }

export interface DragDeps {
  pagePoint: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  commit: () => void;
  force: () => void;
  zoom: number;
  docRef: Ref<Doc | null>;
  pageIndexRef: Ref<number>;
  selIdsRef: Ref<string[]>;
  snapRef: Ref<{ x: number | null; y: number | null }>;
  dragTipRef: Ref<{ x: number; y: number; w: number; h: number; mode: string; live: boolean } | null>;
}

export function useStartDrag(deps: DragDeps) {
  const { pagePoint, commit, force, zoom, docRef, pageIndexRef, selIdsRef, snapRef, dragTipRef } = deps;
  return useCallback((
    e: React.PointerEvent, el: El, mode: DragMode, handle = ""
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const start = pagePoint(e);
    const orig = JSON.parse(JSON.stringify(el)) as El;
    /* Everything else in the selection travels with the one being dragged.
       Their starting corners are captured up front so the delta is always
       measured from where the drag began, not from the last frame. */
    const convoy = mode === "move"
      ? selIdsRef.current
          .filter((id) => id !== el.id)
          .map((id) => {
            const o = docRef.current!.pages[pageIndexRef.current].els.find((x) => x.id === id);
            return o && !o.locked ? { id, x0: o.x, y0: o.y } : null;
          })
          .filter(Boolean) as { id: string; x0: number; y0: number }[]
      : [];
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const d = docRef.current!;
      const p = d.pages[pageIndexRef.current];
      const cur = p.els.find((x) => x.id === el.id);
      if (!cur) return;
      const pt = pagePoint(ev);
      const dx = pt.x - start.x, dy = pt.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      if (mode === "envelope") {
        /* one control point of the lettering's envelope, in units of the box
           so the warp survives a later resize */
        const i = parseInt(handle, 10);
        const t = cur as TextEl;
        const base = (orig as TextEl).ts.env ?? FLAT.map((q) => [...q]);
        const pts = base.map((q) => [...q]);
        if (pts[i]) {
          pts[i] = [base[i][0] + dx / Math.max(1, cur.w), base[i][1] + dy / Math.max(1, cur.h)];
          t.ts = { ...t.ts, env: pts };
          force();
        }
        return;
      }
      if (mode === "move") {
        let nx = Math.round(orig.x + dx), ny = Math.round(orig.y + dy);
        snapRef.current = { x: null, y: null };
        if (!ev.altKey) {
          /* snap to margins, page centre and other elements (Alt disables) */
          const tol = Math.max(4, 8 / zoom);
          const m = pageMargins(p);
          const others = p.els.filter((o) => o.id !== cur.id);
          /* snap targets: page bleed edges, margins, centre, other elements */
          const vTargets = [0, p.w, m.l, p.w - m.r, p.w / 2, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
          const hTargets = [0, p.h, m.t, p.h - m.b, p.h / 2, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
          /* level/mirror helpers: same spot on the opposite side of the page */
          for (const o of others) {
            vTargets.push(p.w - (o.x + o.w), p.w - o.x, p.w - (o.x + o.w / 2));
            hTargets.push(p.h - (o.y + o.h), p.h - o.y, p.h - (o.y + o.h / 2));
          }
          /* equal-spacing helpers: reuse existing gaps between stacked items */
          const colMates = others.filter((o) => o.x < nx + cur.w && o.x + o.w > nx).sort((a, b) => a.y - b.y);
          const vGaps = new Set<number>();
          for (let i = 0; i < colMates.length - 1; i++) {
            const gap = colMates[i + 1].y - (colMates[i].y + colMates[i].h);
            if (gap > 4) vGaps.add(Math.round(gap));
          }
          for (const o of colMates) for (const gap of vGaps) {
            hTargets.push(o.y + o.h + gap, o.y - gap - cur.h);
          }
          const rowMates = others.filter((o) => o.y < ny + cur.h && o.y + o.h > ny).sort((a, b) => a.x - b.x);
          const hGaps = new Set<number>();
          for (let i = 0; i < rowMates.length - 1; i++) {
            const gap = rowMates[i + 1].x - (rowMates[i].x + rowMates[i].w);
            if (gap > 4) hGaps.add(Math.round(gap));
          }
          for (const o of rowMates) for (const gap of hGaps) {
            vTargets.push(o.x + o.w + gap, o.x - gap - cur.w);
          }
          let best = tol + 1;
          for (const own of [0, cur.w / 2, cur.w]) for (const t of vTargets) {
            const delta = t - (nx + own);
            if (Math.abs(delta) < Math.abs(best)) { best = delta; snapRef.current.x = t; }
          }
          if (Math.abs(best) <= tol) nx += Math.round(best); else snapRef.current.x = null;
          best = tol + 1;
          for (const own of [0, cur.h / 2, cur.h]) for (const t of hTargets) {
            const delta = t - (ny + own);
            if (Math.abs(delta) < Math.abs(best)) { best = delta; snapRef.current.y = t; }
          }
          if (Math.abs(best) <= tol) ny += Math.round(best); else snapRef.current.y = null;
        }
        cur.x = nx;
        cur.y = ny;
        /* the rest of the selection travels the same distance, after snapping,
           so a group keeps its internal spacing exactly */
        if (convoy.length) {
          const sx = nx - orig.x, sy = ny - orig.y;
          for (const o of convoy) {
            const oe = p.els.find((x) => x.id === o.id);
            if (oe) { oe.x = o.x0 + sx; oe.y = o.y0 + sy; }
          }
        }
        /* joined balloons that melt together drop their connector bend, so
           separating again starts with a clean straight band */
        if (cur.type === "balloon") {
          const partner = (cur.attachTo
            ? p.els.find((o) => o.id === cur.attachTo)
            : p.els.find((o) => o.type === "balloon" && (o as BalloonEl).attachTo === cur.id)) as BalloonEl | undefined;
          if (partner && aabbOverlap(cur, partner)) {
            const owner = cur.attachTo ? (cur as BalloonEl) : partner; // the child owns the connector
            if (owner.tail) {
              delete owner.tail.bx; delete owner.tail.by;
              delete owner.tail.tx; delete owner.tail.ty;
            }
          }
        }
      } else if (mode === "resize") {
        const [ldx, ldy] = rotVec(dx, dy, -orig.rot);
        if (handle.includes("e")) cur.w = Math.max(MIN_SIZE, Math.round(orig.w + ldx));
        if (handle.includes("s")) cur.h = Math.max(MIN_SIZE, Math.round(orig.h + ldy));
        if (handle.includes("w")) { cur.w = Math.max(MIN_SIZE, Math.round(orig.w - ldx)); cur.x = orig.x + (orig.w - cur.w); }
        if (handle.includes("n")) { cur.h = Math.max(MIN_SIZE, Math.round(orig.h - ldy)); cur.y = orig.y + (orig.h - cur.h); }
        /* images keep their proportions on every handle (Shift stretches
           freely); other elements lock with Shift on a corner */
        const lockAspect = cur.type === "image" ? !ev.shiftKey : ev.shiftKey && handle.length === 2;
        if (lockAspect) {
          const s = handle.length === 2
            ? Math.max(cur.w / orig.w, cur.h / orig.h)
            : handle === "e" || handle === "w" ? cur.w / orig.w : cur.h / orig.h;
          cur.w = Math.max(MIN_SIZE, Math.round(orig.w * s));
          cur.h = Math.max(MIN_SIZE, Math.round(orig.h * s));
          if (handle.includes("w")) cur.x = orig.x + (orig.w - cur.w);
          if (handle.includes("n")) cur.y = orig.y + (orig.h - cur.h);
          /* an edge drag grows the cross axis out from the middle */
          if (handle === "e" || handle === "w") cur.y = orig.y + Math.round((orig.h - cur.h) / 2);
          if (handle === "n" || handle === "s") cur.x = orig.x + Math.round((orig.w - cur.w) / 2);
        }
        /* dragged edges snap to the page border, margins, centre and other
           elements' edges (Alt disables) */
        snapRef.current = { x: null, y: null };
        if (!ev.altKey) {
          const tol = Math.max(4, 8 / zoom);
          const m = pageMargins(p);
          const others = p.els.filter((o) => o.id !== cur.id);
          const vT = [0, p.w, m.l, p.w - m.r, p.w / 2, ...others.flatMap((o) => [o.x, o.x + o.w])];
          const hT = [0, p.h, m.t, p.h - m.b, p.h / 2, ...others.flatMap((o) => [o.y, o.y + o.h])];
          const near = (val: number, ts: number[]) => {
            let best: number | null = null, bd = tol + 1;
            for (const t of ts) { const dd = Math.abs(t - val); if (dd < bd) { bd = dd; best = t; } }
            return best;
          };
          let sx: number | null = null, sy: number | null = null;
          if (handle.includes("e")) { const t = near(cur.x + cur.w, vT); if (t != null) { cur.w = Math.max(MIN_SIZE, t - cur.x); sx = t; } }
          else if (handle.includes("w")) { const t = near(cur.x, vT); if (t != null) { cur.w = Math.max(MIN_SIZE, cur.x + cur.w - t); cur.x = t; sx = t; } }
          if (handle.includes("s")) { const t = near(cur.y + cur.h, hT); if (t != null) { cur.h = Math.max(MIN_SIZE, t - cur.y); sy = t; } }
          else if (handle.includes("n")) { const t = near(cur.y, hT); if (t != null) { cur.h = Math.max(MIN_SIZE, cur.y + cur.h - t); cur.y = t; sy = t; } }
          if (lockAspect && (sx != null || sy != null)) {
            /* keep proportions: the snapped axis wins, the other follows */
            if (sx != null) {
              const s2 = cur.w / orig.w;
              cur.h = Math.max(MIN_SIZE, Math.round(orig.h * s2));
              if (handle.includes("n")) cur.y = orig.y + (orig.h - cur.h);
              if (handle === "e" || handle === "w") cur.y = orig.y + Math.round((orig.h - cur.h) / 2);
              sy = null;
            } else if (sy != null) {
              const s2 = cur.h / orig.h;
              cur.w = Math.max(MIN_SIZE, Math.round(orig.w * s2));
              if (handle.includes("w")) cur.x = orig.x + (orig.w - cur.w);
              if (handle === "n" || handle === "s") cur.x = orig.x + Math.round((orig.w - cur.w) / 2);
            }
          }
          snapRef.current = { x: sx, y: sy };
        }
        /* lettering scales with its box, like Comic Life */
        if (cur.type === "text" && orig.type === "text") {
          const ratio = Math.min(cur.w / orig.w, cur.h / orig.h);
          cur.ts.size = clamp(Math.round(orig.ts.size * ratio), 8, 800);
          cur.ts.outlineW = Math.max(0, Math.round(orig.ts.outlineW * ratio));
          if (orig.ts.tracking) cur.ts.tracking = Math.round(orig.ts.tracking * ratio * 10) / 10;
        }
      } else if (mode === "rotate") {
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        let ang = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI + 90;
        if (ev.shiftKey) ang = Math.round(ang / 15) * 15;
        const norm = ((ang % 360) + 360) % 360;
        if (norm < 3 || norm > 357) ang = 0;
        cur.rot = Math.round(ang * 10) / 10;
      } else if (mode === "tail" && cur.type === "balloon") {
        cur.attachTo = null; // dragging the tip detaches a joined balloon
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        const [ldx, ldy] = rotVec(pt.x - cx, pt.y - cy, -orig.rot);
        const oldTail = (orig as BalloonEl).tail;
        const next: NonNullable<BalloonEl["tail"]> = { dx: Math.round(ldx), dy: Math.round(ldy) };
        /* the bend lever owns the tail's exit point — keep it planted while
           the tip moves */
        if (oldTail && oldTail.bx != null && oldTail.by != null) {
          next.bx = oldTail.bx;
          next.by = oldTail.by;
        }
        cur.tail = next;
        /* dropping the tip inside another bubble JOINS them — bubbles join in
           any order, including onto one that already has a partner. The band
           appears live while hovering; dragging back out detaches again. A
           join that would loop the chain back onto itself is refused. */
        const chainReaches = (from: BalloonEl, targetId: string): boolean => {
          let n: BalloonEl | undefined = from;
          for (let i = 0; i < 32 && n; i++) {
            if (n.id === targetId) return true;
            n = n.attachTo
              ? p.els.find((o) => o.id === n!.attachTo && o.type === "balloon") as BalloonEl | undefined
              : undefined;
          }
          return false;
        };
        const hit = p.els.find((o) =>
          o.type === "balloon" && o.id !== cur.id && !o.locked &&
          pt.x >= o.x && pt.x <= o.x + o.w && pt.y >= o.y && pt.y <= o.y + o.h &&
          !chainReaches(o as BalloonEl, cur.id));
        if (hit) cur.attachTo = hit.id;
      } else if (mode === "bow" && cur.type === "balloon" && cur.tail) {
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        const [ldx, ldy] = rotVec(pt.x - cx, pt.y - cy, -orig.rot);
        cur.tail = { ...cur.tail, bx: Math.round(ldx), by: Math.round(ldy) };
      } else if (mode === "tilt" && cur.type === "balloon" && cur.tail) {
        /* the two satellite dots tilt the connector's tangent at the bend —
           this is the ONLY control that distorts the band. Seed a bend point
           at the current midpoint so the tilt has something to curve through. */
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        const [lx, ly] = rotVec(pt.x - cx, pt.y - cy, -orig.rot);
        const bx = cur.tail.bx ?? cur.tail.dx / 2, by = cur.tail.by ?? cur.tail.dy / 2;
        let vx = lx - bx, vy = ly - by;
        if (handle === "t2") { vx = -vx; vy = -vy; }
        const L = Math.hypot(vx, vy) || 1;
        cur.tail = { ...cur.tail, bx, by, tx: Math.round((vx / L) * 1000) / 1000, ty: Math.round((vy / L) * 1000) / 1000 };
      }
      if (mode === "move" || mode === "resize")
        dragTipRef.current = { x: cur.x, y: cur.y, w: cur.w, h: cur.h, mode, live: true };
      force();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      snapRef.current = { x: null, y: null };
      /* keep the coordinates tooltip up briefly after release, like Comic Life */
      if (dragTipRef.current) {
        const tip = dragTipRef.current;
        tip.live = false;
        setTimeout(() => {
          if (dragTipRef.current === tip) { dragTipRef.current = null; force(); }
        }, 900);
      }
      if (moved) commit();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    /* touch/pen gestures can be cancelled by the browser (scroll takeover,
       palm rejection) — without this the listeners leak and the element keeps
       tracking a phantom pointer */
    window.addEventListener("pointercancel", onUp);
  }, [pagePoint, commit, force, zoom, docRef, pageIndexRef, selIdsRef, snapRef, dragTipRef]);
}
