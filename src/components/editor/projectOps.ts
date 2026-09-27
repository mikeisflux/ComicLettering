/* Project persistence + page export + proofing ops — split from ops.ts
   (which had grown past the 1500-line cap). Same EditorCtx-bag calling
   convention; ops.ts re-exports everything here, so call sites are unchanged. */
import { demoLock } from "@/lib/storeMode";
import {
  Assets, BalloonEl, Doc, TextEl, normalizeDoc, reseedIds, starterDoc } from "@/lib/model";
import { artSize, fmtBytes, holdArt, noteArtId, putArt, releaseAllArt } from "@/lib/assetStore";
import { ZipWriter, isZip, readZipDirectory, zipEntryBlob, zipEntryText } from "@/lib/zipFile";
import { ensureDocFonts } from "./useFontsStamps";
import {
  ImageFormat, docThumbnail, exportPageImage, exportPagePNG, spreadNeighbor, download, pageImageBlob } from "@/lib/exportPng";
import { LT_URL, ProofMatch } from "./textHelpers";
import { EditorCtx } from "./ctx";
import { ensureAllArt, refitLegacyLettering, releaseOffscreenArt } from "./ops";
import { launchFireworks } from "./fireworks";


/* Real-time export progress: update the bar overlay, then yield two frames
   so the browser actually PAINTS it before the next page's heavy canvas
   work grabs the main thread. Every export path awaits this between units
   of work — that is what makes the bar move in real time instead of
   jumping straight to done. total 0 = indeterminate (busy sweep). */
export class ExportCancelled extends Error { constructor() { super("cancelled"); } }

async function showProgress(ed: EditorCtx, label: string, done: number, total: number) {
  ed.setExportProgress({ label, done, total });
  /* rAF stops in a background tab — race it with a timer so an export
     keeps going while the user looks at something else */
  await Promise.race([
    new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
    new Promise<void>((r) => setTimeout(r, 60)),
  ]);
  if (ed.exportCancelRef.current) throw new ExportCancelled();
}

/* the common tail of every export path */
function finishExport(ed: EditorCtx, err: unknown) {
  if (err instanceof ExportCancelled) ed.setStatus("Export cancelled.");
  else if (err) {
    console.error(err);
    ed.setStatus("Export failed: " + (err instanceof Error ? err.message : String(err)).slice(0, 160));
  }
  ed.setExportProgress(null);
  ed.exportCancelRef.current = false;
  /* the whole book's artwork was decoded for the export — keep only the
     page on screen (see releaseOffscreenArt) */
  releaseOffscreenArt(ed);
}

/* artwork the book references but this computer does not have: ask before
   exporting blank frames with a success message */
async function confirmMissingArt(ed: EditorCtx): Promise<boolean> {
  const missing = await ensureAllArt(ed);
  if (!missing.length) return true;
  return window.confirm(`${missing.length} image${missing.length > 1 ? "s" : ""} in this book ${missing.length > 1 ? "are" : "is"} not on this computer (they stay where they were imported). ${missing.length > 1 ? "Those frames" : "That frame"} will export blank — continue?`);
}

/* ---------------- project library (SQL) ---------------- */

export async function refreshProjects(ed: EditorCtx) {
  const { setProjects, setDbError } = ed;
  try {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error(await res.text());
    setProjects(await res.json());
    setDbError(null);
  } catch (err) {
    setDbError("Library unavailable: " + String(err).slice(0, 140));
    setProjects([]);
  }
}

/* Full-size page scans stay on this computer: they are held as local blobs,
   and a 140-page book of them is gigabytes — not something to push through a
   project save. Small generated artwork (tuck cutouts, stamps) is still a data
   URL and travels with the document as before. */
