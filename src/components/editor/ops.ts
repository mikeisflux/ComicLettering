/* Editor operations — element, page, asset, project and export commands.
   Extracted verbatim from Editor.tsx; each op takes the per-render
   EditorCtx bag (plain function calls, not components). */
import React from "react";
import {
  Assets, BalloonEl, BalloonKind, DPI, Doc, El, FONTS, FillStyle, GradStop, Page,
  TAILLESS_KINDS, TextEl, TextStyle, clamp, makeBalloon, makeImage,
  makePanel, makeText, reseedIds, solid, uid,
} from "@/lib/model";
import { balloonGeom } from "@/lib/geometry";
import {
  artIdTaken, artUrl, clearArt, ensureArt, fmtBytes, holdArt, noteArtId, putArt,
  releaseAllArt, requestPersistence, storageEstimate,
} from "@/lib/assetStore";
import { LETTER_STYLES, applyLetterStyle } from "@/lib/presets";
import { BALLOON_STYLES, BOX_STYLES, applyShapeStyle } from "@/lib/balloonStyles";
import {
  ImageFormat, docThumbnail, exportPageImage, exportPagePNG, loadImage,
} from "@/lib/exportPng";
import { BalloonPreset, LT_URL, ProofMatch, measureBlock, parseScript } from "./textHelpers";
import { EditorCtx } from "./ctx";


/* Dedicated add-on bubble: a linked balloon that inherits the parent's
   look and stays joined (replaces the old drag-to-join behaviour). */
export function addAttachedBubble(ed: EditorCtx) {
  const { docRef, pageIndexRef, selId, setStatus, pendingLockRef, commit, setSelId } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const src = p.els.find((x) => x.id === selId);
  if (!src || src.type !== "balloon") {
    setStatus("Select a balloon first, then click Add Bubble to link a second one to it.");
    return;
  }
  const b = src as BalloonEl;
  const w = Math.round(b.w * 0.8), h = Math.round(b.h * 0.8);
  let x = b.x + Math.round(b.w * 0.55);
  const y = Math.max(0, Math.min(p.h - h, b.y + Math.round(b.h * 1.06)));
  if (x + w > p.w) x = Math.max(0, b.x - Math.round(w * 0.9));
  const el = makeBalloon(b.kind, x, y, w, h);
  el.fill = JSON.parse(JSON.stringify(b.fill));
  el.stroke = b.stroke;
  el.strokeW = b.strokeW;
  el.shadow = b.shadow;
  el.ts = { ...b.ts };
  if (b.kind === "custom") { el.pts = b.pts; el.tailStyle = b.tailStyle; }
  el.attachTo = b.id;
  /* straight connector by default — NO seeded bend; the band only curves
     when the user drags the middle handle */
  const pcx = b.x + b.w / 2 - (x + w / 2), pcy = b.y + b.h / 2 - (y + h / 2);
  el.tail = { dx: Math.round(pcx), dy: Math.round(pcy) };
  p.els.push(el);
  pendingLockRef.current.add(el.id);
  commit();
  setSelId(el.id);
  setStatus("Linked bubble added — it matches the first bubble's style and stays joined. Drag the orange tip to detach.");
}

export function resolveTailAsk(ed: EditorCtx, choice: "speech" | "thought" | "none") {
  const { tailAsk, setTailAsk, docRef, pageIndexRef, commit, setStatus } = ed;
  const id = tailAsk;
  setTailAsk(null);
  if (!id) return;
  const d = docRef.current!;
  const pg = d.pages[pageIndexRef.current];
  const el = pg.els.find((x) => x.id === id);
  if (!el || el.type !== "balloon") return;
  if (choice === "none") {
    el.tail = null;
  } else {
    el.tail = { dx: -Math.round(el.w * 0.25), dy: Math.round(el.h * 0.85) };
    el.tailStyle = choice;
  }
  commit();
  setStatus(choice === "none"
    ? "Custom balloon created — double-click to type."
    : "Custom balloon created — double-click to type, drag the orange dot to aim the tail.");
}

export function deleteSel(ed: EditorCtx) {
  const { docRef, pageIndexRef, selId, setStatus, pendingLockRef, setSelId, commit } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const i = p.els.findIndex((x) => x.id === selId);
  if (i < 0) return;
  if (p.els[i].locked) { setStatus("This item is locked — right-click it to unlock before deleting."); return; }
  pendingLockRef.current.delete(p.els[i].id);
  p.els.splice(i, 1);
  setSelId(null);
  commit();
}

export function duplicateSel(ed: EditorCtx) {
  const { docRef, pageIndexRef, selId, pendingLockRef, commit, setSelId } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const el = p.els.find((x) => x.id === selId);
  if (!el) return;
  const copy = JSON.parse(JSON.stringify(el)) as El;
  copy.id = uid();
  copy.x += 40; copy.y += 40;
  copy.locked = false;
  p.els.push(copy);
  pendingLockRef.current.add(copy.id);
  commit();
  setSelId(copy.id);
}

/* quick fill/stroke from the format-bar pickers — applies to the selected
   balloon/panel/lettering, or the page background when nothing is selected */
export function applyQuickFill(ed: EditorCtx, opt: { solidColor?: string; gradient?: [string, string]; stops?: GradStop[] }) {
  const { docRef, pageIndexRef, selId, setStatus, commit, setShowFill } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const el = p.els.find((e) => e.id === selId);
  if (el?.locked) { setStatus("That item is locked — unlock it first."); return; }
  const asFill = (): FillStyle => opt.stops
    ? { kind: "gradient", a: opt.stops[0][0], b: opt.stops[opt.stops.length - 1][0], angle: 180, stops: opt.stops }
    : opt.gradient
      ? { kind: "gradient", a: opt.gradient[0], b: opt.gradient[1], angle: 180 }
      : solid(opt.solidColor!);
  if (el && (el.type === "balloon" || el.type === "panel")) {
    el.fill = asFill();
  } else if (el && el.type === "text") {
    if (opt.stops) { el.ts.fillA = opt.stops[0][0]; el.ts.fillB = opt.stops[opt.stops.length - 1][0]; }
    else if (opt.gradient) { el.ts.fillA = opt.gradient[0]; el.ts.fillB = opt.gradient[1]; }
    else { el.ts.fillA = opt.solidColor!; el.ts.fillB = null; }
  } else if (el && el.type === "image") {
    setStatus("Images have no fill — select a balloon, panel or lettering.");
    return;
  } else {
    p.bg = asFill();
  }
  commit();
  setShowFill(false);
}

