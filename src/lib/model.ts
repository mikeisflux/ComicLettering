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

  /* --- metallics and foils --- */
  { name: "Rose Gold", stops: [["#fff0ea", 0], ["#f0b8a8", 0.38], ["#a85f4c", 0.55], ["#ffd8c8", 1]] },
  { name: "Brass", stops: [["#fff2c0", 0], ["#d4a72c", 0.45], ["#6b4c0a", 0.6], ["#f0cf6e", 1]] },
  { name: "Bronze", stops: [["#f7d9a8", 0], ["#b07a34", 0.45], ["#5a3410", 0.7], ["#e0aa62", 1]] },
  { name: "Gunmetal", stops: [["#cfd6dd", 0], ["#6b757f", 0.4], ["#232a31", 0.7], ["#8d99a4", 1]] },
  { name: "Platinum", stops: [["#ffffff", 0], ["#e4e9ee", 0.35], ["#b3bcc5", 0.6], ["#f4f7fa", 1]] },
  { name: "Titanium", stops: [["#dfe6ec", 0], ["#93a1ad", 0.45], ["#4c5a67", 0.8], ["#c4ced8", 1]] },
  { name: "Oil Slick", stops: [["#2e1a4a", 0], ["#1f6f8f", 0.28], ["#2fa36b", 0.5], ["#c05a2e", 0.74], ["#5a2050", 1]] },
  { name: "Holo", stops: [["#ffd9f2", 0], ["#c9e4ff", 0.25], ["#d6ffe8", 0.5], ["#fff5cc", 0.75], ["#f0d4ff", 1]] },
  { name: "Iridescent", stops: [["#8fe8ff", 0], ["#c48fff", 0.3], ["#ff8fd0", 0.55], ["#ffd98f", 0.8], ["#9dffc4", 1]] },
  { name: "Prism", stops: [["#ff6b9d", 0], ["#feca57", 0.25], ["#48dbfb", 0.5], ["#1dd1a1", 0.75], ["#a55eea", 1]] },

  /* --- skies, weather and water --- */
  { name: "Dawn", stops: [["#ffd6a5", 0], ["#ff9a8b", 0.4], ["#a06cd5", 0.75], ["#3b2a68", 1]] },
  { name: "Dusk", stops: [["#f8b195", 0], ["#c06c84", 0.4], ["#6c5b7b", 0.72], ["#355c7d", 1]] },
  { name: "Midday", stops: [["#e6f7ff", 0], ["#8fd0f5", 0.5], ["#3a8fd0", 1]] },
  { name: "Storm", stops: [["#8d99ae", 0], ["#4a5568", 0.45], ["#1f2430", 1]] },
  { name: "Aurora", stops: [["#0b1a2e", 0], ["#1b7a5a", 0.35], ["#4fd6a0", 0.55], ["#7a5ad6", 0.8], ["#12102e", 1]] },
  { name: "Deep Sea", stops: [["#2ec5c0", 0], ["#1a7ba8", 0.4], ["#0d3562", 0.75], ["#04101f", 1]] },
  { name: "Lagoon", stops: [["#d6fff5", 0], ["#5fe0c8", 0.4], ["#128f9e", 1]] },
  { name: "Glacier", stops: [["#ffffff", 0], ["#d8f0ff", 0.35], ["#7fb8dd", 0.7], ["#2e5f85", 1]] },
  { name: "Sandstorm", stops: [["#fff1cc", 0], ["#e0b76e", 0.45], ["#9c6b34", 1]] },
  { name: "Smog", stops: [["#e8dcc0", 0], ["#a89878", 0.5], ["#4f4738", 1]] },

  /* --- heat and hazard --- */
  { name: "Inferno", stops: [["#fffbe0", 0], ["#ffd21f", 0.22], ["#ff6a00", 0.5], ["#c00d0d", 0.78], ["#2a0505", 1]] },
  { name: "Ember", stops: [["#ffb36e", 0], ["#e04a1a", 0.45], ["#6b1005", 1]] },
  { name: "Plasma", stops: [["#fff0ff", 0], ["#ff6ee8", 0.32], ["#8a2be2", 0.66], ["#1a0a3a", 1]] },
  { name: "Radiation", stops: [["#f7ffb0", 0], ["#c8f000", 0.4], ["#4e8a00", 0.75], ["#0f2a05", 1]] },
  { name: "Kryptonite", stops: [["#e8ffd0", 0], ["#7fe03a", 0.42], ["#1f7a2a", 1]] },
  { name: "Acid Burn", stops: [["#fbff3a", 0], ["#3aff8a", 0.5], ["#00a86b", 1]] },
  { name: "Blood", stops: [["#ff8a7a", 0], ["#c41818", 0.42], ["#5a0208", 1]] },
  { name: "Rust", stops: [["#f0c08a", 0], ["#b5602a", 0.45], ["#5c2810", 1]] },
  { name: "Toxic Waste", stops: [["#d8ff5e", 0], ["#5ec24a", 0.4], ["#1a5c3a", 0.75], ["#08221a", 1]] },
  { name: "Warning", stops: [["#ffe14d", 0], ["#ffb300", 0.5], ["#1a1a1a", 1]] },

  /* --- neon and night --- */
  { name: "Neon Pink", stops: [["#ffd6f5", 0], ["#ff2ec4", 0.45], ["#7a0059", 1]] },
  { name: "Neon Blue", stops: [["#d6f6ff", 0], ["#00c2ff", 0.42], ["#00306b", 1]] },
  { name: "Neon Lime", stops: [["#f2ffd6", 0], ["#8aff00", 0.42], ["#1f5c00", 1]] },
  { name: "Vaporwave", stops: [["#ff71ce", 0], ["#b967ff", 0.35], ["#01cdfe", 0.7], ["#05ffa1", 1]] },
  { name: "Synthwave", stops: [["#ff2a6d", 0], ["#d1006c", 0.35], ["#3b1e6e", 0.7], ["#0d0221", 1]] },
  { name: "Cyberpunk", stops: [["#fcee0a", 0], ["#ff2a6d", 0.4], ["#05d9e8", 0.75], ["#01012b", 1]] },
  { name: "Midnight", stops: [["#3a4a7a", 0], ["#1a2145", 0.5], ["#05060f", 1]] },
  { name: "Shadow", stops: [["#6b7280", 0], ["#2c313a", 0.5], ["#000000", 1]] },
  { name: "Ultraviolet", stops: [["#e0c8ff", 0], ["#8a2be2", 0.45], ["#2a0a5e", 1]] },
  { name: "Void", stops: [["#4a2a7a", 0], ["#160d33", 0.55], ["#000000", 1]] },

  /* --- pastels and paper --- */
  { name: "Cotton Candy", stops: [["#ffe4f2", 0], ["#ffc2e0", 0.4], ["#c2e0ff", 1]] },
  { name: "Peach", stops: [["#fff2e8", 0], ["#ffd0b0", 0.5], ["#f0a072", 1]] },
  { name: "Mint Cream", stops: [["#f2fffa", 0], ["#c8f0e0", 0.5], ["#7fc4ac", 1]] },
  { name: "Lavender Ice", stops: [["#f8f2ff", 0], ["#ddc8f5", 0.5], ["#a888d8", 1]] },
  { name: "Butter", stops: [["#fffce8", 0], ["#fff0a8", 0.5], ["#e8d060", 1]] },
  { name: "Newsprint", stops: [["#f7f4ea", 0], ["#e0d9c6", 0.55], ["#b8ae96", 1]] },
  { name: "Aged Paper", stops: [["#fdf6e0", 0], ["#e8d5a8", 0.5], ["#b09256", 1]] },
  { name: "Blueprint", stops: [["#2a5fa8", 0], ["#1a3f78", 0.55], ["#0c2145", 1]] },
  { name: "Sepia", stops: [["#f2e2c6", 0], ["#c49a5e", 0.5], ["#6b4a24", 1]] },
  { name: "Charcoal", stops: [["#c8ccd0", 0], ["#6b7278", 0.5], ["#22262a", 1]] },

  /* --- spectrum sweeps --- */
  { name: "Spectrum", stops: [["#ff0000", 0], ["#ffff00", 0.17], ["#00ff00", 0.34], ["#00ffff", 0.5], ["#0000ff", 0.67], ["#ff00ff", 0.84], ["#ff0000", 1]] },
  { name: "Warm Sweep", stops: [["#fff200", 0], ["#ff9a00", 0.33], ["#ff2e00", 0.66], ["#a80038", 1]] },
  { name: "Cool Sweep", stops: [["#c8ffe8", 0], ["#00d4ff", 0.35], ["#2e5ce0", 0.7], ["#5e0ec4", 1]] },
  { name: "Tropical", stops: [["#fff44f", 0], ["#3aff8a", 0.35], ["#00c2ff", 0.7], ["#7a3aff", 1]] },
  { name: "Autumn", stops: [["#ffd76e", 0], ["#e08a2e", 0.4], ["#a83a1a", 0.75], ["#4a1a0c", 1]] },
  { name: "Forest", stops: [["#d8f0c0", 0], ["#5ea83c", 0.42], ["#1f5c22", 0.78], ["#0a2a12", 1]] },
  { name: "Desert", stops: [["#fff0c8", 0], ["#e8b76e", 0.4], ["#b5702e", 0.75], ["#6b3a14", 1]] },
  { name: "Arctic", stops: [["#ffffff", 0], ["#cfeaff", 0.4], ["#7aa8cc", 0.75], ["#2a4a6b", 1]] },
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
  /* dry-media brush texture masked over the letterforms (see lib/brushes) */
  brush?: string;
  /* coloured halo thrown off the letterforms (see lib/glows) */
  glow?: string;
  glowW?: number;
  /* envelope warp control points, in units of the element box (see lib/warp) */
  env?: number[][];
  align: Align;
  lineHeight?: number; // line-spacing multiplier (default 1.05 — comic leading is tight)
  tracking?: number;   // letter-spacing in px (default 0)
  crossbarI?: boolean; // draw crossbars on the pronoun "I" (comic convention)
  fillA: string;
  fillB: string | null; // gradient bottom stop; null = solid fillA
  outlineC: string;
  outlineW: number;
  shadow: boolean;
  shadowC: string;
}

