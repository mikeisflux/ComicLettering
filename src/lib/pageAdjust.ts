/* Page adjustment layers — the grading engine.

   Each AdjustEl on a page contributes a stage to ONE SVG <filter>; the DOM
   editor applies it to the page's element stack (filter: url(#pgadj-N)) and
   the canvas/PDF export runs the SAME markup through ctx.filter on the
   finished page canvas, so the grade is WYSIWYG by construction. Stages are
   chained in layer order (bottom of the stack first). All maths in sRGB. */
import { AdjustEl, AdjustKind, Page, clamp, uid } from "./model";

/* ---------------- tool metadata (labels, sliders, defaults) ---------------- */

export interface AdjustParamSpec {
  key: string; label: string;
  min?: number; max?: number; step?: number;
  def: number | string;
  color?: boolean;
  /* gradient painted on the slider track (Photoshop-style temp/tint ramps) */
  track?: string;
  /* rendered as the interactive curve graph, not a slider */
  curve?: boolean;
}

/* Selective Color's nine families (key prefix + display name) */
export const SEL_FAMILIES: [string, string][] = [
  ["red", "Reds"], ["yel", "Yellows"], ["grn", "Greens"], ["cyn", "Cyans"],
  ["blu", "Blues"], ["mag", "Magentas"], ["wht", "Whites"], ["neu", "Neutrals"], ["blk", "Blacks"],
];
const SELCOLOR_PARAMS: AdjustParamSpec[] = [
  ...SEL_FAMILIES.flatMap(([f, name]) =>
    (["c", "m", "y", "k"] as const).map((ch) => ({
      key: `${f}_${ch}`, label: `${name} ${ch.toUpperCase()}`, min: -100, max: 100, def: 0,
    }))),
  { key: "method", label: "Method", min: 0, max: 1, def: 0 },
];

