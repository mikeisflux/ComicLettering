/* Balloon shape geometry — original vector paths for every balloon type.
   Path strings are valid SVG `d` data and canvas Path2D input. */
import { BalloonEl } from "./model";

const fmt = (n: number) => Math.round(n * 100) / 100;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (p: number[], q: number[], t: number) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const ellipsePt = (cx: number, cy: number, rx: number, ry: number, th: number) =>
  [cx + rx * Math.cos(th), cy + ry * Math.sin(th)];

/* Arc-warp layout for SFX text. Given each glyph's advance width and a warp
   amount (-100..100), returns each glyph's centre offset (x,y from the arc
   midpoint) and tangent rotation in radians. Used identically by the on-canvas
   editor preview and the export renderer so warped text is WYSIWYG. */
export function arcTextLayout(widths: number[], amount: number): { x: number; y: number; rot: number }[] {
  const total = widths.reduce((a, b) => a + b, 0) || 1;
  const cum: number[] = [];
  let acc = 0;
  for (const w of widths) { cum.push(acc + w / 2); acc += w; }
  if (!amount) return widths.map((_, i) => ({ x: cum[i] - total / 2, y: 0, rot: 0 }));
  const dir = amount < 0 ? -1 : 1;
  const s = Math.min(Math.abs(amount) / 100, 1) * Math.PI * 0.9;
  const R = total / s;
  return cum.map((sMid) => {
    const theta = -s / 2 + sMid / R;
    const x = R * Math.sin(theta);
    const yUp = R - R * Math.cos(theta);
    return { x, y: dir > 0 ? yUp : -yUp, rot: dir > 0 ? theta : -theta };
  });
}

/* tiny deterministic prng for hand-drawn jitter */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function circleSub(cx: number, cy: number, r: number) {
  return ` M ${fmt(cx + r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx - r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx + r)} ${fmt(cy)} Z`;
}

const linePath = (pts: number[][], close = true) =>
  `M ${pts.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join(" L ")}${close ? " Z" : ""}`;

/* sampled quadratic bezier (excluding the start point) */
function quadPts(p0: number[], c: number[], p1: number[], n = 14): number[][] {
  const out: number[][] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
      u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
    ]);
  }
  return out;
}

/* One curved edge of a joined-balloon connector: from base point P through
   Mside (the offset bend point) to the far point Tp, with tangent T at the
   bend so the tilt axis controls the curve's lean. */
function bentSide(P: number[], Mside: number[], Tp: number[], T: number[]): number[][] {
  const k1 = 0.5 * Math.hypot(P[0] - Mside[0], P[1] - Mside[1]);
  const k2 = 0.5 * Math.hypot(Tp[0] - Mside[0], Tp[1] - Mside[1]);
  const c1 = [Mside[0] - T[0] * k1, Mside[1] - T[1] * k1];
  const c2 = [Mside[0] + T[0] * k2, Mside[1] + T[1] * k2];
  return [...quadPts(P, c1, Mside), ...quadPts(Mside, c2, Tp)];
}

/* Resolve the connector's bend geometry shared by all balloon shapes:
   bend point M, unit tangent T (flipped to point base→tip), tip-end spread
   points, and the two offset bend points for the band edges. */
