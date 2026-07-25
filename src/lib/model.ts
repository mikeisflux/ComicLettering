/* ComicLettering Studio — document model, fonts, filters, layouts. */

export type Align = "left" | "center" | "right";
export type FilterKey = "none" | "bw" | "sepia" | "vivid" | "faded" | "noir";
export type BalloonKind =
  | "speech" | "rough" | "buzz" | "double" | "thought"
  | "shout" | "burst2" | "whisper" | "square" | "tv"
  | "extend" | "rounded" | "caption";

/* ---------------- fills: solid / gradient / halftone ---------------- */

export type HalftoneVariant = "down" | "up" | "left" | "right" | "full" | "midh" | "midv";
export type PatternVariant =
  | "check" | "dots" | "dotsinv" | "hexdots" | "hollowdots" | "smalldots"
  | "linesd" | "linesd2" | "linesh" | "linesv" | "crosshatch" | "zigzag" | "screen";
export type SpeedlineVariant = "burst" | "burst2" | "ring" | "corner" | "horiz" | "horizfade";
export type TextureVariant = "speckle" | "grit" | "static" | "murk" | "daubs" | "stone";

export type FillStyle =
  | { kind: "solid"; a: string }
  | { kind: "gradient"; a: string; b: string; angle: number }
  | { kind: "halftone"; a: string; dot: string; cell: 8 | 16 | 32; variant: HalftoneVariant }
  | { kind: "pattern"; a: string; fg: string; variant: PatternVariant; scale: number }
  | { kind: "speedlines"; a: string; line: string; variant: SpeedlineVariant }
  | { kind: "texture"; a: string; fg: string; variant: TextureVariant };

export const solid = (a: string): FillStyle => ({ kind: "solid", a });

export const HALFTONE_VARIANTS: Record<HalftoneVariant, string> = {
  down: "Fade down", up: "Fade up", left: "Fade left", right: "Fade right",
  full: "Uniform", midh: "Middle ↔", midv: "Middle ↕",
};
export const PATTERN_VARIANTS: Record<PatternVariant, string> = {
  check: "Checks", dots: "Dots", dotsinv: "Dots inverted", hexdots: "Hex dots",
  hollowdots: "Hollow dots", smalldots: "Small dots", linesd: "Lines ↘", linesd2: "Lines ↗",
  linesh: "Lines —", linesv: "Lines |", crosshatch: "Crosshatch", zigzag: "Zigzag", screen: "Screen",
};
export const SPEEDLINE_VARIANTS: Record<SpeedlineVariant, string> = {
  burst: "Burst", burst2: "Burst dense", ring: "Ring", corner: "Corner", horiz: "Motion", horizfade: "Motion faded",
};
export const TEXTURE_VARIANTS: Record<TextureVariant, string> = {
  speckle: "Speckle", grit: "Grit", static: "Static", murk: "Murk", daubs: "Daubs", stone: "Stone",
};

/* Gradient defaults (like Comic Life's bundled gradients) — [top, bottom] pairs. */
export const GRADIENT_PRESETS: [string, string][] = [
  ["#ffffff", "#9ecbff"], ["#c9ecff", "#2e86d4"], ["#fff7b0", "#ff9d2e"],
  ["#ffe14d", "#ff2a00"], ["#ff9d2e", "#e03000"], ["#ff512f", "#dd2476"],
  ["#ffd0e8", "#ff45a4"], ["#eadcff", "#8a4fd8"], ["#d8ffd0", "#3fae4a"],
  ["#fceabb", "#f8b500"], ["#f8f8f8", "#a8aeb8"], ["#41506b", "#0c1220"],
];

export interface TextStyle {
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  caps: boolean;
  align: Align;
  fillA: string;
  fillB: string | null; // gradient bottom stop; null = solid fillA
  outlineC: string;
  outlineW: number;
  shadow: boolean;
  shadowC: string;
}

