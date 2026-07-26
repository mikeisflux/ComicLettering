/* ComicLettering Studio — document model, fonts, filters, layouts. */

export type Align = "left" | "center" | "right" | "justify";
export type FilterKey = "none" | "bw" | "sepia" | "vivid" | "faded" | "noir";
export type BalloonKind =
  | "speech" | "rough" | "buzz" | "double" | "thought"
  | "shout" | "burst2" | "whisper" | "square" | "tv"
  | "extend" | "rounded" | "caption" | "custom"
  | "cosmic" | "sketch" | "emitter";

/* ---------------- fills: solid / gradient / halftone ---------------- */

export type HalftoneVariant = "down" | "up" | "left" | "right" | "full" | "midh" | "midv";
export type PatternVariant =
  | "check" | "dots" | "dotsinv" | "hexdots" | "hollowdots" | "smalldots"
  | "linesd" | "linesd2" | "linesh" | "linesv" | "crosshatch" | "zigzag" | "screen";
export type SpeedlineVariant = "burst" | "burst2" | "ring" | "corner" | "horiz" | "horizfade";
export type TextureVariant = "speckle" | "grit" | "static" | "murk" | "daubs" | "stone";

export type GradStop = [string, number]; // [color, position 0..1]

export type FillStyle =
  | { kind: "solid"; a: string }
  | { kind: "gradient"; a: string; b: string; angle: number; stops?: GradStop[] }
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

function hslHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/* Gradient library — [top, bottom] pairs: curated classics plus a full
   sweep of every hue (highlight fade, deep fade, white fade). */
const CURATED_GRADIENTS: [string, string][] = [
  ["#ffffff", "#9ecbff"], ["#c9ecff", "#2e86d4"], ["#fff7b0", "#ff9d2e"],
  ["#ffe14d", "#ff2a00"], ["#ff9d2e", "#e03000"], ["#ff512f", "#dd2476"],
  ["#ffd0e8", "#ff45a4"], ["#eadcff", "#8a4fd8"], ["#d8ffd0", "#3fae4a"],
  ["#fceabb", "#f8b500"], ["#f8f8f8", "#a8aeb8"], ["#41506b", "#0c1220"],
  ["#fffbe6", "#ffd21f"], ["#ffd21f", "#b8860b"], ["#f5f7fa", "#b8c2cc"],
  ["#e8e8e8", "#707880"], ["#ffe0b3", "#b06a2c"], ["#ffcccc", "#8f0000"],
  ["#0fd8c8", "#0a4f8f"], ["#ff9a9e", "#fecfef"], ["#a1c4fd", "#c2e9fb"],
  ["#f6d365", "#fda085"], ["#84fab0", "#8fd3f4"], ["#161a20", "#4a5568"],
];
/* Multi-tier gradients: banded metallics and comic-classic ramps. */
export const MULTI_GRADIENTS: { name: string; stops: GradStop[] }[] = [
  { name: "Gold", stops: [["#fff7cc", 0], ["#ffd21f", 0.35], ["#8a5a00", 0.5], ["#ffd21f", 0.68], ["#fffbe6", 1]] },
  { name: "Chrome", stops: [["#f8fbff", 0], ["#c7d3e0", 0.42], ["#5a6d80", 0.5], ["#e8eff5", 0.58], ["#8ea2b5", 1]] },
  { name: "Silver", stops: [["#ffffff", 0], ["#d7dde4", 0.4], ["#9aa5b1", 0.55], ["#eef2f6", 1]] },
  { name: "Copper", stops: [["#ffe0c2", 0], ["#e08a3c", 0.4], ["#7a3a10", 0.55], ["#ffb26e", 1]] },
  { name: "Fire", stops: [["#fff23e", 0], ["#ff9d1f", 0.4], ["#e8330f", 0.75], ["#7a0b00", 1]] },
  { name: "Magma", stops: [["#ffd21f", 0], ["#ff5a00", 0.35], ["#a30f0f", 0.7], ["#26060a", 1]] },
  { name: "Sunset", stops: [["#ffd76e", 0], ["#ff8a5c", 0.4], ["#e0498a", 0.75], ["#5b2a86", 1]] },
  { name: "Ocean", stops: [["#b8f1ff", 0], ["#3fc3e8", 0.35], ["#1a6fd4", 0.7], ["#0c2a5e", 1]] },
  { name: "Emerald", stops: [["#d8ffd0", 0], ["#4ecb5f", 0.45], ["#0f7a2a", 0.75], ["#06381a", 1]] },
  { name: "Toxic", stops: [["#f4ff5e", 0], ["#8fe000", 0.5], ["#2e6b00", 1]] },
  { name: "Candy", stops: [["#ffd9ec", 0], ["#ff6eb4", 0.45], ["#ffffff", 0.55], ["#ff45a4", 1]] },
  { name: "Grape", stops: [["#ecd9ff", 0], ["#a05ce8", 0.5], ["#4a1580", 1]] },
  { name: "Night", stops: [["#4a5a8a", 0], ["#252a55", 0.55], ["#0a0b1e", 1]] },
  { name: "Rainbow", stops: [["#ff3b30", 0], ["#ff9500", 0.2], ["#ffe14d", 0.4], ["#34c759", 0.6], ["#2e86d4", 0.8], ["#8a4fd8", 1]] },
  { name: "Steel", stops: [["#e8ecf0", 0], ["#8d99a6", 0.5], ["#3c4650", 0.85], ["#c2ccd6", 1]] },
  { name: "Cream", stops: [["#fffdf2", 0], ["#ffe9b0", 0.55], ["#e0a83c", 1]] },
];