function bendGeom(
  tail: { dx: number; dy: number; bx?: number; by?: number; tx?: number; ty?: number },
  cx: number, cy: number, tip: number[], E: number[], B: number[], bandHalf: number
) {
  const M = [cx + (tail.bx ?? tail.dx / 2), cy + (tail.by ?? tail.dy / 2)];
  let T = tail.tx != null && tail.ty != null
    ? [tail.tx, tail.ty]
    : [tip[0] - E[0], tip[1] - E[1]];
  const L = Math.hypot(T[0], T[1]) || 1;
  T = [T[0] / L, T[1] / L];
  if (T[0] * (tip[0] - E[0]) + T[1] * (tip[1] - E[1]) < 0) T = [-T[0], -T[1]];
  const nrm = [-T[1], T[0]];
  const side = nrm[0] * (B[0] - M[0]) + nrm[1] * (B[1] - M[1]) >= 0 ? 1 : -1;
  const M_B = [M[0] + nrm[0] * side * bandHalf, M[1] + nrm[1] * side * bandHalf];
  const M_A = [M[0] - nrm[0] * side * bandHalf, M[1] - nrm[1] * side * bandHalf];
  /* tip-end spread perpendicular to the arrival direction */
  const av = [tip[0] - M[0], tip[1] - M[1]];
  const al = Math.hypot(av[0], av[1]) || 1;
  const ap = [-av[1] / al, av[0] / al];
  const t1 = [tip[0] + ap[0] * bandHalf, tip[1] + ap[1] * bandHalf];
  const t2 = [tip[0] - ap[0] * bandHalf, tip[1] - ap[1] * bandHalf];
  const near1 = Math.hypot(t1[0] - M_B[0], t1[1] - M_B[1]) <= Math.hypot(t2[0] - M_B[0], t2[1] - M_B[1]);
  const tipB = near1 ? t1 : t2, tipA = near1 ? t2 : t1;
  return { M_B, M_A, tipB, tipA, T };
}

export interface BalloonGeom {
  d: string;
  d2?: string; // decorative second outline (stroked only)
  /* decorative shapes filled with the stroke colour (e.g. dot borders) */
  deco?: string;
  /* suppress stroking the main path (border drawn by deco instead) */
  noStroke?: boolean;
  /* joined-balloon connector, drawn as a separate OPEN band on top of both
     bodies: `bandFill` is the closed quad (filled, no stroke — it covers the
     outline segments it crosses so both junctions stay open), `bandEdges` are
     the two side curves (stroked only). */
  bandFill?: string;
  bandEdges?: string;
  textRect: [number, number, number, number];
  dash: number[] | null;
}

/* ---- polygon outlines (rects, rounded rects, pills) with optional tails ---- */

function roundRectPts(w: number, h: number, r: number, seg = 5): number[][] {
  r = Math.min(r, w / 2 - 0.5, h / 2 - 0.5);
  const pts: number[][] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  corner(w - r, r, -Math.PI / 2);      // top-right
  corner(w - r, h - r, 0);             // bottom-right
  corner(r, h - r, Math.PI / 2);       // bottom-left
  corner(r, r, Math.PI);               // top-left
  return pts;
}

/* Insert a tail into a closed polygon: find where the ray from the centre to
   the tip exits, and splice base points + tail leg(s) into that edge. */