export const ADJUST_META: Record<AdjustKind, { label: string; params: AdjustParamSpec[] }> = {
  colorvib: {
    label: "Color and Vibrance",
    params: [
      { key: "temp", label: "Temperature", min: -100, max: 100, def: 0,
        track: "linear-gradient(90deg,#2b6cff,#a9b2c4 50%,#ffd23f)" },
      { key: "tint", label: "Tint", min: -100, max: 100, def: 0,
        track: "linear-gradient(90deg,#2ecc40,#c9c2cc 50%,#ff2fd0)" },
      { key: "vib", label: "Vibrance", min: -100, max: 100, def: 0,
        track: "linear-gradient(90deg,#a9a9a9,#c9a08e 50%,#ff5a3c)" },
      { key: "sat", label: "Saturation", min: -100, max: 100, def: 0,
        track: "linear-gradient(90deg,#9c9c9c,#cf8d76 50%,#ff4d2e)" },
    ],
  },
  brightness: {
    label: "Brightness/Contrast",
    params: [
      { key: "b", label: "Brightness", min: -100, max: 100, def: 0 },
      { key: "c", label: "Contrast", min: -100, max: 100, def: 0 },
    ],
  },
  exposure: {
    label: "Exposure",
    params: [
      { key: "e", label: "Exposure", min: -100, max: 100, def: 0 },
      { key: "offset", label: "Offset", min: -100, max: 100, def: 0 },
      { key: "gammaC", label: "Gamma correction", min: 0.2, max: 2.4, step: 0.02, def: 1 },
    ],
  },
  levels: {
    label: "Levels",
    params: [
      { key: "blacks", label: "Blacks in", min: 0, max: 100, def: 0 },
      { key: "whites", label: "Whites in", min: 0, max: 100, def: 0 },
      { key: "gamma", label: "Midtones (gamma)", min: 0.2, max: 2.4, step: 0.02, def: 1 },
      { key: "outB", label: "Output black", min: 0, max: 255, def: 0 },
      { key: "outW", label: "Output white", min: 0, max: 255, def: 255 },
    ],
  },
  curves: {
    label: "Curves",
    params: [{ key: "pts", label: "Curve", def: "0:0,1:1", curve: true }],
  },
  hsl: {
    label: "Hue/Saturation",
    params: [
      { key: "hue", label: "Hue", min: -180, max: 180, def: 0,
        track: "linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" },
      { key: "sat", label: "Saturation", min: -100, max: 100, def: 0,
        track: "linear-gradient(90deg,#8a8a8a,#c96fae 50%,#ff0040)" },
      { key: "light", label: "Lightness", min: -100, max: 100, def: 0,
        track: "linear-gradient(90deg,#000,#8a8a8a 50%,#fff)" },
    ],
  },
  colorbalance: {
    label: "Color Balance",
    params: [
      { key: "r", label: "Cyan ↔ Red", min: -100, max: 100, def: 0,
        track: "linear-gradient(90deg,#0fd8d8,#9b9b9b 50%,#f00)" },
      { key: "g", label: "Magenta ↔ Green", min: -100, max: 100, def: 0,
        track: "linear-gradient(90deg,#e42ce4,#9b9b9b 50%,#0c0)" },
      { key: "b", label: "Yellow ↔ Blue", min: -100, max: 100, def: 0,
        track: "linear-gradient(90deg,#e0d000,#9b9b9b 50%,#00e)" },
    ],
  },
  bw: {
    label: "Black & White",
    params: [
      { key: "reds", label: "Reds", min: -100, max: 200, def: 40, track: "linear-gradient(90deg,#000,#f33,#ffd9d9)" },
      { key: "yellows", label: "Yellows", min: -100, max: 200, def: 60, track: "linear-gradient(90deg,#000,#e6c800,#fff7c2)" },
      { key: "greens", label: "Greens", min: -100, max: 200, def: 40, track: "linear-gradient(90deg,#000,#2c2,#d6f5d6)" },
      { key: "cyans", label: "Cyans", min: -100, max: 200, def: 60, track: "linear-gradient(90deg,#000,#0cc,#d2f4f4)" },
      { key: "blues", label: "Blues", min: -100, max: 200, def: 20, track: "linear-gradient(90deg,#000,#44f,#d9d9ff)" },
      { key: "magentas", label: "Magentas", min: -100, max: 200, def: 80, track: "linear-gradient(90deg,#000,#e3e,#f8d6f8)" },
    ],
  },
  photofilter: {
    label: "Photo Filter",
    params: [
      { key: "color", label: "Filter color", def: "#ec8a00", color: true },
      { key: "density", label: "Density", min: 0, max: 100, def: 25 },
    ],
  },
  selectivecolor: {
    label: "Selective Color",
    params: SELCOLOR_PARAMS,   // custom family panel in adjustDialog
  },
  colorlookup: {
    label: "Color Lookup",
    /* the look itself is picked from LOOKUP_TABLE in the dialog */
    params: [
      { key: "look", label: "Look", def: "Teal & Orange" },
      { key: "strength", label: "Strength", min: 0, max: 100, def: 100 },
    ],
  },
  channelmixer: {
    label: "Channel Mixer",
    /* one row of source weights per output channel + constant; mono uses
       the red row as the gray recipe (custom panel in adjustDialog) */
    params: [
      { key: "rr", label: "Red ← Red", min: -200, max: 200, def: 100 },
      { key: "rg", label: "Red ← Green", min: -200, max: 200, def: 0 },
      { key: "rb", label: "Red ← Blue", min: -200, max: 200, def: 0 },
      { key: "rk", label: "Red constant", min: -200, max: 200, def: 0 },
      { key: "gr", label: "Green ← Red", min: -200, max: 200, def: 0 },
      { key: "gg", label: "Green ← Green", min: -200, max: 200, def: 100 },
      { key: "gb", label: "Green ← Blue", min: -200, max: 200, def: 0 },
      { key: "gk", label: "Green constant", min: -200, max: 200, def: 0 },
      { key: "br", label: "Blue ← Red", min: -200, max: 200, def: 0 },
      { key: "bg", label: "Blue ← Green", min: -200, max: 200, def: 0 },
      { key: "bb", label: "Blue ← Blue", min: -200, max: 200, def: 100 },
      { key: "bk", label: "Blue constant", min: -200, max: 200, def: 0 },
      { key: "mono", label: "Monochrome", min: 0, max: 1, def: 0 },
    ],
  },
  invert: {
    label: "Invert",
    params: [{ key: "amt", label: "Amount", min: 0, max: 100, def: 100 }],
  },
  posterize: {
    label: "Posterize",
    params: [{ key: "levels", label: "Levels", min: 2, max: 16, step: 1, def: 4 }],
  },
  threshold: {
    label: "Threshold",
    params: [{ key: "level", label: "Level", min: 1, max: 99, def: 50 }],
  },
  gradientmap: {
    label: "Gradient Map",
    params: [
      { key: "preset", label: "Gradient", def: "Crimson" },
      { key: "a", label: "Shadows color", def: "#1a1240", color: true },
      { key: "b", label: "Highlights color", def: "#ffcf6b", color: true },
      { key: "rev", label: "Reverse", min: 0, max: 1, def: 0 },
      { key: "method", label: "Method", def: "Smooth" },
      { key: "amt", label: "Blend", min: 0, max: 100, def: 100 },
    ],
  },
  grain: {
    label: "Grain",
    params: [
      { key: "amt", label: "Amount", min: 0, max: 100, def: 35 },
      { key: "size", label: "Size", min: 1, max: 40, def: 10 },
      { key: "rough", label: "Roughness", min: 1, max: 4, step: 1, def: 2 },
    ],
  },
  clarity: {
    label: "Clarity and Dehaze",
    params: [
      { key: "clarity", label: "Clarity", min: -100, max: 100, def: 0 },
      { key: "dehaze", label: "Dehaze", min: -100, max: 100, def: 0 },
    ],
  },
};

export function makeAdjust(kind: AdjustKind, pageW: number, pageH: number): AdjustEl {
  const params: Record<string, number | string> = {};
  for (const p of ADJUST_META[kind].params) params[p.key] = p.def;
  return {
    id: uid(), x: 0, y: 0, w: pageW, h: pageH, rot: 0, shadow: false,
    type: "adjust", kind, params,
  };
}

