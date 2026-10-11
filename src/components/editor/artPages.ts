/* Insert → Import Art Pages…: a folder's worth of page art becomes the
   book in one go.

   - The page each file belongs to comes from the number in its name —
     "page03.png", "SW3_07.jpg", "012.tif" — the LAST run of digits, so a
     series or chapter number earlier in the name does not confuse it.
     Files with no number go in name order after the numbered ones.
   - Pages are added until the book has enough to hold them.
   - Each picture is scaled so its WIDTH matches the page exactly (the
     left and right edges line up with the page's), and centred vertically;
     a taller scan overhangs top and bottom into the bleed, which is fine
     for art. It is placed BEHIND whatever is already on the page.
   The same TIFF/BMP/… normalising and local art store as a single image
   import, so nothing about rendering or saving changes. */
import { makeImage, newPage } from "@/lib/model";
import { loadImage } from "@/lib/exportPng";
import type { EditorCtx } from "./ctx";
import { ART_FORMATS_LABEL, isSupportedArtFile, isTiffFile, nextAid, normalizeArtFile, stashArt } from "./ops";

/* the page number in a file's stem (1-based): a run of digits labelled
   "page"/"pg"/"p" wins ("Issue2-p07" → 7); otherwise the LAST run, except a
   version suffix ("pg_10_v2" → 10, not 2) */
export function pageNumberOf(name: string): number | null {
  const stem = name.replace(/\.[^.]+$/, "");
  const runs = [...stem.matchAll(/\d+/g)].map((m) => ({ n: parseInt(m[0], 10), before: stem.slice(0, m.index) }));
  if (!runs.length) return null;
  const ok = (n: number) => Number.isFinite(n) && n > 0 && n <= 2000;
  const labelled = runs.filter((r) => /(?:^|[^a-z])(?:page|pg|p)[ _.-]*$/i.test(r.before));
  if (labelled.length) { const n = labelled[labelled.length - 1].n; return ok(n) ? n : null; }
  const unversioned = runs.filter((r) => !/(?:^|[^a-z])v[ _.-]*$/i.test(r.before));
  const pick = (unversioned.length ? unversioned : runs).slice(-1)[0].n;
  return ok(pick) ? pick : null;
}

export async function importArtPages(ed: EditorCtx, files: File[]) {
  const { docRef, setStatus, commit, rebuildThumbs, setPageIndex, setSelId, pageIndexRef } = ed;
  const d = docRef.current;
  if (!d) return;
  const usable = files.filter((f) => isSupportedArtFile(f) && !(f.type === "application/pdf" || /\.pdf$/i.test(f.name)));
  const skipped = files.length - usable.length;
  if (!usable.length) {
    setStatus(`No page art to import — pick image files (${ART_FORMATS_LABEL.replace(" or PDF", "")}); PDFs go through Insert → Image….`);
    return;
  }
  /* numbered files land on their page; the rest follow in name order */
  const natural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  const numbered = usable.filter((f) => pageNumberOf(f.name) !== null)
    .sort((a, b) => pageNumberOf(a.name)! - pageNumberOf(b.name)! || natural(a.name, b.name));
  const unnumbered = usable.filter((f) => pageNumberOf(f.name) === null).sort((a, b) => natural(a.name, b.name));
  const plan: { f: File; page: number }[] = numbered.map((f) => ({ f, page: pageNumberOf(f.name)! - 1 }));
  let next = plan.length ? Math.max(...plan.map((p) => p.page)) + 1 : pageIndexRef.current;
  for (const f of unnumbered) plan.push({ f, page: next++ });

  /* enough pages to hold the highest one — fresh page objects, the book's
     size, margin and bleed (what addPageAt does, without a commit each) */
  const need = Math.max(...plan.map((p) => p.page)) + 1;
  const tpl = d.pages[pageIndexRef.current] ?? d.pages[0];
  let added = 0;
  while (d.pages.length < need) {
    const pg = newPage(tpl.w, tpl.h, tpl.margin && { ...tpl.margin });
    pg.bleed = tpl.bleed;
    d.pages.push(pg);
    added++;
  }

  let placed = 0, failed = 0;
  for (let i = 0; i < plan.length; i++) {
    const { f, page } = plan[i];
    setStatus(`Importing page art ${i + 1} of ${plan.length} — ${f.name}…`);
    try {
      let src: Blob = f;
      if (isTiffFile(f)) src = await normalizeArtFile(f);
      const aid = nextAid(ed);
      const url = await stashArt(ed, aid, src);
      const img = await loadImage(url);
      const pg = d.pages[page];
      if (!img.naturalWidth || !img.naturalHeight) throw new Error("no size");
      /* width-matched: the art's left and right edges ARE the page's */
      const scale = pg.w / img.naturalWidth;
      const h = Math.round(img.naturalHeight * scale);
      const el = makeImage(0, Math.round((pg.h - h) / 2), pg.w, h, aid);
      pg.els.unshift(el);          // behind any lettering already there
      placed++;
    } catch {
      failed++;
    }
  }
  commit();
  rebuildThumbs();
  setSelId(null);
  if (plan.length) setPageIndex(plan[0].page);
  const pages = plan.map((p) => p.page + 1);
  const range = pages.length > 1 ? `pages ${Math.min(...pages)}–${Math.max(...pages)}` : `page ${pages[0]}`;
  setStatus(`Imported ${placed} page${placed === 1 ? "" : "s"} of art onto ${range}`
    + (added ? `, ${added} page${added === 1 ? "" : "s"} added` : "")
    + (failed ? `, ${failed} could not be read` : "")
    + (skipped ? `, ${skipped} skipped (PDF/unsupported)` : "") + ".");
}
