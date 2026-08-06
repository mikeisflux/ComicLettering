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
}

export const ADJUST_META: Record<AdjustKind, { label: string; params: AdjustParamSpec[] }> = {
  brightness: {
    label: "Brightness/Contrast",
    params: [
      { key: "b", label: "Brightness", min: -100, max: 100, def: 0 },
      { key: "c", label: "Contrast", min: -100, max: 100, def: 0 },
    ],
  },
  exposure: {
    label: "Exposure",
    params: [{ key: "e", label: "Exposure", min: -100, max: 100, def: 0 }],
  },
  levels: {
    label: "Levels",
    params: [
      { key: "blacks", label: "Blacks in", min: 0, max: 100, def: 0 },
      { key: "whites", label: "Whites in", min: 0, max: 100, def: 0 },
      { key: "gamma", label: "Midtones (gamma)", min: 0.2, max: 2.4, step: 0.02, def: 1 },
    ],
  },
  curves: {
    label: "Curves (S)",
    params: [{ key: "s", label: "S-curve", min: -100, max: 100, def: 0 }],
  },
  hsl: {
    label: "Hue/Saturation",
    params: [
      { key: "hue", label: "Hue", min: -180, max: 180, def: 0 },
      { key: "sat", label: "Saturation", min: -100, max: 100, def: 0 },
      { key: "vib", label: "Vibrance", min: 0, max: 100, def: 0 },
    ],
  },
  colorbalance: {
    label: "Color Balance",
    params: [
      { key: "r", label: "Cyan ↔ Red", min: -100, max: 100, def: 0 },
      { key: "g", label: "Magenta ↔ Green", min: -100, max: 100, def: 0 },
      { key: "b", label: "Yellow ↔ Blue", min: -100, max: 100, def: 0 },
    ],
  },
  bw: {
    label: "Black & White",
    params: [{ key: "amt", label: "Desaturate", min: 0, max: 100, def: 100 }],
  },
  photofilter: {
    label: "Photo Filter",
    params: [
      { key: "color", label: "Filter color", def: "#ec8a00", color: true },
      { key: "density", label: "Density", min: 0, max: 100, def: 25 },
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
      { key: "a", label: "Shadows color", def: "#1a1240", color: true },
      { key: "b", label: "Highlights color", def: "#ffcf6b", color: true },
      { key: "amt", label: "Blend", min: 0, max: 100, def: 100 },
    ],
  },
  grain: {
    label: "Grain",
    params: [{ key: "amt", label: "Amount", min: 0, max: 100, def: 35 }],
  },
  clarity: {
    label: "Clarity/Dehaze",
    params: [{ key: "amt", label: "Amount", min: -100, max: 100, def: 30 }],
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

function stageMarkup(el: AdjustEl, src: string, out: string): string {
  const p = el.params || {};
  switch (el.kind) {
    case "brightness": {
      const slope = Math.pow(2, num(p.c, 0) / 100);
      const icpt = num(p.b, 0) / 200 + (1 - slope) / 2;
      return linearCT(src, out, slope, icpt);
    }
    case "exposure":
      return linearCT(src, out, Math.pow(2, num(p.e, 0) / 50), 0);
    case "levels": {
      const b = clamp(num(p.blacks, 0), 0, 100) / 200;         // 0..0.5 in
      const w = 1 - clamp(num(p.whites, 0), 0, 100) / 200;
      const slope = 1 / Math.max(0.05, w - b);
      const lin = linearCT(src, `${out}l`, slope, -b * slope);
      const g = clamp(num(p.gamma, 1), 0.2, 2.4);
      const exp = F(1 / g);
      return lin +
        `<feComponentTransfer in="${out}l" result="${out}">` +
        `<feFuncR type="gamma" amplitude="1" exponent="${exp}" offset="0"/>` +
        `<feFuncG type="gamma" amplitude="1" exponent="${exp}" offset="0"/>` +
        `<feFuncB type="gamma" amplitude="1" exponent="${exp}" offset="0"/>` +
        `</feComponentTransfer>`;
    }
    case "curves": {
      const k = clamp(num(p.s, 0), -100, 100) / 100;
      const vals: string[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const s = t * t * (3 - 2 * t);          // smoothstep S
        const v = k >= 0 ? t + k * (s - t) : t - k * (t - (0.5 + (t - 0.5) * 0.6));
        vals.push(F(clamp(v, 0, 1)));
      }
      return tableCT(src, out, vals.join(" "));
    }
    case "hsl": {
      const hue = `<feColorMatrix in="${src}" type="hueRotate" values="${F(num(p.hue, 0))}" result="${out}h"/>`;
      const sat = (1 + num(p.sat, 0) / 100) * (1 + num(p.vib, 0) / 200);
      return hue + `<feColorMatrix in="${out}h" type="saturate" values="${F(Math.max(0, sat))}" result="${out}"/>`;
    }
    case "colorbalance":
      return linearCT(src, out, 1, num(p.r, 0) / 200, num(p.g, 0) / 200, num(p.b, 0) / 200);
    case "bw":
      return `<feColorMatrix in="${src}" type="saturate" values="${F(1 - clamp(num(p.amt, 100), 0, 100) / 100)}" result="${out}"/>`;
    case "photofilter": {
      const d = clamp(num(p.density, 25), 0, 100) / 100;
      return `<feFlood flood-color="${str(p.color, "#ec8a00")}" result="${out}f"/>` +
        `<feBlend in="${src}" in2="${out}f" mode="multiply" result="${out}m"/>` +
        MIX(src, `${out}m`, out, d);
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
      const [ar, ag, ab] = hexRGB(str(p.a, "#1a1240"));
      const [br, bg, bb] = hexRGB(str(p.b, "#ffcf6b"));
      const amt = clamp(num(p.amt, 100), 0, 100) / 100;
      return LUM(src, `${out}l`) +
        tableCT(`${out}l`, `${out}g`, `${F(ar)} ${F(br)}`, `${F(ag)} ${F(bg)}`, `${F(ab)} ${F(bb)}`) +
        MIX(src, `${out}g`, out, amt);
    }
    case "grain": {
      const k = clamp(num(p.amt, 35), 0, 100) / 100 * 0.55;
      return `<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" stitchTiles="stitch" result="${out}n"/>` +
        `<feColorMatrix in="${out}n" type="matrix" result="${out}g" values="` +
        `0.33 0.33 0.34 0 0 0.33 0.33 0.34 0 0 0.33 0.33 0.34 0 0 0 0 0 0 1"/>` +
        `<feComposite in="${src}" in2="${out}g" operator="arithmetic" ` +
        `k1="0" k2="1" k3="${F(k)}" k4="${F(-k / 2)}" result="${out}"/>`;
    }
    case "clarity": {
      const k = clamp(num(p.amt, 30), -100, 100) / 100 * 1.4;
      return `<feGaussianBlur in="${src}" stdDeviation="3" result="${out}b"/>` +
        `<feComposite in="${src}" in2="${out}b" operator="arithmetic" ` +
        `k1="0" k2="${F(1 + k)}" k3="${F(-k)}" k4="0" result="${out}"/>`;
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
