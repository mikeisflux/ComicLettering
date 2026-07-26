/* "Tuck behind art" engine — the digital version of the letterer's traced
   clipping mask. Given a region of a panel's artwork, extract the FOREGROUND
   (inked/dark shapes) as a transparent cutout PNG. Placed above an SFX, the
   cutout makes the art read as being in front of the lettering.

   The cutout is generated at the artwork's native resolution for the region,
   so it stays sharp in print export. */

export interface TuckSource {
  img: HTMLImageElement;   // the panel/image element's artwork (already loaded)
  elW: number; elH: number;      // the element's on-page size
  regionX: number; regionY: number; // region in ELEMENT-local page units
  regionW: number; regionH: number;
}

/* Replicates the editor's cover-crop: the image fills the element box like
   CSS object-fit: cover. Returns the source-pixel rect for an element-local
   rect. */
function coverMap(s: TuckSource) {
  const natW = s.img.naturalWidth, natH = s.img.naturalHeight;
  const scale = Math.max(s.elW / natW, s.elH / natH);
  const sw = s.elW / scale, sh = s.elH / scale;
  const sx = (natW - sw) / 2, sy = (natH - sh) / 2;
  return {
    sx: sx + (s.regionX / s.elW) * sw,
    sy: sy + (s.regionY / s.elH) * sh,
    sw: (s.regionW / s.elW) * sw,
    sh: (s.regionH / s.elH) * sh,
    scale,
  };
}

/* Build the transparent foreground cutout for a region.
   threshold: 0..100 — how dark a pixel must be to count as foreground.
   invert: keep LIGHT pixels instead (art with light foreground on dark bg).
   Returns a PNG data URL sized to the region at native art resolution. */
export function makeCutout(
  s: TuckSource, threshold: number, invert = false
): { url: string; pxW: number; pxH: number } | null {
  const m = coverMap(s);
  const pxW = Math.max(1, Math.round(m.sw));
  const pxH = Math.max(1, Math.round(m.sh));
  if (pxW < 2 || pxH < 2) return null;
  const cv = document.createElement("canvas");
  cv.width = pxW; cv.height = pxH;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(s.img, m.sx, m.sy, m.sw, m.sh, 0, 0, pxW, pxH);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, pxW, pxH);
  } catch {
    return null; // tainted canvas (non-local artwork)
  }
  const d = data.data;
  /* soft threshold: feather ±8 luminance steps around the cut so edges keep
     a hint of anti-aliasing instead of jaggies */
  const t = (threshold / 100) * 255;
  const lo = t - 8, hi = t + 8;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    let a: number;
    if (lum <= lo) a = 1;
    else if (lum >= hi) a = 0;
    else a = 1 - (lum - lo) / (hi - lo);
    if (invert) a = 1 - a;
    d[i + 3] = Math.round(d[i + 3] * a);
  }
  ctx.putImageData(data, 0, 0);
  return { url: cv.toDataURL("image/png"), pxW, pxH };
}
