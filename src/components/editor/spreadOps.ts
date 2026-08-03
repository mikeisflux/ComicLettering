/* Two-up spread + page-list helpers, split from Editor.tsx (1500-line cap):
   where the facing page sits on screen, the cross-page drop that moves a
   dragged selection onto it, and the add-page insert. */
import type React from "react";
import { Doc, El, newPage, pageBleed } from "@/lib/model";
import { elCrossesSpine, spreadNeighbor } from "@/lib/exportPng";
import type { EditorCtx } from "./ctx";

/* Insert a blank page (same size/margins as the current one) at `at`, jump
   to it, and refresh every thumbnail — inserting shifts the pages after it,
   so the index-keyed thumbs must all re-render or the list shows stale
   previews until a reload. */
export function addPageAt(ed: EditorCtx, at: number) {
  const d = ed.docRef.current!;
  const cur = d.pages[ed.pageIndexRef.current];
  d.pages.splice(at, 0, newPage(cur.w, cur.h, cur.margin));
  ed.setAskAddPage(false);
  ed.setPageIndex(at);
  ed.setSelId(null);
  ed.commit();
  ed.rebuildThumbs();
}

/* The facing page's index and where its origin sits in CURRENT-page units
   (screen mapping). Read from the preview's full-size img so the print
   view's cropped inner bleed doesn't shift the origin. Null outside spread
   view. */
export function facingOffset(
  pageDiv: HTMLElement | null, zoom: number,
): { index: number; offX: number; offY: number } | null {
  /* both pages live on the spread canvas as .pageHalf wrappers — the
     other page's content origin, in CURRENT-page-local units */
  const cur = document.querySelector(".pageHalf.cur") as HTMLElement | null;
  const other = document.querySelector(".pageHalf:not(.cur)") as HTMLElement | null;
  const idx = other ? parseInt(other.dataset.pageIndex ?? "-1", 10) : -1;
  if (!cur || !other || idx < 0) return null;
  const fr = other.getBoundingClientRect();
  const pr = cur.getBoundingClientRect();
  return { index: idx, offX: (fr.left - pr.left) / zoom, offY: (fr.top - pr.top) / zoom };
}

export interface CrossPageDropDeps {
  docRef: React.RefObject<Doc | null>;
  pageIndexRef: React.RefObject<number>;
  selIdsRef: React.RefObject<string[]>;
  pageDivRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  /* print view: the halves' spine-side bleed strips are cropped away, so
     the drop hit-test must stop at the visible seam, not the layout rect */
  spreadPrint: boolean;
  setSelIds: (ids: string[]) => void;
  commit: () => void;
  rebuildThumbs: () => void;
  setStatus: (s: string) => void;
}

/* Releasing a move-drag over the facing page hands the whole selection to
   that page, keeping it under the cursor. Joins never span pages, so any
   link the move would cut is detached; locked items stay put. */
export function makeCrossPageDrop(d: CrossPageDropDeps) {
  return (mainId: string, cx: number, cy: number): boolean => {
    const doc = d.docRef.current;
    const pgEl = d.pageDivRef.current;
    const fpDiv = document.querySelector(".pageHalf:not(.cur)") as HTMLElement | null;
    if (!doc || !pgEl || !fpDiv) return false;
    const off = facingOffset(pgEl, d.zoom);
    if (!off) return false;
    const target0 = doc.pages[off.index];
    const hit = { ...fpDiv.getBoundingClientRect().toJSON() } as
      { left: number; right: number; top: number; bottom: number };
    if (d.spreadPrint) {
      /* the half's rect includes its CLIPPED spine-side bleed strip (rects
         ignore clip-path) — pull the hit edge in to the visible seam, or a
         release just past the seam on the CURRENT page counts as a drop */
      const inset = pageBleed(target0) * d.zoom;
      if (off.offX > 0) hit.left += inset; else hit.right -= inset;
    }
    if (cx < hit.left || cx > hit.right || cy < hit.top || cy > hit.bottom) return false;
    const cur = doc.pages[d.pageIndexRef.current];
    const target = doc.pages[off.index];
    const ids = new Set(d.selIdsRef.current.length ? d.selIdsRef.current : [mainId]);
    const moving = cur.els.filter((e) => ids.has(e.id) && !e.locked);
    if (!moving.length) return false;
    const movingIds = new Set(moving.map((m) => m.id));
    /* Two content spaces exist between facing pages: the CANVAS (with the
       gutter and both bleed strips between the pages) and the TRIM JOIN
       (where the pages' printed content is glued edge to edge — what the
       split rendering shows). A dragged element that is NOT split moves
       with the canvas offset, so it stays exactly under the cursor. One
       that IS split across the spine must move with the trim-join offset
       instead — its ink is drawn in join space, and using the canvas
       offset visibly lurched the word sideways by gutter + bleeds the
       moment it was dropped. */
    const mainEl = cur.els.find((e) => e.id === mainId);
    const spanning = (() => {
      if (!mainEl) return false;
      const b = pageBleed(cur);
      const side: 1 | -1 = (d.pageIndexRef.current + 1) % 2 === 0 ? 1 : -1;
      return elCrossesSpine(mainEl, side === 1 ? cur.w - b : b, side);
    })();
    const join = spreadNeighbor(doc, off.index);   // source content → target coords
    if (spanning && join && mainEl) {
      /* a SPLIT element already lives on both pages — flipping its owner on
         every release only churns pages (and spams status). Hand it over
         only when the drop leaves it clearly on the target side: after the
         join-preserving move it must no longer cross back over the spine.
         (Checked BEFORE any mutation — bailing out must leave joins alone.) */
      const bT = pageBleed(target);
      const sideT: 1 | -1 = (off.index + 1) % 2 === 0 ? 1 : -1;
      const moved = { ...mainEl, x: mainEl.x + join.dx };
      if (elCrossesSpine(moved, sideT === 1 ? target.w - bT : bT, sideT)) return false;
    }
    for (const m of moving) {
      if (m.type === "balloon" && m.attachTo && !movingIds.has(m.attachTo)) m.attachTo = null;
    }
    for (const e2 of cur.els) {
      if (e2.type === "balloon" && e2.attachTo && movingIds.has(e2.attachTo) && !movingIds.has(e2.id)) e2.attachTo = null;
    }
    const tx = spanning && join ? join.dx : -off.offX;
    const ty = spanning ? 0 : -off.offY;
    cur.els = cur.els.filter((e2: El) => !movingIds.has(e2.id));
    for (const m of moving) {
      m.x = Math.round(m.x + tx);
      m.y = Math.round(m.y + ty);
      target.els.push(m);
    }
    d.setSelIds([]);
    d.commit();
    d.rebuildThumbs();
    d.setStatus(`Moved ${moving.length > 1 ? `${moving.length} items` : "1 item"} to page ${off.index + 1}.`);
    return true;
  };
}