export async function portableAssets(assets: Assets, inlineUnder = 600_000, budget = 8_000_000): Promise<{ assets: Assets; local: number }> {
  const out: Assets = {};
  let local = 0, used = 0;
  for (const [id, url] of Object.entries(assets)) {
    if (typeof url !== "string" || !url.startsWith("blob:")) { out[id] = url; continue; }
    /* every stored image is a blob: URL once it reaches the art store —
       stamps and tuck cutouts included. Small ones are inlined so they
       travel with the book (they used to be dropped with the page scans,
       and came back blank on another machine); big scans stay local, and
       the inlined total stays well under the server's 25 MB cap. Sizes come
       from the store's own bookkeeping — no re-reading every scan on save. */
    const size = artSize(id);
    if (size !== undefined && size <= inlineUnder && used + size <= budget) {
      try {
        const b = await fetch(url).then((r) => r.blob());
        out[id] = await blobToDataUrl(b);
        used += size;
        continue;
      } catch { /* unreadable — treat as local */ }
    }
    local++;
  }
  return { assets: out, local };
}


/* Guards against a second save starting before the first returns — Ctrl+S
   held or double-clicked would otherwise POST twice and create two projects. */
let saveInFlight = false;

/* the server's updatedAt for the book that is open — sent back with each
   save so the server can refuse to overwrite a teammate's newer save */
let openedAt: { id: string; at: string } | null = null;

