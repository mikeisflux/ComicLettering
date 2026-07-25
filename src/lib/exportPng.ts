/* Full-resolution canvas renderer — used for PNG export and page thumbnails. */
import {
  Assets, BalloonEl, Doc, El, FILTERS, FONTS, Page, TextStyle,
  aabbOverlap, deg2rad, lightenHex, resolveBalloon, rotVec,
} from "./model";
import { balloonGeom } from "./geometry";
import { paintFill } from "./fills";

interface MergeInfo { d: string; color: string; cx: number; cy: number; rot: number; bw: number; bh: number }

const imgCache = new Map<string, HTMLImageElement>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  const hit = imgCache.get(src);
  if (hit) return Promise.resolve(hit);
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => { imgCache.set(src, img); res(img); };
    img.onerror = rej;
    img.src = src;
  });
}

export function fontString(ts: TextStyle): string {
  return `${ts.italic ? "italic " : ""}${ts.bold ? "700 " : "400 "}${ts.size}px ${FONTS[ts.font]?.css || FONTS.comicneue.css}`;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of String(text).split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); continue; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = line + " " + words[i];
      if (ctx.measureText(test).width <= maxWidth) line = test;
      else { out.push(line); line = words[i]; }
    }
    out.push(line);
  }
  return out;
}