export function applyQuickStroke(ed: EditorCtx, color: string) {
  const { docRef, pageIndexRef, selId, setStatus, setShowStroke, commit } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const el = p.els.find((e) => e.id === selId);
  if (!el) { setStatus("Select an item to change its stroke."); setShowStroke(false); return; }
  if (el.locked) { setStatus("That item is locked — unlock it first."); return; }
  if (el.type === "balloon") el.stroke = color;
  else if (el.type === "panel" || el.type === "image") {
    el.borderC = color;
    if (!el.borderW) el.borderW = 4;
  } else if (el.type === "text") {
    el.ts.outlineC = color;
    if (!el.ts.outlineW) el.ts.outlineW = Math.max(2, Math.round(el.ts.size * 0.08));
  }
  commit();
  setShowStroke(false);
}

export function copySel(ed: EditorCtx) {
  const { page, selId, clipboardRef, setStatus } = ed;
  const el = page?.els.find((x) => x.id === selId);
  if (!el) return;
  clipboardRef.current = JSON.parse(JSON.stringify(el));
  setStatus("Copied.");
}

export function cutSel(ed: EditorCtx) {
  const { page, selId, setStatus, clipboardRef } = ed;
  const el = page?.els.find((x) => x.id === selId);
  if (!el) return;
  if (el.locked) { setStatus("This item is locked — unlock it to cut."); return; }
  clipboardRef.current = JSON.parse(JSON.stringify(el));
  deleteSel(ed);
}

export function pasteClip(ed: EditorCtx) {
  const { clipboardRef, page, pendingLockRef, commit, setSelId } = ed;
  if (!clipboardRef.current || !page) return;
  const copy = JSON.parse(JSON.stringify(clipboardRef.current)) as El;
  copy.id = uid();
  copy.x += 30; copy.y += 30;
  copy.locked = false;
  page.els.push(copy);
  pendingLockRef.current.add(copy.id);
  commit();
  setSelId(copy.id);
}

export function rotateSel(ed: EditorCtx, delta: number) {
  const { mutateSel } = ed;
  mutateSel((x) => {
    let r = (x.rot || 0) + delta;
    r = ((r % 360) + 360) % 360;   // 0..360
    if (r > 180) r -= 360;          // keep in -180..180
    x.rot = Math.round(r * 10) / 10;
  });
}

export function saveBalloonPreset(ed: EditorCtx) {
  const { selEl, setStatus, savePresets, presets } = ed;
  if (!selEl || selEl.type !== "balloon") { setStatus("Select a balloon to save as a preset."); return; }
  const name = (window.prompt("Name this balloon preset:", "My balloon") || "").trim();
  if (!name) return;
  const s = selEl;
  const preset: BalloonPreset = {
    name, kind: s.kind, fill: JSON.parse(JSON.stringify(s.fill)),
    stroke: s.stroke, strokeW: s.strokeW, shadow: s.shadow,
    ts: JSON.parse(JSON.stringify(s.ts)),
  };
  savePresets([...presets.filter((p) => p.name !== name), preset]);
  setStatus(`Saved balloon preset “${name}”.`);
}

export function applyBalloonPreset(ed: EditorCtx, name: string) {
  const { presets, selEl, setStatus, mutateSel } = ed;
  const p = presets.find((x) => x.name === name);
  if (!p) return;
  if (!selEl || selEl.type !== "balloon") { setStatus("Select a balloon to apply the preset to."); return; }
  mutateSel<BalloonEl>((b) => {
    b.kind = p.kind;
    if (TAILLESS_KINDS.includes(b.kind)) b.tail = null;
    else if (!b.tail) b.tail = { dx: -b.w * 0.25, dy: b.h * 0.85 };
    b.fill = JSON.parse(JSON.stringify(p.fill));
    b.stroke = p.stroke; b.strokeW = p.strokeW; b.shadow = p.shadow;
    b.ts = JSON.parse(JSON.stringify(p.ts));
  });
  setStatus(`Applied preset “${name}”.`);
}

export function deleteBalloonPreset(ed: EditorCtx, name: string) {
  const { savePresets, presets, setStatus } = ed;
  savePresets(presets.filter((p) => p.name !== name));
  setStatus(`Deleted preset “${name}”.`);
}

export function copyStyle(ed: EditorCtx) {
  const { selEl, setStatus, styleClipRef } = ed;
  if (!selEl || (selEl.type !== "text" && selEl.type !== "balloon")) {
    setStatus("Select a balloon or lettering first, then Copy Style.");
    return;
  }
  const s = selEl;
  const clip: Partial<TextStyle> & { fill?: FillStyle; stroke?: string; strokeW?: number } = { ...s.ts };
  if (s.type === "balloon") { clip.fill = JSON.parse(JSON.stringify(s.fill)); clip.stroke = s.stroke; clip.strokeW = s.strokeW; }
  styleClipRef.current = clip;
  setStatus("Style copied — select another balloon or lettering and choose Paste Style.");
}

export function pasteStyle(ed: EditorCtx) {
  const { styleClipRef, setStatus, mutateSel } = ed;
  const clip = styleClipRef.current;
  if (!clip) { setStatus("Copy a style first (Edit → Copy Style)."); return; }
  mutateSel<BalloonEl | TextEl>((x) => {
    const { fill, stroke, strokeW, ...ts } = clip;
    x.ts = { ...x.ts, ...ts };
    if (x.type === "balloon") {
      if (fill) x.fill = JSON.parse(JSON.stringify(fill));
      if (stroke !== undefined) x.stroke = stroke;
      if (strokeW !== undefined) x.strokeW = strokeW;
    }
  });
  setStatus("Style pasted.");
}

/* find & replace across every page (respects locks) */
export function doFindReplace(ed: EditorCtx, all: boolean) {
  const { findText, setStatus, docRef, findCase, replaceText, commit, rebuildThumbs } = ed;
  const needle = findText;
  if (!needle) { setStatus("Enter text to find."); return; }
  const d = docRef.current!;
  const flags = findCase ? "g" : "gi";
  const rx = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags);
  let count = 0;
  for (const p of d.pages) {
    for (const el of p.els) {
      if ((el.type === "text" || el.type === "balloon") && !el.locked && rx.test(el.text)) {
        const before = el.text;
        el.text = all ? el.text.replace(rx, replaceText)
          : el.text.replace(rx, () => { if (count === 0) { count++; return replaceText; } return before.slice(0); });
        if (all) count += (before.match(rx) || []).length;
        if (el.text !== before) el.runs = undefined; // positions changed → drop inline emphasis
        rx.lastIndex = 0;
      }
    }
  }
  if (count) { commit(); rebuildThumbs(); setStatus(`Replaced ${count} occurrence${count > 1 ? "s" : ""} across the document.`); }
  else setStatus(`No matches for “${needle}”.`);
}

