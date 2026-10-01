"use client";
/* ComicLettering Studio — shared text/lettering helpers, constants and types
   split out of Editor.tsx (module-level code, unchanged). */
import React, { CSSProperties, ReactNode } from "react";
import {
  BalloonKind, El, FONTS, FillStyle, TextRun, TextStyle, applyCrossbarI, lightenHex,
} from "@/lib/model";
import { LetterStyle } from "@/lib/presets";
import { ADJUST_META } from "@/lib/pageAdjust";
import { fontString } from "@/lib/exportPng";
import { BrushKey, brushScale, brushURL } from "@/lib/brushes";
import { glowFilter } from "@/lib/glows";

export const HINT = "Double-click a balloon to type · orange dot aims the tail · drop images onto the page · Del removes";

export type BalloonPreset = {
  name: string; kind: BalloonKind; fill: FillStyle;
  stroke: string; strokeW: number; shadow: boolean; ts: TextStyle;
};
export const PRESET_KEY = "lmc.balloonPresets";

/* ---------------- small shared helpers ---------------- */

export function textCss(ts: TextStyle): CSSProperties {
  const st: CSSProperties & Record<string, string | number> = {
    fontFamily: FONTS[ts.font]?.css || FONTS.comicneue.css,
    fontSize: ts.size,
    fontWeight: ts.bold ? 700 : 400,
    fontStyle: ts.italic ? "italic" : "normal",
    textAlign: ts.align,
    textDecoration: ts.underline ? "underline" : "none",
    textTransform: ts.caps ? "uppercase" : "none",
    lineHeight: ts.lineHeight ?? 1.05,
    letterSpacing: ts.tracking ? `${ts.tracking}px` : "normal",
  };
  if (ts.fillB) {
    /* glossy 3-stop gradient: highlight → colour → depth */
    st.backgroundImage = `linear-gradient(180deg, ${lightenHex(ts.fillA, 0.55)} 0%, ${ts.fillA} 38%, ${ts.fillB} 100%)`;
    st.WebkitBackgroundClip = "text";
    st.backgroundClip = "text";
    st.color = "transparent";
  } else {
    st.color = ts.fillA;
  }
  if (ts.outlineW > 0) {
    st.WebkitTextStroke = `${ts.outlineW}px ${ts.outlineC}`;
    st.paintOrder = "stroke fill";
  }
  if (ts.brush && ts.brush !== "none") {
    /* the brush is a mask, so it bites into whatever fill, gradient and
       outline the lettering already carries rather than replacing them */
    const url = brushURL(ts.brush as BrushKey);
    if (url) {
      const px = `${brushScale(ts.size)}px`;
      st.WebkitMaskImage = `url(${url})`;
      st.maskImage = `url(${url})`;
      st.WebkitMaskSize = px;
      st.maskSize = px;
      st.WebkitMaskRepeat = "repeat";
      st.maskRepeat = "repeat";
    }
  }
  /* glow sits behind the drop shadow so the halo reads around the whole
     letterform, brush texture and all — filters apply after the mask */
  const glow = ts.glow && ts.glow !== "none" ? glowFilter(ts.glow, ts.size, ts.glowW ?? 1) : "";
  const drop = ts.shadow
    ? `drop-shadow(${ts.size * 0.05}px ${ts.size * 0.05}px ${ts.size * 0.06}px ${ts.shadowC || "#00000088"})`
    : "";
  const chain = [glow, drop].filter(Boolean).join(" ");
  if (chain) st.filter = chain;
  return st;
}

/* while the words are being typed the caret must stay visible: a gradient
   fill paints the text transparent (and the caret is currentColor), a
   brush mask eats the caret along with the letters' gaps, and a drop
   shadow/glow filter blurs it. Plain fill and outline stay so the words
   still look like themselves. */
export function editingCss(ts: TextStyle): CSSProperties {
  return {
    caretColor: ts.fillA || "#000",
    WebkitMaskImage: "none", maskImage: "none",
    filter: "none",
  } as CSSProperties;
}

/* small field helper — MODULE level: defining it inside Editor would make it
   a new component type each render, unmounting inspector inputs on every
   keystroke (focus loss after one character) */
export const Fld = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="fld"><label>{label}</label>{children}</div>
);

/* apply crossbar-I for static display (not while editing) */
export function displayText(text: string, ts: TextStyle, editing: boolean): string {
  if (editing || !ts.crossbarI) return text;
  return applyCrossbarI(ts.caps ? text.toUpperCase() : text);
}