/* the page's LIVE grade: visible adjustment layers, bottom of stack first */
export function pageAdjustLayers(page: Page): AdjustEl[] {
  return page.els.filter((e): e is AdjustEl => e.type === "adjust" && !e.hidden);
}

/* ---------------- SVG filter construction ---------------- */

const F = (v: number) => {
  const s = (+v).toFixed(4);
  return s.replace(/\.?0+$/, "") || "0";
};
const num = (v: number | string | undefined, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? v : def;
const str = (v: number | string | undefined, def: string) =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : def;

/* one linear feComponentTransfer on RGB */
const linearCT = (src: string, out: string, slope: number, icpt: number, icptG = icpt, icptB = icpt) =>
  `<feComponentTransfer in="${src}" result="${out}">` +
  `<feFuncR type="linear" slope="${F(slope)}" intercept="${F(icpt)}"/>` +
  `<feFuncG type="linear" slope="${F(slope)}" intercept="${F(icptG)}"/>` +
  `<feFuncB type="linear" slope="${F(slope)}" intercept="${F(icptB)}"/>` +
  `</feComponentTransfer>`;

const tableCT = (src: string, out: string, r: string, g = r, b = r) =>
  `<feComponentTransfer in="${src}" result="${out}">` +
  `<feFuncR type="table" tableValues="${r}"/>` +
  `<feFuncG type="table" tableValues="${g}"/>` +
  `<feFuncB type="table" tableValues="${b}"/>` +
  `</feComponentTransfer>`;

const discreteCT = (src: string, out: string, vals: string) =>
  `<feComponentTransfer in="${src}" result="${out}">` +
  `<feFuncR type="discrete" tableValues="${vals}"/>` +
  `<feFuncG type="discrete" tableValues="${vals}"/>` +
  `<feFuncB type="discrete" tableValues="${vals}"/>` +
  `</feComponentTransfer>`;

const LUM = (src: string, out: string) =>
  `<feColorMatrix in="${src}" type="matrix" result="${out}" values="` +
  `0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0"/>`;

/* result = (1-t)·src + t·other */
const MIX = (src: string, other: string, out: string, t: number) =>
  `<feComposite in="${src}" in2="${other}" operator="arithmetic" ` +
  `k1="0" k2="${F(1 - t)}" k3="${F(t)}" k4="0" result="${out}"/>`;

const hexRGB = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/* ---------------- Gradient Map: the preset gradient library ---------------- */

export const GRADIENT_MAPS: Record<string, [string, string[]][]> = {
  Basics: [
    ["Black → White", ["#000000", "#ffffff"]],
    ["Sepia Tone", ["#1c120a", "#8a6a48", "#f7ecd9"]],
    ["Crimson", ["#0a0004", "#6b0f2b", "#ffffff"]],
  ],
  Blues: [
    ["Midnight", ["#000000", "#0b2a5e", "#bcd9ff"]],
    ["Cyanotype", ["#0a1a3c", "#2a6a9e", "#d8f2fa"]],
    ["Steel", ["#111318", "#5a7a9e", "#dfe9f2"]],
  ],
  Purples: [
    ["Amethyst", ["#160a2e", "#7b3fbf", "#f0e2ff"]],
    ["Ultraviolet", ["#20003c", "#c96bff"]],
  ],
  Pinks: [
    ["Rose", ["#3c0518", "#ff5f8f", "#ffe3ec"]],
    ["Bubblegum", ["#7a1f5c", "#ffb3d9"]],
  ],
  Reds: [
    ["Blood", ["#000000", "#8a0f0f", "#ffd9c2"]],
    ["Ember", ["#1a0000", "#ff4400", "#ffe8b0"]],
  ],
  Oranges: [
    ["Sunset", ["#2b0a3c", "#ff6a00", "#ffd166"]],
    ["Amber", ["#221100", "#ffb300"]],
  ],
  Greens: [
    ["Forest", ["#03180c", "#2e8b57", "#eaf7d9"]],
    ["Toxic", ["#031f00", "#8aff00"]],
  ],
  Grays: [
    ["Silver", ["#111111", "#9aa2ad", "#f5f7fa"]],
    ["Charcoal", ["#0a0a0a", "#666666"]],
  ],
  Cloud: [
    ["Sky", ["#3a6ea5", "#dfeeff", "#ffffff"]],
    ["Dawn Cloud", ["#5a4a7a", "#f2b5a0", "#fff3e0"]],
  ],
  Iridescent: [
    ["Oil Slick", ["#1a0533", "#12b3a6", "#c96bff"]],
    ["Chrome", ["#222222", "#cfd6de", "#5a7a9e"]],
  ],
  Pastels: [
    ["Peach", ["#b86a5a", "#f7c8a8", "#fdf3ea"]],
    ["Mint Cream", ["#5a8a7a", "#bfe8d8", "#f4fff9"]],
  ],
  Neutrals: [
    ["Bronze", ["#1c120a", "#a97b50", "#f2e3d0"]],
    ["Ivory", ["#3c3428", "#fffbe8"]],
  ],
};
export const gradientStops = (name: string): string[] | null => {
  for (const group of Object.values(GRADIENT_MAPS)) {
    const hit = group.find(([n]) => n === name);
    if (hit) return hit[1];
  }
  return null;
};

/* ---------------- Color Lookup: the built-in look library ----------------
   Each look is a compact grade — per-channel gain and lift, a saturation
   move and an S-contrast — compiled through the same primitives as every
   other tool (original looks in the spirit of the classic film LUT names,
   not copies of Adobe's tables). */
interface Look { sat: number; con: number; gain: [number, number, number]; lift: [number, number, number] }
export const LOOKUP_TABLE: Record<string, Look> = {
  "2-Strip": { sat: 1.2, con: 0.2, gain: [1.08, 0.95, 0.85], lift: [0, 0.02, 0.02] },
  "3-Strip": { sat: 1.35, con: 0.3, gain: [1.1, 1, 0.95], lift: [0, 0, 0] },
  "Bleach Bypass": { sat: 0.45, con: 0.45, gain: [1.05, 1.05, 1.05], lift: [0, 0, 0] },
  "Candlelight": { sat: 1.05, con: 0.1, gain: [1.18, 1, 0.75], lift: [0.02, 0, 0] },
  "Crisp Warm": { sat: 1.1, con: 0.3, gain: [1.1, 1.02, 0.9], lift: [0, 0, 0] },
  "Crisp Winter": { sat: 1.05, con: 0.3, gain: [0.92, 1, 1.12], lift: [0, 0, 0] },
  "Drop Blues": { sat: 1.05, con: 0.15, gain: [1.05, 1, 0.8], lift: [0, 0, 0] },
  "Edgy Amber": { sat: 1, con: 0.35, gain: [1.2, 1, 0.75], lift: [0, 0, 0] },
  "Fall Colors": { sat: 1.2, con: 0.15, gain: [1.12, 1.02, 0.82], lift: [0, 0, 0] },
  "Filmstock": { sat: 0.9, con: 0.2, gain: [1.02, 1, 0.96], lift: [0.02, 0.02, 0.02] },
  "Foggy Night": { sat: 0.6, con: -0.1, gain: [0.85, 0.9, 1.05], lift: [0.06, 0.07, 0.1] },
  "Futuristic Bleak": { sat: 0.7, con: 0.2, gain: [0.95, 1, 1.08], lift: [0.02, 0.02, 0.04] },
  "Horror Blue": { sat: 0.75, con: 0.3, gain: [0.85, 0.95, 1.2], lift: [0, 0, 0.04] },
  "Late Sunset": { sat: 1.1, con: 0.2, gain: [1.15, 0.95, 0.85], lift: [0.03, 0.01, 0.05] },
  "Moonlight": { sat: 0.7, con: 0.2, gain: [0.85, 0.95, 1.15], lift: [0.02, 0.03, 0.08] },
  "Night From Day": { sat: 0.6, con: 0.25, gain: [0.7, 0.8, 1], lift: [0, 0.01, 0.05] },
  "Soft Warming": { sat: 1.05, con: 0.08, gain: [1.08, 1, 0.94], lift: [0.02, 0.01, 0] },
  "Teal & Orange": { sat: 1.15, con: 0.25, gain: [1.1, 1, 0.9], lift: [0, 0.02, 0.05] },
  "Tension Green": { sat: 0.9, con: 0.25, gain: [0.95, 1.1, 0.9], lift: [0.01, 0.03, 0.02] },
};

/* ---------------- curves: shared by the graph UI and the filter ----------------
   Points serialise as "x:y,x:y" (0..1, x ascending). The curve through them
   is a monotone cubic (Fritsch–Carlson), so it never overshoots the way a
   naive spline does — the drawn graph and the applied table are the SAME
   samples. */

export function parseCurve(v: unknown): [number, number][] {
  const pts: [number, number][] = [];
  if (typeof v === "string") {
    for (const seg of v.split(",")) {
      const [x, y] = seg.split(":").map(Number);
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([clamp(x, 0, 1), clamp(y, 0, 1)]);
    }
  }
  if (pts.length < 2) return [[0, 0], [1, 1]];
  pts.sort((a, b) => a[0] - b[0]);
  return pts;
}
export const serializeCurve = (pts: [number, number][]): string =>
  pts.map(([x, y]) => `${F(x)}:${F(y)}`).join(",");

export function sampleCurve(pts: [number, number][], n: number): number[] {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const k = pts.length;
  /* Fritsch–Carlson tangents */
  const d: number[] = [], m: number[] = [];
  for (let i = 0; i < k - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]));
  for (let i = 0; i < k; i++) {
    if (i === 0) m.push(d[0]);
    else if (i === k - 1) m.push(d[k - 2]);
    else m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  }
  for (let i = 0; i < k - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  const out: number[] = [];
  for (let s = 0; s < n; s++) {
    const x = s / (n - 1);
    if (x <= xs[0]) { out.push(clamp(ys[0], 0, 1)); continue; }
    if (x >= xs[k - 1]) { out.push(clamp(ys[k - 1], 0, 1)); continue; }
    let i = 0;
    while (i < k - 2 && x > xs[i + 1]) i++;
    const h = Math.max(1e-6, xs[i + 1] - xs[i]);
    const t = (x - xs[i]) / h;
    const t2 = t * t, t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i]
      + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
    out.push(clamp(y, 0, 1));
  }
  return out;
}

