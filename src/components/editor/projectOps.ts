/* Project persistence + page export + proofing ops — split from ops.ts
   (which had grown past the 1500-line cap). Same EditorCtx-bag calling
   convention; ops.ts re-exports everything here, so call sites are unchanged. */
import {
  Assets, BalloonEl, Doc, TextEl, normalizeDoc, reseedIds,
} from "@/lib/model";
import { clearArt, fmtBytes, holdArt, noteArtId, putArt, releaseAllArt } from "@/lib/assetStore";
import {
  ImageFormat, docThumbnail, exportPageImage, exportPagePNG, spreadNeighbor,
} from "@/lib/exportPng";
import { LT_URL, ProofMatch } from "./textHelpers";
import { EditorCtx } from "./ctx";
import { ensureAllArt, refitLegacyLettering } from "./ops";


/* Real-time export progress: update the bar overlay, then yield two frames
   so the browser actually PAINTS it before the next page's heavy canvas
   work grabs the main thread. Every export path awaits this between units
   of work — that is what makes the bar move in real time instead of
   jumping straight to done. total 0 = indeterminate (busy sweep). */
function showProgress(ed: EditorCtx, label: string, done: number, total: number) {
  ed.setExportProgress({ label, done, total });
  return new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
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
export function portableAssets(assets: Assets): { assets: Assets; local: number } {
  const out: Assets = {};
  let local = 0;
  for (const [id, url] of Object.entries(assets)) {
    if (typeof url === "string" && url.startsWith("blob:")) local++;
    else out[id] = url;
  }
  return { assets: out, local };
}

/* Guards against a second save starting before the first returns — Ctrl+S
   held or double-clicked would otherwise POST twice and create two projects. */
let saveInFlight = false;

export async function saveProject(ed: EditorCtx, saveAs: boolean) {
  const { demo, setStatus, current, setCurrent, docRef, assetsRef } = ed;
  if (demo) { setStatus("Saving is off in the demo — subscribe to save your comics to your library."); return; }
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
    try { thumbnail = await docThumbnail(d, assetsRef.current); } catch { /* optional */ }
    const { assets: portable, local } = portableAssets(assetsRef.current);
    const payload = { name, data: { doc: d, assets: portable }, thumbnail };
    const res = target
      ? await fetch(`/api/projects/${target.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
    const meta = await res.json();
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
    /* a loaded document owns the artwork slate — drop the previous book's
       local blobs so the store does not accumulate orphans */
    releaseAllArt(); await clearArt();
    assetsRef.current = payload.assets || {};
    reseedIds(docRef.current!);
    reseedAids();
    try { await refitLegacyLettering(docRef.current!); } catch { /* best-effort */ }
    histRef.current = [JSON.stringify(docRef.current)];
    hIndexRef.current = 0;
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

export async function exportJSON(ed: EditorCtx) {
  const { demo, setStatus, docRef, assetsRef, current } = ed;
  if (demo) { setStatus("Saving project files is off in the demo — subscribe to unlock."); return; }
  /* materialise every asset the document references before packing */
  setStatus("Packing artwork…");
  await showProgress(ed, "Preparing artwork…", 0, 0);
  try { await ensureAllArt(ed); } catch { /* pack whatever is available */ }
  const parts: string[] = ['{"doc":', JSON.stringify(docRef.current), ',"assets":{'];
  let first = true;
  let inlined = 0;
  let skipped = 0;
  const blobTotal = Object.values(assetsRef.current)
    .filter((u) => typeof u === "string" && u.startsWith("blob:")).length;
  let blob: Blob;
  try {
    for (const [id, url] of Object.entries(assetsRef.current)) {
      if (typeof url !== "string") continue;
      let out = url;
      if (url.startsWith("blob:")) {
        await showProgress(ed, `Packing artwork ${inlined + skipped + 1} of ${blobTotal}`, inlined + skipped, blobTotal);
        try {
          const b = await fetch(url).then((r) => r.blob());
          out = await blobToDataUrl(b);
          inlined++;
          setStatus(`Packing artwork… ${inlined}`);
        } catch { skipped++; continue; }   // unreadable blob — skip, don't corrupt
      }
      parts.push((first ? "" : ",") + JSON.stringify(id) + ":", JSON.stringify(out));
      first = false;
    }
    parts.push("}}");
    blob = new Blob(parts, { type: "application/x-lettermycomic" });
  } finally {
    ed.setExportProgress(null);
  }
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
    const payload = JSON.parse(await f.text());
    const d: Doc = payload.doc ?? payload;
    if (d?.app !== "comiclettering" || !Array.isArray(d.pages) || d.pages.length === 0) throw new Error("not a ComicLettering project");
    if ((d as { version?: number }).version !== 2) throw new Error("this file is from an old version");
    docRef.current = normalizeDoc(d);
    /* a loaded document owns the artwork slate — drop the previous book's
       local blobs so the store does not accumulate orphans */
    releaseAllArt(); await clearArt();
    assetsRef.current = payload.assets || {};
    reseedIds(d);
    reseedAids();
    try { await refitLegacyLettering(d); } catch { /* best-effort */ }
    /* a self-contained .lmc carries full-size page art inlined as data
       URLs (exact original bytes). Move the big ones into the disk-backed
       blob store this computer uses for everything else: base64 strings
       live in the JS heap (a book of scans would sink the tab) and would
       not survive a refresh via autosave. Small generated art stays as
       data URLs, same as always. */
    for (const [id, url] of Object.entries(assetsRef.current)) {
      if (typeof url === "string" && url.startsWith("data:") && url.length > 500_000) {
        try {
          const blob = await fetch(url).then((r) => r.blob());
          await putArt(id, blob);
          noteArtId(id);
          assetsRef.current[id] = holdArt(id, blob);
        } catch { /* keep the data URL — it still renders */ }
      }
    }
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
  const { demo, setStatus, page, assetsRef } = ed;
  if (demo) { setStatus("Printing is off in the demo — subscribe to print your pages."); return; }
  if (!page) return;
  setStatus("Preparing print…");
  const { renderPageToCanvas } = await import("@/lib/exportPng");
  const canvas = await renderPageToCanvas(page, assetsRef.current, 1);
  const url = canvas.toDataURL("image/png");
  const w = window.open("", "_blank");
  if (!w) { setStatus("Pop-up blocked — allow pop-ups to print."); return; }
  w.document.write(`<!doctype html><title>Print — LetterMyComic</title><style>body{margin:0}img{width:100%}</style><img src="${url}" onload="setTimeout(function(){window.print()},150)">`);
  w.document.close();
  setStatus("Sent to print.");
}

export async function exportAllPages(ed: EditorCtx) {
  const { demo, setStatus, docRef, assetsRef } = ed;
  if (demo) { setStatus("Export is off in the demo — subscribe to unlock."); return; }
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
  if (demo) { setStatus("Export is off in the demo — subscribe to export print-ready pages."); setShowExport(false); return; }
  if (ed.exportProgress) return;   // an export is already running — ignore re-clicks
  setStatus("Loading artwork…");
  try {
    await showProgress(ed, "Loading artwork…", 0, 0);
    await ensureAllArt(ed);
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
      let doneCnt = 0;
      for (const pi of idxs) {
        setStatus(`Exporting page ${pi + 1} (${fmt.toUpperCase()} @ ${dpi} dpi${letteringOnly ? ", lettering only" : ""})…`);
        await showProgress(ed, `Exporting page ${pi + 1} (${fmt.toUpperCase()} @ ${dpi} dpi)`, doneCnt, idxs.length);
        const suffix = letteringOnly ? "-lettering" : "";
        await exportPageImage(d.pages[pi], assetsRef.current, `${nameBase}-page-${pi + 1}${suffix}.${fmt}`, fmt, dpi, letteringOnly, spreadNeighbor(d, pi));
        doneCnt++;
      }
    }
    setStatus("Export complete.");
    setShowExport(false);
  } catch (err) {
    setStatus("Export failed: " + String(err).slice(0, 120));
  } finally {
    ed.setExportProgress(null);
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
  commit();
  setProof((p) => p ? { ...p, matches: p.matches.filter((x) => x !== m && x.elId !== m.elId) } : p);
}

