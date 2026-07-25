/* Balloon shape geometry — original vector paths for every balloon type.
   Path strings are valid SVG `d` data and canvas Path2D input. */
import { BalloonEl } from "./model";

const fmt = (n: number) => Math.round(n * 100) / 100;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (p: number[], q: number[], t: number) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)];
const ellipsePt = (cx: number, cy: number, rx: number, ry: number, th: number) =>
  [cx + rx * Math.cos(th), cy + ry * Math.sin(th)];

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

export interface BalloonGeom {
  d: string;
  d2?: string; // decorative second outline (stroked only)
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
  tail: { dx: number; dy: number } | null, zigzag = false
): string {
  if (!tail) return linePath(pts);
  const cx = w / 2, cy = h / 2;
  const tip = [cx + tail.dx, cy + tail.dy];
  const dx = tip[0] - cx, dy = tip[1] - cy;
  const dLen = Math.hypot(dx, dy);
  if (dLen < 4) return linePath(pts);
  const D = [dx / dLen, dy / dLen];

  let bestI = -1, bestS = Infinity, bestU = 0;
  for (let i = 0; i < pts.length; i++) {
    const P = pts[i], Q = pts[(i + 1) % pts.length];
    const ex = Q[0] - P[0], ey = Q[1] - P[1];
    const den = D[0] * ey - D[1] * ex;
    if (Math.abs(den) < 1e-9) continue;
    const u = (D[0] * (cy - P[1]) - D[1] * (cx - P[0])) / -den;
    const s = Math.abs(D[0]) > Math.abs(D[1])
      ? (P[0] + u * ex - cx) / D[0]
      : (P[1] + u * ey - cy) / D[1];
    if (u >= 0 && u <= 1 && s > 0 && s < bestS) { bestS = s; bestI = i; bestU = u; }
  }
  if (bestI < 0) return linePath(pts);

  const P = pts[bestI], Q = pts[(bestI + 1) % pts.length];
  const eLen = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
  const bwU = Math.min(0.45, Math.max(0.05, (Math.min(w, h) * 0.16) / Math.max(eLen, 1)));
  const uB = Math.max(0.02, bestU - bwU);
  const uA = Math.min(0.98, bestU + bwU);
  const B = lerpPt(P, Q, uB);
  const A = lerpPt(P, Q, uA);

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

  const out: number[][] = [];
  for (let i = 0; i <= bestI; i++) out.push(pts[i]);
  out.push(B, ...leg(B, tip), tip, ...leg(tip, A), A);
  for (let i = bestI + 1; i < pts.length; i++) out.push(pts[i]);
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

/* ---------------- main entry ---------------- */

export function balloonGeom(el: BalloonEl): BalloonGeom {
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
        d: polygonWithTail([[0, 0], [w, 0], [w, h], [0, h]], w, h, tail),
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
      return {
        d: polygonWithTail(pts, w, h, tail),
        textRect: [x0 + iw * 0.18, y0 + ih * 0.18, iw * 0.64, ih * 0.64],
        dash: null,
      };
    }
    case "tv":
      return {
        d: polygonWithTail(roundRectPts(w, h, Math.min(w, h) * 0.12, 4), w, h, tail, true),
        textRect: padRect(0.11, 0.14), dash: null,
      };
    case "extend":
      return {
        d: polygonWithTail(roundRectPts(w, h, Math.min(w, h) / 2, 8), w, h, tail),
        textRect: padRect(0.14, 0.16), dash: null,
      };
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
