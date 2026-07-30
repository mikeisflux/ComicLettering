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

/* Each handle displaces the box, and its influence falls off to nothing at the
   far side: pulling the bottom edge bows the bottom and leaves the top exactly
   where it was. A Coons patch would instead reshape the whole block, which is
   not what dragging one edge should mean. */
const bump = (t: number) => 4 * t * (1 - t);   // 0 at both ends, 1 at the middle

/** (u,v) in the unit square → a point in the warped patch, in box units. */
export function warpPoint(w: Warp, u: number, v: number): Pt {
  let x = u, y = v;
  for (let i = 0; i < 8; i++) {
    const dx = w[i][0] - FLAT[i][0], dy = w[i][1] - FLAT[i][1];
    if (!dx && !dy) continue;
    let k: number;
    switch (i) {
      case 0: k = (1 - u) * (1 - v); break;          // nw
      case 1: k = u * (1 - v); break;                // ne
      case 2: k = u * v; break;                      // se
      case 3: k = (1 - u) * v; break;                // sw
      case 4: k = bump(u) * (1 - v); break;          // top edge
      case 5: k = bump(v) * u; break;                // right edge
      case 6: k = bump(u) * v; break;                // bottom edge
      default: k = bump(v) * (1 - u); break;         // left edge
    }
    x += dx * k; y += dy * k;
  }
  return [x, y];
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
      /* NO per-cell clip: an antialiased clip edge lets the background bleed
         through along every cell border, drawing the mesh as a faint grid
         over the letters. Neighbouring cells overdraw each other by a hair
         instead — their content matches to sub-pixel accuracy at the seam, so
         the overlap is invisible and the grid is gone. */
      ctx.transform(ax, ay, bx, by, p00[0] - ax * sx - bx * sy, p00[1] - ay * sx - by * sy);
      ctx.drawImage(src, sx - 0.6, sy - 0.6, cw + 1.2, ch + 1.2,
        sx - 0.6, sy - 0.6, cw + 1.2, ch + 1.2);
      ctx.restore();
    }
  }
}