function stageMarkup(el: AdjustEl, src: string, out: string): string {
  const p = el.params || {};
  switch (el.kind) {
    case "brightness": {
      const slope = Math.pow(2, num(p.c, 0) / 100);
      const icpt = num(p.b, 0) / 200 + (1 - slope) / 2;
      return linearCT(src, out, slope, icpt);
    }
    case "colorvib": {
      /* temperature/tint as gentle channel offsets, vibrance+saturation as
         a combined saturate — the Photoshop Color-and-Vibrance quartet */
      const t = num(p.temp, 0) / 300, ti = num(p.tint, 0) / 300;
      const off = linearCT(src, `${out}t`, 1, t, -ti, -t);
      const sat = Math.max(0, (1 + num(p.sat, 0) / 100) * (1 + num(p.vib, 0) / 150));
      return off + `<feColorMatrix in="${out}t" type="saturate" values="${F(sat)}" result="${out}"/>`;
    }
    case "exposure": {
      const lin = linearCT(src, `${out}e`, Math.pow(2, num(p.e, 0) / 50), num(p.offset, 0) / 200);
      const g = clamp(num(p.gammaC, 1), 0.2, 2.4);
      const exp = F(1 / g);
      return lin +
        `<feComponentTransfer in="${out}e" result="${out}">` +
        `<feFuncR type="gamma" amplitude="1" exponent="${exp}" offset="0"/>` +
        `<feFuncG type="gamma" amplitude="1" exponent="${exp}" offset="0"/>` +
        `<feFuncB type="gamma" amplitude="1" exponent="${exp}" offset="0"/>` +
        `</feComponentTransfer>`;
    }
    case "levels": {
      const b = clamp(num(p.blacks, 0), 0, 100) / 200;         // 0..0.5 in
      const w = 1 - clamp(num(p.whites, 0), 0, 100) / 200;
      const slope = 1 / Math.max(0.05, w - b);
      const lin = linearCT(src, `${out}l`, slope, -b * slope);
      const g = clamp(num(p.gamma, 1), 0.2, 2.4);
      const exp = F(1 / g);
      const gam =
        `<feComponentTransfer in="${out}l" result="${out}g">` +
        `<feFuncR type="gamma" amplitude="1" exponent="${exp}" offset="0"/>` +
        `<feFuncG type="gamma" amplitude="1" exponent="${exp}" offset="0"/>` +
        `<feFuncB type="gamma" amplitude="1" exponent="${exp}" offset="0"/>` +
        `</feComponentTransfer>`;
      /* output levels: remap onto [outB, outW] */
      const ob = clamp(num(p.outB, 0), 0, 255) / 255;
      const ow = clamp(num(p.outW, 255), 0, 255) / 255;
      return lin + gam + linearCT(`${out}g`, out, ow - ob, ob);
    }
    case "curves": {
      /* legacy layers saved a single S strength; new ones carry points */
      let pts = parseCurve(p.pts);
      if (typeof p.pts !== "string" && typeof p.s === "number") {
        const k = clamp(p.s, -100, 100) / 100;
        pts = [[0, 0], [0.25, clamp(0.25 - k * 0.12, 0, 1)], [0.75, clamp(0.75 + k * 0.12, 0, 1)], [1, 1]];
      }
      return tableCT(src, out, sampleCurve(pts, 33).map(F).join(" "));
    }
    case "hsl": {
      const hue = `<feColorMatrix in="${src}" type="hueRotate" values="${F(num(p.hue, 0))}" result="${out}h"/>`;
      const sat = Math.max(0, 1 + num(p.sat, 0) / 100);
      return hue +
        `<feColorMatrix in="${out}h" type="saturate" values="${F(sat)}" result="${out}s"/>` +
        linearCT(`${out}s`, out, 1, num(p.light, 0) / 200);
    }
    case "colorbalance":
      return linearCT(src, out, 1, num(p.r, 0) / 200, num(p.g, 0) / 200, num(p.b, 0) / 200);
    case "bw": {
      /* legacy layers stored a single desaturate amount */
      if (typeof p.reds !== "number" && typeof p.amt === "number") {
        return `<feColorMatrix in="${src}" type="saturate" values="${F(1 - clamp(p.amt, 0, 100) / 100)}" result="${out}"/>`;
      }
      /* six-hue mix folded to per-channel weights (secondaries split into
         their two primaries), normalised so the mix stays exposure-neutral */
      const wr = num(p.reds, 40), wy = num(p.yellows, 60), wg = num(p.greens, 40);
      const wc = num(p.cyans, 60), wb = num(p.blues, 20), wm = num(p.magentas, 80);
      let rc = wr + wy / 2 + wm / 2, gc = wg + wy / 2 + wc / 2, bc = wb + wc / 2 + wm / 2;
      const sum = rc + gc + bc;
      if (Math.abs(sum) < 1) { rc = gc = bc = 1 / 3; }
      else { rc /= sum; gc /= sum; bc /= sum; }
      const row = `${F(rc)} ${F(gc)} ${F(bc)} 0 0`;
      return `<feColorMatrix in="${src}" type="matrix" result="${out}" values="${row} ${row} ${row} 0 0 0 1 0"/>`;
    }
    case "photofilter": {
      const d = clamp(num(p.density, 25), 0, 100) / 100;
      return `<feFlood flood-color="${str(p.color, "#ec8a00")}" result="${out}f"/>` +
        `<feBlend in="${src}" in2="${out}f" mode="multiply" result="${out}m"/>` +
        MIX(src, `${out}m`, out, d);
    }
    case "selectivecolor": {
      /* Photoshop-compatible Selective Color (masks per pkh.me's reverse
         engineering / FFmpeg's selectivecolor): a pixel's membership in
         each family comes from channel min/max comparisons —
           reds R−max(G,B) · yellows min(R,G)−B · greens G−max(R,B)
           cyans min(G,B)−R · blues B−max(R,G) · magentas min(R,B)−G
           whites 2·min−1 · blacks 1−2·max · neutrals broad mid-tent —
         and the C/M/Y/K sliders push ink into R/G/B (K into all three).
         RELATIVE additionally scales by the pixel's existing ink (1−C).

         Filter mechanics: min/max via feBlend darken/lighten; the hue
         subtraction A−B is realised as the alpha-safe product A·(1−B)
         (a plain arithmetic subtract zeroes the ALPHA channel and premul
         storage then destroys the mask — the bug that made v1 a no-op);
         negative deltas apply through complement→add→complement for the
         same reason. */
      const active = SEL_FAMILIES.map(([f]) => f).filter((f) =>
        num(p[`${f}_c`], 0) || num(p[`${f}_m`], 0) || num(p[`${f}_y`], 0) || num(p[`${f}_k`], 0));
      if (!active.length) return linearCT(src, out, 1, 0);
      const relative = !num(p.method, 0);
      const toHex = (r: number, g: number, b: number) => {
        const c = (v: number) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");
        return `#${c(r)}${c(g)}${c(b)}`;
      };
      /* shared per-stage images: isolated channels + their inverses */
      const CR = `${out}cr`, CG = `${out}cg`, CB = `${out}cb`, INV = `${out}inv`;
      const iso = (r: number, g: number, b: number, res: string) => {
        const row = `${r} ${g} ${b} 0 0`;
        return `<feColorMatrix in="${src}" type="matrix" result="${res}" values="${row} ${row} ${row} 0 0 0 0 1"/>`;
      };
      let body = iso(1, 0, 0, CR) + iso(0, 1, 0, CG) + iso(0, 0, 1, CB);
      if (relative) {
        /* 1−R / 1−G / 1−B per channel — the pixel's ink room */
        body += `<feColorMatrix in="${src}" type="matrix" result="${INV}" values="` +
          `-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 0 1"/>`;
      }
      const blend = (mode: string, a: string, b: string, res: string) =>
        `<feBlend mode="${mode}" in="${a}" in2="${b}" result="${res}"/>`;
      const mul = (a: string, b: string, res: string) =>
        `<feComposite in="${a}" in2="${b}" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="${res}"/>`;
      const invCT = (a: string, res: string) => linearCT(a, res, -1, 1);
      let cur = src, fi = 0;
      for (const fam of active) {
        const mk = `${out}m${fi}`;
        /* membership mask, alpha kept at 1 throughout */
        switch (fam) {
          case "red": body += blend("lighten", CG, CB, `${mk}t`) + invCT(`${mk}t`, `${mk}i`) + mul(CR, `${mk}i`, mk); break;
          case "yel": body += blend("darken", CR, CG, `${mk}t`) + invCT(CB, `${mk}i`) + mul(`${mk}t`, `${mk}i`, mk); break;
          case "grn": body += blend("lighten", CR, CB, `${mk}t`) + invCT(`${mk}t`, `${mk}i`) + mul(CG, `${mk}i`, mk); break;
          case "cyn": body += blend("darken", CG, CB, `${mk}t`) + invCT(CR, `${mk}i`) + mul(`${mk}t`, `${mk}i`, mk); break;
          case "blu": body += blend("lighten", CR, CG, `${mk}t`) + invCT(`${mk}t`, `${mk}i`) + mul(CB, `${mk}i`, mk); break;
          case "mag": body += blend("darken", CR, CB, `${mk}t`) + invCT(CG, `${mk}i`) + mul(`${mk}t`, `${mk}i`, mk); break;
          case "wht": body += blend("darken", CR, CG, `${mk}t`) + blend("darken", `${mk}t`, CB, `${mk}u`) +
            linearCT(`${mk}u`, mk, 2, -1); break;
          case "blk": body += blend("lighten", CR, CG, `${mk}t`) + blend("lighten", `${mk}t`, CB, `${mk}u`) +
            linearCT(`${mk}u`, mk, -2, 1); break;
          default: body += LUM(src, `${mk}l`) +
            `<feComponentTransfer in="${mk}l" result="${mk}">` +
            `<feFuncR type="table" tableValues="0 1 1 1 1 1 0"/>` +
            `<feFuncG type="table" tableValues="0 1 1 1 1 1 0"/>` +
            `<feFuncB type="table" tableValues="0 1 1 1 1 1 0"/>` +
            `</feComponentTransfer>`;
        }
        /* relative scales the mask by the ink room per channel */
        const maskUse = relative ? `${mk}rel` : mk;
        if (relative) body += mul(mk, INV, `${mk}rel`);
        const c = num(p[`${fam}_c`], 0) / 100, m = num(p[`${fam}_m`], 0) / 100;
        const y = num(p[`${fam}_y`], 0) / 100, k = num(p[`${fam}_k`], 0) / 100;
        const dR = -(c + k), dG = -(m + k), dB = -(y + k);
        const hasPos = dR > 0 || dG > 0 || dB > 0;
        const hasNeg = dR < 0 || dG < 0 || dB < 0;
        if (hasPos) {
          body += `<feFlood flood-color="${toHex(Math.max(0, dR), Math.max(0, dG), Math.max(0, dB))}" result="${mk}fp"/>` +
            mul(maskUse, `${mk}fp`, `${mk}p`) +
            `<feComposite in="${cur}" in2="${mk}p" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="${mk}a"/>`;
          cur = `${mk}a`;
        }
        if (hasNeg) {
          /* cur − d as 1 − ((1 − cur) + d): every step keeps alpha at 1 */
          body += `<feFlood flood-color="${toHex(Math.max(0, -dR), Math.max(0, -dG), Math.max(0, -dB))}" result="${mk}fn"/>` +
            mul(maskUse, `${mk}fn`, `${mk}n`) +
            invCT(cur, `${mk}v`) +
            `<feComposite in="${mk}v" in2="${mk}n" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="${mk}w"/>` +
            invCT(`${mk}w`, `${mk}z`);
          cur = `${mk}z`;
        }
        fi++;
      }
      return body + linearCT(cur, out, 1, 0);
    }
    case "colorlookup": {
      const look = LOOKUP_TABLE[String(p.look)] ?? LOOKUP_TABLE["Teal & Orange"];
      const gains =
        `<feComponentTransfer in="${src}" result="${out}g">` +
        `<feFuncR type="linear" slope="${F(look.gain[0])}" intercept="${F(look.lift[0])}"/>` +
        `<feFuncG type="linear" slope="${F(look.gain[1])}" intercept="${F(look.lift[1])}"/>` +
        `<feFuncB type="linear" slope="${F(look.gain[2])}" intercept="${F(look.lift[2])}"/>` +
        `</feComponentTransfer>`;
      const sat = `<feColorMatrix in="${out}g" type="saturate" values="${F(look.sat)}" result="${out}s"/>`;
      const vals: string[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const s = t * t * (3 - 2 * t);
        vals.push(F(clamp(t + look.con * (s - t), 0, 1)));
      }
      const con = tableCT(`${out}s`, `${out}c`, vals.join(" "));
      return gains + sat + con + MIX(src, `${out}c`, out, clamp(num(p.strength, 100), 0, 100) / 100);
    }
    case "channelmixer": {
      const v = (k: string, d: number) => num(p[k], d) / 100;
      const rows: [number, number, number, number][] = num(p.mono, 0)
        ? Array(3).fill([v("rr", 1), v("rg", 0), v("rb", 0), v("rk", 0)]) as [number, number, number, number][]
        : [
          [v("rr", 1), v("rg", 0), v("rb", 0), v("rk", 0)],
          [v("gr", 0), v("gg", 1), v("gb", 0), v("gk", 0)],
          [v("br", 0), v("bg", 0), v("bb", 1), v("bk", 0)],
        ];
      const vals = rows.map(([a, b, c, k]) => `${F(a)} ${F(b)} ${F(c)} 0 ${F(k)}`).join(" ");
      return `<feColorMatrix in="${src}" type="matrix" result="${out}" values="${vals} 0 0 0 1 0"/>`;
    }
    case "invert": {
      const a = clamp(num(p.amt, 100), 0, 100) / 100;
      return tableCT(src, out, `${F(a)} ${F(1 - a)}`);
    }
    case "posterize": {
      const n = Math.round(clamp(num(p.levels, 4), 2, 16));
      const vals = Array.from({ length: n }, (_, i) => F(i / (n - 1))).join(" ");
      return discreteCT(src, out, vals);
    }
    case "threshold": {
      const t = clamp(num(p.level, 50), 1, 99) / 100;
      const bands = Array.from({ length: 32 }, (_, i) => (i / 32 < t ? "0" : "1")).join(" ");
      return LUM(src, `${out}l`) + discreteCT(`${out}l`, out, bands);
    }
    case "gradientmap": {
      /* preset stops (2-3) or the custom A→B pair; Reverse flips; the
         Stripes method quantises the map into hard bands */
      let stops = (typeof p.preset === "string" && p.preset !== "Custom" && gradientStops(p.preset))
        || [str(p.a, "#1a1240"), str(p.b, "#ffcf6b")];
      if (num(p.rev, 0)) stops = [...stops].reverse();
      const rgb = stops.map(hexRGB);
      const chan = (i: 0 | 1 | 2) => rgb.map((s) => F(s[i])).join(" ");
      const amt = clamp(num(p.amt, 100), 0, 100) / 100;
      const lum = LUM(src, `${out}l`);
      if (p.method === "Stripes") {
        /* sample the gradient at 8 bands, applied as a discrete table */
        const at = (t: number, i: 0 | 1 | 2) => {
          const x = t * (rgb.length - 1);
          const j = Math.min(rgb.length - 2, Math.floor(x));
          return rgb[j][i] + (rgb[j + 1][i] - rgb[j][i]) * (x - j);
        };
        const band = (i: 0 | 1 | 2) => Array.from({ length: 8 }, (_, j) => F(at((j + 0.5) / 8, i))).join(" ");
        return lum +
          `<feComponentTransfer in="${out}l" result="${out}g">` +
          `<feFuncR type="discrete" tableValues="${band(0)}"/>` +
          `<feFuncG type="discrete" tableValues="${band(1)}"/>` +
          `<feFuncB type="discrete" tableValues="${band(2)}"/>` +
          `</feComponentTransfer>` +
          MIX(src, `${out}g`, out, amt);
      }
      return lum +
        tableCT(`${out}l`, `${out}g`, chan(0), chan(1), chan(2)) +
        MIX(src, `${out}g`, out, amt);
    }
    case "grain": {
      const k = clamp(num(p.amt, 35), 0, 100) / 100 * 0.55;
      const freq = 0.9 / clamp(num(p.size, 10), 1, 40) * 10;   // bigger size → coarser noise
      const oct = Math.round(clamp(num(p.rough, 2), 1, 4));
      return `<feTurbulence type="fractalNoise" baseFrequency="${F(freq)}" numOctaves="${oct}" seed="7" stitchTiles="stitch" result="${out}n"/>` +
        `<feColorMatrix in="${out}n" type="matrix" result="${out}g" values="` +
        `0.33 0.33 0.34 0 0 0.33 0.33 0.34 0 0 0.33 0.33 0.34 0 0 0 0 0 0 1"/>` +
        `<feComposite in="${src}" in2="${out}g" operator="arithmetic" ` +
        `k1="0" k2="1" k3="${F(k)}" k4="${F(-k / 2)}" result="${out}"/>`;
    }
    case "clarity": {
      /* clarity: unsharp local contrast; dehaze: contrast + black depth +
         a saturation lift (the classic haze cut), both signed */
      const k = clamp(num(p.clarity, num(p.amt, 0)), -100, 100) / 100 * 1.4;
      const un = `<feGaussianBlur in="${src}" stdDeviation="3" result="${out}b"/>` +
        `<feComposite in="${src}" in2="${out}b" operator="arithmetic" ` +
        `k1="0" k2="${F(1 + k)}" k3="${F(-k)}" k4="0" result="${out}c"/>`;
      const d = clamp(num(p.dehaze, 0), -100, 100) / 100;
      return un + linearCT(`${out}c`, `${out}d`, 1 + d * 0.5, -d * 0.22) +
        `<feColorMatrix in="${out}d" type="saturate" values="${F(Math.max(0, 1 + d * 0.25))}" result="${out}"/>`;
    }
  }
}

