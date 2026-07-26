/* ComicLettering Studio — hand-drawn balloon sketch cleanup helpers
   split out of Editor.tsx (module-level code, unchanged). */

/* ---------------- hand-drawn sketch cleanup ---------------- */


/* Trim the raw stroke so it closes on itself cleanly: find the closest pair
   between the first and last stretch of points and cut off the overshoot. */
export function closeSketchLoop(arr: number[][]): number[][] {
  const n = arr.length;
  const K = Math.min(14, Math.floor(n / 4));
  let bi = 0, bj = n - 1, bd = Infinity;
  for (let i = 0; i <= K; i++) for (let j = n - 1 - K; j < n; j++) {
    const d = Math.hypot(arr[i][0] - arr[j][0], arr[i][1] - arr[j][1]);
    if (d < bd) { bd = d; bi = i; bj = j; }
  }
  return arr.slice(bi, bj + 1);
}

/* Even out the point spacing around the closed ring. */
export function resampleRing(arr: number[][], N: number): number[][] {
  const n = arr.length;
  const seg: number[] = [];
  let per = 0;
  for (let i = 0; i < n; i++) {
    const q = arr[(i + 1) % n];
    const L = Math.hypot(q[0] - arr[i][0], q[1] - arr[i][1]);
    seg.push(L); per += L;
  }
  if (per < 1) return arr;
  const out: number[][] = [];
  let i = 0, acc = 0;
  for (let k = 0; k < N; k++) {
    const target = (k * per) / N;
    while (i < n - 1 && acc + seg[i] < target) { acc += seg[i]; i++; }
    const t = seg[i] ? (target - acc) / seg[i] : 0;
    const p = arr[i], q = arr[(i + 1) % n];
    out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
  }
  return out;
}

/* A drawn tail reads as a narrow spike that shoots far from the centroid and
   comes straight back. Returns the spike's tip and the ring without it. */
export function detectSketchTail(ring: number[][]): { tip: number[]; body: number[][] } | null {
  const N = ring.length;
  const cx = ring.reduce((s, p) => s + p[0], 0) / N;
  const cy = ring.reduce((s, p) => s + p[1], 0) / N;
  const d = ring.map((p) => Math.hypot(p[0] - cx, p[1] - cy));
  const med = [...d].sort((a, b) => a - b)[Math.floor(N / 2)];
  let peak = 0;
  for (let i = 1; i < N; i++) if (d[i] > d[peak]) peak = i;
  if (d[peak] < med * 1.45) return null;
  /* walk outward from the tip along both sides of the stroke while the two
     sides stay close together — that corridor is the whole tail, even where
     it wanders across the body */
  const neckW = med * 0.6;
  let a = peak, b = peak, guard = 0;
  while (guard++ < N) {
    const na = (a - 1 + N) % N, nb = (b + 1) % N;
    if (na === b || nb === a) break;
    const dA = Math.hypot(ring[na][0] - ring[b][0], ring[na][1] - ring[b][1]);
    const dB = Math.hypot(ring[a][0] - ring[nb][0], ring[a][1] - ring[nb][1]);
    if (Math.min(dA, dB) > neckW) break;
    if (dA <= dB) a = na; else b = nb;
    if ((b - a + N) % N + 1 >= N * 0.7) return null; // most of the ring — not a tail
  }
  if ((b - a + N) % N + 1 < 4) return null;
  const body: number[][] = [];
  for (let i = (b + 1) % N; i !== a; i = (i + 1) % N) body.push(ring[i]);
  if (body.length < 8) return null;
  return { tip: ring[peak], body };
}

/* Round the ring out as much as possible while keeping the drawn silhouette;
   deliberate sharp turns are kept as clean corners. */
export function smoothSketchRing(ring: number[][], passes = 5): number[][] {
  const N = ring.length;
  const corner = new Array(N).fill(false);
  const W = 2;
  for (let i = 0; i < N; i++) {
    const p0 = ring[(i - W + N) % N], p1 = ring[i], p2 = ring[(i + W) % N];
    const a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
    const a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    let da = Math.abs(a2 - a1);
    if (da > Math.PI) da = 2 * Math.PI - da;
    if (da > 1.15) corner[i] = true; // ≈66°+ = a drawn angle, keep it crisp
  }
  let cur = ring.map((p) => [...p]);
  for (let it = 0; it < passes; it++) {
    cur = cur.map((p, i) => {
      if (corner[i]) return [...p];
      const p0 = cur[(i - 1 + N) % N], p2 = cur[(i + 1) % N];
      return [(p0[0] + 2 * p[0] + p2[0]) / 4, (p0[1] + 2 * p[1] + p2[1]) / 4];
    });
  }
  return cur;
}