export function duplicatePage(ed: EditorCtx) {
  const { docRef, pageIndexRef, setPageIndex, setSelId, commit, rebuildThumbs, setStatus } = ed;
  const d = docRef.current!;
  const src = d.pages[pageIndexRef.current];
  const copy = JSON.parse(JSON.stringify(src)) as Page;
  /* fresh ids — and remap attachTo so joined balloons stay joined on the copy */
  const idMap = new Map<string, string>();
  for (const el of copy.els) { const nid = uid(); idMap.set(el.id, nid); el.id = nid; }
  for (const el of copy.els) {
    if (el.type === "balloon" && el.attachTo) el.attachTo = idMap.get(el.attachTo) ?? null;
  }
  d.pages.splice(pageIndexRef.current + 1, 0, copy);
  setPageIndex(pageIndexRef.current + 1);
  setSelId(null);
  commit();
  rebuildThumbs();
  setStatus("Page duplicated.");
}

export function movePage(ed: EditorCtx, dir: -1 | 1) {
  const { docRef, pageIndexRef, setPageIndex, commit, rebuildThumbs } = ed;
  const d = docRef.current!;
  const i = pageIndexRef.current, j = i + dir;
  if (j < 0 || j >= d.pages.length) return;
  [d.pages[i], d.pages[j]] = [d.pages[j], d.pages[i]];
  setPageIndex(j);
  commit();
  rebuildThumbs();
}


/* Grow a balloon so its lettering fits. Balloons expand as you type rather
   than silently clipping; returns true if the size actually changed. */

/* Every keystroke in a balloon or caption: grow the shape to fit, and put the
   in-progress line into the autosave. React deliberately does not own the
   editable node during editing (see renderEls), so re-rendering here resizes
   the balloon without disturbing the caret. */
export function onLetteringInput(ed: EditorCtx, id: string, dom: HTMLElement) {
  const { docRef, pageIndexRef, force, autosaveSoon } = ed;
  autosaveSoon();
  const d = docRef.current;
  if (!d) return;
  const p = d.pages[pageIndexRef.current];
  const el = p.els.find((x) => x.id === id);
  if (!el || el.type !== "balloon") return;
  const txt = (dom.innerText || "")
    .replace(/\u200b/g, "")            // emphasis caret anchors are not content
    .replace(/\u00a0/g, " ").replace(/\s+$/, "");
  if (growBalloonToFit(p, el as BalloonEl, txt)) force();
}

export function growBalloonToFit(page: Page, el: BalloonEl, textOverride?: string): boolean {
  const text = textOverride ?? el.text;
  if (el.locked || !text.trim()) return false;
  const before = { w: el.w, h: el.h };
  const fitted = fitSize(page, el, text, true);
  if (fitted.w <= el.w && fitted.h <= el.h) return false;
  resizeAround(page, el, Math.max(el.w, fitted.w), Math.max(el.h, fitted.h));
  return el.w !== before.w || el.h !== before.h;
}

/** Size a lettering block to the letters themselves. The selection box used to
    be a fixed slab of the page with the word floating in the middle of it. */
export function sizeTextToContent(el: TextEl, pageW: number) {
  if (!el.text.trim()) return;
  const m = measureBlock(el.ts, el.text, Math.max(el.ts.size * 2, pageW * 0.92));
  const padX = Math.round(el.ts.size * 0.18 + el.ts.outlineW * 1.2);
  const padY = Math.round(el.ts.size * 0.14 + el.ts.outlineW * 1.2);
  el.w = Math.max(24, Math.round(m.w) + padX * 2);
  el.h = Math.max(20, Math.round(m.h) + padY * 2);
}

/** size a freshly created balloon so it just contains its placeholder text */
export function sizeBalloonToText(page: Page, el: BalloonEl) {
  const fitted = fitSize(page, el, el.text, false, 7);
  el.w = fitted.w;
  el.h = fitted.h;
}

/* The usable text area is a fraction of the balloon that changes with the
   balloon's own size, so solving for it takes a couple of passes: measure the
   lettering, resize, re-read the new text rect, measure again. */
function fitSize(page: Page, el: BalloonEl, text: string, growOnly: boolean, wrapEm = 11): { w: number; h: number } {
  const probe = { ...el } as BalloonEl;
  let w = el.w, h = el.h;
  for (let pass = 0; pass < 4; pass++) {
    probe.w = w; probe.h = h;
    const [, , tw, th] = balloonGeom(probe).textRect;
    const fracW = tw / w, fracH = th / h;
    if (!(fracW > 0) || !(fracH > 0)) return { w, h };
    /* wrap at a comfortable measure — a couple of short lines reads better
       than one very long one, and it is what hand lettering does */
    const natural = measureBlock(el.ts, text, 1e6).w;
    const wrapAt = Math.max(el.ts.size * 4, Math.min(natural, el.ts.size * wrapEm));
    const m = measureBlock(el.ts, text, wrapAt);
    const needTW = m.w + el.ts.size * 0.7;
    const needTH = m.h + el.ts.size * 0.5;
    const nextW = clamp(Math.round(needTW / fracW), 70, page.w);
    const nextH = clamp(Math.round(needTH / fracH), 50, page.h);
    const w2 = growOnly ? Math.max(w, nextW) : nextW;
    const h2 = growOnly ? Math.max(h, nextH) : nextH;
    if (Math.abs(w2 - w) < 2 && Math.abs(h2 - h) < 2) { w = w2; h = h2; break; }
    w = w2; h = h2;
  }
  return { w, h };
}

function resizeAround(page: Page, el: BalloonEl, w: number, h: number) {
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  el.w = w; el.h = h;
  el.x = Math.round(clamp(cx - w / 2, 0, Math.max(0, page.w - w)));
  el.y = Math.round(clamp(cy - h / 2, 0, Math.max(0, page.h - h)));
}

