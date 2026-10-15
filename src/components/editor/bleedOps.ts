/* Bleed-line housekeeping — split from ops.ts (1500-line cap).

   The bleed line (trim) is a hard border for balloons, text boxes,
   lettering and stamps; the editor and every export clip them there. An
   item that slides (all but) entirely past it therefore vanishes from
   view — these two commands find such strays and bring them back. */
import { Page, pageBleed } from "@/lib/model";
import { TrimRect, elCrossesTrim, trimSliver } from "@/lib/exportPng";
import type { EditorCtx } from "./ctx";

/* Edit → Select Items Past the Bleed Line: everything on this page that
   the trim leaves (all but) nothing of — a balloon that slid off the page
   edge, an imported caption that landed below the margin. The editor
   clips at the page edge, so such strays were invisible here and printed
   as a hairline at the bleed line. Other pages are counted in the status. */
export function selectPastBleed(ed: EditorCtx) {
  const { docRef, pageIndexRef, setSelIds, setSelId, setStatus } = ed;
  const d = docRef.current;
  if (!d) return;
  const strays = (pg: Page) => {
    const b = pageBleed(pg);
    const r: TrimRect = { x0: b, y0: b, x1: pg.w - b, y1: pg.h - b };
    return pg.els.filter((e) => !e.hidden && trimSliver(e, r));
  };
  const here = strays(d.pages[pageIndexRef.current]);
  const elsewhere = d.pages.map((pg, i) => [i + 1, strays(pg).length] as const).filter(([i, n]) => n && i !== pageIndexRef.current + 1);
  const other = elsewhere.length ? ` Other pages with strays: ${elsewhere.map(([i, n]) => `${i} (${n})`).join(", ")}.` : "";
  if (!here.length) { setStatus("Nothing on this page is hiding past the bleed line." + other); return; }
  setSelIds(here.map((e) => e.id));
  setSelId(here[here.length - 1].id);
  setStatus(`Selected ${here.length} item${here.length === 1 ? "" : "s"} sitting past the bleed line — Delete removes ${here.length === 1 ? "it" : "them"}, or drag ${here.length === 1 ? "it" : "them"} back onto the page.` + other);
}

/* Edit → Gather Items at the Bleed Line (Ctrl+Shift+G): everything on
   this page that touches or crosses the bleed line — balloons, text boxes,
   lettering, stamps, plus the partners they are joined to — is moved to
   the middle of the page (fanned a little so they do not land dead on top
   of each other) and selected, ready to be placed properly. Locked items
   come too (a stray is a stray); page art is not governed by the line. */
export function gatherPastBleed(ed: EditorCtx) {
  const { docRef, pageIndexRef, setSelIds, setSelId, setStatus, commit, rebuildThumbs } = ed;
  const d = docRef.current;
  const pg = d?.pages[pageIndexRef.current];
  if (!d || !pg) return;
  const b = pageBleed(pg);
  const r: TrimRect = { x0: b, y0: b, x1: pg.w - b, y1: pg.h - b };
  const hit = new Set<string>();
  for (const e of pg.els) if (!e.hidden && elCrossesTrim(e, r)) hit.add(e.id);
  /* joined balloons travel together, or the band would stretch across the page */
  for (const e of pg.els) {
    if (e.type !== "balloon" || !e.attachTo) continue;
    if (hit.has(e.id)) hit.add(e.attachTo);
    else if (hit.has(e.attachTo)) hit.add(e.id);
  }
  const items = pg.els.filter((e) => hit.has(e.id));
  if (!items.length) { setStatus("Nothing on this page touches the bleed line."); return; }
  const step = Math.round(pg.w * 0.02);
  items.forEach((e, i) => {
    const k = i - (items.length - 1) / 2;
    e.x = Math.round(pg.w / 2 - e.w / 2 + k * step);
    e.y = Math.round(pg.h / 2 - e.h / 2 + k * step);
  });
  setSelIds(items.map((e) => e.id));
  setSelId(items[items.length - 1].id);
  commit();
  rebuildThumbs();
  setStatus(`Gathered ${items.length} item${items.length === 1 ? "" : "s"} from the bleed line to the middle of the page — drag ${items.length === 1 ? "it" : "them"} where ${items.length === 1 ? "it belongs" : "they belong"} (Ctrl+Z undoes).`);
}