export interface BaseEl {
  id: string;
  x: number; y: number; w: number; h: number; rot: number;
  shadow: boolean;
  opacity?: number;   // 0..1, default 1
  flipH?: boolean;
  flipV?: boolean;
  locked?: boolean;
}
export interface PanelEl extends BaseEl {
  type: "panel";
  fill: FillStyle; borderW: number; borderC: string;
  img: string | null; filter: FilterKey;
}
export interface ImageEl extends BaseEl {
  type: "image";
  img: string; filter: FilterKey;
  borderW: number; borderC: string;
}
export interface BalloonEl extends BaseEl {
  type: "balloon";
  kind: BalloonKind;
  text: string;
  ts: TextStyle;
  fill: FillStyle; stroke: string; strokeW: number;
  /* dx/dy: tail tip relative to the balloon centre (local, unrotated).
     bx/by: optional bend point the tail curves through. */
  tail: { dx: number; dy: number; bx?: number; by?: number } | null;
  /* id of a balloon this one is attached to: they render joined, with the
     connector tail aimed at the partner automatically */
  attachTo?: string | null;
  /* optional image content (e.g. pre-made lettering stamps), clipped to the
     balloon shape and drawn behind the text */
  img?: string | null;
}

/* Resolve a balloon's effective tail: attached balloons aim at their partner. */
export function resolveBalloon(page: Page, el: BalloonEl): { el: BalloonEl; base: BalloonEl | null } {
  if (!el.attachTo) return { el, base: null };
  const base = page.els.find((e) => e.id === el.attachTo && e.type === "balloon") as BalloonEl | undefined;
  if (!base) return { el: { ...el, attachTo: null }, base: null };
  const bc = [el.x + el.w / 2, el.y + el.h / 2];
  const ac = [base.x + base.w / 2, base.y + base.h / 2];
  const [dx, dy] = rotVec(ac[0] - bc[0], ac[1] - bc[1], -el.rot);
  return {
    el: { ...el, tail: { ...(el.tail ?? {}), dx: Math.round(dx), dy: Math.round(dy) } },
    base,
  };
}

export const aabbOverlap = (
  a: Pick<BaseEl, "x" | "y" | "w" | "h">, b: Pick<BaseEl, "x" | "y" | "w" | "h">
) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/* The balloon underneath `el` that overlaps it (candidate to attach to). */
export function findMergeBase(page: Page, el: BalloonEl): BalloonEl | null {
  const idx = page.els.indexOf(el);
  for (let i = idx - 1; i >= 0; i--) {
    const o = page.els[i];
    if (o.type !== "balloon" || o.id === el.attachTo) continue;
    if (aabbOverlap(el, o)) return o;
  }
  return null;
}
export interface TextEl extends BaseEl {
  type: "text";
  text: string;
  ts: TextStyle;
}
export type El = PanelEl | ImageEl | BalloonEl | TextEl;

export interface PageMargin { t: number; r: number; b: number; l: number }
export interface Page { w: number; h: number; bg: FillStyle; els: El[]; margin?: PageMargin }

/* Pixels per inch used across rulers, paper sizes and Page Setup. */
export const DPI = 225;

export interface PaperCategory { name: string; sizes: [string, number, number][] }
export const PAPER_CATEGORIES: PaperCategory[] = [
  {
    name: "Comic Sizes",
    sizes: [
      ["Standard Comic", 6.625, 10.25],
      ["Golden Age", 7.75, 10.5],
      ["Digest", 5.5, 8.25],
      ["Magazine", 8.5, 11],
      ["Webcomic Strip", 8, 2.75],
      ["Square Album", 8.5, 8.5],
    ],
  },
  {
    name: "US Paper Sizes",
    sizes: [
      ["Tabloid", 11, 17],
      ["US Legal", 8.5, 14],
      ["US Letter", 8.5, 11],
    ],
  },
  {
    name: "International Paper Sizes",
    sizes: [
      ["A3", 11.693, 16.535],
      ["A4", 8.268, 11.693],
      ["A5", 5.827, 8.268],
      ["B4", 9.843, 13.898],
      ["B5 (Manga)", 6.929, 9.843],
    ],
  },
];
export interface Doc { app: "comiclettering"; version: 2; pages: Page[] }
export type Assets = Record<string, string>;

/* ---------------- fonts ---------------- */

export interface FontDef { label: string; css: string; group: string }