export function fitBalloonToText(ed: EditorCtx) {
  const { page, selId, setStatus, mutateSel } = ed;
  const el = page?.els.find((x) => x.id === selId);
  if (!el || el.type !== "balloon") { setStatus("Select a balloon to fit."); return; }
  if (el.locked) { setStatus("That balloon is locked — unlock it to resize."); return; }
  if (!el.text.trim()) { setStatus("Type some text first, then fit the balloon to it."); return; }
  const g = balloonGeom(el);
  const [, , tw, th] = g.textRect;
  const fracW = tw / el.w, fracH = th / el.h;
  if (!(fracW > 0) || !(fracH > 0)) return;
  /* measure the lettering in a hidden node that mirrors on-canvas layout */
  const meas = document.createElement("div");
  const ts = el.ts;
  Object.assign(meas.style, {
    position: "absolute", left: "-9999px", top: "0",
    visibility: "hidden", whiteSpace: "pre",
    fontFamily: (FONTS[ts.font]?.css || FONTS.comicneue.css),
    fontSize: `${ts.size}px`,
    fontWeight: ts.bold ? "700" : "400",
    fontStyle: ts.italic ? "italic" : "normal",
    lineHeight: `${ts.lineHeight ?? 1.05}`,
    letterSpacing: ts.tracking ? `${ts.tracking}px` : "normal",
    textTransform: ts.caps ? "uppercase" : "none",
  } as CSSStyleDeclaration);
  meas.textContent = el.text;
  document.body.appendChild(meas);
  const lineW = meas.scrollWidth;          // longest line (respects manual breaks)
  /* height at that width, allowing wrapping */
  meas.style.whiteSpace = "pre-wrap";
  meas.style.width = `${lineW + 2}px`;
  const lineH = meas.scrollHeight;
  document.body.removeChild(meas);
  const maxTextW = page!.w * 0.9;
  const targetTW = clamp(lineW + ts.size * 0.5, 24, maxTextW);
  const targetTH = lineH + ts.size * 0.35;
  const newW = clamp(Math.round(targetTW / fracW), 60, page!.w);
  const newH = clamp(Math.round(targetTH / fracH), 44, page!.h);
  /* keep the balloon centred while it resizes */
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  mutateSel<BalloonEl>((b) => {
    b.w = newW; b.h = newH;
    b.x = Math.round(cx - newW / 2);
    b.y = Math.round(cy - newH / 2);
  });
  setStatus("Balloon fitted to its lettering.");
}

export function balanceRag(ed: EditorCtx) {
  const { page, selId, setStatus, mutateSel } = ed;
  const el = page?.els.find((x) => x.id === selId);
  if (!el || (el.type !== "balloon" && el.type !== "text")) { setStatus("Select a balloon or text to balance."); return; }
  if (el.locked) { setStatus("That item is locked — unlock it first."); return; }
  const raw = el.text.replace(/\s+/g, " ").trim();
  const words = raw.split(" ").filter(Boolean);
  if (words.length < 2) { setStatus("Nothing to balance."); return; }
  const availW = el.type === "balloon" ? balloonGeom(el).textRect[2] : el.w;
  const ts = el.ts;
  const meas = document.createElement("div");
  Object.assign(meas.style, {
    position: "absolute", left: "-9999px", top: "0", visibility: "hidden",
    whiteSpace: "pre",
    fontFamily: (FONTS[ts.font]?.css || FONTS.comicneue.css),
    fontSize: `${ts.size}px`,
    fontWeight: ts.bold ? "700" : "400",
    fontStyle: ts.italic ? "italic" : "normal",
    letterSpacing: ts.tracking ? `${ts.tracking}px` : "normal",
    textTransform: ts.caps ? "uppercase" : "none",
  } as CSSStyleDeclaration);
  document.body.appendChild(meas);
  const measure = (s: string) => { meas.textContent = s; return meas.scrollWidth; };
  const wordW = words.map(measure);
  const spaceW = measure("x x") - measure("xx");
  document.body.removeChild(meas);
  const linesAt = (maxW: number) => {
    let lines = 1, cur = 0;
    for (const w of wordW) {
      if (cur === 0) cur = w;
      else if (cur + spaceW + w <= maxW) cur += spaceW + w;
      else { lines++; cur = w; }
    }
    return lines;
  };
  const targetLines = linesAt(availW);
  if (targetLines <= 1) { setStatus("Text already fits on one line."); return; }
  /* smallest max-width that still yields the same number of lines → even rag */
  let lo = Math.max(...wordW), hi = availW;
  for (let it = 0; it < 40 && hi - lo > 0.5; it++) {
    const mid = (lo + hi) / 2;
    if (linesAt(mid) <= targetLines) hi = mid; else lo = mid;
  }
  const W = hi;
  const out: string[] = [];
  let cur = "", curW = 0;
  for (let i = 0; i < words.length; i++) {
    if (cur === "") { cur = words[i]; curW = wordW[i]; }
    else if (curW + spaceW + wordW[i] <= W) { cur += " " + words[i]; curW += spaceW + wordW[i]; }
    else { out.push(cur); cur = words[i]; curW = wordW[i]; }
  }
  if (cur) out.push(cur);
  mutateSel<BalloonEl | TextEl>((x) => { x.text = out.join("\n"); x.runs = undefined; });
  setStatus(`Balanced into ${out.length} even line${out.length > 1 ? "s" : ""}.`);
}

export function importScript(ed: EditorCtx) {
  const { scriptText, setStatus, docRef, pageIndexRef, activeStyleRef, commit, rebuildThumbs, setShowScript, setScriptText, setSelId } = ed;
  const items = parseScript(scriptText);
  if (!items.length) { setStatus("No dialogue found — use CHARACTER: text (one per line)."); return; }
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const colW = Math.round(p.w * 0.42);
  const gap = Math.round(p.w * 0.03);
  const m0 = Math.round(p.w * 0.06);
  let x = m0, y = m0;
  let count = 0;
  for (const it of items) {
    const lineCt = Math.max(1, Math.ceil(it.text.length / 26));
    let el: El;
    if (it.kind === "sfx") {
      el = makeText(x, y, colW, Math.round(p.w * 0.16), true);
      const st = LETTER_STYLES.find((s) => s.name === activeStyleRef.current) || LETTER_STYLES[0];
      (el as TextEl).ts = applyLetterStyle((el as TextEl).ts, st);
      (el as TextEl).ts.outlineW = Math.round((el as TextEl).ts.size * st.outlineF);
      el.text = it.text;
    } else {
      const kind = (["caption", "thought", "whisper", "exclaim"].includes(it.kind) ? it.kind : "speech") as BalloonKind;
      const h = clamp(Math.round(lineCt * p.w * 0.05 + p.w * 0.06), Math.round(p.w * 0.12), Math.round(p.h * 0.4));
      el = makeBalloon(kind, x, y, colW, h);
      el.text = it.text;
    }
    p.els.push(el);
    count++;
    y += el.h + gap;
    if (y > p.h * 0.9) { y = m0; x += colW + gap; if (x + colW > p.w) x = m0; }
  }
  commit();
  rebuildThumbs();
  setShowScript(false);
  setScriptText("");
  setSelId(null);
  setStatus(`Added ${count} item${count > 1 ? "s" : ""} from your script.`);
}

export function alignSel(ed: EditorCtx, mode: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
  const { page, selId, setStatus, commit } = ed;
  const el = page?.els.find((x) => x.id === selId);
  if (!el || !page) return;
  if (el.locked) { setStatus("This item is locked."); return; }
  const def = Math.round(page.w * 0.035);
  const m = page.margin ?? { t: def, r: def, b: def, l: def };
  if (mode === "left") el.x = m.l;
  if (mode === "hcenter") el.x = Math.round((page.w - el.w) / 2);
  if (mode === "right") el.x = page.w - m.r - el.w;
  if (mode === "top") el.y = m.t;
  if (mode === "vcenter") el.y = Math.round((page.h - el.h) / 2);
  if (mode === "bottom") el.y = page.h - m.b - el.h;
  commit();
}