export async function saveProject(ed: EditorCtx, saveAs: boolean) {
  const { demo, setStatus, current, setCurrent, docRef, assetsRef } = ed;
  if (demo) { setStatus(demoLock("Saving is off in the demo — subscribe to save your comics to your library.", "Saving")); return; }
  /* review access is read-only: editors comment and close review passes,
     the letterer saves (Save a Copy still works — it makes a NEW book) */
  if (!saveAs && current && ed.collab?.role === "editor") {
    setStatus("You have review access on this book — pin notes and close review passes; the letterer saves.");
    return;
  }
  if (saveInFlight) return;
  const d = docRef.current!;
  let target = current;
  let name = current?.name;
  if (saveAs || !target) {
    const entered = window.prompt("Project name:", name || "My comic");
    if (!entered) return;
    name = entered;
    target = null;
  }
  setStatus("Saving to library…");
  saveInFlight = true;
  try {
    let thumbnail = "";
    /* the rail's renderer: it fetches page 1's art from the store, so the
       library card is not blank when page 1 was never visited this session */
    try { thumbnail = await ed.thumbOf(0); } catch { try { thumbnail = await docThumbnail(d, assetsRef.current); } catch { /* optional */ } }
    const { assets: portable, local } = await portableAssets(assetsRef.current);
    const baseUpdatedAt = target && openedAt?.id === target.id ? openedAt.at : undefined;
    const payload = { name, data: { doc: d, assets: portable }, thumbnail, baseUpdatedAt };
    const res = target
      ? await fetch(`/api/projects/${target.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
    const meta = await res.json();
    if (typeof meta.updatedAt === "string") openedAt = { id: meta.id, at: meta.updatedAt };
    setCurrent({ id: meta.id, name: meta.name });
    setStatus(local
      ? `Saved “${meta.name}” to the library. ${local} page image${local > 1 ? "s stay" : " stays"} on this computer — they are too large to upload.`
      : `Saved “${meta.name}” to the library.`);
    refreshProjects(ed);
  } catch (err) {
    setStatus("Save failed: " + String(err).slice(0, 120));
  } finally {
    saveInFlight = false;
  }
}

/* File → New / toolbar New — one path. The two copies drifted: neither
   cleared an edit in progress (editingId pointed at an element that no
   longer existed), the context menu, the adjustment dialog or a pending
   tuck. The local art store is NOT cleared: other books' page art lives
   there too (see loadProject). */
export function newDocument(ed: EditorCtx) {
  const { docRef, assetsRef, histRef, hIndexRef, setCurrent, setSelId, setEditingId, setPageIndex, setThumbs, autosave, force, fitZoom } = ed;
  if (!window.confirm("Start a new document?")) return;
  if (ed.editingIdRef.current) ed.finishEditing();
  docRef.current = starterDoc();
  assetsRef.current = {};
  releaseAllArt();
  reseedIds(docRef.current);
  ed.reseedAids();
  histRef.current = [JSON.stringify(docRef.current)];
  hIndexRef.current = 0;
  setCurrent(null); setSelId(null); setEditingId(null); setPageIndex(0); setThumbs({});
  ed.setCtxMenu(null); ed.setAdjustEdit(null); ed.setTuckAsk(null);
  autosave(); force(); fitZoom(true);
  ed.rebuildThumbs();
}

export async function loadProject(ed: EditorCtx, id: string) {
  const { setStatus, docRef, assetsRef, reseedAids, histRef, hIndexRef, setCurrent, setSelId, setEditingId, setPageIndex, setThumbs, autosave, force, fitZoom } = ed;
  setStatus("Loading project…");
  try {
    const res = await fetch(`/api/projects/${id}`);
    if (!res.ok) throw new Error(res.statusText);
    const p = await res.json();
    const payload = p.data;
    if (!payload?.doc?.pages) throw new Error("bad project data");
    docRef.current = normalizeDoc(payload.doc);
    /* release this tab's object URLs only. The local art store is shared
       by EVERY book on this computer — page scans never leave it (they are
       too big to upload), so clearing it here deleted the other books'
       artwork the moment you opened a second one. */
    releaseAllArt();
    assetsRef.current = payload.assets || {};
    reseedIds(docRef.current!);
    reseedAids();
    await storeInlineAssets(assetsRef.current);
    try { await refitLegacyLettering(docRef.current!); } catch { /* best-effort */ }
    histRef.current = [JSON.stringify(docRef.current)];
    hIndexRef.current = 0;
    openedAt = typeof p.updatedAt === "string" ? { id: p.id, at: p.updatedAt } : null;
    setCurrent({ id: p.id, name: p.name });
    setSelId(null); setEditingId(null); setPageIndex(0);
    setThumbs({});
    autosave();
    force();
    fitZoom(true);
    ed.rebuildThumbs(); // bumps the thumb generation → stale in-flight renders die
    setStatus(`Opened “${p.name}”.`);
  } catch (err) {
    setStatus("Load failed: " + String(err).slice(0, 120));
  }
}

export async function deleteProject(ed: EditorCtx, id: string) {
  const { current, setCurrent } = ed;
  if (!window.confirm("Delete this project from the library?")) return;
  await fetch(`/api/projects/${id}`, { method: "DELETE" });
  if (current?.id === id) setCurrent(null);
  refreshProjects(ed);
}

/* Save As… — the project as a FILE on disk, the way a desktop app does it.
   The format is our JSON payload under the .lmc extension; import accepts
   both .lmc and legacy .json. Where the browser offers a real save dialog
   (Chromium's File System Access API) we use it so the user picks the
   location and filename; elsewhere it falls back to a download.

   Unlike a LIBRARY save (which strips local page-art blobs — gigabytes
   don't belong in a server POST), the project FILE is the portable copy
   of the whole book: every piece of uploaded artwork is inlined as a data
   URL so the .lmc opens complete on any machine. The file is assembled in
   PARTS — one asset at a time — so a big book never needs the whole file
   as a single string in memory. */
async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/* Inlined data-URL assets (stamps, cutouts, small art that travelled with
   a library save or an .lmc) go into the local art store as blobs: the
   autosave stores the document only and pages materialise art from the
   store, so anything left as a data URL in memory was gone after a refresh. */
async function storeInlineAssets(assets: Assets) {
  for (const [id, url] of Object.entries(assets)) {
    if (typeof url !== "string" || !url.startsWith("data:")) continue;
    try {
      const blob = await fetch(url).then((r) => r.blob());
      if (await putArt(id, blob)) { noteArtId(id); assets[id] = holdArt(id, blob); }
    } catch { /* keep the data URL — it still renders this session */ }
  }
}

const extFor = (type: string) =>
  type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp"
    : type === "image/gif" ? "gif" : type === "image/svg+xml" ? "svg" : type === "image/avif" ? "avif" : "bin";

/* The .lmc file is a stored ZIP: `doc.json` (the document plus a manifest of
   which asset lives in which entry) and one entry per image, holding the
   ORIGINAL bytes. Built from Blob parts and read as file slices, so a book
   of full-size scans never has to fit in JavaScript memory — the old
   single-JSON format base64'd every scan into one giant string, which sank
   the tab on save and could not be re-opened at all past ~400 MB. */
export async function exportJSON(ed: EditorCtx) {
  const { demo, setStatus, docRef, assetsRef, current } = ed;
  if (demo) { setStatus(demoLock("Saving project files is off in the demo — subscribe to unlock.", "Saving project files")); return; }
  if (ed.exportProgress) return;
  setStatus("Packing artwork…");
  let blob: Blob;
  let skipped = 0;
  try {
    await showProgress(ed, "Preparing artwork…", 0, 0);
    if (!(await confirmMissingArt(ed))) { finishExport(ed, null); return; }
    const zw = new ZipWriter();
    const manifest: Record<string, string> = {};
    const entries = Object.entries(assetsRef.current).filter(([, u]) => typeof u === "string");
    const blobTotal = entries.filter(([, u]) => (u as string).startsWith("blob:")).length;
    let packed = 0;
    for (const [id, url] of entries) {
      if (!url.startsWith("blob:")) { manifest[id] = url; continue; }   // small data URLs ride in doc.json
      await showProgress(ed, `Packing artwork ${packed + skipped + 1} of ${blobTotal}`, packed + skipped, blobTotal);
      try {
        const b = await fetch(url).then((r) => r.blob());
        const entry = `assets/${id}.${extFor(b.type)}`;
        await zw.add(entry, b);
        manifest[id] = "zip:" + entry;
        packed++;
      } catch { skipped++; }   // unreadable blob — skip, don't corrupt
    }
    await zw.add("doc.json", JSON.stringify({ app: "comiclettering", format: "lmc-zip", version: 3, doc: docRef.current, assets: manifest }));
    blob = zw.finish("application/x-lettermycomic");
  } catch (err) {
    finishExport(ed, err);
    return;
  }
  finishExport(ed, null);
  const name = (current?.name || "comic-project") + ".lmc";
  const doneMsg = (where: string) =>
    `Saved “${name}”${where} — artwork included (${fmtBytes(blob.size)}${skipped ? `, ${skipped} image${skipped > 1 ? "s" : ""} unreadable and skipped` : ""}).`;
  const picker = (window as unknown as {
    showSaveFilePicker?: (opts: unknown) => Promise<{ createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }> }>;
  }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName: name,
        types: [{ description: "LetterMyComic Project", accept: { "application/x-lettermycomic": [".lmc"] } }],
      });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      setStatus(doneMsg(""));
      return;
    } catch (err) {
      if ((err as Error).name === "AbortError") return;   // user cancelled
      /* picker unavailable/blocked — fall through to the download path */
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  setStatus(doneMsg(" to your downloads"));
}

export async function importJSON(ed: EditorCtx, f: File) {
  const { docRef, assetsRef, reseedAids, histRef, hIndexRef, setCurrent, setSelId, setEditingId, setPageIndex, setThumbs, autosave, force, fitZoom, setStatus } = ed;
  try {
    let d: Doc;
    let assets: Assets = {};
    if (await isZip(f)) {
      /* the container format: doc.json + one entry per image, read as
         slices of the file — nothing but the document is held in memory */
      const dir = await readZipDirectory(f);
      const docEntry = dir.get("doc.json");
      if (!docEntry) throw new Error("not a ComicLettering project");
      const payload = JSON.parse(await zipEntryText(f, docEntry));
      d = payload.doc;
      if (d?.app !== "comiclettering" || !Array.isArray(d.pages) || d.pages.length === 0) throw new Error("not a ComicLettering project");
      if ((d as { version?: number }).version !== 2) throw new Error("this file is from an old version");
      docRef.current = normalizeDoc(d);
      releaseAllArt();   // see loadProject — the store is shared, never cleared here
      reseedIds(d);
      const manifest = (payload.assets ?? {}) as Record<string, string>;
      const ids = Object.keys(manifest);
      let n = 0;
      for (const id of ids) {
        const ref = manifest[id];
        if (!ref.startsWith("zip:")) { assets[id] = ref; continue; }
        const e = dir.get(ref.slice(4));
        if (!e) continue;
        if (++n % 5 === 0) setStatus(`Unpacking artwork… ${n}`);
        try {
          const blob = zipEntryBlob(f, e, e.name.endsWith(".png") ? "image/png" : e.name.endsWith(".jpg") ? "image/jpeg" : "");
          /* into the store as a real blob (a slice of the file on disk) */
          if (await putArt(id, blob)) { noteArtId(id); assets[id] = holdArt(id, blob); }
        } catch { /* unreadable entry — that frame stays blank */ }
      }
    } else {
      const text = await f.text();
      /* the desktop wrapper used to hand files over as UTF-8 text; a zip
         mangled that way starts with the ZIP signature */
      if (text.startsWith("PK\u0003\u0004")) throw new Error("this file needs a newer desktop app — open it from the website instead");
      const payload = JSON.parse(text);
      d = payload.doc ?? payload;
      if (d?.app !== "comiclettering" || !Array.isArray(d.pages) || d.pages.length === 0) throw new Error("not a ComicLettering project");
      if ((d as { version?: number }).version !== 2) throw new Error("this file is from an old version");
      docRef.current = normalizeDoc(d);
      releaseAllArt();
      reseedIds(d);
      assets = payload.assets || {};
    }
    assetsRef.current = assets;
    reseedAids();
    /* every inlined data URL goes into the disk-backed store — big scans
       because base64 in the heap would sink the tab, small art because the
       autosave cannot bring it back otherwise */
    await storeInlineAssets(assetsRef.current);
    try { await refitLegacyLettering(d); } catch { /* best-effort */ }
    histRef.current = [JSON.stringify(d)];
    hIndexRef.current = 0;
    setCurrent(null);
    setSelId(null); setEditingId(null); setPageIndex(0); setThumbs({});
    autosave(); force(); fitZoom(true);
    ed.rebuildThumbs(); // bumps the thumb generation → stale in-flight renders die
    setStatus("Project imported.");
  } catch (err) {
    window.alert("Could not open that file: " + (err as Error).message);
  }
}

export async function printPage(ed: EditorCtx) {
  const { demo, setStatus, page, assetsRef, docRef, pageIndexRef } = ed;
  if (demo) { setStatus(demoLock("Printing is off in the demo — subscribe to print your pages.", "Printing")); return; }
  if (!page) return;
  const d = docRef.current!;
  setStatus("Preparing print…");
  const { renderPageToCanvas, spreadNeighbor } = await import("@/lib/exportPng");
  /* the two-page print view prints both pages of the spread; otherwise the
     one page — either way WITH its spread partner's cross-spine lettering,
     which the old print cut off at the trim */
  const idxs = ed.spreadPrint && ed.spreadLayout.length === 2
    ? [...ed.spreadLayout].sort((a, b) => a.off - b.off).map((s) => s.idx)
    : [pageIndexRef.current];
  try {
    await ensureDocFonts(d);
    const urls: string[] = [];
    for (const i of idxs) {
      const canvas = await renderPageToCanvas(d.pages[i], assetsRef.current, 1, false, spreadNeighbor(d, i));
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("render failed");
      urls.push(URL.createObjectURL(blob));
    }
    const w = window.open("", "_blank");
    if (!w) { setStatus("Pop-up blocked — allow pop-ups to print."); urls.forEach((u) => URL.revokeObjectURL(u)); return; }
    const imgs = urls.map((u) => `<img src="${u}">`).join("");
    w.document.write(`<!doctype html><title>Print — LetterMyComic</title><style>@page{margin:0}html,body{margin:0;height:100%}img{display:block;width:100%;height:100vh;object-fit:contain;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style>${imgs}<script>var n=${urls.length},k=0;document.querySelectorAll("img").forEach(function(i){i.onload=function(){if(++k===n)setTimeout(function(){window.print()},150)}})</script>`);
    w.document.close();
    setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 60_000);
    setStatus(idxs.length > 1 ? "Sent the spread to print." : "Sent to print.");
  } catch (err) {
    setStatus("Print failed: " + (err instanceof Error ? err.message : String(err)).slice(0, 140));
  }
}

export async function exportAllPages(ed: EditorCtx) {
  return runExport(ed, "png", "all", 225);
}

export async function exportAllPagesLegacy(ed: EditorCtx) {
  const { demo, setStatus, docRef, assetsRef } = ed;
  if (demo) { setStatus(demoLock("Export is off in the demo — subscribe to unlock.", "Export")); return; }
  const d = docRef.current!;
  setStatus("Loading artwork…");
  try {
    await showProgress(ed, "Loading artwork…", 0, 0);
    await ensureAllArt(ed);
    for (let i = 0; i < d.pages.length; i++) {
      setStatus(`Exporting page ${i + 1}/${d.pages.length}…`);
      await showProgress(ed, `Exporting page ${i + 1} of ${d.pages.length} (PNG)`, i, d.pages.length);
      await exportPagePNG(d.pages[i], assetsRef.current, `comic-page-${i + 1}.png`, spreadNeighbor(d, i));
    }
    setStatus(`Exported ${d.pages.length} page${d.pages.length > 1 ? "s" : ""}.`);
    launchFireworks();
  } finally {
    ed.setExportProgress(null);
  }
}

export async function runExport(
  ed: EditorCtx,
  format: ImageFormat | "pdf" | "cbz",
  scope: "current" | "all" | "range", dpi: number
) {
  const { demo, setStatus, setShowExport, docRef, current, pageIndexRef,
    exportFrom, exportTo, letteringOnly, exportCropMarks, assetsRef } = ed;
  if (demo) { setStatus(demoLock("Export is off in the demo — subscribe to export print-ready pages.", "Export")); setShowExport(false); return; }
  if (ed.exportProgress) return;   // an export is already running — ignore re-clicks
  setStatus("Loading artwork…");
  try {
    await showProgress(ed, "Loading artwork…", 0, 0);
    if (!(await confirmMissingArt(ed))) { finishExport(ed, null); return; }
    await ensureDocFonts(docRef.current);
    const d = docRef.current!;
    const nameBase = (current?.name || "comic").replace(/[^\w\- ]+/g, "");
    const idxs =
      scope === "current" ? [pageIndexRef.current]
        : scope === "all" ? d.pages.map((_, i) => i)
        : d.pages.map((_, i) => i).filter((i) =>
            i + 1 >= Math.min(exportFrom, exportTo) && i + 1 <= Math.max(exportFrom, exportTo));
    if (!idxs.length) { setStatus("No pages in that range."); return; }
    if (format === "pdf") {
      const sub = { ...d, pages: idxs.map((i) => d.pages[i]) };
      const { exportPdf } = await import("@/lib/pdfExport");
      /* spread partners resolved against the FULL document, so exporting a
         page range keeps double-page lettering intact */
      await exportPdf(sub, assetsRef.current, `${nameBase}.pdf`, (i, n) => {
        setStatus(`Rendering PDF page ${i}/${n}…`);
        return showProgress(ed, `Rendering PDF page ${i} of ${n}`, i - 1, n);
      }, dpi, exportCropMarks,
        idxs.map((i) => spreadNeighbor(d, i)));
      await showProgress(ed, "Building PDF…", idxs.length, idxs.length);
    } else if (format === "cbz") {
      const { exportCbz } = await import("@/lib/cbz");
      await exportCbz(d, assetsRef.current, `${nameBase}.cbz`, dpi, idxs, (i, n) => {
        setStatus(`Packing CBZ page ${i}/${n}…`);
        return showProgress(ed, `Packing CBZ page ${i} of ${n}`, i - 1, n);
      });
      await showProgress(ed, "Building CBZ…", idxs.length, idxs.length);
    } else {
      const fmt = letteringOnly ? "png" : format; // transparency needs PNG
      const suffix = letteringOnly ? "-lettering" : "";
      if (idxs.length === 1) {
        const pi = idxs[0];
        setStatus(`Exporting page ${pi + 1} (${fmt.toUpperCase()} @ ${dpi} dpi${letteringOnly ? ", lettering only" : ""})…`);
        await showProgress(ed, `Exporting page ${pi + 1} (${fmt.toUpperCase()} @ ${dpi} dpi)`, 0, 1);
        await exportPageImage(d.pages[pi], assetsRef.current, `${nameBase}-page-${pi + 1}${suffix}.${fmt}`, fmt, dpi, letteringOnly, spreadNeighbor(d, pi));
      } else {
        /* several pages → ONE zip. A download per page depended on the
           browser's "allow multiple downloads" prompt: decline it (or use
           Safari) and pages went silently missing behind "Export complete". */
        const zw = new ZipWriter();
        let doneCnt = 0;
        for (const pi of idxs) {
          setStatus(`Exporting page ${pi + 1} (${fmt.toUpperCase()} @ ${dpi} dpi${letteringOnly ? ", lettering only" : ""})…`);
          await showProgress(ed, `Exporting page ${pi + 1} (${fmt.toUpperCase()} @ ${dpi} dpi)`, doneCnt, idxs.length);
          const blob = await pageImageBlob(d.pages[pi], assetsRef.current, fmt, dpi, letteringOnly, spreadNeighbor(d, pi));
          await zw.add(`${nameBase}-page-${String(pi + 1).padStart(3, "0")}${suffix}.${fmt}`, blob);
          doneCnt++;
        }
        await showProgress(ed, "Building the zip…", idxs.length, idxs.length);
        download(zw.finish("application/zip"), `${nameBase}-pages${suffix}.zip`);
      }
    }
    setStatus("Export complete.");
    setShowExport(false);
    launchFireworks();   // the book is out — sparks earned
    finishExport(ed, null);
  } catch (err) {
    finishExport(ed, err);
  }
}

/* ---------------- proofing tab (open-source LanguageTool) ---------------- */

export async function runProof(ed: EditorCtx) {
  const { page, setProof } = ed;
  if (!page) return;
  setProof({ busy: true, error: null, matches: [] });
  const targets = page.els.filter((e): e is BalloonEl | TextEl => e.type === "balloon" || e.type === "text");
  const all: ProofMatch[] = [];
  try {
    for (const el of targets) {
      if (!el.text.trim()) continue;
      const res = await fetch(LT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ text: el.text, language: "en-US" }),
      });
      if (!res.ok) throw new Error(`LanguageTool ${res.status}`);
      const data = await res.json();
      for (const m of data.matches || []) {
        all.push({
          elId: el.id,
          message: m.message,
          context: m.context?.text || "",
          offset: m.offset, length: m.length,
          reps: (m.replacements || []).slice(0, 3).map((r: { value: string }) => r.value),
        });
      }
    }
    setProof({ busy: false, error: null, matches: all });
  } catch (err) {
    setProof({ busy: false, error: "Check failed: " + String(err).slice(0, 120) + " (LanguageTool is a free open-source service — it rate-limits heavy use)", matches: all });
  }
}

export function applyProofFix(ed: EditorCtx, m: ProofMatch, rep: string) {
  const { page, setStatus, commit, setProof } = ed;
  if (!page) return;
  const el = page.els.find((e) => e.id === m.elId) as BalloonEl | TextEl | undefined;
  if (!el) return;
  if (el.locked) { setStatus("That item is locked — unlock it to apply fixes."); return; }
  el.text = el.text.slice(0, m.offset) + rep + el.text.slice(m.offset + m.length);
  /* the correction shifts every offset — inline bold/italic runs would
     keep drawing the OLD words (both renderers prefer runs over text) */
  el.runs = undefined;
  commit();
  setProof((p) => p ? { ...p, matches: p.matches.filter((x) => x !== m && x.elId !== m.elId) } : p);
}

