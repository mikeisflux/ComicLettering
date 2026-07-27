"use client";
/* ComicLettering Studio — shared text/lettering helpers, constants and types
   split out of Editor.tsx (module-level code, unchanged). */
import { CSSProperties, ReactNode } from "react";
import {
  BalloonKind, El, FONTS, FillStyle, TextRun, TextStyle, applyCrossbarI, lightenHex,
} from "@/lib/model";
import { LetterStyle } from "@/lib/presets";
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

function emphasisAncestor(node: Node | null, kind: "bold" | "italic", root: HTMLElement): HTMLElement | null {
  let found: HTMLElement | null = null;
  let n: Node | null = node;
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const e = n as HTMLElement;
      const tag = e.tagName.toLowerCase();
      const fw = e.style?.fontWeight;
      const isBold = tag === "b" || tag === "strong" || fw === "bold" || (!!fw && +fw >= 600);
      const isItal = tag === "i" || tag === "em" || e.style?.fontStyle === "italic";
      if (kind === "bold" ? isBold : isItal) found = e;   // keep going: take the outermost
    }
    n = n.parentNode;
  }
  return found;
}

/** Toggle bold/italic on the editable node. Returns false if it could not. */
export function toggleEmphasis(root: HTMLElement, kind: "bold" | "italic"): boolean {
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
    const wrap = document.createElement(kind === "bold" ? "b" : "i");
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
    if (r.i) h = `<i>${h}</i>`;
    if (r.b) h = `<b>${h}</b>`;
    return h;
  }).join("");
}
export function domToRuns(root: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];
  const walk = (node: Node, b: boolean, i: boolean) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        const txt = (child.textContent || "").replace(/\u200b/g, "");
        if (txt) runs.push({ t: txt, ...(b ? { b: true } : {}), ...(i ? { i: true } : {}) });
      } else if (child.nodeType === 1) {
        const e = child as HTMLElement;
        const tag = e.tagName.toLowerCase();
        if (tag === "br") { runs.push({ t: "\n", ...(b ? { b: true } : {}), ...(i ? { i: true } : {}) }); return; }
        let nb = b, ni = i;
        if (tag === "b" || tag === "strong") nb = true;
        if (tag === "i" || tag === "em") ni = true;
        const fw = e.style?.fontWeight; if (fw === "bold" || (fw && +fw >= 600)) nb = true;
        if (e.style?.fontStyle === "italic") ni = true;
        if ((tag === "div" || tag === "p") && runs.length && runs[runs.length - 1].t !== "\n") runs.push({ t: "\n" });
        walk(e, nb, ni);
      }
    });
  };
  walk(root, false, false);
  return runs;
}
export function renderRuns(runs: TextRun[], ts: TextStyle): ReactNode {
  return runs.map((r, idx) => {
    const txt = ts.crossbarI ? applyCrossbarI(ts.caps ? r.t.toUpperCase() : r.t) : r.t;
    const parts = txt.split("\n");
    const content: ReactNode[] = [];
    parts.forEach((p, i) => { if (i > 0) content.push(<br key={`b${idx}-${i}`} />); content.push(p); });
    let node: ReactNode = content;
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
  d.style.wordBreak = "normal";
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

export interface ProjectMeta { id: string; name: string; updatedAt: string; thumbnail: string | null }
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
  el.type === "balloon" ? `Balloon: ${el.text.slice(0, 18) || "(empty)"}`
    : el.type === "text" ? `Lettering: ${el.text.slice(0, 18) || "(empty)"}`
    : el.type === "panel" ? "Panel"
    : "Image";

/* Parse a comic script (CHARACTER: dialogue, CAPTION:, SFX:, parentheticals) */
export function parseScript(src: string): { kind: string; text: string }[] {
  const items: { kind: string; text: string }[] = [];
  const headerRx = /^(PAGE|PANEL|SCENE|PG|P|INT|EXT)\b/i;
  const lineRx = /^\s*([A-Z0-9 .,'’&\-]{1,28}?)\s*(?:\(([^)]*)\))?\s*:\s*(.+)$/;
  for (const rawLine of src.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (headerRx.test(line) && !line.includes(":")) continue;
    const m = line.match(lineRx);
    if (!m) { if (items.length) items[items.length - 1].text += " " + line; continue; }
    const speaker = m[1].trim().toUpperCase();
    const paren = (m[2] || "").toLowerCase();
    const text = m[3].trim();
    let kind = "speech";
    if (/^(SFX|SOUND|FX)$/.test(speaker)) kind = "sfx";
    else if (/^(CAPTION|CAP|NARRATION|NARR|BOX|TITLE)$/.test(speaker)) kind = "caption";
    else if (/thought|think/.test(paren)) kind = "thought";
    else if (/whisper|quiet/.test(paren)) kind = "whisper";
    else if (/shout|yell|scream|loud|angry/.test(paren)) kind = "exclaim";
    items.push({ kind, text });
  }
  return items;
}
