/* Procedural fill engine: gradients, halftones, repeating tiles, speedlines
   and textures — all generated at runtime (nothing copied from other apps),
   deterministic (seeded PRNG) and cached. Client-side only. */
import type { CSSProperties } from "react";
import {
  FillStyle, HalftoneVariant, PatternVariant, SpeedlineVariant, TextureVariant,
} from "./model";

/* deterministic PRNG so every render/export of a variant looks identical */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, HTMLCanvasElement>();
const urlCache = new Map<string, string>();

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!];
}

/* ---------------- halftone (stretched tile) ---------------- */

function halftoneCoverage(v: HalftoneVariant, fx: number, fy: number): number {
  switch (v) {
    case "down": return 1 - fy;
    case "up": return fy;
    case "left": return 1 - fx;
    case "right": return fx;
    case "full": return 0.55;
    case "midh": return 1 - Math.abs(2 * fx - 1);
    case "midv": return 1 - Math.abs(2 * fy - 1);
  }
}

function halftoneTile(dot: string, cell: number, variant: HalftoneVariant): HTMLCanvasElement {
  const key = `ht|${dot}|${cell}|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 1024;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = dot;
  const step = cell * 2;
  for (let row = 0, y = step / 2; y < S + step; y += step, row++) {
    const off = row % 2 ? step / 2 : 0;
    for (let x = step / 2 + off; x < S + step; x += step) {
      const t = Math.max(0, Math.min(1, halftoneCoverage(variant, x / S, y / S)));
      const r = step * 0.62 * Math.sqrt(t);
      if (r < 0.3) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  cache.set(key, c);
  return c;
}

/* ---------------- repeating pattern tiles ---------------- */

function patternTile(fg: string, variant: PatternVariant, scale: number): HTMLCanvasElement {
  const key = `pt|${fg}|${variant}|${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = Math.max(4, scale);
  let c: HTMLCanvasElement, ctx: CanvasRenderingContext2D;

  const dotGrid = (radiusF: number, hollow: boolean, stagger: boolean) => {
    [c, ctx] = makeCanvas(s * 2, s * 2);
    ctx.strokeStyle = ctx.fillStyle = fg;
    ctx.lineWidth = Math.max(1, s * 0.12);
    const centers = stagger
      ? [[s * 0.5, s * 0.5], [s * 1.5, s * 1.5]]
      : [[s * 0.5, s * 0.5], [s * 1.5, s * 0.5], [s * 0.5, s * 1.5], [s * 1.5, s * 1.5]];
    for (const [x, y] of centers) {
      ctx.beginPath();
      ctx.arc(x, y, s * radiusF, 0, Math.PI * 2);
      if (hollow) ctx.stroke(); else ctx.fill();
    }
  };

  switch (variant) {
    case "check": {
      [c, ctx] = makeCanvas(s * 2, s * 2);
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, s, s);
      ctx.fillRect(s, s, s, s);
      break;
    }
    case "dots": dotGrid(0.28, false, true); break;
    case "smalldots": dotGrid(0.14, false, true); break;
    case "hexdots": dotGrid(0.3, false, true); break;
    case "hollowdots": dotGrid(0.26, true, false); break;
    case "dotsinv": {
      [c, ctx] = makeCanvas(s * 2, s * 2);
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, s * 2, s * 2);
      ctx.globalCompositeOperation = "destination-out";
      const rnd = mulberry32(7);
      for (const [x, y] of [[s * 0.5, s * 0.5], [s * 1.5, s * 1.5]]) {
        ctx.beginPath();
        ctx.arc(x + rnd() * 0.01, y, s * 0.24, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "linesh": case "linesv": {
      [c, ctx] = makeCanvas(s, s);
      ctx.fillStyle = fg;
      if (variant === "linesh") ctx.fillRect(0, 0, s, Math.max(1, s * 0.4));
      else ctx.fillRect(0, 0, Math.max(1, s * 0.4), s);
      break;
    }
    case "linesd": case "linesd2": {
      [c, ctx] = makeCanvas(s, s);
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(1, s * 0.35);
      ctx.beginPath();
      if (variant === "linesd") {
        ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s * 1.5, s * 1.5);
        ctx.moveTo(-s / 2, s / 2); ctx.lineTo(s / 2, s * 1.5);
        ctx.moveTo(s / 2, -s / 2); ctx.lineTo(s * 1.5, s / 2);
      } else {
        ctx.moveTo(-s / 2, s * 1.5); ctx.lineTo(s * 1.5, -s / 2);
        ctx.moveTo(-s / 2, s / 2); ctx.lineTo(s / 2, -s / 2);
        ctx.moveTo(s / 2, s * 1.5); ctx.lineTo(s * 1.5, s / 2);
      }
      ctx.stroke();
      break;
    }
    case "crosshatch": {
      [c, ctx] = makeCanvas(s, s);
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(1, s * 0.14);
      ctx.beginPath();
      ctx.moveTo(-s / 2, -s / 2); ctx.lineTo(s * 1.5, s * 1.5);
      ctx.moveTo(-s / 2, s * 1.5); ctx.lineTo(s * 1.5, -s / 2);
      ctx.stroke();
      break;
    }
    case "zigzag": {
      [c, ctx] = makeCanvas(s * 2, s);
      ctx.strokeStyle = fg;
      ctx.lineWidth = Math.max(1, s * 0.18);
      ctx.lineJoin = "miter";
      ctx.beginPath();
      ctx.moveTo(0, s * 0.75);
      ctx.lineTo(s * 0.5, s * 0.25);
      ctx.lineTo(s, s * 0.75);
      ctx.lineTo(s * 1.5, s * 0.25);
      ctx.lineTo(s * 2, s * 0.75);
      ctx.stroke();
      break;
    }
    case "screen": default: {
      [c, ctx] = makeCanvas(128, 128);
      const img = ctx.createImageData(128, 128);
      const rnd = mulberry32(1234);
      const col = hexToRgb(fg);
      for (let i = 0; i < img.data.length; i += 4) {
        const on = rnd() < 0.5;
        img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2];
        img.data[i + 3] = on ? 255 : 0;
      }
      ctx.putImageData(img, 0, 0);
      break;
    }
  }
  cache.set(key, c!);
  return c!;
}