export const GRADIENT_PRESETS: [string, string][] = (() => {
  const out = [...CURATED_GRADIENTS];
  for (let i = 0; i < 12; i++) {
    const h = i * 30;
    out.push([hslHex(h, 1, 0.68), hslHex(h, 1, 0.44)]);      // vivid pop
    out.push([hslHex(h, 0.95, 0.5), hslHex(h, 1, 0.24)]);    // rich deep
  }
  return out;
})();

/* Color palette grid for the Fill picker: grayscale row + hue × lightness. */
export const COLOR_PALETTE: string[][] = (() => {
  const rows: string[][] = [];
  rows.push(Array.from({ length: 14 }, (_, i) => {
    const v = Math.round((i / 13) * 255);
    return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
  }));
  const lights = [0.88, 0.75, 0.62, 0.5, 0.38, 0.26];
  for (const l of lights) {
    rows.push(Array.from({ length: 14 }, (_, i) => hslHex(Math.round((i / 14) * 360), 0.92, l)));
  }
  return rows;
})();

export interface TextStyle {
  font: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
  caps: boolean;
  align: Align;
  lineHeight?: number; // line-spacing multiplier (default 1.25)
  tracking?: number;   // letter-spacing in px (default 0)
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
     bx/by: optional bend point the tail curves through.
     tx/ty: optional tangent direction at the bend (the tilt axis of a
     joined-balloon connector). */
  tail: { dx: number; dy: number; bx?: number; by?: number; tx?: number; ty?: number } | null;
  /* id of a balloon this one is attached to: they render joined, with the
     connector tail aimed at the partner automatically */
  attachTo?: string | null;
  /* optional image content (e.g. pre-made lettering stamps), clipped to the
     balloon shape and drawn behind the text */
  img?: string | null;
  /* hand-drawn outline for kind "custom": closed polygon, points normalised
     to the element box (0..1) */
  pts?: [number, number][];
  /* how a custom balloon's tail renders: spliced speech taper (default) or
     a thought-bubble trail */
  tailStyle?: "speech" | "thought";
  /* transient (set by resolveBalloon, never saved): render the tail as a
     wide connector band between joined balloons instead of a point */
  band?: boolean;
}

/* aim a band-tail from `from` toward the centre of `to` (local, unrotated) */
function bandToward(from: BalloonEl, to: BalloonEl, keep?: BalloonEl["tail"]): BalloonEl["tail"] {
  const [dx, dy] = rotVec(
    to.x + to.w / 2 - (from.x + from.w / 2),
    to.y + to.h / 2 - (from.y + from.h / 2),
    -from.rot);
  const t: NonNullable<BalloonEl["tail"]> = { dx: Math.round(dx), dy: Math.round(dy) };
  if (keep && keep.bx != null && keep.by != null) { t.bx = keep.bx; t.by = keep.by; t.tx = keep.tx; t.ty = keep.ty; }
  return t;
}