function polygonWithTail(
  pts: number[][], w: number, h: number,
  tail: { dx: number; dy: number; bx?: number; by?: number; tx?: number; ty?: number } | null,
  zigzag = false, band = false
): string {
  if (!tail) return linePath(pts);
  const cx = w / 2, cy = h / 2;
  const tip = [cx + tail.dx, cy + tail.dy];
  /* a joined connector's bend point steers where the band leaves the shape */
  const aim = band && tail.bx != null && tail.by != null ? [cx + tail.bx, cy + tail.by] : tip;
  const dx = aim[0] - cx, dy = aim[1] - cy;
  const dLen = Math.hypot(dx, dy);
  if (dLen < 4) return linePath(pts);
  const D = [dx / dLen, dy / dLen];

  let bestI = -1, bestS = Infinity, bestU = 0;
  for (let i = 0; i < pts.length; i++) {
    const P = pts[i], Q = pts[(i + 1) % pts.length];
    const ex = Q[0] - P[0], ey = Q[1] - P[1];
    const den = D[0] * ey - D[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    /* solve P + u·edge = centre + s·D for u (fraction along the edge) */
    const u = (D[0] * (cy - P[1]) - D[1] * (cx - P[0])) / den;
    const s = Math.abs(D[0]) > Math.abs(D[1])
      ? (P[0] + u * ex - cx) / D[0]
      : (P[1] + u * ey - cy) / D[1];
    if (u >= 0 && u <= 1 && s > 0 && s < bestS) { bestS = s; bestI = i; bestU = u; }
  }
  if (bestI < 0) return linePath(pts);

  /* the base spans real arc-length around the ring on both sides of the
     exit point, so it stays wide no matter how dense the polygon is */
  const n = pts.length;
  const cum: number[] = new Array(n);
  let per = 0;
  for (let i = 0; i < n; i++) {
    cum[i] = per;
    const q = pts[(i + 1) % n];
    per += Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]);
  }
  if (per < 8) return linePath(pts);
  const segLen = (i: number) => (i + 1 < n ? cum[i + 1] : per) - cum[i];
  const exitS = cum[bestI] + bestU * segLen(bestI);
  /* same base width as the standard speech balloon tail (delta 0.11 rad on
     an ellipse ≈ 0.055·(w+h) across), so every balloon's tail matches */
  const half = Math.min(per * 0.18, Math.max(6, (w + h) * 0.0275));
  const sB = (exitS - half + per) % per;
  const sA = (exitS + half) % per;
  const pointAt = (s: number): number[] => {
    for (let k = 0; k < n; k++) {
      const end = k + 1 < n ? cum[k + 1] : per;
      if (s >= cum[k] && s <= end) return lerpPt(pts[k], pts[(k + 1) % n], (s - cum[k]) / (segLen(k) || 1));
    }
    return pts[0];
  };
  const B = pointAt(sB), A = pointAt(sA);

  const leg = (from: number[], to: number[]): number[][] => {
    if (!zigzag) return [];
    const vx = to[0] - from[0], vy = to[1] - from[1];
    const len = Math.hypot(vx, vy) || 1;
    const nx = -vy / len, ny = vx / len;
    const amp = Math.min(w, h) * 0.06;
    return [
      [from[0] + vx * 0.35 + nx * amp, from[1] + vy * 0.35 + ny * amp],
      [from[0] + vx * 0.65 - nx * amp, from[1] + vy * 0.65 - ny * amp],
    ];
  };

  /* tail wedge — or, between joined balloons, a wide connector band curving
     through the bend point with the tilt axis as tangent */
  let out: number[][];
  if (band) {
    const E2 = pointAt(exitS);
    const bandHalf = half * 0.85;
    const g = bendGeom(tail, w / 2, h / 2, tip, E2, B, bandHalf);
    out = [
      B,
      ...bentSide(B, g.M_B, g.tipB, g.T),
      ...[...bentSide(A, g.M_A, g.tipA, g.T)].reverse(),
      A,
    ];
  } else {
    out = [B, ...leg(B, tip), tip, ...leg(tip, A), A];
  }
  const span = (sB - sA + per) % per;
  const body: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    const rel = (cum[k] - sA + per) % per;
    if (rel > 1e-6 && rel < span - 1e-6) body.push([rel, k]);
  }
  body.sort((a, b) => a[0] - b[0]);
  for (const [, k] of body) out.push(pts[k]);
  return linePath(out);
}

/* ---- ellipse-family outlines with tails via angular splicing ---- */

