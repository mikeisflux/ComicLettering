/* Full-resolution canvas renderer — used for PNG export and page thumbnails. */
import { Assets, Doc, El, FILTERS, FONTS, Page, TextStyle, deg2rad } from "./model";
import { balloonGeom } from "./geometry";
import { paintFill } from "./fills";

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
    g.addColorStop(0, ts.fillA);
    g.addColorStop(1, ts.fillB);
    fill = g;
  }

  const xFor = (align: TextStyle["align"]) => {
    if (align === "left") { ctx.textAlign = "left"; return rx; }
    if (align === "right") { ctx.textAlign = "right"; return rx + rw; }
    ctx.textAlign = "center"; return rx + rw / 2;
  };

  ctx.lineJoin = "round";
  let y = y0;
  for (const line of lines) {
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
        ctx.strokeText(line, x, y);
      } else {
        ctx.fillStyle = fill;
        ctx.fillText(line, x, y);
      }
      ctx.restore();
    }
    if (ts.outlineW > 0) {
      ctx.lineWidth = ts.outlineW;
      ctx.strokeStyle = ts.outlineC;
      ctx.strokeText(line, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(line, x, y);
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

function drawEl(ctx: CanvasRenderingContext2D, el: El, assets: Assets) {
  ctx.save();
  ctx.translate(el.x + el.w / 2, el.y + el.h / 2);
  ctx.rotate(deg2rad(el.rot || 0));
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
    paintFill(ctx, el.fill, el.w, el.h, path);
    if (el.strokeW > 0) {
      ctx.strokeStyle = el.stroke;
      ctx.lineWidth = el.strokeW;
      ctx.lineJoin = "round";
      if (g.dash) ctx.setLineDash(g.dash);
      ctx.stroke(path);
      if (g.d2) ctx.stroke(new Path2D(g.d2));
      ctx.setLineDash([]);
    }
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
    if ((el.type === "panel" || el.type === "image") && el.img && assets[el.img]) srcs.push(assets[el.img]);
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
  for (const el of page.els) drawEl(ctx, el, assets);
  clearShadow(ctx);
  return canvas;
}

export async function exportPagePNG(page: Page, assets: Assets, filename: string) {
  const canvas = await renderPageToCanvas(page, assets, 1);
  return new Promise<void>((res, rej) => {
    canvas.toBlob((blob) => {
      if (!blob) { rej(new Error("render failed")); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      res();
    }, "image/png");
  });
}

export async function pageThumbnail(page: Page, assets: Assets, maxW = 160): Promise<string> {
  const canvas = await renderPageToCanvas(page, assets, Math.min(1, maxW / page.w));
  return canvas.toDataURL("image/jpeg", 0.75);
}

export function docThumbnail(doc: Doc, assets: Assets): Promise<string> {
  return pageThumbnail(doc.pages[0], assets, 200);
}
