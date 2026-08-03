/* Cross-browser canvas compatibility.

   Chrome and Firefox implement CanvasRenderingContext2D.filter; Safari
   does not — assignments to ctx.filter are silently ignored there, so
   every canvas blur (brush edges, glow fills, feathered Tuck Back masks)
   and every exported image filter would simply vanish on Safari/iPad.
   The helpers here use the native filter when the engine has one and a
   real fallback when it doesn't, so both engines render the same page. */

let filterOk: boolean | null = null;
export function canvasFilterSupported(): boolean {
  if (filterOk !== null) return filterOk;
  if (typeof document === "undefined") return false; // SSR — decide in the browser
  const c = document.createElement("canvas").getContext("2d");
  /* the `in` check must come BEFORE assigning: engines without the
     feature would keep the assignment as a plain JS own-property and
     fake the read-back */
  filterOk = !!c && "filter" in c;
  return filterOk;
}

/* Approximate gaussian blur of a whole canvas, in place: two passes of
   downscale/upscale resampling. Not pixel-identical to the native blur,
   but soft, cheap and radius-proportional — right for brush patches,
   glow blobs and feathered mask edges. */
export function blurCanvasFallback(cv: HTMLCanvasElement, radius: number) {
  const w = cv.width, h = cv.height;
  const ctx = cv.getContext("2d");
  if (!ctx || w < 2 || h < 2) return;
  const s = Math.max(0.06, 1 / (1 + radius * 0.5));
  const t = document.createElement("canvas");
  t.width = Math.max(1, Math.round(w * s));
  t.height = Math.max(1, Math.round(h * s));
  const tc = t.getContext("2d");
  if (!tc) return;
  tc.imageSmoothingEnabled = true;
  ctx.imageSmoothingEnabled = true;
  for (let i = 0; i < 2; i++) {
    tc.clearRect(0, 0, t.width, t.height);
    tc.drawImage(cv, 0, 0, w, h, 0, 0, t.width, t.height);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(t, 0, 0, t.width, t.height, 0, 0, w, h);
  }
}

/* Run `draw` so its output lands on `ctx` blurred by `radius` px.
   Native path sets ctx.filter around the draw; the fallback draws onto a
   scratch canvas the same size, blurs that, and composites it once.
   `draw` MUST paint in plain canvas coordinates (no reliance on ctx
   state set outside the callback). */
export function withBlur(
  ctx: CanvasRenderingContext2D, w: number, h: number, radius: number,
  draw: (c: CanvasRenderingContext2D) => void,
) {
  if (radius <= 0) { draw(ctx); return; }
  if (canvasFilterSupported()) {
    ctx.filter = `blur(${radius}px)`;
    draw(ctx);
    ctx.filter = "none";
    return;
  }
  const t = document.createElement("canvas");
  t.width = w; t.height = h;
  const tc = t.getContext("2d");
  if (!tc) { draw(ctx); return; }
  draw(tc);
  blurCanvasFallback(t, radius);
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = 1;
  ctx.drawImage(t, 0, 0);
  ctx.globalAlpha = ga;
}

/* Per-pixel versions of the image FILTERS (model.ts), matching the CSS
   filter functions they're defined with: grayscale/sepia use the spec
   matrices, saturate the spec luminance weights, contrast/brightness the
   spec transfer curves. Applied to cover-drawn artwork on export when
   the engine has no ctx.filter. */
export function pixelFilter(d: Uint8ClampedArray, key: string) {
  const n = d.length;
  const gray = (c: number) => {           // grayscale(1) then contrast(c)
    for (let i = 0; i < n; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = (l - 127.5) * c + 127.5;
    }
  };
  const sat = (s: number) => {            // CSS saturate(s) matrix
    const a = 0.213 * (1 - s), b = 0.715 * (1 - s), c = 0.072 * (1 - s);
    for (let i = 0; i < n; i += 4) {
      const r = d[i], g = d[i + 1], bl = d[i + 2];
      d[i] = (a + s) * r + b * g + c * bl;
      d[i + 1] = a * r + (b + s) * g + c * bl;
      d[i + 2] = a * r + b * g + (c + s) * bl;
    }
  };
  const contrast = (c: number) => {
    for (let i = 0; i < n; i += 4) {
      d[i] = (d[i] - 127.5) * c + 127.5;
      d[i + 1] = (d[i + 1] - 127.5) * c + 127.5;
      d[i + 2] = (d[i + 2] - 127.5) * c + 127.5;
    }
  };
  const bright = (b: number) => {
    for (let i = 0; i < n; i += 4) { d[i] *= b; d[i + 1] *= b; d[i + 2] *= b; }
  };
  switch (key) {
    case "bw": gray(1.1); break;
    case "sepia": {                       // CSS sepia(0.85) matrix lerp
      const a = 0.85;
      for (let i = 0; i < n; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        d[i] = r + a * (0.393 * r + 0.769 * g + 0.189 * b - r);
        d[i + 1] = g + a * (0.349 * r + 0.686 * g + 0.168 * b - g);
        d[i + 2] = b + a * (0.272 * r + 0.534 * g + 0.131 * b - b);
      }
      break;
    }
    case "vivid": sat(1.7); contrast(1.12); break;
    case "faded": sat(0.55); bright(1.12); break;
    case "noir": gray(1.6); bright(0.9); break;
  }
}