/* the page's whole grade as ONE <filter> element (empty string if none) */
export function adjustFilterMarkup(id: string, layers: AdjustEl[]): string {
  if (!layers.length) return "";
  let src = "SourceGraphic";
  let body = "";
  layers.forEach((el, i) => {
    const out = `a${i}`;
    body += stageMarkup(el, src, out);
    src = out;
  });
  return `<filter id="${id}" color-interpolation-filters="sRGB">${body}</filter>`;
}

/* Export side: run the page canvas through the same filter. The scratch SVG
   lives in the document so ctx.filter's url() can resolve it. Browsers
   without canvas filters (Safari) return the canvas ungraded — the same
   degradation the per-element photo filters already have there. */
export function pageAdjustCanvas(canvas: HTMLCanvasElement, layers: AdjustEl[]): HTMLCanvasElement {
  if (!layers.length || typeof document === "undefined") return canvas;
  const out = document.createElement("canvas");
  out.width = canvas.width;
  out.height = canvas.height;
  const ctx = out.getContext("2d")!;
  if (typeof ctx.filter !== "string") return canvas;
  let host = document.getElementById("lmcAdjScratch");
  if (!host) {
    host = document.createElement("div");
    host.id = "lmcAdjScratch";
    host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    document.body.appendChild(host);
  }
  host.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0">${adjustFilterMarkup("lmcAdjX", layers)}</svg>`;
  ctx.filter = "url(#lmcAdjX)";
  ctx.drawImage(canvas, 0, 0);
  ctx.filter = "none";
  return out;
}