/* Inline emphasis: a balloon/text's lettering can be broken into runs, each
   optionally bold and/or italic, on top of the element's base TextStyle. When
   `runs` is absent the plain `text` (with the base style) is used. */
export interface TextRun { t: string; b?: boolean; i?: boolean; u?: boolean }
export function runsToText(runs: TextRun[]): string {
  return runs.map((r) => r.t).join("");
}
/* collapse runs that carry no emphasis (or a single plain run) to nothing, so
   we only persist `runs` when there is real inline formatting */
export function normalizeRuns(runs: TextRun[]): TextRun[] | undefined {
  const merged: TextRun[] = [];
  for (const r of runs) {
    if (!r.t) continue;
    const last = merged[merged.length - 1];
    if (last && !!last.b === !!r.b && !!last.i === !!r.i && !!last.u === !!r.u) last.t += r.t;
    else merged.push({ t: r.t, ...(r.b ? { b: true } : {}), ...(r.i ? { i: true } : {}), ...(r.u ? { u: true } : {}) });
  }
  /* drop the trailing blank the browser leaves behind, so the runs and the
     plain text agree on where the lettering ends */
  while (merged.length) {
    const last = merged[merged.length - 1];
    last.t = last.t.replace(/\s+$/, "");
    if (last.t) break;
    merged.pop();
  }
  if (merged.length === 0) return undefined;
  if (merged.length === 1 && !merged[0].b && !merged[0].i && !merged[0].u) return undefined;
  return merged;
}

