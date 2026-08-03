/* Two-up spread + page-list helpers, split from Editor.tsx (1500-line cap):
   where the facing page sits on screen, the cross-page drop that moves a
   dragged selection onto it, and the add-page insert. */
import type React from "react";
import { Doc, El, newPage } from "@/lib/model";
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
  const fpDiv = document.querySelector(".facingPage") as HTMLElement | null;
  const idx = fpDiv ? parseInt(fpDiv.dataset.pageIndex ?? "-1", 10) : -1;
  if (!fpDiv || !pageDiv || idx < 0) return null;
  const fr = (fpDiv.querySelector("img") ?? fpDiv).getBoundingClientRect();
  const pr = pageDiv.getBoundingClientRect();
  return { index: idx, offX: (fr.left - pr.left) / zoom, offY: (fr.top - pr.top) / zoom };
}

export interface CrossPageDropDeps {
  docRef: React.RefObject<Doc | null>;
  pageIndexRef: React.RefObject<number>;
  selIdsRef: React.RefObject<string[]>;
  pageDivRef: React.RefObject<HTMLDivElement | null>;
  zoom: number;
  facingIndex: number;
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
    const fpDiv = document.querySelector(".facingPage") as HTMLElement | null;
    if (!doc || !pgEl || !fpDiv) return false;
    const hit = fpDiv.getBoundingClientRect();
    if (cx < hit.left || cx > hit.right || cy < hit.top || cy > hit.bottom) return false;
    const off = facingOffset(pgEl, d.zoom);
    if (!off) return false;
    const cur = doc.pages[d.pageIndexRef.current];
    const target = doc.pages[d.facingIndex];
    const ids = new Set(d.selIdsRef.current.length ? d.selIdsRef.current : [mainId]);
    const moving = cur.els.filter((e) => ids.has(e.id) && !e.locked);
    if (!moving.length) return false;
    const movingIds = new Set(moving.map((m) => m.id));
    for (const m of moving) {
      if (m.type === "balloon" && m.attachTo && !movingIds.has(m.attachTo)) m.attachTo = null;
    }
    for (const e2 of cur.els) {
      if (e2.type === "balloon" && e2.attachTo && movingIds.has(e2.attachTo) && !movingIds.has(e2.id)) e2.attachTo = null;
    }
    cur.els = cur.els.filter((e2: El) => !movingIds.has(e2.id));
    for (const m of moving) {
      m.x = Math.round(m.x - off.offX);
      m.y = Math.round(m.y - off.offY);
      target.els.push(m);
    }
    d.setSelIds([]);
    d.commit();
    d.rebuildThumbs();
    d.setStatus(`Moved ${moving.length > 1 ? `${moving.length} items` : "1 item"} to page ${d.facingIndex + 1}.`);
    return true;
  };
}
