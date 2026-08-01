/* Balloon and caption-box colourways — the STYLES panel swatches shown when
   a word balloon or a caption box is selected. Lettering keeps its own list
   in presets.ts; these describe the SHAPE's fill, outline and ink colour. */
import { BalloonEl, FillStyle } from "./model";

export interface ShapeStyle {
  name: string;
  /** flat colour, or [top, bottom] for a vertical gradient */
  fill: string | [string, string];
  stroke: string;
  /** outline width in page units at the balloon's natural scale */
  strokeW: number;
  /** ink colour for the lettering inside — defaults to black */
  ink?: string;
  /** font key for the lettering inside — saved user styles carry the
      balloon's font; the built-in colourways leave the target's font alone */
  font?: string;
  /** transparent body: no fill drawn at all */
  none?: boolean;
}

export function shapeFill(s: ShapeStyle): FillStyle {
  if (s.none) return { kind: "solid", a: "transparent" };
  return Array.isArray(s.fill)
    ? { kind: "gradient", a: s.fill[0], b: s.fill[1], angle: 180 }
    : { kind: "solid", a: s.fill };
}

/** CSS background for a swatch preview */
export function shapeCss(s: ShapeStyle): string {
  if (s.none) return "transparent";
  return Array.isArray(s.fill)
    ? `linear-gradient(180deg, ${s.fill[0]}, ${s.fill[1]})`
    : s.fill;
}

/* Read a balloon back into a style — the inverse of applyShapeStyle, for
   "Save Style". A gradient fill comes back as its two stops; anything else
   is treated as flat, since a halftone or a photo fill is a property of that
   one balloon rather than a colourway worth reusing. */
export function captureShapeStyle(el: BalloonEl, name: string): ShapeStyle {
  const f = el.fill;
  const fill: string | [string, string] =
    f.kind === "gradient" ? [f.a, f.b ?? f.a] : (f.a ?? "#ffffff");
  return {
    name,
    fill,
    stroke: el.stroke,
    strokeW: el.strokeW,
    ink: el.ts?.fillA ?? "#000000",
    /* the bubble's lettering font travels with the saved style */
    font: el.ts?.font,
    none: f.kind === "solid" && (f.a === "transparent" || f.a === "none"),
  };
}

export function applyShapeStyle(el: BalloonEl, s: ShapeStyle) {
  el.fill = shapeFill(s);
  el.stroke = s.stroke;
  el.strokeW = s.strokeW;
  el.ts = {
    ...el.ts,
    fillA: s.ink ?? "#000000", fillB: null, outlineW: 0, shadow: false,
    /* saved styles carry a font; built-in colourways don't and leave the
       target's font untouched */
    ...(s.font ? { font: s.font } : {}),
  };
}