/* ---- inline emphasis (rich text runs) ---- */
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ---- inline emphasis toggling ----

   Chromium handles Ctrl+B/I on a contentEditable itself, and when the style
   is switched OFF at a collapsed caret it leaves the caret INSIDE the <b> it
   just closed. The next character therefore lands back inside the bold run
   while the space that preceded it stays outside, so "Plain **bold** tail"
   commits as "Plain **boldtail**". We take the shortcut over and park the
   caret in a zero-width anchor in the correct context, so whatever is typed
   next lands where the user is looking. */
export const ZWSP = "\u200b";

function emphasisAncestor(node: Node | null, kind: "bold" | "italic" | "underline", root: HTMLElement): HTMLElement | null {
  let found: HTMLElement | null = null;
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const e = n as HTMLElement;
      const tag = e.tagName.toLowerCase();
      const fw = e.style?.fontWeight;
      const isBold = tag === "b" || tag === "strong" || fw === "bold" || (!!fw && +fw >= 600);
      const isItal = tag === "i" || tag === "em" || e.style?.fontStyle === "italic";
      const isUnder = tag === "u" || !!e.style?.textDecoration?.includes("underline");
      if (kind === "bold" ? isBold : kind === "italic" ? isItal : isUnder) found = e;   // keep going: take the outermost
    }
    n = n.parentNode;
  }
  return found;
}

/** Toggle bold/italic on the editable node. Returns false if it could not. */
export function toggleEmphasis(root: HTMLElement, kind: "bold" | "italic" | "underline"): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) return false;
  const wasOn = document.queryCommandState(kind);
  document.execCommand(kind);
  if (!sel.isCollapsed) return true;

  const range = sel.getRangeAt(0);
  const anchor = document.createTextNode(ZWSP);
  if (wasOn) {
    /* just switched OFF — step out of the formatting element so the next
       keystroke is plain, instead of landing back inside it */
    const host = emphasisAncestor(range.startContainer, kind, root);
    if (!host || !host.parentNode) return true;
    host.parentNode.insertBefore(anchor, host.nextSibling);
  } else {
    /* just switched ON — make sure there is a formatting element to type into */
    const host = emphasisAncestor(range.startContainer, kind, root);
    if (host) return true;
    const wrap = document.createElement(kind === "bold" ? "b" : kind === "italic" ? "i" : "u");
    wrap.appendChild(anchor);
    range.insertNode(wrap);
  }
  const after = document.createRange();
  after.setStart(anchor, anchor.length);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  return true;
}

export function runsToHtml(runs: TextRun[]): string {
  return runs.map((r) => {
    let h = escapeHtml(r.t).replace(/\n/g, "<br>");
    if (r.u) h = `<u>${h}</u>`;
    if (r.i) h = `<i>${h}</i>`;
    if (r.b) h = `<b>${h}</b>`;
    return h;
  }).join("");
}
/* What a paste may bring into an editable: the words, their line breaks
   and bold/italic/underline — nothing else.

   A native paste (Ctrl+V) drops the clipboard's HTML straight in. Copied
   text almost always arrives wrapped in a block (<div>, <p>, a whole
   document from a web page or another balloon) and Chrome starts a block
   on a NEW LINE, so every paste began with an empty line; the inline
   styles that rode along (font, size, colour from wherever it was copied)
   then fought the balloon's own style until the edit ended. The markup
   built here is what `document.execCommand("insertHTML")` gets instead. */
const BLOCK_TAGS = new Set(["div", "p", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "section", "article", "header", "footer", "table", "ul", "ol", "dd", "dt"]);
const SKIP_TAGS = new Set(["style", "script", "meta", "head", "title", "link", "template", "noscript"]);
/* "BR" is an explicit <br>; "BLK" is a block edge (a <p>/<div> boundary) —
   a blank line typed as <br><br> survives, but block edges never stack */