function ellipseTailPath(
  el: BalloonEl, mode: "smooth" | "rough" | "buzz"
): string {
  const w = el.w, h = el.h, cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
  const tail = el.tail;
  if (!tail) {
    if (mode === "smooth") {
      return `M ${fmt(cx + rx)} ${fmt(cy)} A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(cx - rx)} ${fmt(cy)} A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(cx + rx)} ${fmt(cy)} Z`;
    }
    /* rough/buzz without tail: jittered ring */
    return jitterRing(el, mode, null);
  }
  if (mode !== "smooth") return jitterRing(el, mode, tail);

  const tip = [cx + tail.dx, cy + tail.dy];
  /* the bend lever steers where the tail exits the balloon — dragging it
     walks the tail base all the way around the perimeter */
  const t = tail.bx != null && tail.by != null
    ? Math.atan2(tail.by, tail.bx)
    : Math.atan2(tail.dy, tail.dx);
  /* slim, elegant tail: narrow base that tapers to a point */
  const delta = 0.11;
  const A = ellipsePt(cx, cy, rx, ry, t + delta);
  const B = ellipsePt(cx, cy, rx, ry, t - delta);
  const E = ellipsePt(cx, cy, rx, ry, t);
  /* joined balloons: the connector is a near-parallel band, wide at both
     ends, curving through the bend point with the tilt axis as tangent */
  if (el.band) {
    const bandHalf = Math.hypot(A[0] - B[0], A[1] - B[1]) * 0.42;
    const g = bendGeom(tail, cx, cy, tip, E, B, bandHalf);
    const sideB = bentSide(B, g.M_B, g.tipB, g.T);
    const sideA = [...bentSide(A, g.M_A, g.tipA, g.T)].reverse();
    return `M ${fmt(A[0])} ${fmt(A[1])}` +
      ` A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(B[0])} ${fmt(B[1])}` +
      sideB.map((p) => ` L ${fmt(p[0])} ${fmt(p[1])}`).join("") +
      sideA.map((p) => ` L ${fmt(p[0])} ${fmt(p[1])}`).join("") +
      " Z";
  }
  let mB: number[], mA: number[];
  if (tail.bx != null && tail.by != null) {
    /* user-bent tail: both edges curve through the bend point */
    const M = [cx + tail.bx, cy + tail.by];
    mB = [M[0] + (B[0] - E[0]) * 0.35, M[1] + (B[1] - E[1]) * 0.35];
    mA = [M[0] + (A[0] - E[0]) * 0.35, M[1] + (A[1] - E[1]) * 0.35];
  } else {
    /* gentle inward bow so the tail curves like hand-drawn lettering */
    mB = lerpPt(lerpPt(B, tip, 0.55), lerpPt(E, tip, 0.5), 0.65);
    mA = lerpPt(lerpPt(tip, A, 0.45), lerpPt(tip, E, 0.5), 0.65);
  }
  return `M ${fmt(A[0])} ${fmt(A[1])}` +
    ` A ${fmt(rx)} ${fmt(ry)} 0 1 1 ${fmt(B[0])} ${fmt(B[1])}` +
    ` Q ${fmt(mB[0])} ${fmt(mB[1])} ${fmt(tip[0])} ${fmt(tip[1])}` +
    ` Q ${fmt(mA[0])} ${fmt(mA[1])} ${fmt(A[0])} ${fmt(A[1])} Z`;
}

