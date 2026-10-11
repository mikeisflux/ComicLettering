/* Lightning — forked electric filaments crackling off the letter edges.

   A "bolt" glow (see glows.ts) is the usual soft halo PLUS a set of jagged
   branching filaments growing outward from the ink. The filaments come
   from the lettering's own alpha mask: edge pixels are found, a handful are
   picked as seeds, and each seed grows a random walk along the outward
   normal — kinked at every step, forking now and then, thinning to a point.
   Every bolt is stroked twice: a wide blurred pass in the glow's colour and
   a thin bright core, so it reads as light, not as a drawn line.

   The walk is seeded from the text itself, so the editor, the thumbnail
   and the printed page all get the SAME bolts (editor/export parity), and
   the bolts stay put while the letterer drags the element around. */
import type { Glow } from "./glows";

/* mulberry32 — the same small PRNG the action lines use */
function rng(seed: number) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** a stable seed for a piece of lettering: its words and its size */
export function boltSeed(text: string, size: number): number {
  let h = 2166136261 ^ Math.round(size);
  const s = String(text);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** how far (in type-size units) the bolts can reach past the ink — the
    scratch canvas is padded by this so nothing is clipped */
export const boltReach = (strength: number) => 0.8 * Math.sqrt(Math.max(0.25, strength));

interface Seg { x0: number; y0: number; x1: number; y1: number; w: number }

/* grow one filament (and its forks) from a seed; `base` is the outward
   direction it keeps drifting back towards. These are hair-fine, short
   and kinked at every step — static crackling off the ink, not sky-bolts. */
function grow(out: Seg[][], rand: () => number, x: number, y: number, base: number, len: number, w0: number, step: number, depth: number) {
  const segs: Seg[] = [];
  let dir = base + (rand() - 0.5) * 1.2;
  let travelled = 0, w = w0, n = 0;
  while (travelled < len && w > 0.1) {
    const sl = step * (0.6 + rand() * 0.8);
    dir += (rand() - 0.5) * 1.6;
    /* pull back towards the outward direction so the filament keeps
       leaving the ink instead of curling into it */
    let d = base - dir;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    dir += d * 0.25;
    const nx = x + Math.cos(dir) * sl, ny = y + Math.sin(dir) * sl;
    const nw = w0 * (1 - (travelled + sl) / len) * (0.8 + rand() * 0.4);
    segs.push({ x0: x, y0: y, x1: nx, y1: ny, w: Math.max(0.1, nw) });
    x = nx; y = ny; travelled += sl; w = nw; n++;
    if (depth < 3 && n >= 1 && travelled < len * 0.85 && rand() < 0.3) {
      const side = rand() < 0.5 ? -1 : 1;
      grow(out, rand, x, y, dir + side * (0.6 + rand() * 0.9), (len - travelled) * (0.4 + rand() * 0.4), w * 0.85, step * 0.9, depth + 1);
    }
  }
  if (segs.length) out.push(segs);
}

/* lighten a #rrggbb towards white */
function lighten(hex: string, t: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.round(v + (255 - v) * t).toString(16).padStart(2, "0");
  return "#" + ch(n >> 16) + ch((n >> 8) & 255) + ch(n & 255);
}

/**
 * Draw the bolts for a piece of lettering.
 * `mask` is the finished lettering rendered on a transparent scratch canvas
 * at `k` device pixels per unit; it is painted onto `ctx` at (x0, y0) in
 * the context's own units, and the bolts land in the same place.
 */
export function drawBolts(
  ctx: CanvasRenderingContext2D, mask: HTMLCanvasElement, x0: number, y0: number, k: number,
  size: number, strength: number, seed: number, glow: Glow,
) {
  const mctx = mask.getContext("2d", { willReadFrequently: true });
  if (!mctx || !mask.width || !mask.height) return;
  let data: Uint8ClampedArray;
  try { data = mctx.getImageData(0, 0, mask.width, mask.height).data; } catch { return; }
  const W = mask.width, H = mask.height;
  const unit = Math.max(1, size * k);           // one type size in mask px
  const s = Math.max(1, Math.round(unit / 22)); // edge sampling step
  const alpha = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : data[(y * W + x) * 4 + 3];
  /* edge samples with their outward normals (minus the alpha gradient) */
  const edges: { x: number; y: number; a: number }[] = [];
  for (let y = s; y < H - s; y += s) {
    for (let x = s; x < W - s; x += s) {
      if (alpha(x, y) < 128) continue;
      const l = alpha(x - s, y), r = alpha(x + s, y), u = alpha(x, y - s), d = alpha(x, y + s);
      if (l >= 128 && r >= 128 && u >= 128 && d >= 128) continue;
      const gx = r - l, gy = d - u;
      if (!gx && !gy) continue;
      edges.push({ x, y, a: Math.atan2(-gy, -gx) });
    }
  }
  if (!edges.length) return;
  const rand = rng(seed);
  /* dense: several filaments per type size of outline, more when strong */
  const want = Math.max(6, Math.min(900, Math.round((edges.length * s) / (unit * 0.42) * Math.sqrt(strength))));
  const minGap = unit * 0.13;
  const seeds: typeof edges = [];
  for (let tries = 0; seeds.length < want && tries < want * 4; tries++) {
    const e = edges[Math.floor(rand() * edges.length)];
    let close = false;
    for (let i = seeds.length - 1; i >= 0 && i >= seeds.length - 80; i--) {
      const q = seeds[i];
      if (Math.abs(q.x - e.x) < minGap && Math.abs(q.y - e.y) < minGap) { close = true; break; }
    }
    if (close) continue;
    seeds.push(e);
  }
  const bolts: Seg[][] = [];
  const reach = unit * boltReach(strength);
  for (const e of seeds) {
    const len = reach * (0.25 + rand() * 0.75);
    grow(bolts, rand, e.x, e.y, e.a, len, unit * 0.017, unit * 0.045, 0);
  }
  if (!bolts.length) return;
  const mid = glow.bolt || glow.ramp[1] || "#b20af5";
  const core = lighten(mid, 0.45);
  const strokeAll = (width: (w: number) => number, color: string, alpha: number, blur: number) => {
    ctx.save();
    ctx.translate(x0, y0);
    ctx.scale(1 / k, 1 / k);
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    if (blur > 0) { ctx.shadowColor = color; ctx.shadowBlur = blur; }
    for (const b of bolts) {
      for (const sg of b) {
        ctx.lineWidth = Math.max(0.3, width(sg.w));
        ctx.beginPath(); ctx.moveTo(sg.x0, sg.y0); ctx.lineTo(sg.x1, sg.y1); ctx.stroke();
      }
    }
    ctx.restore();
  };
  /* a faint haze in the glow's colour, then the fine bright filament */
  strokeAll((w) => w * 3, mid, 0.22, unit * 0.03);
  strokeAll((w) => w, core, 0.72, 0);
}