type PasteTok = { t: string; b: boolean; i: boolean; u: boolean } | "BR" | "BLK";
export function pasteMarkup(html: string, text: string): string {
  const BR = "<br>";
  if (!html) {
    const plain = text.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
    return escapeHtml(plain).replace(/\n/g, BR);
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  /* pass 1: a flat token stream — text with its emphasis, and line breaks
     (one per <br>, one at each block edge) */
  const toks: PasteTok[] = [];
  const isBreak = (k: PasteTok | undefined) => k === "BR" || k === "BLK";
  const breakLine = () => { if (toks.length && !isBreak(toks[toks.length - 1])) toks.push("BLK"); };
  const walk = (node: Node, b: boolean, i: boolean, u: boolean) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        /* source-formatting newlines are spaces in HTML (Windows wraps the
           clipboard in "\r\n<!--StartFragment-->…"); <br>/blocks carry
           the real line breaks */
        const t = (child.textContent || "").replace(/\u200b/g, "").replace(/[\s\u00a0]+/g, " ");
        if (t) toks.push({ t, b, i, u });
      } else if (child.nodeType === 1) {
        const e = child as HTMLElement;
        const tag = e.tagName.toLowerCase();
        if (SKIP_TAGS.has(tag)) return;
        if (tag === "br") { toks.push("BR"); return; }
        let nb = b, ni = i, nu = u;
        const fw = e.style?.fontWeight;
        /* Google Docs wraps its whole clipboard in <b style="font-weight:
           normal"> — the explicit weight wins over the tag */
        if ((tag === "b" || tag === "strong") && !(fw === "normal" || (fw && +fw > 0 && +fw < 600))) nb = true;
        if (tag === "i" || tag === "em") ni = true;
        if (tag === "u") nu = true;
        if (fw === "bold" || (fw && +fw >= 600)) nb = true;
        if (e.style?.fontStyle === "italic") ni = true;
        if (e.style?.textDecoration?.includes("underline") || e.style?.textDecorationLine?.includes("underline")) nu = true;
        const block = BLOCK_TAGS.has(tag);
        if (block) breakLine();
        walk(e, nb, ni, nu);
        if (block) breakLine();
      }
    });
  };
  walk(doc.body, false, false, false);
  /* pass 2: whitespace discipline — a space never sits at a line's start or
     end, never doubles up, and a space-only token next to a break is the
     clipboard's formatting, not content. Then no leading/trailing breaks. */
  const atLineStart = (k: number) => k === 0 || isBreak(toks[k - 1]);
  const atLineEnd = (k: number) => k === toks.length - 1 || isBreak(toks[k + 1]);
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < toks.length; k++) {
      const tok = toks[k];
      if (isBreak(tok)) continue;
      if (atLineStart(k)) tok.t = tok.t.replace(/^ +/, "");
      if (atLineEnd(k)) tok.t = tok.t.replace(/ +$/, "");
      const prev = k > 0 ? toks[k - 1] : null;
      if (prev && !isBreak(prev) && (prev as Exclude<PasteTok, string>).t.endsWith(" ") && tok.t.startsWith(" ")) tok.t = tok.t.slice(1);
      if (!tok.t) { toks.splice(k, 1); k--; }
    }
  }
  /* a block edge next to any other break is the same line break */
  for (let k = 0; k < toks.length; k++) {
    if (toks[k] === "BLK" && (isBreak(toks[k - 1]) || isBreak(toks[k + 1]))) { toks.splice(k, 1); k--; }
  }
  while (toks.length && isBreak(toks[0])) toks.shift();
  while (toks.length && isBreak(toks[toks.length - 1])) toks.pop();
  let out = "";
  for (const tok of toks) {
    if (isBreak(tok)) { out += BR; continue; }
    let piece = escapeHtml(tok.t);
    if (tok.b) piece = `<b>${piece}</b>`;
    if (tok.i) piece = `<i>${piece}</i>`;
    if (tok.u) piece = `<u>${piece}</u>`;
    out += piece;
  }
  if (!out.replace(/<[^>]+>/g, "").trim()) return pasteMarkup("", text);
  return out;
}

/* the editables' onPaste: both the balloon and the caption box route here */
export function onLetteringPaste(e: React.ClipboardEvent<HTMLElement>) {
  const html = e.clipboardData.getData("text/html");
  const text = e.clipboardData.getData("text/plain");
  if (!html && !text) return;          // files/images: nothing to put in text
  e.preventDefault();
  const out = pasteMarkup(html, text);
  if (!out) return;
  document.execCommand("insertHTML", false, out);
}

export function domToRuns(root: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  const walk = (node: Node, b: boolean, i: boolean, u: boolean) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        /* contentEditable writes non-breaking spaces; the text model gets
           plain spaces, so the runs must too or they render differently */
        const txt = (child.textContent || "").replace(/\u200b/g, "").replace(/\u00a0/g, " ");
        if (txt) runs.push({ t: txt, ...(b ? { b: true } : {}), ...(i ? { i: true } : {}), ...(u ? { u: true } : {}) });
      } else if (child.nodeType === 1) {
        const e = child as HTMLElement;
        const tag = e.tagName.toLowerCase();
        if (tag === "br") { runs.push({ t: "\n", ...(b ? { b: true } : {}), ...(i ? { i: true } : {}), ...(u ? { u: true } : {}) }); return; }
        let nb = b, ni = i, nu = u;
        if (tag === "b" || tag === "strong") nb = true;
        if (tag === "i" || tag === "em") ni = true;
        if (tag === "u") nu = true;
        const fw = e.style?.fontWeight; if (fw === "bold" || (fw && +fw >= 600)) nb = true;
        if (e.style?.fontStyle === "italic") ni = true;
        if (e.style?.textDecoration?.includes("underline") || e.style?.textDecorationLine?.includes("underline")) nu = true;
        if ((tag === "div" || tag === "p") && runs.length && !runs[runs.length - 1].t.endsWith("\n")) runs.push({ t: "\n" });
        walk(e, nb, ni, nu);
      }
    });
  };
  walk(root, false, false, false);
  return runs;
}