export const FONTS: Record<string, FontDef> = {
  /* Dialogue */
  comicneue: { label: "Comic Neue",       css: '"Comic Neue","Comic Sans MS",cursive', group: "Dialogue" },
  patrick:   { label: "Patrick Hand",     css: '"Patrick Hand",cursive',               group: "Dialogue" },
  kalam:     { label: "Kalam",            css: '"Kalam",cursive',                      group: "Dialogue" },
  comicsans: { label: "Comic Sans",       css: '"Comic Sans MS","Comic Sans","Chalkboard SE",cursive', group: "Dialogue" },
  /* Display / SFX */
  bangers:   { label: "Bangers",          css: '"Bangers",cursive',        group: "Display" },
  luckiest:  { label: "Luckiest Guy",     css: '"Luckiest Guy",cursive',   group: "Display" },
  boogaloo:  { label: "Boogaloo",         css: '"Boogaloo",cursive',       group: "Display" },
  chewy:     { label: "Chewy",            css: '"Chewy",cursive',          group: "Display" },
  alfa:      { label: "Alfa Slab One",    css: '"Alfa Slab One",serif',    group: "Display" },
  bungee:    { label: "Bungee",           css: '"Bungee",cursive',         group: "Display" },
  league:    { label: "League Gothic",    css: '"League Gothic","Arial Narrow",sans-serif', group: "Display" },
  impact:    { label: "Impact",           css: 'Impact,"Arial Black",sans-serif', group: "Display" },
  /* Themed */
  creepster: { label: "Creepster",        css: '"Creepster",cursive',      group: "Themed" },
  nosifer:   { label: "Nosifer (Drip)",   css: '"Nosifer",cursive',        group: "Themed" },
  audiowide: { label: "Audiowide (Sci-Fi)", css: '"Audiowide",sans-serif', group: "Themed" },
  marker:    { label: "Permanent Marker", css: '"Permanent Marker",cursive', group: "Themed" },
  courier:   { label: "Courier Prime",    css: '"Courier Prime","Courier New",monospace', group: "Themed" },
  /* System */
  sans:      { label: "Arial",            css: "Arial,Helvetica,sans-serif", group: "System" },
  serif:     { label: "Georgia",          css: 'Georgia,"Times New Roman",serif', group: "System" },
};

export const FONT_GROUPS = ["Dialogue", "Display", "Themed", "System"];

/* ---------------- filters ---------------- */

export const FILTERS: Record<FilterKey, { label: string; css: string }> = {
  none:  { label: "None",          css: "" },
  bw:    { label: "Black & White", css: "grayscale(1) contrast(1.1)" },
  sepia: { label: "Sepia",         css: "sepia(0.85)" },
  vivid: { label: "Vivid",         css: "saturate(1.7) contrast(1.12)" },
  faded: { label: "Faded",         css: "saturate(0.55) brightness(1.12)" },
  noir:  { label: "Noir",          css: "grayscale(1) contrast(1.6) brightness(0.9)" },
};

/* ---------------- page sizes & layouts ---------------- */

export const PAGE_SIZES = [
  { k: "comic",  label: "US Comic (1500×2250)",   w: 1500, h: 2250 },
  { k: "manga",  label: "Manga B5 (1516×2150)",   w: 1516, h: 2150 },
  { k: "a4",     label: "A4 Portrait (1654×2339)", w: 1654, h: 2339 },
  { k: "square", label: "Square (2000×2000)",     w: 2000, h: 2000 },
  { k: "strip",  label: "Web Strip (1800×600)",   w: 1800, h: 600 },
];

/* Panel layout library. Each layout is a list of panels as
   [x, y, w, h, rot?] fractions of the page content area (rot in degrees). */
export type LayoutRect = [number, number, number, number, number?];
export interface LayoutCategory { name: string; layouts: LayoutRect[][] }