/* ---------------- speedlines (stretched tile) ---------------- */

function speedTile(line: string, variant: SpeedlineVariant): HTMLCanvasElement {
  const key = `sp|${line}|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 1200;
  const [c, ctx] = makeCanvas(S, S);
  ctx.fillStyle = line;
  const rnd = mulberry32(variant === "burst2" ? 99 : variant === "ring" ? 42 : variant === "corner" ? 7 : 5);

  if (variant === "horiz" || variant === "horizfade") {
    const n = 260;
    for (let i = 0; i < n; i++) {
      const y = rnd() * S;
      const th = 0.6 + rnd() * 2.6;
      const alpha = 0.25 + rnd() * 0.75;
      ctx.globalAlpha = alpha;
      if (variant === "horiz") {
        const x0 = rnd() * S * 0.25, x1 = S - rnd() * S * 0.25;
        ctx.fillRect(x0, y, x1 - x0, th);
      } else {
        /* faded: lines pierce in from both edges, clear middle */
        const len = S * (0.12 + rnd() * 0.3);
        ctx.fillRect(0, y, len, th);
        const y2 = rnd() * S, len2 = S * (0.12 + rnd() * 0.3);
        ctx.fillRect(S - len2, y2, len2, 0.6 + rnd() * 2.6);
      }
    }
    ctx.globalAlpha = 1;
  } else {
    const cx = variant === "corner" ? 0 : S / 2;
    const cy = variant === "corner" ? 0 : S / 2;
    const n = variant === "burst2" ? 420 : 240;
    const rInner = variant === "ring" ? 0.42 : 0.16;
    const maxR = Math.hypot(S, S);
    for (let i = 0; i < n; i++) {
      const ang = variant === "corner"
        ? rnd() * Math.PI * 0.5
        : (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.02;
      const r0 = S * (rInner + rnd() * 0.14);
      const r1 = maxR;
      const halfW = (0.4 + rnd() * 1.6) * (Math.PI / n);
      ctx.globalAlpha = 0.5 + rnd() * 0.5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang - halfW) * r1, cy + Math.sin(ang - halfW) * r1);
      ctx.lineTo(cx + Math.cos(ang + halfW) * r1, cy + Math.sin(ang + halfW) * r1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  cache.set(key, c);
  return c;
}

/* ---------------- textures (stretched tile) ---------------- */

function textureTile(fg: string, variant: TextureVariant): HTMLCanvasElement {
  const key = `tx|${fg}|${variant}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const S = 640;
  const [c, ctx] = makeCanvas(S, S);
  const rnd = mulberry32(variant.length * 31 + 5);
  const col = hexToRgb(fg);

  const noise = (density: number, maxA: number) => {
    const img = ctx.createImageData(S, S);
    for (let i = 0; i < img.data.length; i += 4) {
      if (rnd() < density) {
        img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2];
        img.data[i + 3] = Math.floor(rnd() * maxA * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  const blobs = (count: number, rMin: number, rMax: number, alpha: number, blur: number) => {
    ctx.filter = `blur(${blur}px)`;
    ctx.fillStyle = fg;
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = alpha * (0.4 + rnd() * 0.6);
      const r = rMin + rnd() * (rMax - rMin);
      ctx.beginPath();
      ctx.arc(rnd() * S, rnd() * S, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  };

  switch (variant) {
    case "speckle": noise(0.06, 0.9); break;
    case "grit":    noise(0.22, 0.75); break;
    case "static":  noise(0.5, 0.95); break;
    case "murk":    blobs(90, 20, 90, 0.32, 18); break;
    case "daubs":   blobs(40, 30, 110, 0.4, 8); break;
    case "stone":   noise(0.1, 0.35); blobs(50, 30, 100, 0.12, 22); break;
  }
  cache.set(key, c);
  return c;
}

/* ---------------- public API ---------------- */

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const v = m.length === 3 ? m.split("").map((ch) => ch + ch).join("") : m;
  const n = parseInt(v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function fillOverlayTile(f: FillStyle): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  switch (f.kind) {
    case "halftone": return halftoneTile(f.dot, f.cell, f.variant);
    case "pattern": return patternTile(f.fg, f.variant, f.scale);
    case "speedlines": return speedTile(f.line, f.variant);
    case "texture": return textureTile(f.fg, f.variant);
    default: return null;
  }
}

export function fillOverlayURL(f: FillStyle): string | null {
  const tile = fillOverlayTile(f);
  if (!tile) return null;
  const key = JSON.stringify(f);
  const hit = urlCache.get(key);
  if (hit) return hit;
  const url = tile.toDataURL("image/png");
  urlCache.set(key, url);
  return url;
}

export const isRepeating = (f: FillStyle) => f.kind === "pattern";

/* CSS for DOM rendering of any fill */
export function gradientCss(f: Extract<FillStyle, { kind: "gradient" }>): string {
  if (f.stops?.length) {
    return `linear-gradient(${f.angle}deg, ${f.stops.map(([c, p]) => `${c} ${Math.round(p * 100)}%`).join(", ")})`;
  }
  return `linear-gradient(${f.angle}deg, ${f.a}, ${f.b})`;
}

export function fillCss(f: FillStyle): CSSProperties {
  switch (f.kind) {
    case "solid": return { background: f.a };
    case "gradient": return { background: gradientCss(f) };
    default: {
      const url = fillOverlayURL(f);
      return {
        backgroundColor: f.a,
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: isRepeating(f) ? "auto" : "100% 100%",
        backgroundRepeat: isRepeating(f) ? "repeat" : "no-repeat",
      };
    }
  }
}

/* Paint a fill inside a canvas region (local coords 0,0..w,h), optionally
   clipped to a Path2D. Used by the PNG exporter. */
export function paintFill(
  ctx: CanvasRenderingContext2D, f: FillStyle, w: number, h: number, clip?: Path2D
) {
  ctx.save();
  if (clip) ctx.clip(clip);
  if (f.kind === "gradient") {
    const rad = ((f.angle - 90) * Math.PI) / 180;
    const cx = w / 2, cy = h / 2;
    const len = (Math.abs(Math.cos(rad)) * w + Math.abs(Math.sin(rad)) * h) / 2;
    const g = ctx.createLinearGradient(
      cx - Math.cos(rad) * len, cy - Math.sin(rad) * len,
      cx + Math.cos(rad) * len, cy + Math.sin(rad) * len
    );
    if (f.stops?.length) {
      for (const [c, p] of f.stops) g.addColorStop(Math.min(1, Math.max(0, p)), c);
    } else {
      g.addColorStop(0, f.a);
      g.addColorStop(1, f.b);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    ctx.fillStyle = f.a;
    ctx.fillRect(0, 0, w, h);
    const tile = fillOverlayTile(f);
    if (tile) {
      if (isRepeating(f)) {
        const pat = ctx.createPattern(tile, "repeat");
        if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, w, h); }
      } else {
        ctx.drawImage(tile, 0, 0, w, h);
      }
    }
  }
  ctx.restore();
}

/* Convenient default fill instances for the picker UI */
export function defaultFillFor(kind: FillStyle["kind"], baseColor: string): FillStyle {
  switch (kind) {
    case "solid": return { kind: "solid", a: baseColor };
    case "gradient": return { kind: "gradient", a: "#ffffff", b: "#9ecbff", angle: 180 };
    case "halftone": return { kind: "halftone", a: baseColor, dot: "#222222", cell: 16, variant: "down" };
    case "pattern": return { kind: "pattern", a: baseColor, fg: "#222222", variant: "dots", scale: 24 };
    case "speedlines": return { kind: "speedlines", a: "#ffffff", line: "#222222", variant: "burst" };
    case "texture": return { kind: "texture", a: baseColor, fg: "#555555", variant: "speckle" };
  }
}