/* Map the live DOM text selection inside an editing node to CHARACTER
   offsets in the text domToRuns will capture — same walk, same ZWSP
   stripping, same <br>/<div> newline rules — so a highlighted word can be
   re-found in the runs model after the DOM (and its selection) is gone. */
export function domSelectionOffsets(root: HTMLElement): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  let pos = 0, last = "", start = -1, end = -1;
  const cleanLen = (s: string) => s.replace(/\u200b/g, "").length;
  const walk = (node: Node) => {
    const kids = node.childNodes;
    for (let idx = 0; idx < kids.length; idx++) {
      if (node === range.startContainer && idx === range.startOffset) start = pos;
      if (node === range.endContainer && idx === range.endOffset) end = pos;
      const child = kids[idx];
      if (child.nodeType === 3) {
        const raw = child.textContent || "";
        if (child === range.startContainer) start = pos + cleanLen(raw.slice(0, range.startOffset));
        if (child === range.endContainer) end = pos + cleanLen(raw.slice(0, range.endOffset));
        const clean = raw.replace(/\u200b/g, "");
        if (clean) { pos += clean.length; last = clean[clean.length - 1]; }
      } else if (child.nodeType === 1) {
        const tag = (child as HTMLElement).tagName.toLowerCase();
        if (tag === "br") { pos += 1; last = "\n"; continue; }
        if ((tag === "div" || tag === "p") && pos > 0 && last !== "\n") { pos += 1; last = "\n"; }
        walk(child);
      }
    }
    if (node === range.startContainer && kids.length === range.startOffset) start = pos;
    if (node === range.endContainer && kids.length === range.endOffset) end = pos;
  };
  walk(root);
  if (start < 0 || end < 0) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}
export function renderRuns(runs: TextRun[], ts: TextStyle): ReactNode {
  return runs.map((r, idx) => {
    const txt = ts.crossbarI ? applyCrossbarI(ts.caps ? r.t.toUpperCase() : r.t) : r.t;
    const parts = txt.split("\n");
    const content: ReactNode[] = [];
    parts.forEach((p, i) => { if (i > 0) content.push(<br key={`b${idx}-${i}`} />); content.push(p); });
    let node: ReactNode = content;
    if (r.u) node = <u>{node}</u>;
    if (r.i) node = <i>{node}</i>;
    if (r.b) node = <b>{node}</b>;
    return <span key={idx}>{node}</span>;
  });
}

/* offscreen canvas so warped-text glyph widths match the export renderer */
let _measCanvas: HTMLCanvasElement | null = null;
export function measureCharWidths(ts: TextStyle, chars: string[]): number[] {
  if (typeof document === "undefined") return chars.map(() => ts.size * 0.6);
  if (!_measCanvas) _measCanvas = document.createElement("canvas");
  const ctx = _measCanvas.getContext("2d");
  if (!ctx) return chars.map(() => ts.size * 0.6);
  ctx.font = fontString(ts);
  const tr = ts.tracking ?? 0;
  return chars.map((c) => ctx.measureText(c).width + tr);
}


/* Lay the lettering out exactly the way the canvas will: a hidden node that
   mirrors the on-canvas text box, so wrap points and block height match what
   the reader actually sees. Used to size a balloon to its text and to spot
   text that no longer fits the one it is in. */
let _measDiv: HTMLDivElement | null = null;

function measNode(ts: TextStyle): HTMLDivElement {
  if (!_measDiv) {
    _measDiv = document.createElement("div");
    _measDiv.setAttribute("aria-hidden", "true");
    Object.assign(_measDiv.style, {
      position: "absolute", left: "-99999px", top: "0", visibility: "hidden",
      padding: "0", margin: "0", border: "0",
    } as Partial<CSSStyleDeclaration>);
    document.body.appendChild(_measDiv);
  }
  const d = _measDiv;
  d.style.fontFamily = FONTS[ts.font]?.css || FONTS.comicneue.css;
  d.style.fontSize = `${ts.size}px`;
  d.style.fontWeight = ts.bold ? "700" : "400";
  d.style.fontStyle = ts.italic ? "italic" : "normal";
  d.style.lineHeight = `${ts.lineHeight ?? 1.05}`;
  d.style.letterSpacing = ts.tracking ? `${ts.tracking}px` : "normal";
  d.style.textTransform = ts.caps ? "uppercase" : "none";
  d.style.wordBreak = "break-word";   // as the canvas renders (.el .txt)
  return d;
}