const grid = (cols: number, rows: number): LayoutRect[] => {
  const out: LayoutRect[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    out.push([c / cols, r / rows, 1 / cols, 1 / rows]);
  return out;
};
const rows = (...hs: number[][]): LayoutRect[] => {
  /* rows(...[height, cols]) — stacked rows each split into equal columns */
  const out: LayoutRect[] = [];
  let y = 0;
  for (const [h, cols] of hs) {
    for (let c = 0; c < cols; c++) out.push([c / cols, y, 1 / cols, h]);
    y += h;
  }
  return out;
};

export const LAYOUT_CATEGORIES: LayoutCategory[] = [
  {
    name: "Basic",
    layouts: [
      [[0, 0, 1, 1]],
      rows([0.5, 1], [0.5, 1]),
      grid(2, 1),
      rows([1 / 3, 1], [1 / 3, 1], [1 / 3, 1]),
      rows([0.5, 1], [0.5, 2]),
      rows([0.5, 2], [0.5, 1]),
      grid(2, 2),
      grid(2, 3),
      grid(3, 3),
      rows([0.34, 1], [0.33, 2], [0.33, 1]),
    ],
  },
  {
    name: "Strips",
    layouts: [
      grid(2, 1), grid(3, 1), grid(4, 1),
      rows([0.5, 3], [0.5, 3]),
      rows([1 / 3, 2], [1 / 3, 2], [1 / 3, 2]),
      grid(1, 4),
    ],
  },
  {
    name: "40's Comic",
    layouts: [
      rows([0.2, 1], [0.4, 2], [0.4, 2]),
      grid(2, 3),
      grid(3, 3),
      [[0, 0, 0.6, 1], [0.6, 0, 0.4, 0.5], [0.6, 0.5, 0.4, 0.5]],
      rows([0.4, 2], [0.6, 1]),
      rows([0.75, 1], [0.25, 1]),
    ],
  },
  {
    name: "60's Comic",
    layouts: [
      rows([0.6, 1], [0.4, 3]),
      rows([0.3, 3], [0.7, 1]),
      [[0, 0, 0.45, 1], [0.45, 0, 0.55, 0.5], [0.45, 0.5, 0.55, 0.5]],
      rows([0.3, 1], [0.4, 1], [0.3, 3]),
      rows([0.35, 2], [0.3, 1], [0.35, 2]),
      [[0, 0, 0.55, 0.55], [0.55, 0, 0.45, 0.55], [0, 0.55, 0.45, 0.45], [0.45, 0.55, 0.55, 0.45]],
    ],
  },
  {
    name: "80's Comic",
    layouts: [
      [[0, 0, 0.62, 1 / 3], [0.62, 0, 0.38, 1 / 3], [0, 1 / 3, 0.38, 1 / 3], [0.38, 1 / 3, 0.62, 1 / 3], [0, 2 / 3, 0.62, 1 / 3], [0.62, 2 / 3, 0.38, 1 / 3]],
      [[0, 0, 1 / 3, 0.55], [1 / 3, 0, 1 / 3, 0.45], [2 / 3, 0, 1 / 3, 0.55], [0, 0.55, 1 / 3, 0.45], [1 / 3, 0.45, 1 / 3, 0.55], [2 / 3, 0.55, 1 / 3, 0.45]],
      [[0, 0, 1, 0.4], [0, 0.4, 0.5, 0.6, -2], [0.5, 0.4, 0.5, 0.6, 2]],
      [[0.02, 0, 0.47, 0.5, -2.5], [0.51, 0.02, 0.47, 0.5, 2], [0.02, 0.52, 0.47, 0.48, 1.5], [0.51, 0.5, 0.47, 0.48, -2]],
      rows([0.25, 1], [0.5, 3], [0.25, 1]),
      [[0, 0, 0.7, 0.6], [0.7, 0, 0.3, 0.3], [0.7, 0.3, 0.3, 0.3], [0, 0.6, 0.35, 0.4], [0.35, 0.6, 0.65, 0.4]],
    ],
  },
  {
    name: "Modern",
    layouts: [
      rows([0.25, 1], [0.25, 1], [0.25, 1], [0.25, 1]),
      rows([0.2, 1], [0.2, 1], [0.2, 1], [0.2, 1], [0.2, 1]),
      rows([0.55, 1], [0.45, 2]),
      rows([0.22, 1], [0.56, 1], [0.22, 1]),
      rows([0.3, 2], [0.4, 1], [0.3, 2]),
      [[0, 0, 1, 0.62], [0, 0.62, 1 / 3, 0.38], [1 / 3, 0.62, 1 / 3, 0.38], [2 / 3, 0.62, 1 / 3, 0.38]],
    ],
  },
  {
    name: "Euro Comic",
    layouts: [
      grid(3, 4),
      grid(2, 4),
      rows([0.25, 2], [0.25, 3], [0.25, 2], [0.25, 3]),
      rows([1 / 3, 3], [1 / 3, 3], [1 / 3, 3]),
      rows([0.25, 3], [0.5, 2], [0.25, 3]),
      rows([0.3, 2], [0.3, 3], [0.4, 1]),
    ],
  },
  {
    name: "Manga",
    layouts: [
      [[0.6, 0, 0.4, 1], [0, 0, 0.6, 0.5], [0, 0.5, 0.6, 0.5]],
      [[0, 0, 1, 0.45], [0.66, 0.45, 0.34, 0.55], [0.33, 0.45, 0.33, 0.55], [0, 0.45, 0.33, 0.55]],
      [[0, 0, 0.65, 0.5], [0.65, 0, 0.35, 0.5], [0, 0.5, 0.35, 0.5], [0.35, 0.5, 0.65, 0.5]],
      [[0.05, 0, 0.9, 0.32, -2], [0.05, 0.34, 0.9, 0.32, 1.5], [0.05, 0.68, 0.9, 0.32, -1.5]],
      grid(1, 4),
      [[0.55, 0, 0.45, 0.62], [0, 0, 0.55, 0.62], [0, 0.62, 1, 0.38]],
    ],
  },
  {
    name: "Graphic Novel",
    layouts: [
      grid(2, 2),
      rows([1 / 3, 1], [1 / 3, 2], [1 / 3, 1]),
      grid(3, 2),
      rows([0.28, 1], [0.72, 3]),
      grid(2, 4),
      [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1 / 3], [0.5, 1 / 3, 0.5, 1 / 3], [0.5, 2 / 3, 0.5, 1 / 3]],
    ],
  },
  {
    name: "Picture-In-Picture",
    layouts: [
      [[0, 0, 1, 1], [0.05, 0.05, 0.3, 0.22]],
      [[0, 0, 1, 1], [0.65, 0.73, 0.3, 0.22]],
      [[0, 0, 1, 1], [0.05, 0.05, 0.28, 0.2], [0.67, 0.75, 0.28, 0.2]],
      [[0, 0, 1, 1], [0.06, 0.72, 0.26, 0.22], [0.37, 0.72, 0.26, 0.22], [0.68, 0.72, 0.26, 0.22]],
    ],
  },
  {
    name: "Conceptual",
    layouts: [
      [[0.08, 0.08, 0.84, 0.84, -2]],
      [[0.02, 0.02, 0.55, 0.5, -3], [0.3, 0.28, 0.55, 0.5, 2], [0.44, 0.5, 0.54, 0.48, -1.5]],
      [[0, 0.25, 0.5, 0.5, -4], [0.5, 0.25, 0.5, 0.5, 4]],
      [[0.25, 0, 0.5, 0.32], [0.1, 0.34, 0.8, 0.32, -2], [0.25, 0.68, 0.5, 0.32]],
    ],
  },
];

