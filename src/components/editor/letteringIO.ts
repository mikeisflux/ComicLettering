/* Lettering without the art — three things a letterer needs apart from the
   page scans, which are big, often licensed, and already with the artist:

   - File → Export Lettering & Styles… writes a .lmc of the book with the
     page art left out: balloons, captions, lettering, action lines, panel
     frames (as empty masks), stamps and Tuck Back cutouts, plus the
     styles saved in the book. It opens like any .lmc.
   - File → Import Lettering & Styles… MERGES such a file (or any .lmc)
     onto the open book: each page's non-art elements land on the same
     page here (pages are added as needed), stamps and cutouts come along,
     saved styles are added by name. The art already here stays.
   - Edit → Clear Art… strips the page art from the open book — locked or
     not — and keeps everything else: masks/clipping (panel frames stay,
     emptied), action lines, Tuck Back cutouts, stamps, lettering. */
import { Assets, Doc, El, normalizeDoc, newPage, uid } from "@/lib/model";
import { ZipWriter, isZip, readZipDirectory, zipEntryBlob, zipEntryText } from "@/lib/zipFile";
import { getArt } from "@/lib/assetStore";
import type { EditorCtx } from "./ctx";
import { nextAid, stashArt } from "./ops";
import { downloadBlob, extFor } from "./projectOps";

/* page ART: a picture in its own right. Stamps and Tuck Back cutouts are
   images too but belong to the lettering, so they are NOT art here. */
export const isPageArt = (el: El) => el.type === "image" && !el.stamp && !el.cut;

/* ---------------- Clear Art ---------------- */