export function measureBlock(ts: TextStyle, text: string, maxW: number): { w: number; h: number } {
  if (typeof document === "undefined" || !text) {
    const lineH = ts.size * (ts.lineHeight ?? 1.05);
    return { w: Math.min(maxW, text.length * ts.size * 0.5), h: lineH };
  }
  const d = measNode(ts);
  d.textContent = text;
  /* inline-block shrink-wraps to the widest line. A block with an explicit
     width reports that width back whatever the text does, which sized every
     lettering box to the wrap limit instead of to the letters. */
  d.style.display = "inline-block";
  d.style.width = "auto";
  if (maxW >= 1e6) {
    d.style.whiteSpace = "pre";
    d.style.maxWidth = "none";
  } else {
    d.style.whiteSpace = "pre-wrap";
    d.style.maxWidth = `${Math.max(1, Math.round(maxW))}px`;
  }
  return { w: Math.ceil(d.getBoundingClientRect().width), h: Math.ceil(d.getBoundingClientRect().height) };
}

/* The badge is consulted on every render, so remember the last answer for a
   given box + lettering rather than re-measuring each time. */
const _ovfCache = new Map<string, boolean>();

/** does this lettering overflow the box it has been given? */
export function textOverflows(ts: TextStyle, text: string, w: number, h: number): boolean {
  if (!text.trim() || w <= 0 || h <= 0) return false;
  const key = `${text}\u0000${w}x${h}\u0000${ts.font}|${ts.size}|${ts.bold}|${ts.italic}|${ts.caps}|${ts.lineHeight}|${ts.tracking}`;
  const hit = _ovfCache.get(key);
  if (hit !== undefined) return hit;
  const m = measureBlock(ts, text, w);
  const out = m.h > h + 1 || m.w > w + 1;
  if (_ovfCache.size > 400) _ovfCache.clear();
  _ovfCache.set(key, out);
  return out;
}

export function letterStyleCss(s: LetterStyle, size: number): CSSProperties {
  return textCss({
    font: s.font, size, bold: false, italic: !!s.italic, caps: !s.lower, align: "center",
    fillA: s.fillA, fillB: s.fillB, outlineC: s.outlineC,
    outlineW: Math.max(s.outlineF > 0 ? 1 : 0, Math.round(size * s.outlineF)),
    shadow: s.shadow, shadowC: "#00000066",
  });
}

export interface ProjectMeta {
  id: string; name: string; updatedAt: string; thumbnail: string | null;
  /* present on books shared WITH this account */
  sharedBy?: string; role?: string;
}
export interface ProofMatch { elId: string; message: string; context: string; offset: number; length: number; reps: string[] }

export const STAMPS = ["💥", "⚡", "🔥", "💫", "⭐", "💢", "💦", "💤", "❗", "❓", "🎯", "🏆", "❤️", "💀", "🤖", "👊", "🎵", "🎶"];
/* Pre-made SFX word stamps, each paired with a lettering style preset + tilt */
export const WORD_STAMPS: [string, string, number][] = [
  ["ZAP!", "Hazard", -6], ["POW!", "Sunburst", 5], ["BAM!", "Crimson", -4],
  ["BOOM!", "Blaze", 3], ["KRAK!", "Stone", -5], ["WHAM!", "Panic", 6],
  ["HA HA!", "Classic", -3], ["SPLOOSH!", "Ocean", 4],
  ["#$@%!", "Crimson", -3],
];
export const LT_URL = "https://api.languagetool.org/v2/check";

export const elLabel = (el: El) =>
  el.name ? el.name
    : el.type === "balloon" ? `Balloon: ${el.text.slice(0, 18) || "(empty)"}`
    : el.type === "text" ? `Lettering: ${el.text.slice(0, 18) || "(empty)"}`
    : el.type === "panel" ? "Panel"
    : el.type === "adjust" ? `✨ ${ADJUST_META[el.kind]?.label ?? "Adjustment"}`
    : el.type === "action" ? "Instaction lines"
    : "Image";

/* the script parser lives in its own module now — re-exported so the
   existing import sites keep working */
export { parseScript, describeScript } from "@/lib/scriptParse";
export type { ScriptItem, ScriptKind } from "@/lib/scriptParse";
