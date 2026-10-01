/* Instaction — action lines drawn around a traced object.

   The letterer lassos an object (the same trace tool as Tuck Back) and
   gets a ring of hand-inked emphasis strokes radiating from its outline:
   "burst" wedges thick at the object and tapering outward, or "focus"
   lines running in from the box edge and tapering to a point at the
   object (the manga 集中線). The strokes are generated from the outline,
   never from pixels, so they re-render crisp at any export DPI.

   ONE geometry function feeds both the DOM editor (an SVG path) and the
   canvas/PDF export (Path2D) — editor/export parity by construction.

   Everything is relative to the traced ring's size (its mean radius R):
   length, gap and weight are fractions of R, so resizing the element
   scales the whole effect proportionally, exactly like a custom balloon's
   normalised outline. `seed` makes the hand-jitter reproducible. */
import type { ActionEl } from "./model";

/* deterministic small PRNG (mulberry32) — same seed, same lines, in the
   editor, the thumbnail and the print */
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

/* area centroid of a polygon (falls back to the point mean for a
   degenerate ring) */
function centroid(P: number[][]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-6) {
    return [P.reduce((s, p) => s + p[0], 0) / P.length, P.reduce((s, p) => s + p[1], 0) / P.length];
  }
  return [cx / (3 * a), cy / (3 * a)];
}

/* farthest crossing of the ray C+t·dir with the ring — the object's edge
   in that direction (a concave outline can cross several times; the
   strokes start outside ALL of it) */
function rayHit(P: number[][], C: [number, number], dx: number, dy: number): number | null {
  let best: number | null = null;
  for (let i = 0; i < P.length; i++) {
    const [px, py] = P[i], [qx, qy] = P[(i + 1) % P.length];
    const ex = qx - px, ey = qy - py;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const wx = px - C[0], wy = py - C[1];
    const t = (wx * ey - wy * ex) / den;
    const u = (wx * dy - wy * dx) / den;
    if (t > 0 && u >= 0 && u <= 1 && (best === null || t > best)) best = t;
  }
  return best;
}

/* distance along the ray to the element box's edge */
function rayToBox(C: [number, number], dx: number, dy: number, w: number, h: number): number {
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (w - C[0]) / dx);
  if (dx < -1e-9) t = Math.min(t, -C[0] / dx);
  if (dy > 1e-9) t = Math.min(t, (h - C[1]) / dy);
  if (dy < -1e-9) t = Math.min(t, -C[1] / dy);
  return Number.isFinite(t) ? t : Math.max(w, h);
}

/* even-odd point-in-polygon */
export function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/* a stroke is trimmed when ANY part of it falls inside a cut loop */
function trimmed(w: number[][], cuts: number[][][]): boolean {
  if (!cuts.length) return false;
  const base = [(w[0][0] + w[1][0]) / 2, (w[0][1] + w[1][1]) / 2];
  const mid = [(base[0] + w[2][0]) / 2, (base[1] + w[2][1]) / 2];
  const probes = [w[0], w[1], w[2], base, mid];
  return cuts.some((c) => c.length >= 3 && probes.some((p) => pointInRing(p[0], p[1], c)));
}

export const ACTION_DEFAULTS = {
  style: "burst" as const, count: 36, len: 0.55, gap: 0.08, weight: 0.055, jitter: 0.5, color: "#111111",
};

/* the strokes as closed polygons in ELEMENT-local units */
export function actionWedges(el: ActionEl): number[][][] {
  const P = (el.pts || []).map(([nx, ny]) => [nx * el.w, ny * el.h]);
  if (P.length < 3 || !(el.w > 0) || !(el.h > 0)) return [];
  const C = centroid(P);
  const R = P.reduce((s, p) => s + Math.hypot(p[0] - C[0], p[1] - C[1]), 0) / P.length;
  if (!(R > 0)) return [];
  const rand = rng(el.seed || 1);
  const cuts = (el.cuts || []).map((c) => c.map(([nx, ny]) => [nx * el.w, ny * el.h]));
  const count = Math.max(3, Math.min(240, Math.round(el.count)));
  const jit = Math.max(0, Math.min(1, el.jitter));
  const out: number[][][] = [];
  for (let i = 0; i < count; i++) {
    const a = ((i + 0.5) / count) * Math.PI * 2 + jit * (rand() - 0.5) * (Math.PI * 2 / count) * 0.9;
    const dx = Math.cos(a), dy = Math.sin(a);
    const edge = rayHit(P, C, dx, dy) ?? R;
    const start = edge + el.gap * R * (1 + jit * 0.6 * (rand() - 0.5));
    const w0 = Math.max(0.5, el.weight * R * (1 + jit * 0.5 * (rand() - 0.5)));
    let end: number;
    if (el.style === "focus") {
      /* in from the frame: the box edge is the far end, the taper's point
         sits just off the object */
      end = rayToBox(C, dx, dy, el.w, el.h);
      if (end <= start + 1) continue;
    } else {
      end = start + el.len * R * (1 + jit * 0.7 * (rand() - 0.5));
    }
    const nx = -dy * w0 / 2, ny = dx * w0 / 2;
    const S = [C[0] + dx * start, C[1] + dy * start];
    const E = [C[0] + dx * end, C[1] + dy * end];
    const wdg = el.style === "focus"
      ? [[E[0] + nx, E[1] + ny], [E[0] - nx, E[1] - ny], S]
      : [[S[0] + nx, S[1] + ny], [S[0] - nx, S[1] - ny], E];
    if (!trimmed(wdg, cuts)) out.push(wdg);
  }
  return out;
}

export function actionPathD(el: ActionEl): string {
  return actionWedges(el).map((w) => "M" + w.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L") + "Z").join("");
}

/* the box a traced ring (page units) needs so the burst's longest strokes
   fit inside it — the element's x/y/w/h, and the ring normalised to it */
export function actionBoxFor(ring: number[][], len = ACTION_DEFAULTS.len, gap = ACTION_DEFAULTS.gap, weight = ACTION_DEFAULTS.weight) {
  const C = centroid(ring);
  const R = ring.reduce((s, p) => s + Math.hypot(p[0] - C[0], p[1] - C[1]), 0) / ring.length;
  const pad = R * (gap + len * 1.4 + weight) + 4;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of ring) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const x = Math.round(x0 - pad), y = Math.round(y0 - pad);
  const w = Math.round(x1 - x0 + pad * 2), h = Math.round(y1 - y0 + pad * 2);
  const pts = ring.map(([px, py]) => [(px - x) / w, (py - y) / h] as [number, number]);
  return { x, y, w, h, pts };
}