export async function resizeToActual(ed: EditorCtx) {
  const { page, selId, assetsRef, setStatus, commit } = ed;
  const el = page?.els.find((x) => x.id === selId);
  if (!el || (el.type !== "image" && el.type !== "panel") || !el.img) return;
  if (el.locked) { setStatus("This item is locked."); return; }
  const src = assetsRef.current[el.img];
  if (!src) return;
  const img = await loadImage(src);
  el.w = img.naturalWidth; el.h = img.naturalHeight;
  commit();
}

export function reorder(ed: EditorCtx, delta: number) {
  const { docRef, pageIndexRef, selId, commit } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const i = p.els.findIndex((x) => x.id === selId);
  if (i < 0) return;
  const [el] = p.els.splice(i, 1);
  p.els.splice(clamp(i + delta, 0, p.els.length), 0, el);
  commit();
}

const TRAY_NON_BALLOON = ["panel", "image", "sfx", "text"];

export function addFromTray(ed: EditorCtx, kind: string) {
  const { docRef, pageIndexRef, fileImageRef, activeStyleRef, activeShapeRef,
    pendingLockRef, commit, setSelId, selId, setStatus } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];

  /* a balloon is selected and the user picked another balloon shape: swap the
     selection over to it rather than dropping a second balloon on the page */
  if (!TRAY_NON_BALLOON.includes(kind)) {
    const sel = p.els.find((x) => x.id === selId);
    if (sel && sel.type === "balloon") {
      if (sel.locked) { setStatus("That balloon is locked — unlock it to change its shape."); return; }
      const b = sel as BalloonEl;
      const wasCaption = TAILLESS_KINDS.includes(b.kind);
      const nowCaption = TAILLESS_KINDS.includes(kind as BalloonKind);
      b.kind = kind as BalloonKind;
      /* captions have no tail; give one back when leaving caption shapes */
      if (nowCaption) b.tail = null;
      else if (wasCaption && !b.tail) b.tail = { dx: Math.round(b.w * 0.2), dy: Math.round(b.h * 0.75) };
      commit();
      return;
    }
  }
  const n = p.els.length % 5;
  const spawn = (w: number, h: number) =>
    ({ x: Math.round(p.w / 2 - w / 2 + n * 40), y: Math.round(p.h * 0.3 + n * 40), w, h });
  let el: El | null = null;
  if (kind === "panel") {
    const w = Math.round(p.w * 0.42), h = Math.round(w * 0.75);
    const s = spawn(w, h);
    el = makePanel(s.x, s.y, w, h);
  } else if (kind === "image") {
    fileImageRef.current?.click();
    return;
  } else if (kind === "sfx" || kind === "text") {
    const w = Math.round(p.w * 0.4), h = Math.round(p.w * (kind === "sfx" ? 0.18 : 0.12));
    const s = spawn(w, h);
    const t = makeText(s.x, s.y, w, h, kind === "sfx");
    if (kind === "sfx") {
      /* new lettering uses the active style from the STYLES panel */
      const st = LETTER_STYLES.find((x) => x.name === activeStyleRef.current) || LETTER_STYLES[0];
      t.ts = applyLetterStyle(t.ts, st);
      t.ts.outlineW = Math.round(t.ts.size * st.outlineF);
    }
    sizeTextToContent(t, p.w);
    t.x = Math.round(s.x + (w - t.w) / 2);
    t.y = Math.round(s.y + (h - t.h) / 2);
    el = t;
  } else {
    const caption = TAILLESS_KINDS.includes(kind as BalloonKind);
    const w = Math.round(p.w * (caption ? 0.36 : 0.34));
    const h = caption ? Math.round(w * 0.32) : Math.round(w * 0.62);
    const s = spawn(w, h);
    const b = makeBalloon(kind as BalloonKind, s.x, s.y, w, h);
    /* a new balloon should hug its placeholder, not sprawl across the page */
    sizeBalloonToText(p, b);
    b.x = Math.round(s.x + (w - b.w) / 2);
    b.y = Math.round(s.y + (h - b.h) / 2);
    /* new balloons use the colourway picked in the STYLES panel */
    const list = caption ? BOX_STYLES : BALLOON_STYLES;
    const want = caption ? activeShapeRef.current.box : activeShapeRef.current.balloon;
    const st = list.find((x) => x.name === want);
    if (st) applyShapeStyle(b, st);
    el = b;
  }
  if (el) {
    p.els.push(el);
    pendingLockRef.current.add(el.id);
    commit();
    setSelId(el.id);
  }
}

export async function uploadAsset(kind: "font" | "stamp", name: string, data: string): Promise<string | null> {
  try {
    const res = await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, data }),
    });
    if (!res.ok) return null;
    return (await res.json()).id as string;
  } catch { return null; }
}

export async function importFontFiles(ed: EditorCtx, files: File[]) {
  const { registerRuntimeFont, setStatus, customFontIdsRef } = ed;
  let list: { key: string; label: string; family: string; data: string }[] = [];
  try { list = JSON.parse(localStorage.getItem("lmc.fonts") || "[]"); } catch { /* ignore */ }
  for (const f of files) {
    const label = f.name.replace(/\.(ttf|otf|woff2?)$/i, "");
    const key = "custom_" + label.toLowerCase().replace(/\W+/g, "");
    const family = "LMC " + label;
    const data = await readAsDataURL(f);
    const rec = { key, label, family, data };
    await registerRuntimeFont(rec);
    if (!FONTS[key]) { setStatus(`Could not load font "${f.name}".`); continue; }
    list = [...list.filter((x) => x.key !== key), rec];
    const serverId = await uploadAsset("font", label, data);
    if (serverId) customFontIdsRef.current[key] = serverId;
  }
  try { localStorage.setItem("lmc.fonts", JSON.stringify(list)); } catch { /* cache only */ }
  setStatus("Font imported — find it under “My Fonts”. It's saved to your account and follows you to any computer.");
}

export async function deleteCustomFont(ed: EditorCtx, key: string) {
  const { customFontIdsRef, bumpFonts } = ed;
  const serverId = customFontIdsRef.current[key];
  if (serverId) fetch(`/api/assets/${serverId}`, { method: "DELETE" }).catch(() => { });
  delete customFontIdsRef.current[key];
  delete FONTS[key];
  bumpFonts();
  try {
    const list = JSON.parse(localStorage.getItem("lmc.fonts") || "[]").filter((x: { key: string }) => x.key !== key);
    localStorage.setItem("lmc.fonts", JSON.stringify(list));
  } catch { /* ignore */ }
}