/* Comic crossbar-I: the pronoun "I" (and I-contractions) gets a bar above and
   below. Implemented with combining macrons so it renders identically in the
   DOM editor and the canvas/PDF export, in any font. Never touches "I" inside
   other words (BIG, IT'S, …). */
const CROSSBAR_I = "Ī̱";
export function applyCrossbarI(text: string): string {
  return text.replace(/\bI(?=\b|['’])/g, CROSSBAR_I);
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
  /* "Draw Your Own" pen-tool outline: closed shape as fractions of the
     panel box (curves arrive pre-flattened to a dense polygon, so moving/
     resizing just scales). Absent = plain rectangle. */
  pts?: [number, number][];
}
export interface ImageEl extends BaseEl {
  type: "image";
  img: string; filter: FilterKey;
  borderW: number; borderC: string;
  /* a Tuck Back cutout rather than artwork in its own right. It sits
     above the lettering, so it would otherwise be the first thing the next
     trace lands on — and tracing a cutout of a cutout gets you nowhere. */
  cut?: boolean;
  /* an SFX/lettering stamp rather than page artwork: stamps follow the
     LETTERING rules at the bleed line (clipped at the trim, carried across
     the spread spine) — only real art may live past the bleed. */
  stamp?: boolean;
}
export interface BalloonEl extends BaseEl {
  type: "balloon";
  kind: BalloonKind;
  text: string;
  ts: TextStyle;
  runs?: TextRun[]; // optional inline bold/italic emphasis
  fill: FillStyle; stroke: string; strokeW: number;
  /* dx/dy: tail tip relative to the balloon centre (local, unrotated).
     bx/by: optional bend point the tail curves through.
     tx/ty: optional tangent direction at the bend (the tilt axis of a
     joined-balloon connector).
     ax/ay: TRANSIENT (set by resolveBalloon on the rendered copy, never
     saved) — where the band's opening aims on THIS balloon when bent:
     overshot past the plain centre→bend ray so a wide curve wraps around
     the bubble instead of meeting it head-on. */
  tail: { dx: number; dy: number; bx?: number; by?: number; tx?: number; ty?: number; ax?: number; ay?: number } | null;
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
  const fcx = from.x + from.w / 2, fcy = from.y + from.h / 2;
  const pcx = to.x + to.w / 2, pcy = to.y + to.h / 2;
  const prx = to.w / 2, pry = to.h / 2;
  const seatIn = Math.max(8, to.strokeW * 2.5);
  const [dx, dy] = rotVec(pcx - fcx, pcy - fcy, -from.rot);
  /* edge-to-edge: the band ends just INSIDE the partner's near edge — never
     at its centre — so the open band spans balloon edge to balloon edge and
     its inked sides can't run across the partner's body */
  const dist = Math.hypot(dx, dy) || 1;
  const ux = dx / dist, uy = dy / dist;
  const rr = (prx * pry) / (Math.hypot(pry * ux, prx * uy) || 1);
  const tipDist = Math.max(dist * 0.3, dist - rr + seatIn);
  const t: NonNullable<BalloonEl["tail"]> = { dx: Math.round(ux * tipDist), dy: Math.round(uy * tipDist) };
  if (keep && keep.bx != null && keep.by != null) {
    /* Keep the user's curve generously — the connector is meant to sweep into
       wide graceful arcs around BOTH bubbles (dragging the bend far out to
       one side walks the band's openings around them), so the limits are
       size-aware: with close bubbles the axis length is tiny, and bounding
       by it alone collapsed the curve the moment the bend left the straight
       line. Only a truly runaway bend (flung balloon-widths away — stale
       data after big layout moves) resets to the clean midpoint. */
    const len = Math.hypot(dx, dy) || 1;
    const along = (keep.bx * dx + keep.by * dy) / len;      // projection on the axis
    const perp = Math.abs(keep.bx * dy - keep.by * dx) / len; // sideways deviation
    const reach = Math.max(len, (from.w + from.h) / 2, (to.w + to.h) / 2);
    if (along > -reach && along < len + reach && perp <= reach * 2.5) {
      t.bx = keep.bx; t.by = keep.by; t.tx = keep.tx; t.ty = keep.ty;
      /* Both openings must WALK AROUND their bubbles as the curve sweeps —
         and slightly PAST the plain centre→bend ray (matching the Comic
         Life 3 reference): at a wide extension the band should wrap around
         each bubble and arrive hugging it, not meet it head-on. The
         overshoot factor rotates each opening beyond the radial direction,
         capped so it can never walk to the bubble's far side. */
      const OVER = 1.35, CAP = 2.0;   // radians ≈ 115°
      const swing = (base: number, toward: number) => {
        let d = toward - base;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        return base + Math.max(-CAP, Math.min(CAP, d * OVER));
      };
      /* THIS balloon's opening: overshot from the partner axis toward the
         bend (local frame) — read by connectorBase via tail.ax/ay */
      const aAim = swing(Math.atan2(dy, dx), Math.atan2(keep.by, keep.bx));
      const aimLen = Math.max(100, Math.hypot(keep.bx, keep.by));
      t.ax = Math.cos(aAim) * aimLen;
      t.ay = Math.sin(aAim) * aimLen;
      /* The tip must stay CONNECTED to the partner's edge as the curve
         sweeps: seat it on the partner's outline along the overshot
         direction (page frame), so the attach point walks around the
         partner with the curve instead of staying pinned. */
      const [bpx, bpy] = rotVec(keep.bx, keep.by, from.rot);   // bend, page frame
      const bendPX = fcx + bpx, bendPY = fcy + bpy;
      const eLen = Math.hypot(bendPX - pcx, bendPY - pcy);
      if (eLen > 4) {
        const aSeat = swing(
          Math.atan2(fcy - pcy, fcx - pcx),
          Math.atan2(bendPY - pcy, bendPX - pcx));
        const ex = Math.cos(aSeat), ey = Math.sin(aSeat);
        const rEdge = (prx * pry) / (Math.hypot(pry * ex, prx * ey) || 1);
        const r = Math.max(prx * 0.25, rEdge - seatIn);
        const tipPX = pcx + ex * r, tipPY = pcy + ey * r;
        const [ldx, ldy] = rotVec(tipPX - fcx, tipPY - fcy, -from.rot);
        t.dx = Math.round(ldx); t.dy = Math.round(ldy);
      }
    } else {
      t.bx = Math.round(dx / 2); t.by = Math.round(dy / 2);   // reset to midpoint
    }
  }
  return t;
}

/* Balloons joined into one group — a parent and every balloon attached to it —
   share fill geometry: a gradient spans the WHOLE group instead of restarting
   inside each bubble, so a styled pair reads as one inked shape with no seam
   at the join (a colour mismatch there is what draws the "line"). Returns the
   group's page-coord bounding box, or null for an unjoined balloon. Rotation
   is ignored — the union is page-aligned. */
export function joinGroupRect(page: Page, el: BalloonEl): { x: number; y: number; w: number; h: number } | null {
  /* the group is the CONNECTED COMPONENT over attachTo links, walked in both
     directions — bubbles join in any order (chains, stars, a third bubble
     hung off an existing pair), so a root-plus-direct-children view misses
     members and splits the shared fill */
  const balloons = page.els.filter((o): o is BalloonEl => o.type === "balloon");
  const seen = new Set<string>([el.id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const b of balloons) {
      if (seen.has(b.id)) {
        if (b.attachTo && !seen.has(b.attachTo) && balloons.some((x) => x.id === b.attachTo)) {
          seen.add(b.attachTo);
          grew = true;
        }
      } else if (b.attachTo && seen.has(b.attachTo)) {
        seen.add(b.id);
        grew = true;
      }
    }
  }
  if (seen.size < 2) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const o of balloons) {
    if (!seen.has(o.id)) continue;
    if (o.x < x0) x0 = o.x;
    if (o.y < y0) y0 = o.y;
    if (o.x + o.w > x1) x1 = o.x + o.w;
    if (o.y + o.h > y1) y1 = o.y + o.h;
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* Resolve a balloon's effective tail for rendering. Joined balloons connect
   with a wide band that opens into BOTH balloons; once they overlap they melt
   into one shape and the connector vanishes entirely. */
export function resolveBalloon(page: Page, el: BalloonEl): { el: BalloonEl; base: BalloonEl | null } {
  if (!el.attachTo) {
    /* A parent ALWAYS keeps its own speaker tail pointing at the character,
       even when a joined child sits in the same direction. The connecting band
       is the same fill colour and tucks under the partner's outline (see the
       mergeBase redraw in BalloonShape / drawEl), so it reads as falling BEHIND
       the parent's tail rather than replacing it. Hiding the tail here made it
       vanish the moment you dragged the child into its line — a regression. */
    return { el, base: null };
  }

  /* a balloon can only attach to a DIFFERENT balloon; a self-reference (from
     a corrupt import or a future bug) would resolve to a degenerate self-merge */
  const base = el.attachTo === el.id ? undefined
    : page.els.find((e) => e.id === el.attachTo && e.type === "balloon") as BalloonEl | undefined;
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

/* Every join LINK on the page (a child balloon → the balloon it attaches to),
   with the z-position its connector band paints after. Bands are their own
   render pass, one per link, drawn after WHICHEVER partner renders later:
   painting the band inside the child's own SVG meant a chain's later bubble
   re-inked seams an earlier link had opened, and a child sitting below its
   partner in z-order had its band painted over. Each link acts alone — it
   only ever touches its own two junctions. */
export interface JoinLink { child: BalloonEl; base: BalloonEl; afterIndex: number }
export function joinLinks(page: Page): JoinLink[] {
  const out: JoinLink[] = [];
  page.els.forEach((el, i) => {
    if (el.type !== "balloon" || !el.attachTo || el.attachTo === el.id) return;
    const j = page.els.findIndex((o) => o.id === el.attachTo && o.type === "balloon");
    if (j < 0) return;
    out.push({ child: el, base: page.els[j] as BalloonEl, afterIndex: Math.max(i, j) });
  });
  return out;
}

/* Bring a document loaded from storage up to the current data shape. Old
   saves carry things the code no longer writes — legacy tail fields, a
   transient band flag that leaked into an autosave, links to balloons that
   were deleted, even a cycle from a buggy vintage. Every load path runs the
   doc through here, so a balloon saved months ago behaves exactly like one
   made this morning instead of needing to be deleted and rebuilt. */
export function normalizeDoc(doc: Doc): Doc {
  for (const p of doc.pages ?? []) {
    for (const el of p.els ?? []) {
      if (el.type !== "balloon") continue;
      delete el.band;                       // transient — must never persist
      if (el.tail) {
        const t = el.tail as Record<string, unknown>;
        if (typeof t.dx !== "number" || typeof t.dy !== "number") {
          el.tail = null;
        } else {
          /* keep only the fields the current renderer understands */
          el.tail = {
            dx: t.dx, dy: t.dy,
            ...(typeof t.bx === "number" && typeof t.by === "number"
              ? { bx: t.bx, by: t.by } : {}),
            ...(typeof t.tx === "number" && typeof t.ty === "number"
              ? { tx: t.tx, ty: t.ty } : {}),
          };
        }
      }
      if (el.attachTo && (el.attachTo === el.id ||
        !p.els.some((o) => o.id === el.attachTo && o.type === "balloon"))) {
        el.attachTo = null;
      }
    }
    /* a cycle in attachTo links would hang every chain walk — cut it */
    for (const el of p.els ?? []) {
      if (el.type !== "balloon") continue;
      const seen = new Set<string>([el.id]);
      let n: BalloonEl = el;
      while (n.attachTo) {
        const up = p.els.find((o) => o.id === n.attachTo && o.type === "balloon") as BalloonEl | undefined;
        if (!up || seen.has(up.id)) { n.attachTo = null; break; }
        seen.add(up.id);
        n = up;
      }
    }
    /* an element stranded (almost) entirely past the page edge is clipped
       invisible and un-hittable — nothing left to grab, especially by
       finger. Pull strays back so a fingertip's worth stays on the page.
       Full-bleed page art is untouched: it overlaps the page plenty. */
    for (const el of p.els ?? []) {
      const gw = Math.min(GRAB_MARGIN, el.w), gh = Math.min(GRAB_MARGIN, el.h);
      el.x = clamp(el.x, gw - el.w, p.w - gw);
      el.y = clamp(el.y, gh - el.h, p.h - gh);
    }
  }
  return doc;
}

/* the minimum sliver of an element that must remain on its page — enough
   to land a fingertip on (see the drop rescue in useStartDrag too) */
export const GRAB_MARGIN = 28;

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
  runs?: TextRun[]; // optional inline bold/italic emphasis
  /* SFX arc warp: -100..100 (0/undefined = straight). +bulges up, −bulges down */
  warp?: number;
}
export type El = PanelEl | ImageEl | BalloonEl | TextEl;

export interface PageMargin { t: number; r: number; b: number; l: number }
export interface Page {
  w: number; h: number; bg: FillStyle; els: El[]; margin?: PageMargin;
  /* Bleed, in page units, on every edge. Comic page sizes are quoted WITH
     bleed included, so the page is bigger than the printed book and the
     blade comes down `bleed` inside each edge. Undefined = BLEED. */
  bleed?: number;
}

/* Pixels per inch used across rulers, paper sizes and Page Setup. */
export const DPI = 225;

/* Default size for dialogue and caption lettering, in page units. At 225dpi
   this is a hair under an eighth of an inch — the size hand lettering has
   been set at for decades, and small enough that a balloon reads as a
   balloon rather than a poster. Sound effects set their own, far larger. */
export const DEFAULT_TEXT_SIZE = 24;

/* Standard US comic page, quoted the way printers quote it: the full-bleed
   sheet, an eighth of an inch of bleed on each edge, so the trim is
   6.63 × 10.25in. Art runs to the page edge; the blade lands on the trim. */
export const COMIC_W_IN = 6.88;
export const COMIC_H_IN = 10.5;
export const BLEED_IN = 0.125;
export const BLEED = BLEED_IN * DPI;
/* Live area: how far inside the TRIM lettering must stay to survive a bad
   cut. A quarter inch is the number every printer's spec sheet gives. */
export const SAFE_IN = 0.25;
/* Default document margin: where panels and layouts start, measured from the
   page edge. 0.130in puts them a hair inside the trim, so artwork runs to the
   cut the way comic panels are supposed to, instead of floating in from it. */
export const MARGIN_IN = 0.13;
/* Working oversize, the way it has always been done on board: letter at 1.5×
   and reduce on the way out. Everything — including the bleed — scales, or
   the trim guide would land in the wrong place. */
export const OVERSIZE = 1.5;
export const pageBleed = (p: Page) => p.bleed ?? BLEED;

/* Where panels and layouts sit when the page has no explicit margins. The
   safe area is the answer, not an arbitrary fraction of the width — it is
   the line the printed book actually guarantees. */
export function pageMargins(p: Page): PageMargin {
  if (p.margin) return p.margin;
  /* not rounded to whole pixels: 0.130in is 29.25 at 225dpi, and rounding it
     makes Page Setup read the value back as 0.129 */
  const s = MARGIN_IN * DPI;
  return { t: s, r: s, b: s, l: s };
}

/* Bleed (inches) that goes with a named paper size, for Page Setup. */
export function bleedFor(name: string): number | null {
  if (name.startsWith("Standard Comic")) {
    return name.includes("+1.5") ? BLEED_IN * OVERSIZE : BLEED_IN;
  }
  return null;
}
/* The three nested rectangles, in page units. */
export function pageGuides(p: Page) {
  const b = pageBleed(p);
  const s = b + SAFE_IN * DPI;
  return {
    bleed: b,
    trim: { x: b, y: b, w: p.w - 2 * b, h: p.h - 2 * b },
    safe: { x: s, y: s, w: p.w - 2 * s, h: p.h - 2 * s },
  };
}

export interface PaperCategory { name: string; sizes: [string, number, number][] }
export const PAPER_CATEGORIES: PaperCategory[] = [
  {
    name: "Comic Sizes",
    sizes: [
      ["Standard Comic (full bleed)", COMIC_W_IN, COMIC_H_IN],
      ["Standard Comic +1.5 (oversize)", COMIC_W_IN * OVERSIZE, COMIC_H_IN * OVERSIZE],
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
export interface Doc {
  app: "comiclettering"; version: 2; pages: Page[];
  /* Styles saved off this book's own balloons and lettering, via right-click
     → Save Style. They live in the document, so they travel with the project
     and are still there after a refresh. */
  styles?: { shapes?: unknown[]; letters?: unknown[] };
}
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
  lmckillcrazy: { label: "LMC Killcrazy (Tag)", css: '"LMC Killcrazy",cursive', group: "Display", variants: ALL },
  lmckrakhead: { label: "LMC Krakhead (Block)", css: '"LMC Krakhead",cursive', group: "Display", variants: ALL },
  lmconetwo: { label: "LMC One-Two (Impact)", css: '"LMC Onetwo",cursive', group: "Display", variants: ALL },
  lmcefex: { label: "LMC Efex (SFX)", css: '"LMC Efex",cursive', group: "Display", variants: ALL },
  lmcefexcond: { label: "LMC Efex Condensed", css: '"LMC Efex Cond",cursive', group: "Display", variants: ALL },
  lmcefexthin: { label: "LMC Efex Thin", css: '"LMC Efex Thin",cursive', group: "Display", variants: ALL },
  lmcefexrough: { label: "LMC Efex Rough", css: '"LMC Efex Rough",cursive', group: "Display", variants: ALL },
  lmcefexroughthin: { label: "LMC Efex Rough Thin", css: '"LMC Efex Roughthin",cursive', group: "Display", variants: ALL },
  lmcefexbrush: { label: "LMC Efex Brush", css: '"LMC Efex Brush",cursive', group: "Display", variants: ALL },
  lmcrawbones: { label: "LMC Rawbones (Dry Brush)", css: '"LMC Rawbones",cursive', group: "Display", variants: ALL },
  lmcjolt: { label: "LMC Jolt (Electrified)", css: '"LMC Jolt",cursive', group: "Display", variants: ALL },
  lmctoonblast: { label: "LMC Toonblast (Cartoon)", css: '"LMC Toonblast",cursive', group: "Display", variants: ALL },
  lmcsunder: { label: "LMC Sunder (Torn)", css: '"LMC Sunder",cursive', group: "Display", variants: ALL },
  lmcpunch: { label: "LMC Punch", css: '"LMC Punch",cursive', group: "Display", variants: ALL },
  lmcpalooka: { label: "LMC Palooka", css: '"LMC Palooka",cursive', group: "Display", variants: ALL },
  lmcslick: { label: "LMC Slick (Italic Display)", css: '"LMC Slick",cursive', group: "Display", variants: ALL },
  lmcfeedback: { label: "LMC Feedback (Buzz)", css: '"LMC Feedback",cursive', group: "Display", variants: ALL },
  lmcfullbleed: { label: "LMC Fullbleed", css: '"LMC Fullbleed",cursive', group: "Display", variants: ALL },
  lmcgamma: { label: "LMC Gamma (Torn)", css: '"LMC Gamma",cursive', group: "Display", variants: ALL },
  lmcglassjaw: { label: "LMC Glassjaw", css: '"LMC Glassjaw",cursive', group: "Display", variants: ALL },
  lmcskrunch: { label: "LMC Skrunch (Shards)", css: '"LMC Skrunch",cursive', group: "Display", variants: ALL },
  lmccrashland: { label: "LMC Crashland", css: '"LMC Crashland",cursive', group: "Display", variants: ALL },
  lmcrowdy: { label: "LMC Rowdy", css: '"LMC Rowdy",cursive', group: "Display", variants: ALL },
  lmcdeco: { label: "LMC Deco (Monoline)", css: '"LMC Deco",cursive', group: "Display", variants: ALL },
  lmcscreech: { label: "LMC Screech", css: '"LMC Screech",cursive', group: "Display", variants: ALL },
  lmcgutspill: { label: "LMC Gutspill (Horror)", css: '"LMC Gutspill",cursive', group: "Display", variants: ALL },
  lmcblob: { label: "LMC Blob (Bubble)", css: '"LMC Blob",cursive', group: "Display", variants: ALL },
  lmcfrost: { label: "LMC Frost (Tall Brush)", css: '"LMC Frost",cursive', group: "Display", variants: ALL },
  lmcberserk: { label: "LMC Berserk (Brush)", css: '"LMC Berserk",cursive', group: "Display", variants: ALL },
  lmcsawtooth: { label: "LMC Sawtooth", css: '"LMC Sawtooth",cursive', group: "Display", variants: ALL },
  lmccharflame: { label: "LMC Charflame (Fire)", css: '"LMC Charflame",cursive', group: "Display", variants: ALL },
  lmcarmory: { label: "LMC Armory (Condensed)", css: '"LMC Armory",cursive', group: "Display", variants: ALL },
  lmcbreach: { label: "LMC Breach (Damaged)", css: '"LMC Breach",cursive', group: "Display", variants: ALL },
  lmckaboom: { label: "LMC Kaboom", css: '"LMC Kaboom",cursive', group: "Display", variants: ALL },
  lmcbrimstone: { label: "LMC Brimstone (Brush)", css: '"LMC Brimstone",cursive', group: "Display", variants: ALL },
  lmcbigbold: { label: "LMC Bigbold", css: '"LMC Bigbold",cursive', group: "Display", variants: ALL },
  lmcslam: { label: "LMC Slam", css: '"LMC Slam",cursive', group: "Display", variants: ALL },
  lmcsplash: { label: "LMC Splash", css: '"LMC Splash",cursive', group: "Display", variants: ALL },
  lmcblitz: { label: "LMC Blitz (Shards)", css: '"LMC Blitz",cursive', group: "Display", variants: ALL },
  lmcbutcher: { label: "LMC Butcher (Horror)", css: '"LMC Butcher",cursive', group: "Display", variants: ALL },
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

export const PAGE_SIZES: { k: string; label: string; w: number; h: number; bleed?: number }[] = [
  { k: "comic",  label: 'US Comic 6.88×10.5" (full bleed)', w: 1548, h: 2363 },
  /* letter big, reduce on export — the lettering comes out finer */
  { k: "comic15", label: 'US Comic +1.5 (10.32×15.75")', w: 2322, h: 3544, bleed: BLEED * OVERSIZE },
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
  /* Pages used to be born with a margin at 3.5% of their width — not a print
     measurement, but drawn as a bold dashed box near the edge, where it reads
     as the trim line. Nobody chose that number, so drop it and let the page
     show its real trim instead. Margins somebody actually set are kept. */
  for (const p of doc.pages) {
    const m = p.margin;
    if (!m) continue;
    const legacy = Math.round(p.w * 0.035);
    if (m.t === legacy && m.r === legacy && m.b === legacy && m.l === legacy) delete p.margin;
  }
}

export const defaultTextStyle = (over: Partial<TextStyle> = {}): TextStyle => ({
  font: "lmccasual", size: DEFAULT_TEXT_SIZE, bold: false, italic: false, caps: false,
  lineHeight: 1.05,
  align: "center", fillA: "#111111", fillB: null,
  outlineC: "#111111", outlineW: 0, shadow: false, shadowC: "#00000088",
  ...over,
});

export function newPage(w = Math.round(COMIC_W_IN * DPI), h = Math.round(COMIC_H_IN * DPI), margin?: PageMargin): Page {
  /* No margin by default. A dashed box at 3.5% of the page width is not a
     print measurement, and drawn near the edge it reads as the trim line —
     which had readers believing the bleed was three times what they set.
     Layout falls back to the safe area (pageMargins); the guide only shows
     when someone has deliberately set margins in Page Setup. */
  return { w, h, bg: solid("#ffffff"), els: [], ...(margin ? { margin } : {}) };
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
      font: kind === "tv" || kind === "double" ? "audiowide" : "lmccasual",
      italic: caption, bold: kind === "shout" || kind === "burst2",
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

/* the SVG/Path2D outline of a pen-drawn panel, in the panel's local units —
   ONE builder shared by the DOM editor and the canvas/PDF export so the two
   stay WYSIWYG. Null for plain rectangular panels. */
export function panelPathD(el: PanelEl): string | null {
  if (!el.pts || el.pts.length < 3) return null;
  return el.pts.map(([fx, fy], i) =>
    `${i ? "L" : "M"}${(fx * el.w).toFixed(2)} ${(fy * el.h).toFixed(2)}`).join(" ") + " Z";
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
      : defaultTextStyle({ font: "lmccasual" }),
  };
}

/* a user-saved custom layout (kept in localStorage, listed as "My Layouts");
   pts aligns with fracs and carries pen-drawn panel shapes (null = rect) */
export interface SavedLayout { name: string; fracs: LayoutRect[]; pts?: ([number, number][] | null)[] }

/* Inverse of applyLayout: read the page's CURRENT panel frames back into
   margin-relative fractions (undoing the interior gutter insets applyLayout
   adds), so any hand-tuned arrangement round-trips exactly when saved and
   re-applied as a custom layout. */
export function capturePageLayout(page: Page): { fracs: LayoutRect[]; pts: ([number, number][] | null)[] } | null {
  const mg = pageMargins(page);
  const g = Math.round(page.w * 0.02);
  const cw = page.w - mg.l - mg.r, ch = page.h - mg.t - mg.b;
  if (cw <= 0 || ch <= 0) return null;
  const panels = page.els.filter((e): e is PanelEl => e.type === "panel");
  if (!panels.length) return null;
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const fracs = panels.map((p) => {
    /* pen-drawn shapes keep their exact frame — the gutter inset baked into
       rect layouts would warp the outline */
    const shaped = !!p.pts;
    let x0 = p.x, x1 = p.x + p.w, y0 = p.y, y1 = p.y + p.h;
    if (!shaped) {
      if (x0 > mg.l + 1) x0 -= g / 2;
      if (x1 < mg.l + cw - 1) x1 += g / 2;
      if (y0 > mg.t + 1) y0 -= g / 2;
      if (y1 < mg.t + ch - 1) y1 += g / 2;
    }
    const fx = clamp(r4((x0 - mg.l) / cw), 0, 0.98);
    const fy = clamp(r4((y0 - mg.t) / ch), 0, 0.98);
    const fw = clamp(r4((x1 - x0) / cw), 0.02, 1 - fx);
    const fh = clamp(r4((y1 - y0) / ch), 0.02, 1 - fy);
    return (p.rot ? [fx, fy, fw, fh, p.rot] : [fx, fy, fw, fh]) as LayoutRect;
  });
  return { fracs, pts: panels.map((p) => p.pts ?? null) };
}

export function applyLayout(page: Page, fracs: LayoutRect[]) {
  const mg = pageMargins(page);
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
