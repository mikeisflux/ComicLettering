"use client";
/* ComicLettering Studio — shared text/lettering helpers, constants and types
   split out of Editor.tsx (module-level code, unchanged). */
import { CSSProperties, ReactNode } from "react";
import {
  BalloonKind, El, FONTS, FillStyle, TextRun, TextStyle, applyCrossbarI, lightenHex,
} from "@/lib/model";
import { LetterStyle } from "@/lib/presets";
import { fontString } from "@/lib/exportPng";

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
    lineHeight: ts.lineHeight ?? 1.25,
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
  if (ts.shadow) {
    st.filter = `drop-shadow(${ts.size * 0.05}px ${ts.size * 0.05}px ${ts.size * 0.06}px ${ts.shadowC || "#00000088"})`;
  }
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
        runs.push({ t: child.textContent || "", ...(b ? { b: true } : {}), ...(i ? { i: true } : {}) });
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