export async function importStampFiles(ed: EditorCtx, files: File[]) {
  const { customStamps, setCustomStamps, setStatus } = ed;
  const list = [...customStamps];
  for (const f of files) {
    const url = await readAsDataURL(f);
    const serverId = await uploadAsset("stamp", f.name.replace(/\.\w+$/, ""), url);
    list.push({ id: serverId || crypto.randomUUID(), url, serverId: serverId || undefined });
  }
  setCustomStamps(list);
  try { localStorage.setItem("lmc.stamps", JSON.stringify(list)); } catch { /* cache only */ }
  setStatus("Stamps added — saved to your account library.");
}

/* Drop a built-in SFX stamp on the page. It is fetched once and then kept in
   the local artwork store like any other image, so the page still renders it
   after a refresh without going back to the network. */
export async function insertSfxStamp(ed: EditorCtx, slug: string, label: string) {
  const { aidRef, setStampOpen, setStatus } = ed;
  setStampOpen(false);
  try {
    const res = await fetch(`/stamps/${slug}.png`);
    if (!res.ok) throw new Error(res.statusText);
    const blob = await res.blob();
    const aid = nextAid(ed);
    const url = await stashArt(ed, aid, blob);
    const img = await loadImage(url);
    placeAsset(ed, aid, img.naturalWidth, img.naturalHeight);
  } catch {
    setStatus(`Could not load the “${label}” stamp.`);
  }
}

export async function insertCustomStamp(ed: EditorCtx, url: string) {
  const { aidRef, setStampOpen } = ed;
  const img = await loadImage(url);
  const aid = nextAid(ed);
  await stashDataUrl(ed, aid, url);
  placeAsset(ed, aid, img.naturalWidth, img.naturalHeight);
  setStampOpen(false);
}

export function removeCustomStamp(ed: EditorCtx, id: string) {
  const { customStamps, setCustomStamps } = ed;
  const gone = customStamps.find((s) => s.id === id);
  if (gone?.serverId) fetch(`/api/assets/${gone.serverId}`, { method: "DELETE" }).catch(() => { });
  const list = customStamps.filter((s) => s.id !== id);
  setCustomStamps(list);
  try { localStorage.setItem("lmc.stamps", JSON.stringify(list)); } catch { /* ignore */ }
}

export const readAsDataURL = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result as string);
  r.onerror = rej;
  r.readAsDataURL(f);
});

export function placeAsset(ed: EditorCtx, aid: string, natW: number, natH: number, x?: number, y?: number) {
  const { docRef, pageIndexRef, pendingLockRef, commit, setSelId } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const w = Math.min(Math.round(p.w * 0.45), natW);
  const h = Math.round(w * (natH / natW));
  const el = makeImage(Math.round((x ?? p.w / 2) - w / 2), Math.round((y ?? p.h / 2) - h / 2), w, h, aid);
  p.els.push(el);
  pendingLockRef.current.add(el.id);
  commit();
  setSelId(el.id);
}

export async function importPdfFile(ed: EditorCtx, f: File, x?: number, y?: number) {
  const { setStatus, aidRef, assetsRef } = ed;
  setStatus("Rendering PDF…");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
  const n = Math.min(pdf.numPages, 10);
  let first: { aid: string; w: number; h: number } | null = null;
  for (let i = 1; i <= n; i++) {
    const pg = await pdf.getPage(i);
    const vp1 = pg.getViewport({ scale: 1 });
    const scale = Math.min(3, 1600 / vp1.width);
    const vp = pg.getViewport({ scale });
    const c = document.createElement("canvas");
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await pg.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp }).promise;
    const aid = nextAid(ed);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    const url = blob ? await stashArt(ed, aid, blob) : c.toDataURL("image/png");
    if (!blob) assetsRef.current[aid] = url;
    await loadImage(url);
    if (!first) first = { aid, w: c.width, h: c.height };
  }
  if (first) placeAsset(ed, first.aid, first.w, first.h, x, y);
  setStatus(`Imported ${n} PDF page${n > 1 ? "s" : ""} — extra pages are in the Photos tab.`);
}

export async function importImageFile(ed: EditorCtx, f: File, x?: number, y?: number) {
  const { aidRef, assetsRef } = ed;
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
    await importPdfFile(ed, f, x, y);
    return;
  }
  const aid = nextAid(ed);
  const url = await stashArt(ed, aid, f);
  const img = await loadImage(url);
  placeAsset(ed, aid, img.naturalWidth, img.naturalHeight, x, y);
}

/* Put artwork in the local store as a Blob and hand back a URL the canvas and
   <img> can use. Never base64: a 40MB scan becomes a 53MB string on the JS
   heap, and a book's worth of those will take the tab down. */
/* Export walks every page, but pages only materialise their artwork as they
   are visited — so bring the whole book in first or the unvisited pages render
   blank. */
export async function ensureAllArt(ed: EditorCtx) {
  const { docRef, assetsRef } = ed;
  const d = docRef.current;
  if (!d) return;
  const want: string[] = [];
  for (const pg of d.pages) {
    for (const e of pg.els) {
      const id = "img" in e ? (e.img as string | null) : null;
      if (id && !assetsRef.current[id]) want.push(id);
    }
  }
  if (!want.length) return;
  for (const id of await ensureArt(want)) assetsRef.current[id] = artUrl(id)!;
}

/* Generated artwork (tuck cutouts, instant-alpha copies, stamps) arrives as a
   data URL. It still has to reach the artwork store or the element it belongs
   to comes back from a refresh with nothing to draw. */
export async function stashDataUrl(ed: EditorCtx, aid: string, dataUrl: string): Promise<string> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    return await stashArt(ed, aid, blob);
  } catch {
    ed.assetsRef.current[aid] = dataUrl;   // still usable this session
    return dataUrl;
  }
}

/* Hand out an artwork id nothing else is using.

   A bare counter is not enough. It is seeded from what is loaded, and a book's
   artwork is deliberately NOT all loaded — so the counter could restart low
   and re-issue an id another page was already using. The store then wrote the
   new bytes over the old page's artwork and served the old page's picture for
   the new one, which is what "I dragged in page 13 and page 7 appeared" was.
   Check every id that could exist before using one. */
export function nextAid(ed: EditorCtx): string {
  const { aidRef, assetsRef, docRef } = ed;
  const used = new Set<string>(Object.keys(assetsRef.current));
  const d = docRef.current;
  if (d) {
    for (const pg of d.pages) {
      for (const e of pg.els) {
        const id = "img" in e ? (e.img as string | null) : null;
        if (id) used.add(id);
      }
    }
  }
  let id = "a" + aidRef.current++;
  while (used.has(id) || artIdTaken(id)) id = "a" + aidRef.current++;
  noteArtId(id);
  return id;
}