function jitterRing(
  el: BalloonEl, mode: "rough" | "buzz",
  tail: { dx: number; dy: number } | null
): string {
  const w = el.w, h = el.h, cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
  const t = tail ? Math.atan2(tail.dy, tail.dx) : 0;
  const delta = tail ? 0.1 : 0;
  const K = mode === "buzz" ? 40 : 20;
  const rnd = prng(mode === "buzz" ? 77 : 13);
  const span = Math.PI * 2 - delta * 2;
  const pts: number[][] = [];
  for (let i = 0; i <= K; i++) {
    const a = t + delta + (i / K) * span;
    let f: number;
    if (mode === "buzz") f = i % 2 === 0 ? 1 : 0.93;
    else f = 1 + (rnd() - 0.5) * 0.05;
    pts.push(ellipsePt(cx, cy, rx * f, ry * f, a));
  }
  const tip = tail ? [cx + tail.dx, cy + tail.dy] : null;
  if (mode === "buzz") {
    if (tip) pts.push(tip);
    return linePath(pts);
  }
  /* rough: smooth hand-drawn line through the jittered points */
  let d = `M ${fmt(pts[0][0])} ${fmt(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mid = lerpPt(pts[i], pts[i + 1], 0.5);
    d += ` Q ${fmt(pts[i][0])} ${fmt(pts[i][1])} ${fmt(mid[0])} ${fmt(mid[1])}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${fmt(last[0])} ${fmt(last[1])}`;
  if (tip) d += ` L ${fmt(tip[0])} ${fmt(tip[1])}`;
  return d + " Z";
}

/* ---------------- open connector band (joined balloons) ---------------- */

/* Points where the connector meets the outline, for any balloon shape. */
function connectorBase(el: BalloonEl): { A: number[]; B: number[]; E: number[] } | null {
  const w = el.w, h = el.h, cx = w / 2, cy = h / 2;
  const tail = el.tail;
  if (!tail) return null;
  const aim = tail.bx != null && tail.by != null ? [cx + tail.bx, cy + tail.by] : [cx + tail.dx, cy + tail.dy];
  let pts: number[][] | null = null;
  switch (el.kind) {
    case "caption": case "square": pts = [[0, 0], [w, 0], [w, h], [0, h]]; break;
    case "rounded": pts = roundRectPts(w, h, Math.min(w, h) * 0.18, 6); break;
    case "extend": pts = roundRectPts(w, h, Math.min(w, h) / 2, 8); break;
    case "tv": pts = roundRectPts(w, h, Math.min(w, h) * 0.12, 4); break;
    case "custom": {
      const p2 = (el.pts || []).map(([nx, ny]) => [nx * w, ny * h]);
      if (p2.length >= 3) pts = p2;
      break;
    }
    default: pts = null; // ellipse family
  }
  if (!pts) {
    const rx = w / 2, ry = h / 2;
    const t = Math.atan2(aim[1] - cy, aim[0] - cx);
    const delta = 0.11;
    return {
      A: ellipsePt(cx, cy, rx, ry, t + delta),
      B: ellipsePt(cx, cy, rx, ry, t - delta),
      E: ellipsePt(cx, cy, rx, ry, t),
    };
  }
  /* polygon: ray exit + arc-length base (same maths as polygonWithTail) */
  const dx = aim[0] - cx, dy = aim[1] - cy;
  const dLen = Math.hypot(dx, dy);
  if (dLen < 4) return null;
  const D = [dx / dLen, dy / dLen];
  let bestI = -1, bestS = Infinity, bestU = 0;
  for (let i = 0; i < pts.length; i++) {
    const P = pts[i], Q = pts[(i + 1) % pts.length];
    const ex = Q[0] - P[0], ey = Q[1] - P[1];
    const den = D[0] * ey - D[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const u = (D[0] * (cy - P[1]) - D[1] * (cx - P[0])) / den;
    const s = Math.abs(D[0]) > Math.abs(D[1])
      ? (P[0] + u * ex - cx) / D[0]
      : (P[1] + u * ey - cy) / D[1];
    if (u >= 0 && u <= 1 && s > 0 && s < bestS) { bestS = s; bestI = i; bestU = u; }
  }
  if (bestI < 0) return null;
  const n = pts.length;
  const cum: number[] = new Array(n);
  let per = 0;
  for (let i = 0; i < n; i++) {
    cum[i] = per;
    const q = pts[(i + 1) % n];
    per += Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1]);
  }
  if (per < 8) return null;
  const segLen = (i: number) => (i + 1 < n ? cum[i + 1] : per) - cum[i];
  const exitS = cum[bestI] + bestU * segLen(bestI);
  const half = Math.min(per * 0.18, Math.max(6, (w + h) * 0.0275));
  const pointAt = (s: number): number[] => {
    s = ((s % per) + per) % per;
    for (let k = 0; k < n; k++) {
      const end = k + 1 < n ? cum[k + 1] : per;
      if (s >= cum[k] && s <= end) return lerpPt(pts[k], pts[(k + 1) % n], (s - cum[k]) / (segLen(k) || 1));
    }
    return pts[0];
  };
  return { A: pointAt(exitS + half), B: pointAt(exitS - half), E: pointAt(exitS) };
}

/* The open connector band between joined balloons. Drawn AFTER both bodies:
   the fill quad reaches a little inside this balloon and deep into the
   partner, covering both outline strokes where it crosses them, so each
   junction stays open — only the two (relatively parallel) sides get inked. */
function connectorBand(el: BalloonEl): { fill: string; edges: string } | null {
  const tail = el.tail;
  if (!tail) return null;
  const base = connectorBase(el);
  if (!base) return null;
  const { A, B, E } = base;
  const cx = el.w / 2, cy = el.h / 2;
  const tip = [cx + tail.dx, cy + tail.dy];
  const bandHalf = Math.hypot(A[0] - B[0], A[1] - B[1]) * 0.42;
  const g = bendGeom(tail, cx, cy, tip, E, B, bandHalf);
  const sideB = bentSide(B, g.M_B, g.tipB, g.T);
  const sideA = bentSide(A, g.M_A, g.tipA, g.T);
  const inset = Math.max(6, el.strokeW * 2);
  const inw = (P: number[]) => {
    const vx = cx - P[0], vy = cy - P[1];
    const L = Math.hypot(vx, vy) || 1;
    return [P[0] + (vx / L) * inset, P[1] + (vy / L) * inset];
  };
  const fillPts = [inw(B), B, ...sideB, ...[...sideA].reverse(), A, inw(A)];
  const seg = (P: number[], samples: number[][]) =>
    `M ${fmt(P[0])} ${fmt(P[1])}` + samples.map((p) => ` L ${fmt(p[0])} ${fmt(p[1])}`).join("");
  return { fill: linePath(fillPts), edges: seg(B, sideB) + " " + seg(A, sideA) };
}

/* ---------------- main entry ---------------- */

export function balloonGeom(el: BalloonEl): BalloonGeom {
  /* joined balloons: the outline stays a plain closed shape — the connector
     is returned separately as an OPEN band drawn over both bodies */
  if (el.band && el.tail) {
    const plain = balloonGeom({ ...el, band: false, tail: null });
    const band = connectorBand(el);
    return band ? { ...plain, bandFill: band.fill, bandEdges: band.edges } : plain;
  }
  const w = el.w, h = el.h, cx = w / 2, cy = h / 2, rx = w / 2, ry = h / 2;
  const tail = el.tail;
  const tip = tail ? [cx + tail.dx, cy + tail.dy] : null;
  const padRect = (px: number, py: number): [number, number, number, number] =>
    [w * px, h * py, w * (1 - 2 * px), h * (1 - 2 * py)];
  const ellipseRect: [number, number, number, number] = [w * 0.17, h * 0.19, w * 0.66, h * 0.62];

  switch (el.kind) {
    case "caption": {
      const p = Math.max(8, Math.min(w, h) * 0.12);
      return { d: `M 0 0 H ${fmt(w)} V ${fmt(h)} H 0 Z`, textRect: [p, p, w - 2 * p, h - 2 * p], dash: null };
    }
    case "rounded": {
      const r = Math.min(w, h) * 0.18;
      return { d: linePath(roundRectPts(w, h, r, 6)), textRect: padRect(0.12, 0.14), dash: null };
    }
    case "square":
      return {
        d: polygonWithTail([[0, 0], [w, 0], [w, h], [0, h]], w, h, tail, false, !!el.band),
        textRect: padRect(0.1, 0.13), dash: null,
      };
    case "custom": {
      /* hand-drawn outline: the user's sketched polygon, tail spliced in */
      const pts = (el.pts || []).map(([nx, ny]) => [nx * w, ny * h]);
      if (pts.length < 3)
        return { d: linePath(roundRectPts(w, h, Math.min(w, h) * 0.18, 6)), textRect: padRect(0.12, 0.14), dash: null };
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      const iw = Math.max(1, x1 - x0), ih = Math.max(1, y1 - y0);
      const textRect: [number, number, number, number] =
        [x0 + iw * 0.18, y0 + ih * 0.18, iw * 0.64, ih * 0.64];
      if (tail && el.tailStyle === "thought") {
        /* thought-bubble trail: shrinking circles from the body edge to the tip */
        const tipX = cx + tail.dx, tipY = cy + tail.dy;
        const len = Math.hypot(tipX - cx, tipY - cy);
        let d = linePath(pts);
        if (len > 8) {
          const dirX = (tipX - cx) / len, dirY = (tipY - cy) / len;
          let edge = 0;
          for (const p of pts) {
            const proj = (p[0] - cx) * dirX + (p[1] - cy) * dirY;
            if (proj > edge) edge = proj;
          }
          const r0 = Math.min(w, h) * 0.085;
          for (let k = 0; k < 3; k++) {
            const t = edge + (len - edge) * ((k + 0.6) / 3.2);
            if (t <= edge * 0.9) continue;
            d += circleSub(cx + dirX * t, cy + dirY * t, Math.max(2, r0 * (1 - k * 0.32)));
          }
        }
        return { d, textRect, dash: null };
      }
      return { d: polygonWithTail(pts, w, h, tail, false, !!el.band), textRect, dash: null };
    }
    case "tv":
      return {
        d: polygonWithTail(roundRectPts(w, h, Math.min(w, h) * 0.12, 4), w, h, tail, true, !!el.band),
        textRect: padRect(0.11, 0.14), dash: null,
      };
    case "extend":
      return {
        d: polygonWithTail(roundRectPts(w, h, Math.min(w, h) / 2, 8), w, h, tail, false, !!el.band),
        textRect: padRect(0.14, 0.16), dash: null,
      };
    case "cosmic": {
      /* border made of scattered ink dots around the ellipse */
      const rnd = prng(99 + Math.round(w + h));
      const k = 0.9;
      const d = `M ${fmt(cx + rx * k)} ${fmt(cy)} A ${fmt(rx * k)} ${fmt(ry * k)} 0 1 1 ${fmt(cx - rx * k)} ${fmt(cy)} A ${fmt(rx * k)} ${fmt(ry * k)} 0 1 1 ${fmt(cx + rx * k)} ${fmt(cy)} Z`;
      let deco = "";
      const N = 48;
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2 + rnd() * 0.1;
        const rr = 2.5 + rnd() * Math.min(w, h) * 0.038;
        const wob = 0.96 + rnd() * 0.1;
        deco += circleSub(cx + rx * wob * Math.cos(a) * 0.97, cy + ry * wob * Math.sin(a) * 0.97, rr);
      }
      return { d, deco, noStroke: true, textRect: ellipseRect, dash: null };
    }
    case "sketch": {
      /* skritchy pen: clean line plus a jittered second pass */
      return {
        d: ellipseTailPath(el, "smooth"),
        d2: jitterRing(el, "rough", tail ? { dx: tail.dx, dy: tail.dy } : null),
        textRect: ellipseRect, dash: null,
      };
    }
    case "emitter": {
      /* broken concentric rings radiating outward */
      const ring = (k: number) =>
        `M ${fmt(cx + rx * k)} ${fmt(cy)} A ${fmt(rx * k)} ${fmt(ry * k)} 0 1 1 ${fmt(cx - rx * k)} ${fmt(cy)} A ${fmt(rx * k)} ${fmt(ry * k)} 0 1 1 ${fmt(cx + rx * k)} ${fmt(cy)} Z`;
      return {
        d: ring(0.88),
        d2: ring(0.74) + " " + ring(1.0),
        textRect: [w * 0.2, h * 0.24, w * 0.6, h * 0.52], dash: [26, 15],
      };
    }
    case "rough":
      return { d: ellipseTailPath(el, "rough"), textRect: ellipseRect, dash: null };
    case "buzz":
      return { d: ellipseTailPath(el, "buzz"), textRect: [w * 0.19, h * 0.21, w * 0.62, h * 0.58], dash: null };
    case "double": {
      const inner = `M ${fmt(cx + rx * 0.88)} ${fmt(cy)} A ${fmt(rx * 0.88)} ${fmt(ry * 0.88)} 0 1 1 ${fmt(cx - rx * 0.88)} ${fmt(cy)} A ${fmt(rx * 0.88)} ${fmt(ry * 0.88)} 0 1 1 ${fmt(cx + rx * 0.88)} ${fmt(cy)} Z`;
      return { d: ellipseTailPath(el, "smooth"), d2: inner, textRect: [w * 0.19, h * 0.21, w * 0.62, h * 0.58], dash: null };
    }
    case "thought": {
      const K = 14;
      const brx = rx * 0.88, bry = ry * 0.88;
      const crx = rx * 1.1, cry = ry * 1.1;
      const p0 = ellipsePt(cx, cy, brx, bry, 0);
      let d = `M ${fmt(p0[0])} ${fmt(p0[1])}`;
      for (let i = 0; i < K; i++) {
        const a1 = ((i + 1) / K) * Math.PI * 2;
        const am = ((i + 0.5) / K) * Math.PI * 2;
        const p1 = ellipsePt(cx, cy, brx, bry, a1);
        const c = ellipsePt(cx, cy, crx, cry, am);
        d += ` Q ${fmt(c[0])} ${fmt(c[1])} ${fmt(p1[0])} ${fmt(p1[1])}`;
      }
      d += " Z";
      if (tip && tail) {
        const t = tail.bx != null && tail.by != null
          ? Math.atan2(tail.by, tail.bx)
          : Math.atan2(tail.dy, tail.dx);
        const E = ellipsePt(cx, cy, rx, ry, t);
        const base = Math.min(w, h);
        const M = tail.bx != null && tail.by != null ? [cx + tail.bx, cy + tail.by] : null;
        ([[0.32, 0.085], [0.62, 0.055], [0.88, 0.035]] as const).forEach(([f, rf]) => {
          /* trail follows the bend point when set (quadratic bezier) */
          const c = M
            ? [
                (1 - f) * (1 - f) * E[0] + 2 * (1 - f) * f * M[0] + f * f * tip[0],
                (1 - f) * (1 - f) * E[1] + 2 * (1 - f) * f * M[1] + f * f * tip[1],
              ]
            : lerpPt(E, tip, f);
          d += circleSub(c[0], c[1], Math.max(3, base * rf));
        });
      }
      return { d, textRect: [w * 0.18, h * 0.18, w * 0.64, h * 0.64], dash: null };
    }
    case "shout": case "burst2": {
      const dense = el.kind === "burst2";
      const N = dense ? 18 : 11;
      const innerF = dense ? 0.68 : 0.74;
      const irx = rx * innerF, iry = ry * innerF;
      const wob = dense ? [1, 0.97] : [1, 0.96, 1.02];
      const tAng = tail ? Math.atan2(tail.dy, tail.dx) : null;
      let tailIdx = -1, best = 1e9;
      const pts: number[][] = [];
      for (let j = 0; j < N * 2; j++) {
        const th = (j / (N * 2)) * Math.PI * 2;
        if (j % 2 === 0) {
          const k = wob[(j / 2) % wob.length];
          pts.push(ellipsePt(cx, cy, rx * k, ry * k, th));
          if (tAng !== null) {
            const dd = Math.abs(Math.atan2(Math.sin(th - tAng), Math.cos(th - tAng)));
            if (dd < best) { best = dd; tailIdx = j; }
          }
        } else {
          pts.push(ellipsePt(cx, cy, irx, iry, th));
        }
      }
      if (tailIdx >= 0 && tip) pts[tailIdx] = tip;
      return {
        d: linePath(pts),
        textRect: dense ? [w * 0.24, h * 0.24, w * 0.52, h * 0.52] : [w * 0.22, h * 0.22, w * 0.56, h * 0.56],
        dash: null,
      };
    }
    case "whisper":
      return { d: ellipseTailPath(el, "smooth"), textRect: ellipseRect, dash: [10, 9] };
    case "speech": default:
      return { d: ellipseTailPath(el, "smooth"), textRect: ellipseRect, dash: null };
  }
}