/* --- word balloons: classic ink-and-colour combinations --- */
export const BALLOON_STYLES: ShapeStyle[] = [
  { name: "Classic White",   fill: "#ffffff",                stroke: "#000000", strokeW: 3 },
  { name: "Ice Blue",        fill: "#cfe7f6",                stroke: "#000000", strokeW: 3 },
  { name: "Cream / Amber",   fill: "#fffbe8",                stroke: "#e0902c", strokeW: 4 },
  { name: "Olive Gradient",  fill: ["#d4e157", "#7a9a12"],   stroke: "#000000", strokeW: 3 },
  { name: "Pale Yellow",     fill: "#faf5bd",                stroke: "#000000", strokeW: 3 },
  { name: "Magenta",         fill: ["#f52ce8", "#cf00bc"],   stroke: "#000000", strokeW: 3, ink: "#ffffff" },
  { name: "Blackout",        fill: "#101010",                stroke: "#000000", strokeW: 3, ink: "#ffffff" },
  { name: "Orange Pop",      fill: ["#ffa800", "#ef7a00"],   stroke: "#000000", strokeW: 3 },
  { name: "Old Gold",        fill: ["#efdc8c", "#d6b950"],   stroke: "#000000", strokeW: 3 },
  { name: "Alarm Red",       fill: ["#d60000", "#a30000"],   stroke: "#000000", strokeW: 3, ink: "#ffffff" },
  { name: "Blood Outline",   fill: "#ffffff",                stroke: "#7d0000", strokeW: 6 },
  { name: "Acid Lime",       fill: ["#d8ea4c", "#b5cf1e"],   stroke: "#000000", strokeW: 3 },
  { name: "Highlighter",     fill: "#eeee58",                stroke: "#000000", strokeW: 3 },
  { name: "Green Outline",   fill: "#ffffff",                stroke: "#0a7c22", strokeW: 6 },
  { name: "Ember",           fill: ["#f26522", "#d21f0a"],   stroke: "#000000", strokeW: 3, ink: "#ffffff" },
  { name: "Sky Whisper",     fill: "#cfe6f5",                stroke: "#7fb0cc", strokeW: 3 },
  { name: "Dried Blood",     fill: ["#b22222", "#680a0a"],   stroke: "#000000", strokeW: 3, ink: "#ffffff" },
  { name: "Mint",            fill: "#a9e9a1",                stroke: "#000000", strokeW: 3 },
  { name: "Honey",           fill: ["#ffd44c", "#f0b000"],   stroke: "#000000", strokeW: 3 },
  { name: "Lavender",        fill: ["#e9e1f8", "#c1a9e9"],   stroke: "#000000", strokeW: 3 },
  { name: "Bubblegum",       fill: ["#f7d0e1", "#eeabc9"],   stroke: "#000000", strokeW: 3 },
];

/* --- caption boxes and text boxes --- */
export const BOX_STYLES: ShapeStyle[] = [
  { name: "Lilac Box",       fill: "#ddd6f0",                stroke: "#444444", strokeW: 3 },
  { name: "Legal Pad",       fill: ["#fdfaa8", "#f0e850"],   stroke: "#000000", strokeW: 3 },
  { name: "Stop Red",        fill: "#e01010",                stroke: "#000000", strokeW: 3, ink: "#ffffff" },
  { name: "Plain White",     fill: "#ffffff",                stroke: "#000000", strokeW: 3 },
  { name: "No Box",          fill: "#ffffff", none: true,    stroke: "transparent", strokeW: 0 },
  { name: "Deep Blue",       fill: ["#2c46ea", "#0a1cbe"],   stroke: "#000000", strokeW: 3, ink: "#ffffff" },
  { name: "Cornflower",      fill: "#7aaef0",                stroke: "#000000", strokeW: 3 },
  { name: "Bright White",    fill: "#ffffff",                stroke: "#000000", strokeW: 4 },
  { name: "Slate",           fill: "#a9b9c1",                stroke: "#000000", strokeW: 3 },
  { name: "Violet Neon",     fill: "#3200e0",                stroke: "#f0a000", strokeW: 5, ink: "#ffffff" },
  { name: "Paper",           fill: "#ffffff",                stroke: "#000000", strokeW: 3 },
  { name: "Crimson Fade",    fill: ["#d20000", "#6a0000"],   stroke: "#000000", strokeW: 3, ink: "#ffffff" },
  { name: "Parchment",       fill: "#fdf8c9",                stroke: "#000000", strokeW: 3 },
  { name: "Chartreuse",      fill: "#dbe84a",                stroke: "#000000", strokeW: 3 },
  { name: "Pale Violet",     fill: "#e7ddf8",                stroke: "#000000", strokeW: 3 },
  { name: "Rust Fade",       fill: ["#d22020", "#7c1010"],   stroke: "#000000", strokeW: 3, ink: "#ffffff" },
  { name: "Split Pea",       fill: ["#dce840", "#a8c020"],   stroke: "#000000", strokeW: 3 },
];
