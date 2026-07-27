/* Envelope warp for lettering.

   Eight control points — four corners and the midpoint of each edge — define a
   patch. The corners pin it, the midpoints bow their edge, so the boundary can
   curve rather than only skew. Everything inside is a Coons patch across those
   four boundary curves.

   That is not expressible as a CSS transform, so warped lettering is rendered
   through a canvas in BOTH the editor and the export — one implementation, and
   therefore identical on screen and in print.

   Points are stored in units of the element box so a warp survives resizing. */

export type Pt = [number, number];
/** [nw, ne, se, sw, topMid, rightMid, bottomMid, leftMid] */
export type Warp = Pt[];

export const FLAT: Warp = [
  [0, 0], [1, 0], [1, 1], [0, 1],
  [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5],
];

export const isWarped = (w?: Warp | null) =>
  !!w && w.length === 8 && w.some((p, i) => Math.abs(p[0] - FLAT[i][0]) > 1e-4 || Math.abs(p[1] - FLAT[i][1]) > 1e-4);

const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/* quadratic through a, mid at t=0.5, b — the control point is placed so the
   curve actually passes through the handle the user dragged */
function curve(a: Pt, mid: Pt, b: Pt, t: number): Pt {
  const c: Pt = [2 * mid[0] - (a[0] + b[0]) / 2, 2 * mid[1] - (a[1] + b[1]) / 2];
  const s = 1 - t;
  return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0],
          s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]];
}

/** Coons patch: (u,v) in the unit square → a point in the warped patch. */
export function warpPoint(w: Warp, u: number, v: number): Pt {
  const [nw, ne, se, sw, tm, rm, bm, lm] = w;
  const top = curve(nw, tm, ne, u);
  const bot = curve(sw, bm, se, u);
  const left = curve(nw, lm, sw, v);
  const right = curve(ne, rm, se, v);
  const c = lerp(lerp(nw, ne, u), lerp(sw, se, u), v);
  return [
    (1 - v) * top[0] + v * bot[0] + (1 - u) * left[0] + u * right[0] - c[0],
    (1 - v) * top[1] + v * bot[1] + (1 - u) * left[1] + u * right[1] - c[1],
  ];
}

/** Bounds of the warped patch in element units — a warp can spill outside the box. */
export function warpBounds(w: Warp): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i <= 12; i++) {
    for (let k = 0; k <= 12; k++) {
      const [x, y] = warpPoint(w, i / 12, k / 12);
      if (x < x0) x0 = x; if (y < y0) y0 = y;
      if (x > x1) x1 = x; if (y > y1) y1 = y;
    }
  }
  return { x0, y0, x1, y1 };
}

/** Draw `src` (which covers the unwarped box) through the warp. */
export function drawWarped(
  ctx: CanvasRenderingContext2D, src: CanvasImageSource,
  sw: number, sh: number, warp: Warp, w: number, h: number, N = 20,
) {
  const at = (i: number, k: number): Pt => {
    const p = warpPoint(warp, i / N, k / N);
    return [p[0] * w, p[1] * h];
  };
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < N; k++) {
      const sx = (i / N) * sw, sy = (k / N) * sh, cw = sw / N, ch = sh / N;
      const p00 = at(i, k), p10 = at(i + 1, k), p01 = at(i, k + 1), p11 = at(i + 1, k + 1);
      const ax = (p10[0] - p00[0]) / cw, ay = (p10[1] - p00[1]) / cw;
      const bx = (p01[0] - p00[0]) / ch, by = (p01[1] - p00[1]) / ch;
      if (!Number.isFinite(ax) || !Number.isFinite(by)) continue;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p00[0], p00[1]); ctx.lineTo(p10[0], p10[1]);
      ctx.lineTo(p11[0], p11[1]); ctx.lineTo(p01[0], p01[1]);
      ctx.closePath();
      ctx.clip();
      ctx.transform(ax, ay, bx, by, p00[0] - ax * sx - bx * sy, p00[1] - ay * sx - by * sy);
      /* overdraw slightly so neighbouring cells leave no hairline seams */
      ctx.drawImage(src, sx - 0.6, sy - 0.6, cw + 1.2, ch + 1.2,
        sx - 0.6, sy - 0.6, cw + 1.2, ch + 1.2);
      ctx.restore();
    }
  }
}