export const BALLOON_KINDS: Record<BalloonKind, string> = {
  speech: "Speech", rough: "Rough", buzz: "Buzz", double: "Radio",
  thought: "Thought", shout: "Exclaim", burst2: "Exclaim dense",
  whisper: "Whisper", square: "Square", tv: "TV", extend: "Pill",
  rounded: "Rounded box", caption: "Caption",
};

/* balloon kinds that have no tail */
export const TAILLESS_KINDS: BalloonKind[] = ["caption", "rounded"];

/* ---------------- factories ---------------- */

let idCounter = 1;
export const uid = () => "e" + idCounter++;
export function reseedIds(doc: Doc) {
  let max = 0;
  for (const p of doc.pages) for (const e of p.els) {
    const n = parseInt(String(e.id).replace(/\D/g, ""), 10);
    if (!isNaN(n)) max = Math.max(max, n);
  }
  idCounter = max + 1;
}

export const defaultTextStyle = (over: Partial<TextStyle> = {}): TextStyle => ({
  font: "comicneue", size: 42, bold: false, italic: false, caps: true,
  align: "center", fillA: "#111111", fillB: null,
  outlineC: "#111111", outlineW: 0, shadow: false, shadowC: "#00000088",
  ...over,
});

export function newPage(w = 1500, h = 2250, margin?: PageMargin): Page {
  const m = margin ?? (() => { const v = Math.round(w * 0.035); return { t: v, r: v, b: v, l: v }; })();
  return { w, h, bg: solid("#ffffff"), els: [], margin: m };
}
export function newDoc(): Doc {
  return { app: "comiclettering", version: 2, pages: [newPage()] };
}