/* Resolve a balloon's effective tail for rendering. Joined balloons connect
   with a wide band that opens into BOTH balloons; once they overlap they melt
   into one shape and the connector vanishes entirely. */
export function resolveBalloon(page: Page, el: BalloonEl): { el: BalloonEl; base: BalloonEl | null } {
  /* is this balloon the parent of a joined child? */
  const child = page.els.find(
    (e) => e.type === "balloon" && (e as BalloonEl).attachTo === el.id) as BalloonEl | undefined;

  if (!el.attachTo) {
    /* a parent opens a band toward its child while they're apart, so the
       connector flows in instead of butting against a closed outline */
    if (child && !aabbOverlap(el, child)) {
      return { el: { ...el, band: true, tail: bandToward(el, child, el.tail) }, base: null };
    }
    return { el, base: null };
  }

  const base = page.els.find((e) => e.id === el.attachTo && e.type === "balloon") as BalloonEl | undefined;
  if (!base) return { el: { ...el, attachTo: null }, base: null };

  /* overlapping → melt into one shape: no connector, fills union */
  if (aabbOverlap(el, base)) {
    return { el: { ...el, band: false, tail: null }, base };
  }
  /* apart → band aimed at the partner's centre */
  return { el: { ...el, band: true, tail: bandToward(el, base, el.tail) }, base };
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

export type FontVariant = "regular" | "bold" | "italic" | "bolditalic";
export interface FontDef { label: string; css: string; group: string; variants: FontVariant[] }
const ALL: FontVariant[] = ["regular", "bold", "italic", "bolditalic"];
const RB: FontVariant[] = ["regular", "bold"];
const R: FontVariant[] = ["regular"];

export const FONTS: Record<string, FontDef> = {
  /* Dialogue */
  lmcdialogue: { label: "LMC Dialogue", css: '"LMC Dialogue",cursive', group: "Dialogue", variants: ALL },
  lmccasual:  { label: "LMC Casual",  css: '"LMC Casual",cursive',  group: "Dialogue", variants: ALL },
  lmcagent:   { label: "LMC Agent",   css: '"LMC Agent",cursive',   group: "Dialogue", variants: ALL },
  lmchero:    { label: "LMC Hero",    css: '"LMC Hero",cursive',    group: "Dialogue", variants: ALL },
  lmcalley:   { label: "LMC Alley",   css: '"LMC Alley",cursive',   group: "Dialogue", variants: ALL },
  lmcwhisper: { label: "LMC Whisper", css: '"LMC Whisper",cursive', group: "Dialogue", variants: ALL },
  comicneue: { label: "Comic Neue",       css: '"Comic Neue","Comic Sans MS",cursive', group: "Dialogue", variants: ALL },
  patrick:   { label: "Patrick Hand",     css: '"Patrick Hand",cursive',               group: "Dialogue", variants: R },
  kalam:     { label: "Kalam",            css: '"Kalam",cursive',                      group: "Dialogue", variants: RB },
  shantell:  { label: "Shantell Sans",    css: '"Shantell Sans",cursive',              group: "Dialogue", variants: RB },
  gochi:     { label: "Gochi Hand",       css: '"Gochi Hand",cursive',                 group: "Dialogue", variants: R },
  schoolbell:{ label: "Schoolbell",       css: '"Schoolbell",cursive',                 group: "Dialogue", variants: R },
  walter:    { label: "Walter Turncoat",  css: '"Walter Turncoat",cursive',            group: "Dialogue", variants: R },
  delius:    { label: "Delius",           css: '"Delius",cursive',                     group: "Dialogue", variants: R },
  deliussw:  { label: "Delius Swash",     css: '"Delius Swash Caps",cursive',          group: "Dialogue", variants: R },
  deliusuni: { label: "Delius Unicase",   css: '"Delius Unicase",cursive',             group: "Dialogue", variants: RB },
  gloria:    { label: "Gloria Hallelujah", css: '"Gloria Hallelujah",cursive',         group: "Dialogue", variants: R },
  happymonkey: { label: "Happy Monkey",   css: '"Happy Monkey",sans-serif',            group: "Dialogue", variants: R },
  neucha:    { label: "Neucha",           css: '"Neucha",cursive',                     group: "Dialogue", variants: R },
  pangolin:  { label: "Pangolin",         css: '"Pangolin",cursive',                   group: "Dialogue", variants: R },
  itim:      { label: "Itim",             css: '"Itim",cursive',                       group: "Dialogue", variants: R },
  mali:      { label: "Mali",             css: '"Mali",cursive',                       group: "Dialogue", variants: ALL },
  sriracha:  { label: "Sriracha",         css: '"Sriracha",cursive',                   group: "Dialogue", variants: R },
  comingsoon:{ label: "Coming Soon",      css: '"Coming Soon",cursive',                group: "Dialogue", variants: R },
  architects:{ label: "Architects Daughter", css: '"Architects Daughter",cursive',     group: "Dialogue", variants: R },
  indieflower:{ label: "Indie Flower",    css: '"Indie Flower",cursive',               group: "Dialogue", variants: R },
  shortstack:{ label: "Short Stack",      css: '"Short Stack",cursive',                group: "Dialogue", variants: R },
  handlee:   { label: "Handlee",          css: '"Handlee",cursive',                    group: "Dialogue", variants: R },
  loveya:    { label: "Love Ya Like A Sister", css: '"Love Ya Like A Sister",cursive', group: "Dialogue", variants: R },
  justanother:{ label: "Just Another Hand", css: '"Just Another Hand",cursive',        group: "Dialogue", variants: R },
  covered:   { label: "Covered By Your Grace", css: '"Covered By Your Grace",cursive', group: "Dialogue", variants: R },
  sueellen:  { label: "Sue Ellen Francisco", css: '"Sue Ellen Francisco",cursive',     group: "Dialogue", variants: R },
  rocksalt:  { label: "Rock Salt",        css: '"Rock Salt",cursive',                  group: "Dialogue", variants: R },
  shadows:   { label: "Shadows Into Light", css: '"Shadows Into Light",cursive',       group: "Dialogue", variants: R },
  patricksc: { label: "Patrick Hand SC",  css: '"Patrick Hand SC",cursive',            group: "Dialogue", variants: R },
  annie:     { label: "Annie Use Your Telescope", css: '"Annie Use Your Telescope",cursive', group: "Dialogue", variants: R },
  crafty:    { label: "Crafty Girls",     css: '"Crafty Girls",cursive',               group: "Dialogue", variants: R },
  comicsans: { label: "Comic Sans",       css: '"Comic Sans MS","Comic Sans","Chalkboard SE",cursive', group: "Dialogue", variants: ALL },
  /* Display / SFX */
  lmcshout:  { label: "LMC Shout",  css: '"LMC Shout",cursive',  group: "Display", variants: ALL },
  lmcbrawl:  { label: "LMC Brawl",  css: '"LMC Brawl",cursive',  group: "Display", variants: ALL },
  bangers:   { label: "Bangers",          css: '"Bangers",cursive',        group: "Display", variants: R },
  luckiest:  { label: "Luckiest Guy",     css: '"Luckiest Guy",cursive',   group: "Display", variants: R },
  boogaloo:  { label: "Boogaloo",         css: '"Boogaloo",cursive',       group: "Display", variants: R },
  chewy:     { label: "Chewy",            css: '"Chewy",cursive',          group: "Display", variants: R },
  alfa:      { label: "Alfa Slab One",    css: '"Alfa Slab One",serif',    group: "Display", variants: R },
  bungee:    { label: "Bungee",           css: '"Bungee",cursive',         group: "Display", variants: R },
  league:    { label: "League Gothic",    css: '"League Gothic","Arial Narrow",sans-serif', group: "Display", variants: R },
  impact:    { label: "Impact",           css: 'Impact,"Arial Black",sans-serif', group: "Display", variants: R },
  titan:     { label: "Titan One",        css: '"Titan One",cursive',      group: "Display", variants: R },
  lilita:    { label: "Lilita One",       css: '"Lilita One",cursive',     group: "Display", variants: R },
  passion:   { label: "Passion One",      css: '"Passion One",cursive',    group: "Display", variants: RB },
  fredoka:   { label: "Fredoka",          css: '"Fredoka",sans-serif',     group: "Display", variants: RB },
  sniglet:   { label: "Sniglet",          css: '"Sniglet",cursive',        group: "Display", variants: R },
  rampart:   { label: "Rampart One",      css: '"Rampart One",cursive',    group: "Display", variants: R },
  anton:     { label: "Anton",            css: '"Anton",sans-serif',       group: "Display", variants: R },
  archivoblack:{ label: "Archivo Black",  css: '"Archivo Black",sans-serif', group: "Display", variants: R },
  sigmar:    { label: "Sigmar One",       css: '"Sigmar One",cursive',     group: "Display", variants: R },
  bowlby:    { label: "Bowlby One SC",    css: '"Bowlby One SC",cursive',  group: "Display", variants: R },
  modak:     { label: "Modak (Fat)",      css: '"Modak",cursive',          group: "Display", variants: R },
  shrikhand: { label: "Shrikhand",        css: '"Shrikhand",cursive',      group: "Display", variants: R },
  chango:    { label: "Chango",           css: '"Chango",cursive',         group: "Display", variants: R },
  slackey:   { label: "Slackey",          css: '"Slackey",cursive',        group: "Display", variants: R },
  knewave:   { label: "Knewave (Brush)",  css: '"Knewave",cursive',        group: "Display", variants: R },
  frijole:   { label: "Frijole",          css: '"Frijole",cursive',        group: "Display", variants: R },
  erica:     { label: "Erica One",        css: '"Erica One",cursive',      group: "Display", variants: R },
  ranchers:  { label: "Ranchers",         css: '"Ranchers",cursive',       group: "Display", variants: R },
  lemon:     { label: "Lemon",            css: '"Lemon",serif',            group: "Display", variants: R },
  paytone:   { label: "Paytone One",      css: '"Paytone One",sans-serif', group: "Display", variants: R },
  carter:    { label: "Carter One",       css: '"Carter One",cursive',     group: "Display", variants: R },
  fugaz:     { label: "Fugaz One",        css: '"Fugaz One",cursive',      group: "Display", variants: R },
  ceviche:   { label: "Ceviche One",      css: '"Ceviche One",cursive',    group: "Display", variants: R },
  spicyrice: { label: "Spicy Rice",       css: '"Spicy Rice",cursive',     group: "Display", variants: R },
  bubblegum: { label: "Bubblegum Sans",   css: '"Bubblegum Sans",cursive', group: "Display", variants: R },
  baloo:     { label: "Baloo 2",          css: '"Baloo 2",cursive',        group: "Display", variants: RB },
  bungeeshade:{ label: "Bungee Shade",    css: '"Bungee Shade",cursive',   group: "Display", variants: R },
  bungeeinline:{ label: "Bungee Inline",  css: '"Bungee Inline",cursive',  group: "Display", variants: R },
  bungeeoutline:{ label: "Bungee Outline", css: '"Bungee Outline",cursive', group: "Display", variants: R },
  fasterone: { label: "Faster One (Speed)", css: '"Faster One",cursive',   group: "Display", variants: R },
  racing:    { label: "Racing Sans One",  css: '"Racing Sans One",cursive', group: "Display", variants: R },
  blackops:  { label: "Black Ops One (Stencil)", css: '"Black Ops One",cursive', group: "Display", variants: R },
  cabinsketch:{ label: "Cabin Sketch",    css: '"Cabin Sketch",cursive',   group: "Display", variants: RB },
  londrina:  { label: "Londrina Solid",   css: '"Londrina Solid",cursive', group: "Display", variants: RB },
  londrinashadow:{ label: "Londrina Shadow", css: '"Londrina Shadow",cursive', group: "Display", variants: R },
  londrinaoutline:{ label: "Londrina Outline", css: '"Londrina Outline",cursive', group: "Display", variants: R },
  fingerpaint:{ label: "Finger Paint",    css: '"Finger Paint",cursive',   group: "Display", variants: R },
  spraypaint: { label: "Rubik Spray Paint (Grunge)", css: '"Rubik Spray Paint",cursive', group: "Display", variants: R },
  freckle:   { label: "Freckle Face",     css: '"Freckle Face",cursive',   group: "Display", variants: R },
  kranky:    { label: "Kranky",           css: '"Kranky",cursive',         group: "Display", variants: R },
  /* Themed */
  lmchorror:  { label: "LMC Horror",  css: '"LMC Horror",cursive',  group: "Themed", variants: ALL },
  lmcsneeze:  { label: "LMC Sneeze",  css: '"LMC Sneeze",cursive',  group: "Themed", variants: ALL },
  lmcmumble:  { label: "LMC Mumble (Scribble)", css: '"LMC Mumble",cursive', group: "Themed", variants: ALL },
  lmcdragon:  { label: "LMC Dragon", css: '"LMC Dragon",cursive', group: "Themed", variants: ALL },
  lmcalien:   { label: "LMC Alien (Sigils)", css: '"LMC Alien",cursive', group: "Themed", variants: RB },
  lmcvapor:   { label: "LMC Vapor (Bubbles)", css: '"LMC Vapor",cursive', group: "Themed", variants: ALL },
  sacramento: { label: "Sacramento (Thin Script)", css: '"Sacramento",cursive', group: "Themed", variants: R },
  greatvibes: { label: "Great Vibes (Tattoo Script)", css: '"Great Vibes",cursive', group: "Themed", variants: R },
  allerta:    { label: "Allerta Stencil", css: '"Allerta Stencil",sans-serif', group: "Display", variants: R },
  mountains:  { label: "Mountains of Christmas", css: '"Mountains of Christmas",cursive', group: "Themed", variants: RB },
  graduate:   { label: "Graduate (Collegiate)", css: '"Graduate",serif', group: "Display", variants: R },
  lmcslasher: { label: "LMC Slasher", css: '"LMC Slasher",cursive', group: "Themed", variants: ALL },
  lmccosmos:  { label: "LMC Cosmos",  css: '"LMC Cosmos",cursive',  group: "Themed", variants: ALL },
  cinzeldeco: { label: "Cinzel Decorative (Occult)", css: '"Cinzel Decorative",serif', group: "Themed", variants: RB },
  pirata:     { label: "Pirata One (Pirate)", css: '"Pirata One",cursive', group: "Themed", variants: R },
  metamorph:  { label: "Metamorphous (Gladiator)", css: '"Metamorphous",serif', group: "Themed", variants: R },
  almendra:   { label: "Almendra (Fantasy)", css: '"Almendra",serif', group: "Themed", variants: ALL },
  rubikburned:{ label: "Rubik Burned (Char)", css: '"Rubik Burned",cursive', group: "Themed", variants: R },
  bahiana:    { label: "Bahiana (Woodcut)", css: '"Bahiana",cursive', group: "Themed", variants: R },
  beastly:    { label: "Rubik Beastly (Fuzzy)", css: '"Rubik Beastly",cursive', group: "Themed", variants: R },
  wetpaint:   { label: "Rubik Wet Paint (Splatter)", css: '"Rubik Wet Paint",cursive', group: "Themed", variants: R },
  medieval:   { label: "MedievalSharp (Witchy)", css: '"MedievalSharp",cursive', group: "Themed", variants: R },
  poiret:     { label: "Poiret One (Deco Line)", css: '"Poiret One",cursive', group: "Themed", variants: R },
  wallpoet:   { label: "Wallpoet (Stencil Tech)", css: '"Wallpoet",cursive', group: "Themed", variants: R },
  tradewinds: { label: "Trade Winds (Circus)", css: '"Trade Winds",cursive', group: "Themed", variants: R },
  giveyouglory:{ label: "Give You Glory (Notes)", css: '"Give You Glory",cursive', group: "Dialogue", variants: R },
  limelight:  { label: "Limelight (Noir Deco)", css: '"Limelight",cursive', group: "Themed", variants: R },
  pacifico:   { label: "Pacifico (Retro Script)", css: '"Pacifico",cursive', group: "Themed", variants: R },
  kaushan:    { label: "Kaushan Script (Brush)", css: '"Kaushan Script",cursive', group: "Themed", variants: R },
  rubikglitch:{ label: "Rubik Glitch (Cyber)", css: '"Rubik Glitch",cursive', group: "Themed", variants: R },
  rye:        { label: "Rye (Victorian)", css: '"Rye",cursive', group: "Themed", variants: R },
  uncial:     { label: "Uncial Antiqua (Norse)", css: '"Uncial Antiqua",cursive', group: "Themed", variants: R },
  oldenburg:  { label: "Oldenburg (News Slab)", css: '"Oldenburg",cursive', group: "Themed", variants: R },
  pressstart: { label: "Press Start 2P (8-Bit)", css: '"Press Start 2P",monospace', group: "Themed", variants: R },
  vt323:      { label: "VT323 (Digital)", css: '"VT323",monospace', group: "Themed", variants: R },
  charm:      { label: "Charm (Chancery Pen)", css: '"Charm",cursive', group: "Themed", variants: RB },
  caesar:     { label: "Caesar Dressing (Greek)", css: '"Caesar Dressing",cursive', group: "Themed", variants: R },
  ultra:      { label: "Ultra (Pulp Slab)", css: '"Ultra",serif', group: "Themed", variants: R },
  creepster: { label: "Creepster",        css: '"Creepster",cursive',      group: "Themed", variants: R },
  nosifer:   { label: "Nosifer (Drip)",   css: '"Nosifer",cursive',        group: "Themed", variants: R },
  audiowide: { label: "Audiowide (Sci-Fi)", css: '"Audiowide",sans-serif', group: "Themed", variants: R },
  marker:    { label: "Permanent Marker", css: '"Permanent Marker",cursive', group: "Themed", variants: R },
  courier:   { label: "Courier Prime",    css: '"Courier Prime","Courier New",monospace', group: "Themed", variants: ALL },
  caveat:    { label: "Caveat",           css: '"Caveat",cursive',         group: "Themed", variants: RB },
  amatic:    { label: "Amatic SC",        css: '"Amatic SC",cursive',      group: "Themed", variants: RB },
  elite:     { label: "Special Elite",    css: '"Special Elite",monospace', group: "Themed", variants: R },
  griffy:    { label: "Griffy (Spooky)",  css: '"Griffy",cursive',          group: "Themed", variants: R },
  hennypenny:{ label: "Henny Penny",      css: '"Henny Penny",cursive',     group: "Themed", variants: R },
  mysteryquest:{ label: "Mystery Quest",  css: '"Mystery Quest",cursive',   group: "Themed", variants: R },
  jollylodger:{ label: "Jolly Lodger",    css: '"Jolly Lodger",cursive',    group: "Themed", variants: R },
  eater:     { label: "Eater (Horror)",   css: '"Eater",cursive',           group: "Themed", variants: R },
  butcherman:{ label: "Butcherman (Horror)", css: '"Butcherman",cursive',   group: "Themed", variants: R },
  barrio:    { label: "Barrio (Grunge)",  css: '"Barrio",cursive',          group: "Themed", variants: R },
  sedgwick:  { label: "Sedgwick Ave (Graffiti)", css: '"Sedgwick Ave",cursive', group: "Themed", variants: R },
  sedgwickd: { label: "Sedgwick Ave Display", css: '"Sedgwick Ave Display",cursive', group: "Themed", variants: R },
  /* System */
  jost:      { label: "Jost (Geometric)", css: '"Jost",sans-serif',        group: "System", variants: ALL },
  sans:      { label: "Arial",            css: "Arial,Helvetica,sans-serif", group: "System", variants: ALL },
  serif:     { label: "Georgia",          css: 'Georgia,"Times New Roman",serif', group: "System", variants: ALL },
};

export const FONT_GROUPS = ["My Fonts", "Site Fonts", "Dialogue", "Display", "Themed", "System"];

/* Register a runtime-loaded font (user-imported or site-wide). */
export function registerFont(key: string, label: string, family: string, group: "My Fonts" | "Site Fonts" = "My Fonts") {
  FONTS[key] = { label, css: `"${family}", sans-serif`, group, variants: ["regular"] };
}

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
  rounded: "Rounded box", caption: "Caption", custom: "Hand-drawn",
  cosmic: "Dotted ring", sketch: "Sketchy pen", emitter: "Emitter rings",
};

/* balloon kinds that have no tail */
export const TAILLESS_KINDS: BalloonKind[] = ["caption", "rounded", "cosmic", "emitter"];

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
    text: caption ? "Meanwhile..." : "Your words here...",
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

/* New documents start as a single blank page — pick a layout or drop art in. */
export function starterDoc(): Doc {
  return newDoc();
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* Mix a hex color toward white — used for the glossy top highlight on
   gradient lettering. */
export function lightenHex(hex: string, amt = 0.5): string {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((c) => c + c).join("") : m.padEnd(6, "0");
  const n = parseInt(v.slice(0, 6), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amt);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
export const deg2rad = (d: number) => (d * Math.PI) / 180;
export const rotVec = (x: number, y: number, deg: number): [number, number] => {
  const r = deg2rad(deg), c = Math.cos(r), s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
};