export async function stashArt(ed: EditorCtx, aid: string, blob: Blob): Promise<string> {
  const { assetsRef, setStatus } = ed;
  /* first artwork of the session: ask the browser to stop treating this
     origin as evictable, so a big book is not cleared out when disk gets tight */
  if (!askedToPersist) { askedToPersist = true; requestPersistence(); }
  const ok = await putArt(aid, blob);
  const url = holdArt(aid, blob);
  assetsRef.current[aid] = url;
  if (!ok) {
    const est = await storageEstimate();
    setStatus(est && est.quota
      ? `Could not store this artwork on this computer — ${fmtBytes(est.usage)} of ${fmtBytes(est.quota)} used. Free some disk space, or it will not survive a refresh.`
      : "Could not store this artwork on this computer — it will not survive a refresh. Check your browser's storage settings.");
    return url;
  }
  /* warn while there is still room to do something about it */
  const est = await storageEstimate();
  if (est && est.quota && est.usage / est.quota > 0.8) {
    setStatus(`Artwork stored — ${fmtBytes(est.usage)} of ${fmtBytes(est.quota)} of local storage used. Export or free disk space before adding many more pages.`);
  }
  return url;
}

let askedToPersist = false;

/* Instant Alpha: flood-remove the background color from the image edges. */
export async function runInstantAlpha(ed: EditorCtx, elId: string, aid: string) {
  const { assetsRef, setStatus, aidRef, docRef, pageIndexRef, commit } = ed;
  const tolStr = window.prompt("Background removal strength (1–100):", "30");
  if (!tolStr) return;
  const tol = clamp(+tolStr || 30, 1, 100);
  const src = assetsRef.current[aid];
  if (!src) return;
  setStatus("Removing background…");
  const img = await loadImage(src);
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, W, H);
  const d = imgData.data;
  const thr2 = (tol * 4.41) ** 2;
  const visited = new Uint8Array(W * H);
  for (const [sx, sy] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) {
    const si = sy * W + sx;
    if (visited[si]) continue;
    const sr = d[si * 4], sg = d[si * 4 + 1], sb = d[si * 4 + 2];
    const q = [si];
    visited[si] = 1;
    while (q.length) {
      const i = q.pop()!;
      const o = i * 4;
      const dr = d[o] - sr, dg = d[o + 1] - sg, db = d[o + 2] - sb;
      if (dr * dr + dg * dg + db * db > thr2) continue;
      d[o + 3] = 0;
      const px = i % W, py = (i / W) | 0;
      if (px > 0 && !visited[i - 1]) { visited[i - 1] = 1; q.push(i - 1); }
      if (px < W - 1 && !visited[i + 1]) { visited[i + 1] = 1; q.push(i + 1); }
      if (py > 0 && !visited[i - W]) { visited[i - W] = 1; q.push(i - W); }
      if (py < H - 1 && !visited[i + W]) { visited[i + W] = 1; q.push(i + W); }
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const url = c.toDataURL("image/png");
  const newAid = nextAid(ed);
  await stashDataUrl(ed, newAid, url);
  await loadImage(url);
  const p = docRef.current!.pages[pageIndexRef.current];
  const el = p.els.find((e) => e.id === elId);
  if (el && (el.type === "image" || el.type === "panel")) {
    el.img = newAid;
    commit();
    setStatus("Background removed — undo (Ctrl+Z) if it took too much.");
  }
}

export function hitElAt(ed: EditorCtx, x: number, y: number): El | null {
  const { docRef, pageIndexRef } = ed;
  const p = docRef.current!.pages[pageIndexRef.current];
  for (let i = p.els.length - 1; i >= 0; i--) {
    const el = p.els[i];
    if (x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h) return el;
  }
  return null;
}

export async function onDrop(ed: EditorCtx, e: React.DragEvent) {
  const { pagePoint, aidRef, assetsRef, commit, setSelId, setStatus } = ed;
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])].filter(
    (f) => f.type.startsWith("image/") || f.type === "application/pdf" || /\.pdf$/i.test(f.name));
  if (!files.length) return;
  const pt = pagePoint(e);
  let off = 0;
  for (const f of files) {
    const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
    /* dropping an image onto a balloon or panel fills it in place */
    const target = !isPdf && off === 0 ? hitElAt(ed, pt.x, pt.y) : null;
    if (target && (target.type === "balloon" || target.type === "panel" || target.type === "image") && !target.locked) {
      const url = await readAsDataURL(f);
      const img = await loadImage(url);
      const aid = nextAid(ed);
      assetsRef.current[aid] = url;
      target.img = aid;
      /* a bare image element is the picture, not a frame — see fitBoxToArt */
      if (target.type === "image") fitBoxToArt(target, img);
      commit();
      setSelId(target.id);
      setStatus(target.type === "balloon" ? "Image placed inside the balloon." : "Image placed in the panel.");
    } else {
      await importImageFile(ed, f, pt.x + off, pt.y + off);
    }
    off += 60;
  }
}

/* Artwork is drawn object-fit: cover, so anything whose box is not the
   artwork's shape gets silently cropped.

   For a PANEL or a BALLOON that is the point — the frame is the frame, and
   the art fills it. But an IMAGE element has no frame of its own: the box IS
   the picture, so keeping a stale box just eats the edges of the art with
   nothing on screen to say so. Reshape it around its centre instead. */
export function fitBoxToArt(el: { x: number; y: number; w: number; h: number }, img: HTMLImageElement) {
  if (!img.naturalWidth || !img.naturalHeight) return;
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  /* keep the area it already occupies, so it does not jump in size */
  const area = el.w * el.h;
  const ar = img.naturalWidth / img.naturalHeight;
  const w = Math.max(1, Math.round(Math.sqrt(area * ar)));
  const h = Math.max(1, Math.round(w / ar));
  el.x = Math.round(cx - w / 2); el.y = Math.round(cy - h / 2);
  el.w = w; el.h = h;
}

export async function assignImageToPanel(ed: EditorCtx, elId: string, aid: string) {
  const { docRef, pageIndexRef, assetsRef, commit } = ed;
  const d = docRef.current!;
  const p = d.pages[pageIndexRef.current];
  const el = p.els.find((x) => x.id === elId);
  if (!el || (el.type !== "panel" && el.type !== "image" && el.type !== "balloon")) return;
  el.img = aid;
  const img = await loadImage(assetsRef.current[aid]);
  if (el.type === "image") fitBoxToArt(el, img);
  commit();
}

/* Un-crop: give a panel the artwork's shape without changing how much room it
   takes on the page. The one-click answer to "why is my art cut off". */