const base = (x: number, y: number, w: number, h: number) =>
  ({ id: uid(), x, y, w, h, rot: 0, shadow: false });

export function makeBalloon(kind: BalloonKind, x: number, y: number, w: number, h: number): BalloonEl {
  const caption = TAILLESS_KINDS.includes(kind);
  return {
    ...base(x, y, w, h), type: "balloon", kind,
    text: caption ? "Meanwhile..." : "Your text here",
    ts: defaultTextStyle({
      font: caption ? "serif" : kind === "tv" || kind === "double" ? "audiowide" : "comicneue",
      italic: caption, caps: !caption, bold: kind === "shout" || kind === "burst2",
    }),
    fill: solid(caption ? "#fff7c9" : "#ffffff"),
    stroke: "#111111",
    strokeW: kind === "shout" || kind === "burst2" ? 5 : 3,
    tail: caption ? null : { dx: -w * 0.25, dy: h * 0.85 },
  };
}

export function makePanel(x: number, y: number, w: number, h: number): PanelEl {
  return { ...base(x, y, w, h), type: "panel", fill: solid("#ffffff"), borderW: 6, borderC: "#111111", img: null, filter: "none" };
}

export function makeImage(x: number, y: number, w: number, h: number, img: string): ImageEl {
  return { ...base(x, y, w, h), type: "image", img, filter: "none", borderW: 0, borderC: "#111111" };
}

export function makeText(x: number, y: number, w: number, h: number, sfx: boolean): TextEl {
  return {
    ...base(x, y, w, h), type: "text",
    text: sfx ? "POW!" : "Abc",
    ts: sfx
      ? defaultTextStyle({ font: "bangers", size: 140, fillA: "#ffd21f", fillB: "#ff7a00", outlineC: "#111111", outlineW: 16, shadow: true })
      : defaultTextStyle({ font: "comicneue", size: 60, caps: false }),
  };
}

export function applyLayout(page: Page, fracs: LayoutRect[]) {
  const def = Math.round(page.w * 0.035);
  const mg = page.margin ?? { t: def, r: def, b: def, l: def };
  const g = Math.round(page.w * 0.02);
  const cw = page.w - mg.l - mg.r, ch = page.h - mg.t - mg.b;
  const panels = fracs.map(([fx, fy, fw, fh, rot]) => {
    const x0 = mg.l + fx * cw + (fx > 0.001 ? g / 2 : 0);
    const x1 = mg.l + (fx + fw) * cw - (fx + fw < 0.999 ? g / 2 : 0);
    const y0 = mg.t + fy * ch + (fy > 0.001 ? g / 2 : 0);
    const y1 = mg.t + (fy + fh) * ch - (fy + fh < 0.999 ? g / 2 : 0);
    const p = makePanel(Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0));
    if (rot) p.rot = rot;
    return p;
  });
  page.els = [...panels, ...page.els.filter((e) => e.type !== "panel")];
}

export function starterDoc(): Doc {
  const d = newDoc();
  const p = d.pages[0];
  applyLayout(p, LAYOUT_CATEGORIES[0].layouts[6]); // basic 2×2
  const b = makeBalloon("speech", p.w * 0.14, p.h * 0.09, 560, 330);
  b.text = "Welcome! Double-click me and start lettering.";
  const t = makeText(p.w * 0.5, p.h * 0.42, 640, 240, true);
  const c = makeBalloon("caption", p.w * 0.55, p.h * 0.6, 520, 170);
  c.text = "Drop your artwork onto the panels...";
  p.els.push(b, t, c);
  return d;
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rotVec = (x: number, y: number, deg: number): [number, number] => {
  const r = deg2rad(deg), c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
};