export function clearArt(ed: EditorCtx) {
  const { docRef, setStatus, commit, rebuildThumbs, setSelId } = ed;
  const d = docRef.current;
  if (!d) return;
  let pics = 0, frames = 0;
  for (const pg of d.pages) {
    for (const e of pg.els) {
      if (isPageArt(e)) pics++;
      else if (e.type === "panel" && e.img) frames++;
    }
  }
  if (!pics && !frames) { setStatus("There is no page art in this book."); return; }
  const what = [pics ? `${pics} picture${pics === 1 ? "" : "s"}` : "", frames ? `the art in ${frames} panel${frames === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ");
  if (!window.confirm(`Unlock all art and clear it?\n\nThis removes ${what} from every page. Lettering, balloons, panel frames (emptied), stamps, Tuck Back cutouts, action lines and saved styles stay. Undo brings it back.`)) return;
  for (const pg of d.pages) {
    pg.els = pg.els.filter((e) => !isPageArt(e));
    for (const e of pg.els) {
      if (e.type === "panel" && e.img) { e.img = null; delete e.pan; e.locked = false; }
    }
  }
  setSelId(null);
  commit();
  rebuildThumbs();
  setStatus(`Cleared ${what}. The lettering, frames, stamps and cutouts are all still here (Ctrl+Z undoes).`);
}

/* ---------------- Export Lettering & Styles ---------------- */

export async function exportLettering(ed: EditorCtx) {
  const { docRef, assetsRef, current, setStatus } = ed;
  const src = docRef.current;
  if (!src) return;
  setStatus("Packing lettering…");
  /* a deep copy with the art stripped: pictures dropped, frames emptied */
  const doc = JSON.parse(JSON.stringify(src)) as Doc;
  const keep = new Set<string>();
  for (const pg of doc.pages) {
    pg.els = pg.els.filter((e) => !isPageArt(e));
    for (const e of pg.els) {
      if (e.type === "panel" && e.img) { e.img = null; delete e.pan; }
      if ("img" in e && e.img) keep.add(e.img as string);
    }
  }
  const zw = new ZipWriter();
  const manifest: Record<string, string> = {};
  for (const id of keep) {
    let blob: Blob | null = null;
    const url = assetsRef.current[id];
    try {
      if (typeof url === "string" && url.startsWith("blob:")) blob = await fetch(url).then((r) => r.blob());
      else if (typeof url === "string" && url.startsWith("data:")) { manifest[id] = url; continue; }
      if (!blob) blob = await getArt(id);
    } catch { blob = null; }
    if (!blob) continue;
    const entry = `assets/${id}.${extFor(blob.type)}`;
    await zw.add(entry, blob);
    manifest[id] = "zip:" + entry;
  }
  await zw.add("doc.json", JSON.stringify({ app: "comiclettering", format: "lmc-zip", version: 3, letteringOnly: true, doc, assets: manifest }));
  const blob = zw.finish("application/x-lettermycomic");
  const name = `${(current?.name || "comic").replace(/[^\w.-]+/g, "_")}-lettering.lmc`;
  await downloadBlob(blob, name);
  setStatus(`Saved the lettering and styles as “${name}” — no page art inside.`);
}

/* ---------------- Import Lettering & Styles (merge) ---------------- */

async function readLmc(f: File): Promise<{ doc: Doc; assets: Assets; blobs: Map<string, Blob> }> {
  const blobs = new Map<string, Blob>();
  if (await isZip(f)) {
    const dir = await readZipDirectory(f);
    const docEntry = dir.get("doc.json");
    if (!docEntry) throw new Error("not a ComicLettering project");
    const payload = JSON.parse(await zipEntryText(f, docEntry));
    const doc = payload.doc as Doc;
    if (doc?.app !== "comiclettering" || !Array.isArray(doc.pages)) throw new Error("not a ComicLettering project");
    const assets: Assets = {};
    for (const [id, ref] of Object.entries((payload.assets ?? {}) as Record<string, string>)) {
      if (!ref.startsWith("zip:")) { assets[id] = ref; continue; }
      const e = dir.get(ref.slice(4));
      if (e) blobs.set(id, zipEntryBlob(f, e, e.name.endsWith(".png") ? "image/png" : e.name.endsWith(".jpg") ? "image/jpeg" : ""));
    }
    return { doc, assets, blobs };
  }
  const payload = JSON.parse(await f.text());
  const doc = (payload.doc ?? payload) as Doc;
  if (doc?.app !== "comiclettering" || !Array.isArray(doc.pages)) throw new Error("not a ComicLettering project");
  return { doc, assets: payload.assets || {}, blobs };
}

export async function importLettering(ed: EditorCtx, f: File) {
  const { docRef, setStatus, commit, rebuildThumbs, setSelId, pageIndexRef } = ed;
  const d = docRef.current;
  if (!d) return;
  setStatus("Reading lettering…");
  let read: Awaited<ReturnType<typeof readLmc>>;
  try { read = await readLmc(f); } catch (err) { setStatus("Import failed: " + String((err as Error).message || err)); return; }
  const src = normalizeDoc(read.doc);
  /* the file's stamps and cutouts get fresh ids here — the open book's
     ids must not be hijacked */
  const aidMap = new Map<string, string>();
  for (const [id, blob] of read.blobs) {
    const aid = nextAid(ed);
    try { await stashArt(ed, aid, blob); aidMap.set(id, aid); } catch { /* that stamp stays blank */ }
  }
  for (const [id, url] of Object.entries(read.assets)) {
    if (typeof url !== "string" || !url.startsWith("data:")) continue;
    const aid = nextAid(ed);
    try { await stashArt(ed, aid, await fetch(url).then((r) => r.blob())); aidMap.set(id, aid); } catch { /* skip */ }
  }
  const tpl = d.pages[pageIndexRef.current] ?? d.pages[0];
  let added = 0, placed = 0;
  for (let pi = 0; pi < src.pages.length; pi++) {
    while (d.pages.length <= pi) {
      const pg = newPage(tpl.w, tpl.h, tpl.margin && { ...tpl.margin });
      pg.bleed = tpl.bleed;
      d.pages.push(pg); added++;
    }
    const idMap = new Map<string, string>();
    const incoming = src.pages[pi].els.filter((e) => !isPageArt(e)).map((e) => {
      const c = JSON.parse(JSON.stringify(e)) as El;
      const nid = uid(); idMap.set(e.id, nid); c.id = nid;
      if (c.type === "panel" && c.img) { c.img = null; delete c.pan; }      // frames come as masks
      if (c.type === "image" && c.img) c.img = aidMap.get(c.img) ?? c.img;
      if (c.type === "balloon" && c.img) c.img = aidMap.get(c.img) ?? c.img;
      return c;
    });
    for (const c of incoming) {
      if (c.type === "balloon" && c.attachTo) c.attachTo = idMap.get(c.attachTo) ?? null;
    }
    d.pages[pi].els.push(...incoming);
    placed += incoming.length;
  }
  /* saved styles: add the ones this book does not have (by name) */
  let styles = 0;
  const mine = (d.styles ??= {});
  for (const key of ["letters", "shapes"] as const) {
    const have = new Set(((mine[key] ?? []) as { name: string }[]).map((s) => s.name));
    for (const s of (src.styles?.[key] ?? []) as { name: string }[]) {
      if (!have.has(s.name)) { (mine[key] ??= []).push(s); have.add(s.name); styles++; }
    }
  }
  setSelId(null);
  commit();
  rebuildThumbs();
  setStatus(`Imported ${placed} lettering item${placed === 1 ? "" : "s"} across ${src.pages.length} page${src.pages.length === 1 ? "" : "s"}`
    + (added ? `, ${added} page${added === 1 ? "" : "s"} added` : "") + (styles ? `, ${styles} saved style${styles === 1 ? "" : "s"}` : "") + ". The art here was left alone.");
}
