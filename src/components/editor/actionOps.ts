/* Instaction — lasso an object, get action lines around it. Rides the
   Tuck Back trace tool (same magnetic lasso / pen, same armed state); the
   only difference is what happens when the ring closes: an ActionEl is
   placed instead of a cutout dialog opening. */
import type React from "react";
import type { Doc } from "@/lib/model";
import { makeAction } from "@/lib/model";
import { actionBoxFor } from "@/lib/actionLines";
import { pathBounds } from "./tuck";

export interface ActionDeps {
  docRef: React.RefObject<Doc | null>;
  pageIndexRef: React.RefObject<number>;
  pendingLockRef: React.RefObject<Set<string>>;
  commit: () => void;
  rebuildThumbs: () => void;
  setSelId: (id: string | null) => void;
  setPageIndex: (i: number) => void;
  setStatus: (s: string) => void;
  setTuckMode: (v: boolean) => void;
  showTab: (k: "inspector") => void;
  /* spread view: the facing page and where its origin sits in current-page
     units, so a ring drawn over the other page lands on THAT page */
  facing: { index: number; offX: number; offY: number } | null;
}

export function placeActionLines(d: ActionDeps, ringIn: number[][]) {
  d.setTuckMode(false);
  if (ringIn.length < 3) { d.setStatus("Draw a loop around the object that should get action lines."); return; }
  const doc = d.docRef.current!;
  const cur = d.pageIndexRef.current;
  /* the page the ring mostly covers */
  const cands: { idx: number; ring: number[][] }[] = [{ idx: cur, ring: ringIn }];
  if (d.facing) cands.push({ idx: d.facing.index, ring: ringIn.map(([x, y]) => [x - d.facing!.offX, y - d.facing!.offY]) });
  const overlap = (ring: number[][], idx: number) => {
    const b = pathBounds(ring), pg = doc.pages[idx];
    return Math.max(0, Math.min(b.x + b.w, pg.w) - Math.max(b.x, 0)) * Math.max(0, Math.min(b.y + b.h, pg.h) - Math.max(b.y, 0));
  };
  cands.sort((a, b) => overlap(b.ring, b.idx) - overlap(a.ring, a.idx));
  const { idx, ring } = cands[0];
  const b = pathBounds(ring);
  if (b.w < 12 || b.h < 12) { d.setStatus("That loop is too small — draw around the whole object."); return; }
  const box = actionBoxFor(ring);
  const el = makeAction(box.x, box.y, box.w, box.h, box.pts);
  const page = doc.pages[idx];
  page.els.push(el);
  d.pendingLockRef.current.add(el.id);
  if (idx !== cur) {
    /* drawn over the facing page of the spread: it lives there, and the
       ops page follows so the Inspector edits the right element */
    (d.pageIndexRef as { current: number }).current = idx;
    d.setPageIndex(idx);
  }
  d.commit();
  d.rebuildThumbs();
  d.setSelId(el.id);
  d.showTab("inspector");
  d.setStatus("Action lines added — tune the style, count, length and weight in the Inspector; drag the handles to resize the burst.");
}