export function drawStyledText(
  ctx: CanvasRenderingContext2D, ts: TextStyle, text: string,
  rect: [number, number, number, number]
) {
  const [rx, ry, rw, rh] = rect;
  ctx.font = fontString(ts);
  ctx.textBaseline = "middle";
  const t = ts.caps ? String(text).toUpperCase() : String(text);
  const lines = wrapLines(ctx, t, rw);
  const lineH = ts.size * 1.25;
  const blockH = lines.length * lineH;
  const y0 = ry + rh / 2 - blockH / 2 + lineH / 2;

  let fill: string | CanvasGradient = ts.fillA;
  if (ts.fillB) {
    const g = ctx.createLinearGradient(0, y0 - lineH / 2, 0, y0 - lineH / 2 + blockH);
    g.addColorStop(0, lightenHex(ts.fillA, 0.55));
    g.addColorStop(0.38, ts.fillA);
    g.addColorStop(1, ts.fillB);
    fill = g;
  }

  const xFor = (align: TextStyle["align"]) => {
    if (align === "left" || align === "justify") { ctx.textAlign = "left"; return rx; }
    if (align === "right") { ctx.textAlign = "right"; return rx + rw; }
    ctx.textAlign = "center"; return rx + rw / 2;
  };

  /* justified lines: draw word-by-word with distributed gaps */
  const drawLine = (line: string, x: number, yy: number, op: "fill" | "stroke", justify: boolean) => {
    const paint = (txt: string, px: number) =>
      op === "fill" ? ctx.fillText(txt, px, yy) : ctx.strokeText(txt, px, yy);
    if (!justify) { paint(line, x); return; }
    const words = line.split(" ").filter(Boolean);
    if (words.length < 2) { paint(line, x); return; }
    const wordsW = words.reduce((sum, w) => sum + ctx.measureText(w).width, 0);
    const gap = (rw - wordsW) / (words.length - 1);
    let px = rx;
    ctx.textAlign = "left";
    for (const w2 of words) { paint(w2, px); px += ctx.measureText(w2).width + gap; }
  };

  ctx.lineJoin = "round";
  let y = y0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const justifyThis = ts.align === "justify" && li < lines.length - 1 && lines[li + 1] !== "";
    const x = xFor(ts.align);
    if (ts.shadow) {
      ctx.save();
      ctx.shadowColor = ts.shadowC || "#00000088";
      ctx.shadowOffsetX = ts.size * 0.05;
      ctx.shadowOffsetY = ts.size * 0.05;
      ctx.shadowBlur = ts.size * 0.06;
      if (ts.outlineW > 0) {
        ctx.lineWidth = ts.outlineW;
        ctx.strokeStyle = ts.outlineC;
        drawLine(line, x, y, "stroke", justifyThis);
      } else {
        ctx.fillStyle = fill;
        drawLine(line, x, y, "fill", justifyThis);
      }
      ctx.restore();
    }
    if (ts.outlineW > 0) {
      ctx.lineWidth = ts.outlineW;
      ctx.strokeStyle = ts.outlineC;
      drawLine(line, x, y, "stroke", justifyThis);
    }
    ctx.fillStyle = fill;
    drawLine(line, x, y, "fill", justifyThis);
    if (ts.underline && line.trim()) {
      const lw = justifyThis ? rw : ctx.measureText(line).width;
      const ux = ts.align === "right" ? rx + rw - lw
        : ts.align === "center" ? rx + (rw - lw) / 2 : rx;
      ctx.save();
      ctx.strokeStyle = ts.fillA;
      ctx.lineWidth = Math.max(1, ts.size * 0.06);
      ctx.beginPath();
      ctx.moveTo(ux, y + ts.size * 0.45);
      ctx.lineTo(ux + lw, y + ts.size * 0.45);
      ctx.stroke();
      ctx.restore();
    }
    y += lineH;
  }
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s, sh = h / s;
  const sx = (img.naturalWidth - sw) / 2, sy = (img.naturalHeight - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

function withFilter(ctx: CanvasRenderingContext2D, filterKey: string, fn: () => void) {
  const css = FILTERS[filterKey as keyof typeof FILTERS]?.css;
  let applied = false;
  if (css && "filter" in ctx) {
    try { (ctx as CanvasRenderingContext2D).filter = css; applied = true; } catch { /* unsupported */ }
  }
  fn();
  if (applied) (ctx as CanvasRenderingContext2D).filter = "none";
}

function shapeShadow(ctx: CanvasRenderingContext2D, on: boolean, size: number) {
  if (!on) return;
  ctx.shadowColor = "#00000059";
  ctx.shadowOffsetX = size;
  ctx.shadowOffsetY = size;
  ctx.shadowBlur = size * 1.4;
}
function clearShadow(ctx: CanvasRenderingContext2D) {
  ctx.shadowColor = "transparent";
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = 0;
}

function drawEl(ctx: CanvasRenderingContext2D, el: El, assets: Assets, merge?: MergeInfo | null) {
  ctx.save();
  ctx.globalAlpha = el.opacity ?? 1;
  ctx.translate(el.x + el.w / 2, el.y + el.h / 2);
  ctx.rotate(deg2rad(el.rot || 0));
  ctx.scale(el.flipH ? -1 : 1, el.flipV ? -1 : 1);
  ctx.translate(-el.w / 2, -el.h / 2);

  if (el.type === "panel" || el.type === "image") {
    const rectPath = new Path2D();
    rectPath.rect(0, 0, el.w, el.h);
    if (el.shadow) {
      ctx.save();
      shapeShadow(ctx, true, 10);
      ctx.fillStyle = el.type === "panel" ? "#ffffff" : "#00000001";
      ctx.fill(rectPath);
      ctx.restore();
    }
    if (el.type === "panel") paintFill(ctx, el.fill, el.w, el.h, rectPath);
    const src = el.img ? assets[el.img] : null;
    const img = src ? imgCache.get(src) : null;
    if (img) {
      ctx.save();
      ctx.clip(rectPath);
      withFilter(ctx, el.filter, () => drawCover(ctx, img, el.w, el.h));
      ctx.restore();
    }
    if (el.borderW > 0) {
      ctx.strokeStyle = el.borderC;
      ctx.lineWidth = el.borderW;
      ctx.strokeRect(el.borderW / 2, el.borderW / 2, el.w - el.borderW, el.h - el.borderW);
    }
  } else if (el.type === "balloon") {
    const g = balloonGeom(el);
    const path = new Path2D(g.d);
    if (el.shadow) {
      ctx.save();
      shapeShadow(ctx, true, 8);
      ctx.fillStyle = "#ffffff";
      ctx.fill(path);
      ctx.restore();
    }
    if (el.strokeW > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineJoin = "round";
      if (g.dash) ctx.setLineDash(g.dash);
      if (merge) {
        /* joined balloons: stroke under, fills over → union outline */
        ctx.lineWidth = el.strokeW * 2;
        ctx.stroke(path);
      }
    }
    paintFill(ctx, el.fill, el.w, el.h, path);
    const bImgSrc = el.img ? assets[el.img] : null;
    const bImg = bImgSrc ? imgCache.get(bImgSrc) : null;
    if (bImg) {
      ctx.save();
      ctx.clip(path);
      drawCover(ctx, bImg, el.w, el.h);
      ctx.restore();
    }
    if (merge) {
      ctx.save();
      ctx.translate(merge.cx, merge.cy);
      ctx.rotate(deg2rad(merge.rot));
      ctx.translate(-merge.bw / 2, -merge.bh / 2);
      ctx.fillStyle = merge.color;
      ctx.fill(new Path2D(merge.d));
      ctx.restore();
    } else if (el.strokeW > 0) {
      ctx.lineWidth = el.strokeW;
      ctx.stroke(path);
      if (g.d2) ctx.stroke(new Path2D(g.d2));
    }
    ctx.setLineDash([]);
    drawStyledText(ctx, el.ts, el.text, g.textRect);
  } else if (el.type === "text") {
    drawStyledText(ctx, el.ts, el.text, [0, 0, el.w, el.h]);
  }
  ctx.restore();
}

export async function renderPageToCanvas(
  page: Page, assets: Assets, scale = 1
): Promise<HTMLCanvasElement> {
  const srcs: string[] = [];
  for (const el of page.els) {
    if ((el.type === "panel" || el.type === "image" || el.type === "balloon") && el.img && assets[el.img]) srcs.push(assets[el.img]);
  }
  await Promise.all(srcs.map((s) => loadImage(s).catch(() => null)));
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(page.w * scale));
  canvas.height = Math.max(1, Math.round(page.h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  paintFill(ctx, page.bg, page.w, page.h);
  for (const el of page.els) {
    if (el.type === "balloon") {
      const { el: bEl, base } = resolveBalloon(page, el);
      let merge: MergeInfo | null = null;
      if (base && aabbOverlap(el, base)) {
        const bg = balloonGeom(resolveBalloon(page, base).el);
        const [rx, ry] = rotVec(
          base.x + base.w / 2 - (el.x + el.w / 2),
          base.y + base.h / 2 - (el.y + el.h / 2), -el.rot);
        merge = {
          d: bg.d, color: base.fill.a,
          cx: el.w / 2 + rx, cy: el.h / 2 + ry,
          rot: base.rot - el.rot, bw: base.w, bh: base.h,
        };
      }
      drawEl(ctx, bEl as BalloonEl, assets, merge);
    } else {
      drawEl(ctx, el, assets);
    }
  }
  clearShadow(ctx);
  return canvas;
}

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/* Minimal uncompressed RGB TIFF encoder (little-endian, single strip),
   with proper resolution tags so print shops see the right DPI. */
function encodeTiff(img: ImageData, dpi: number): Uint8Array {
  const { width: w, height: h, data } = img;
  const pixBytes = w * h * 3;
  const headerSize = 8;
  const bpsOff = headerSize + pixBytes;          // BitsPerSample [8,8,8]
  const xResOff = bpsOff + 6;                    // rational
  const yResOff = xResOff + 8;
  const ifdOff = yResOff + 8;
  const entryCount = 12;
  const buf = new ArrayBuffer(ifdOff + 2 + entryCount * 12 + 4);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  view.setUint16(0, 0x4949, true);      // II little-endian
  view.setUint16(2, 42, true);
  view.setUint32(4, ifdOff, true);

  let p = headerSize;
  for (let i = 0; i < w * h; i++) {
    bytes[p++] = data[i * 4];
    bytes[p++] = data[i * 4 + 1];
    bytes[p++] = data[i * 4 + 2];
  }
  view.setUint16(bpsOff, 8, true); view.setUint16(bpsOff + 2, 8, true); view.setUint16(bpsOff + 4, 8, true);
  view.setUint32(xResOff, dpi, true); view.setUint32(xResOff + 4, 1, true);
  view.setUint32(yResOff, dpi, true); view.setUint32(yResOff + 4, 1, true);

  let e = ifdOff;
  view.setUint16(e, entryCount, true); e += 2;
  const entry = (tag: number, type: number, count: number, value: number) => {
    view.setUint16(e, tag, true);
    view.setUint16(e + 2, type, true);
    view.setUint32(e + 4, count, true);
    if (type === 3 && count === 1) view.setUint16(e + 8, value, true);
    else view.setUint32(e + 8, value, true);
    e += 12;
  };
  entry(256, 4, 1, w);          // ImageWidth
  entry(257, 4, 1, h);          // ImageLength
  entry(258, 3, 3, bpsOff);     // BitsPerSample
  entry(259, 3, 1, 1);          // Compression: none
  entry(262, 3, 1, 2);          // Photometric: RGB
  entry(273, 4, 1, headerSize); // StripOffsets
  entry(277, 3, 1, 3);          // SamplesPerPixel
  entry(278, 4, 1, h);          // RowsPerStrip
  entry(279, 4, 1, pixBytes);   // StripByteCounts
  entry(282, 5, 1, xResOff);    // XResolution
  entry(283, 5, 1, yResOff);    // YResolution
  entry(296, 3, 1, 2);          // ResolutionUnit: inch
  view.setUint32(e, 0, true);   // next IFD: none
  return bytes;
}

export type ImageFormat = "png" | "jpg" | "tiff";

/* dpi controls output resolution: scale = dpi / 225 (the native page dpi). */
export async function exportPageImage(page: Page, assets: Assets, filename: string, format: ImageFormat, dpi = 225) {
  const canvas = await renderPageToCanvas(page, assets, dpi / 225);
  if (format === "tiff") {
    const ctx = canvas.getContext("2d")!;
    const tiff = encodeTiff(ctx.getImageData(0, 0, canvas.width, canvas.height), dpi);
    download(new Blob([tiff.buffer as ArrayBuffer], { type: "image/tiff" }), filename);
    return;
  }
  return new Promise<void>((res, rej) => {
    canvas.toBlob((blob) => {
      if (!blob) { rej(new Error("render failed")); return; }
      download(blob, filename);
      res();
    }, format === "jpg" ? "image/jpeg" : "image/png", 0.92);
  });
}

export async function pageJpegBytes(page: Page, assets: Assets, dpi = 225): Promise<Uint8Array> {
  const canvas = await renderPageToCanvas(page, assets, dpi / 225);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!blob) throw new Error("render failed");
  return new Uint8Array(await blob.arrayBuffer());
}

export { download };

export async function exportPagePNG(page: Page, assets: Assets, filename: string) {
  return exportPageImage(page, assets, filename, "png");
}

export async function pageThumbnail(page: Page, assets: Assets, maxW = 160): Promise<string> {
  const canvas = await renderPageToCanvas(page, assets, Math.min(1, maxW / page.w));
  return canvas.toDataURL("image/jpeg", 0.75);
}

export function docThumbnail(doc: Doc, assets: Assets): Promise<string> {
  return pageThumbnail(doc.pages[0], assets, 200);
}