export async function fitToArtwork(ed: EditorCtx) {
  const { page, selId, assetsRef, setStatus, commit } = ed;
  const el = page?.els.find((x) => x.id === selId);
  if (!el || (el.type !== "image" && el.type !== "panel") || !el.img) return;
  if (el.locked) { setStatus("This item is locked."); return; }
  const src = assetsRef.current[el.img];
  if (!src) return;
  fitBoxToArt(el, await loadImage(src));
  commit();
  setStatus("Frame reshaped to the artwork — nothing is cropped now.");
}

/* Drop a finished page onto the page. `fill` runs the art to the page edges
   and past them where the shapes differ (full bleed, what page art is for);
   otherwise the whole image is brought inside the page with nothing lost.
   Either way the aspect ratio is kept — the art is never stretched. */
export async function fitToPage(ed: EditorCtx, fill: boolean) {
  const { page, selId, assetsRef, setStatus, commit } = ed;
  const el = page?.els.find((x) => x.id === selId);
  if (!el || (el.type !== "image" && el.type !== "panel") || !el.img || !page) return;
  if (el.locked) { setStatus("This item is locked."); return; }
  const src = assetsRef.current[el.img];
  if (!src) return;
  const img = await loadImage(src);
  if (!img.naturalWidth || !img.naturalHeight) return;
  const ar = img.naturalWidth / img.naturalHeight;
  const pageAr = page.w / page.h;
  /* fill wants the SHORT side covered, fit wants the LONG side contained */
  const widthLed = fill ? ar < pageAr : ar > pageAr;
  const w = widthLed ? page.w : Math.round(page.h * ar);
  const h = widthLed ? Math.round(page.w / ar) : page.h;
  el.w = w; el.h = h;
  el.x = Math.round((page.w - w) / 2);
  el.y = Math.round((page.h - h) / 2);
  el.rot = 0;
  commit();
  const over = fill && (w > page.w || h > page.h);
  setStatus(fill
    ? over
      ? `Page art placed full bleed — it runs ${((Math.max(w - page.w, h - page.h) / 2) / DPI).toFixed(2)}in past the page, so trim has something to cut into.`
      : "Page art placed full bleed."
    : "Page art fitted inside the page — nothing cropped.");
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

export async function saveProject(ed: EditorCtx, saveAs: boolean) {
  const { demo, setStatus, current, setCurrent, docRef, assetsRef } = ed;
  if (demo) { setStatus("Saving is off in the demo — subscribe to save your comics to your library."); return; }
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
    docRef.current = payload.doc;
    /* a loaded document owns the artwork slate — drop the previous book's
       local blobs so the store does not accumulate orphans */
    releaseAllArt(); await clearArt();
    assetsRef.current = payload.assets || {};
    reseedIds(docRef.current!);
    reseedAids();
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

export function exportJSON(ed: EditorCtx) {
  const { demo, setStatus, docRef, assetsRef, current } = ed;
  if (demo) { setStatus("Export is off in the demo — subscribe to unlock."); return; }
  const blob = new Blob([JSON.stringify({ doc: docRef.current, assets: portableAssets(assetsRef.current).assets })], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = (current?.name || "comic-project") + ".json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function importJSON(ed: EditorCtx, f: File) {
  const { docRef, assetsRef, reseedAids, histRef, hIndexRef, setCurrent, setSelId, setEditingId, setPageIndex, setThumbs, autosave, force, fitZoom, setStatus } = ed;
  try {
    const payload = JSON.parse(await f.text());
    const d: Doc = payload.doc ?? payload;
    if (d?.app !== "comiclettering" || !Array.isArray(d.pages) || d.pages.length === 0) throw new Error("not a ComicLettering project");
    if ((d as { version?: number }).version !== 2) throw new Error("this file is from an old version");
    docRef.current = d;
    /* a loaded document owns the artwork slate — drop the previous book's
       local blobs so the store does not accumulate orphans */
    releaseAllArt(); await clearArt();
    assetsRef.current = payload.assets || {};
    reseedIds(d);
    reseedAids();
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
  await ensureAllArt(ed);
  for (let i = 0; i < d.pages.length; i++) {
    setStatus(`Exporting page ${i + 1}/${d.pages.length}…`);
    await exportPagePNG(d.pages[i], assetsRef.current, `comic-page-${i + 1}.png`);
  }
  setStatus(`Exported ${d.pages.length} page${d.pages.length > 1 ? "s" : ""}.`);
}

export async function runExport(
  ed: EditorCtx,
  format: ImageFormat | "pdf" | "cbz",
  scope: "current" | "all" | "range", dpi: number
) {
  const { demo, setStatus, setShowExport, docRef, current, pageIndexRef,
    exportFrom, exportTo, letteringOnly, exportCropMarks, assetsRef } = ed;
  if (demo) { setStatus("Export is off in the demo — subscribe to export print-ready pages."); setShowExport(false); return; }
  setStatus("Loading artwork…");
  await ensureAllArt(ed);
  const d = docRef.current!;
  const nameBase = (current?.name || "comic").replace(/[^\w\- ]+/g, "");
  const idxs =
    scope === "current" ? [pageIndexRef.current]
      : scope === "all" ? d.pages.map((_, i) => i)
      : d.pages.map((_, i) => i).filter((i) =>
          i + 1 >= Math.min(exportFrom, exportTo) && i + 1 <= Math.max(exportFrom, exportTo));
  if (!idxs.length) { setStatus("No pages in that range."); return; }
  try {
    if (format === "pdf") {
      const sub = { ...d, pages: idxs.map((i) => d.pages[i]) };
      const { exportPdf } = await import("@/lib/pdfExport");
      await exportPdf(sub, assetsRef.current, `${nameBase}.pdf`, (i, n) => setStatus(`Rendering PDF page ${i}/${n}…`), dpi, exportCropMarks);
    } else if (format === "cbz") {
      const { exportCbz } = await import("@/lib/cbz");
      await exportCbz(d, assetsRef.current, `${nameBase}.cbz`, dpi, idxs, (i, n) => setStatus(`Packing CBZ page ${i}/${n}…`));
    } else {
      const fmt = letteringOnly ? "png" : format; // transparency needs PNG
      for (const pi of idxs) {
        setStatus(`Exporting page ${pi + 1} (${fmt.toUpperCase()} @ ${dpi} dpi${letteringOnly ? ", lettering only" : ""})…`);
        const suffix = letteringOnly ? "-lettering" : "";
        await exportPageImage(d.pages[pi], assetsRef.current, `${nameBase}-page-${pi + 1}${suffix}.${fmt}`, fmt, dpi, letteringOnly);
      }
    }
    setStatus("Export complete.");
    setShowExport(false);
  } catch (err) {
    setStatus("Export failed: " + String(err).slice(0, 120));
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
