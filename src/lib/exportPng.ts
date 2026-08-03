/* Full-resolution canvas renderer — used for PNG export and page thumbnails. */
import {
  Assets, BalloonEl, Doc, El, FILTERS, FONTS, JoinLink, Page, TextRun, TextStyle,
  aabbOverlap, applyCrossbarI, deg2rad, joinGroupRect, joinLinks, lightenHex, pageBleed, resolveBalloon, rotVec,
} from "./model";
import { balloonGeom, arcTextLayout } from "./geometry";
import { paintFill } from "./fills";
import { BrushKey, brushScale, brushTile } from "./brushes";
import { glowPasses } from "./glows";
import { Warp, drawWarped, isWarped, warpBounds } from "./warp";

interface MergeInfo { d: string; bodyD?: string; color: string; cx: number; cy: number; rot: number; bw: number; bh: number; stroke?: string; strokeW?: number }

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

/* Break a single over-wide word at grapheme-cluster boundaries so it wraps
   like CSS `word-break: break-word` (also wraps spaceless CJK runs, which
   arrive as one huge "word"). Returns at least one part. */
function breakWordClusters(ctx: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  const clusters = word.match(/\P{M}\p{M}*/gu) || [word];
  const parts: string[] = [];
  let cur = "";
  for (const cl of clusters) {
    const test = cur + cl;
    if (cur && ctx.measureText(test).width > maxWidth) { parts.push(cur); cur = cl; }
    else cur = test;
  }
  if (cur) parts.push(cur);
  return parts.length ? parts : [word];
}

/* Word-wrap matching the editor's CSS (`white-space: pre-wrap` +
   `word-break: break-word`). hard[i] is true when lines[i] ends at a forced
   break (\n) — those lines must never be justified. */
function wrapLines(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number
): { lines: string[]; hard: boolean[] } {
  const lines: string[] = [];
  const hard: boolean[] = [];
  const paras = String(text).split("\n");
  for (let pi = 0; pi < paras.length; pi++) {
    const words = paras[pi].split(/\s+/).filter(Boolean);
    if (!words.length) lines.push("");
    else {
      let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width <= maxWidth) { line = test; continue; }
        if (line) lines.push(line);
        if (ctx.measureText(w).width <= maxWidth) { line = w; continue; }
        // over-wide word: move to its own line, then break per cluster
        const parts = breakWordClusters(ctx, w, maxWidth);
        for (let k = 0; k < parts.length - 1; k++) lines.push(parts[k]);
        line = parts[parts.length - 1];
      }
      lines.push(line);
    }
    while (hard.length < lines.length) hard.push(false);
    if (pi < paras.length - 1) hard[lines.length - 1] = true;
  }
  return { lines, hard };
}

/* Rich text with inline bold/italic runs. Cluster-level layout so emphasis can
   fall anywhere; honours wrap, alignment, gradient, outline, shadow, caps and
   crossbar-I — matching the DOM editor's run rendering. */
function drawRichText(
  ctx: CanvasRenderingContext2D, ts: TextStyle, runs: TextRun[],
  rect: [number, number, number, number]
) {
  const [rx, ry, rw, rh] = rect;
  const fam = FONTS[ts.font]?.css || FONTS.comicneue.css;
  const fontFor = (b: boolean, i: boolean) =>
    `${(ts.italic || i) ? "italic " : ""}${(ts.bold || b) ? "700 " : "400 "}${ts.size}px ${fam}`;
  ctx.textBaseline = "middle";
  const tr = ts.tracking ?? 0;
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px"; } catch { /* ignore */ }

  type Cl = { ch: string; b: boolean; i: boolean; u: boolean };
  const clusters: Cl[] = [];
  for (const run of runs) {
    const t0 = ts.caps ? run.t.toUpperCase() : run.t;
    const t = ts.crossbarI ? applyCrossbarI(t0) : t0;
    for (const cl of (t.match(/\P{M}\p{M}*|\n/gu) || [])) clusters.push({ ch: cl, b: !!run.b, i: !!run.i, u: !!run.u });
  }
  const measure = (cl: Cl) => { ctx.font = fontFor(cl.b, cl.i); return ctx.measureText(cl.ch).width + tr; };
  ctx.font = fontFor(false, false);
  const spaceW = ctx.measureText(" ").width + tr;

  type Tok = { type: "word" | "space"; clusters?: Cl[]; w: number };
  const lines: Tok[][] = [];
  /* hardBreak[i]: lines[i] ends at a forced break (\n) — never justified */
  const hardBreak: boolean[] = [];
  let curLine: Tok[] = [], curLineW = 0, word: Cl[] = [], wordW = 0;
  const pushLine = (hard: boolean) => { lines.push(curLine); hardBreak.push(hard); curLine = []; curLineW = 0; };
  const flushWord = () => {
    if (!word.length) return;
    const needSpace = curLine.length > 0;
    if (curLineW > 0 && curLineW + (needSpace ? spaceW : 0) + wordW > rw) pushLine(false);
    if (wordW > rw) {
      /* over-wide word (long word or spaceless CJK): break at grapheme-cluster
         boundaries so it wraps like CSS word-break: break-word */
      let part: Cl[] = [], partW = 0;
      for (const cl of word) {
        const cw = measure(cl);
        if (part.length && partW + cw > rw) {
          curLine.push({ type: "word", clusters: part, w: partW });
          curLineW += partW;
          pushLine(false);
          part = []; partW = 0;
        }
        part.push(cl); partW += cw;
      }
      curLine.push({ type: "word", clusters: part, w: partW }); curLineW += partW;
    } else {
      if (curLine.length > 0) { curLine.push({ type: "space", w: spaceW }); curLineW += spaceW; }
      curLine.push({ type: "word", clusters: word, w: wordW }); curLineW += wordW;
    }
    word = []; wordW = 0;
  };
  for (const cl of clusters) {
    if (cl.ch === "\n") { flushWord(); pushLine(true); continue; }
    if (/^\s+$/.test(cl.ch)) { flushWord(); continue; }
    word.push(cl); wordW += measure(cl);
  }
  flushWord();
  if (curLine.length || lines.length === 0) pushLine(false);

  const lineH = ts.size * (ts.lineHeight ?? 1.05);
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
  ctx.lineJoin = "round";
  ctx.textAlign = "left";
  let y = y0;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const lineW = line.reduce((s, t) => s + t.w, 0);
    /* justify: distribute extra width into the space tokens — but never on the
       last line of the block, nor on a line that ends at a forced break */
    const justifyThis = ts.align === "justify" && li < lines.length - 1 && !hardBreak[li];
    const spaceCount = line.reduce((n, t) => n + (t.type === "space" ? 1 : 0), 0);
    const extraPerSpace = justifyThis && spaceCount > 0 ? (rw - lineW) / spaceCount : 0;
    let x = ts.align === "center" ? rx + (rw - lineW) / 2 : ts.align === "right" ? rx + rw - lineW : rx;
    const lineX0 = x;
    let hasWord = false;
    for (const tok of line) {
      if (tok.type === "space") { x += tok.w + extraPerSpace; continue; }
      hasWord = true;
      for (const cl of tok.clusters!) {
        ctx.font = fontFor(cl.b, cl.i);
        const cw = ctx.measureText(cl.ch).width + tr;
        if (ts.shadow) {
          ctx.save();
          ctx.shadowColor = ts.shadowC || "#00000088";
          ctx.shadowOffsetX = ts.size * 0.05; ctx.shadowOffsetY = ts.size * 0.05; ctx.shadowBlur = ts.size * 0.06;
          ctx.fillStyle = fill; ctx.fillText(cl.ch, x, y);
          ctx.restore();
        }
        if (ts.outlineW > 0) { ctx.lineWidth = ts.outlineW; ctx.strokeStyle = ts.outlineC; ctx.strokeText(cl.ch, x, y); }
        ctx.fillStyle = fill; ctx.fillText(cl.ch, x, y);
        if (cl.u && !ts.underline) {
          /* run-level underline — same constants as the block underline */
          ctx.save();
          ctx.strokeStyle = ts.fillA;
          ctx.lineWidth = Math.max(1, ts.size * 0.06);
          ctx.beginPath();
          ctx.moveTo(x, y + ts.size * 0.45);
          ctx.lineTo(x + cw, y + ts.size * 0.45);
          ctx.stroke();
          ctx.restore();
        }
        x += cw;
      }
    }
    if (ts.underline && hasWord && x > lineX0) {
      /* same constants as drawStyledText's underline */
      ctx.save();
      ctx.strokeStyle = ts.fillA;
      ctx.lineWidth = Math.max(1, ts.size * 0.06);
      ctx.beginPath();
      ctx.moveTo(lineX0, y + ts.size * 0.45);
      ctx.lineTo(x, y + ts.size * 0.45);
      ctx.stroke();
      ctx.restore();
    }
    y += lineH;
  }
}

/* SFX arc-warped text: lay each glyph along a circular arc. Single line. */
function drawWarpedText(
  ctx: CanvasRenderingContext2D, ts: TextStyle, text: string,
  rect: [number, number, number, number], warp: number
) {
  const [rx, ry, rw, rh] = rect;
  let t = (ts.caps ? String(text).toUpperCase() : String(text)).replace(/\s*\n\s*/g, " ");
  if (ts.crossbarI) t = applyCrossbarI(t);
  const chars = t.match(/\P{M}\p{M}*/gu) || []; // keep combining marks with their base glyph
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px"; } catch { /* ignore */ }
  const tr = ts.tracking ?? 0;
  const widths = chars.map((c) => ctx.measureText(c).width + tr);
  const layout = arcTextLayout(widths, warp);
  const cx0 = rx + rw / 2, cy0 = ry + rh / 2;
  let fill: string | CanvasGradient = ts.fillA;
  if (ts.fillB) {
    /* glyph-LOCAL coordinates: gradients resolve against the CTM at paint
       time, and each glyph is painted inside its own translate/rotate — so a
       ramp spanning (0,±size/2) reproduces the editor's per-glyph gradient */
    const g = ctx.createLinearGradient(0, -ts.size / 2, 0, ts.size / 2);
    g.addColorStop(0, lightenHex(ts.fillA, 0.55));
    g.addColorStop(0.38, ts.fillA);
    g.addColorStop(1, ts.fillB);
    fill = g;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  chars.forEach((ch, i) => {
    if (ch === " ") return;
    const p = layout[i];
    ctx.save();
    ctx.translate(cx0 + p.x, cy0 + p.y);
    ctx.rotate(p.rot);
    if (ts.shadow) {
      ctx.save();
      ctx.shadowColor = ts.shadowC || "#00000088";
      ctx.shadowOffsetX = ts.size * 0.05; ctx.shadowOffsetY = ts.size * 0.05; ctx.shadowBlur = ts.size * 0.06;
      ctx.fillStyle = fill; ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    if (ts.outlineW > 0) {
      ctx.lineWidth = ts.outlineW; ctx.strokeStyle = ts.outlineC;
      ctx.strokeText(ch, 0, 0);
    }
    ctx.fillStyle = fill;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  });
}

export function drawStyledText(
  ctx: CanvasRenderingContext2D, ts: TextStyle, text: string,
  rect: [number, number, number, number], warp = 0, runs?: TextRun[]
) {
  /* A brush is a mask over the finished lettering, so the whole block —
     fill, gradient, outline and shadow alike — is drawn to a scratch canvas
     first and the texture punched out of it. Wrapping the one entry point
     keeps plain, rich and warped text identical to the DOM editor. */
  /* an envelope warp is not a linear transform, so the block is rendered flat
     to a scratch canvas and pushed through the patch — the same routine the
     editor uses, so screen and print cannot drift apart */
  const env = ts.env && isWarped(ts.env as Warp) ? (ts.env as Warp) : null;
  if (env) {
    const [rx, ry, rw, rh] = rect;
    const b = warpBounds(env);
    const sc = document.createElement("canvas");
    const pad = Math.ceil(ts.size * 0.5);
    sc.width = Math.max(1, Math.ceil(rw) + pad * 2);
    sc.height = Math.max(1, Math.ceil(rh) + pad * 2);
    const sctx = sc.getContext("2d");
    if (sctx) {
      sctx.translate(pad - rx, pad - ry);
      drawStyledText(sctx, { ...ts, env: undefined }, text, rect, warp, runs);
      ctx.save();
      ctx.translate(rx - pad, ry - pad);
      drawWarped(ctx, sc, sc.width, sc.height, env, sc.width, sc.height);
      ctx.restore();
      void b;   /* bounds are the caller's business — the page is not clipped */
      return;
    }
  }
  const brush = ts.brush && ts.brush !== "none" ? (ts.brush as BrushKey) : null;
  const glow = ts.glow && ts.glow !== "none" ? glowPasses(ts.glow, ts.size, ts.glowW ?? 1) : [];
  if ((brush || glow.length) && typeof document !== "undefined") {
    const tile = brush ? brushTile(brush) : null;
    if (tile || glow.length) {
      const [rx, ry, rw, rh] = rect;
      const glowPad = glow.length ? Math.ceil(Math.max(...glow.map((g) => g.blur)) * 2.4) : 0;
      const pad = Math.ceil(ts.size * 0.8 + ts.outlineW * 2) + glowPad;
      const w = Math.max(1, Math.ceil(rw) + pad * 2), h = Math.max(1, Math.ceil(rh) + pad * 2);
      const sc = document.createElement("canvas");
      sc.width = w; sc.height = h;
      const sctx = sc.getContext("2d");
      if (sctx) {
        sctx.translate(pad - rx, pad - ry);
        drawStyledText(sctx, { ...ts, brush: "none", glow: "none" }, text, rect, warp, runs);
        sctx.setTransform(1, 0, 0, 1, 0, 0);
        if (tile) {
          const px = brushScale(ts.size);
          const pat = sctx.createPattern(tile, "repeat");
          if (pat) {
            /* scale the tile with the type size so the grain stays in
               proportion instead of shrink-wrapping onto big lettering */
            pat.setTransform(new DOMMatrix([px / tile.width, 0, 0, px / tile.height, 0, 0]));
            sctx.globalCompositeOperation = "destination-in";
            sctx.fillStyle = pat;
            sctx.fillRect(0, 0, w, h);
            sctx.globalCompositeOperation = "source-over";
          }
        }
        /* stamp the halo behind the finished lettering — widest and coolest
           first, so the ramp heats up as it closes on the ink */
        for (const g of glow) {
          ctx.save();
          ctx.shadowColor = g.color;
          ctx.shadowBlur = g.blur;
          ctx.drawImage(sc, rx - pad, ry - pad);
          ctx.drawImage(sc, rx - pad, ry - pad);
          ctx.restore();
        }
        ctx.drawImage(sc, rx - pad, ry - pad);
        return;
      }
    }
  }
  if (runs && runs.length && !warp) { drawRichText(ctx, ts, runs, rect); return; }
  const [rx, ry, rw, rh] = rect;
  ctx.font = fontString(ts);
  ctx.textBaseline = "middle";
  if (warp) { drawWarpedText(ctx, ts, text, rect, warp); return; }
  const preText = ts.crossbarI ? applyCrossbarI(ts.caps ? String(text).toUpperCase() : String(text)) : text;
  // letter-spacing (tracking) — supported in the browser canvas used for export
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = `${ts.tracking ?? 0}px`; } catch { /* older engines */ }
  const t = ts.caps ? String(preText).toUpperCase() : String(preText);
  const { lines, hard } = wrapLines(ctx, t, rw);
  const lineH = ts.size * (ts.lineHeight ?? 1.05);
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
    /* never justify the last line of the block or a line ending at a forced
       break (\n) — matches CSS text-align: justify */
    const justifyThis = ts.align === "justify" && li < lines.length - 1 && !hard[li];
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

function drawEl(
  ctx: CanvasRenderingContext2D, el: El, assets: Assets, merge?: MergeInfo | null,
  /* join-group box in el-local coords — joined balloons share fill geometry */
  joinRect?: { x: number; y: number; w: number; h: number } | null,
) {
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
    if (el.strokeW > 0 && !g.noStroke) {
      ctx.strokeStyle = el.stroke;
      ctx.lineJoin = "round";
      if (g.dash) ctx.setLineDash(g.dash);
      if (merge) {
        /* joined balloons: stroke under, fills over → union outline */
        ctx.lineWidth = el.strokeW * 2;
        if (!merge.strokeW) {
          /* melt (overlapping): hide this balloon's outline where it crosses
             INTO the partner, so the union has no inner seam — clip to
             everything OUTSIDE the partner (big rect XOR partner, evenodd) */
          ctx.save();
          const clip = new Path2D();
          clip.rect(-el.w, -el.h, el.w * 3, el.h * 3);
          const m = new DOMMatrix();
          m.translateSelf(merge.cx, merge.cy);
          m.rotateSelf(merge.rot);
          m.translateSelf(-merge.bw / 2, -merge.bh / 2);
          clip.addPath(new Path2D(merge.d), m);
          ctx.clip(clip, "evenodd");
          ctx.stroke(path);
          ctx.restore();
        } else {
          ctx.stroke(path);
        }
      }
    }
    paintFill(ctx, el.fill, el.w, el.h, path, joinRect);
    const bImgSrc = el.img ? assets[el.img] : null;
    const bImg = bImgSrc ? imgCache.get(bImgSrc) : null;
    if (bImg) {
      ctx.save();
      ctx.clip(path);
      drawCover(ctx, bImg, el.w, el.h);
      ctx.restore();
    }
    if (!merge && el.strokeW > 0 && !g.noStroke) {
      ctx.lineWidth = el.strokeW;
      ctx.stroke(path);
      if (g.d2) ctx.stroke(new Path2D(g.d2));
    }
    if (g.deco && el.strokeW > 0) {
      ctx.fillStyle = el.stroke;
      ctx.fill(new Path2D(g.deco));
    }
    /* the connector band and the partner's tail wedge are NOT drawn here —
       each join link is its own pass after BOTH partners (drawJoinBand),
       so a chain's links never repaint each other's junctions */
    ctx.setLineDash([]);
    drawStyledText(ctx, el.ts, el.text, g.textRect, 0, el.runs);
  } else if (el.type === "text") {
    drawStyledText(ctx, el.ts, el.text, [0, 0, el.w, el.h], el.warp ?? 0, el.runs);
  }
  ctx.restore();
}

/* Spread-spine handling for a page rendered next to a facing partner.
   The spine-side BLEED LINE (trim) is a hard border for LETTERING: any
   balloon, text box or SFX that crosses it stops dead at the trim on its
   own page, and the cut-off part renders on the facing page starting at
   ITS bleed line instead. Uploaded art (images, panels) is exempt — art
   is meant to fill its bleed and never carries across.
   `side` is the page edge the spine sits on (1 = right, -1 = left),
   `trimX` that edge's bleed line. mode "clip" = the page's own pass
   (cut crossing lettering at the trim); mode "only" = the partner pass
   (draw JUST the partner's crossing lettering, from the trim join out). */
export type SpineSpan = { side: 1 | -1; trimX: number; mode: "clip" | "only" };

/* horizontal extent of an element's box, rotation included */
function elXBounds(el: { x: number; y: number; w: number; h: number; rot: number }): [number, number] {
  const cx = el.x + el.w / 2;
  const r = deg2rad(el.rot || 0);
  const hw = (Math.abs(Math.cos(r)) * el.w + Math.abs(Math.sin(r)) * el.h) / 2;
  return [cx - hw, cx + hw];
}

/* is this a lettering element that crosses the spine-side bleed line?
   (uploaded art — images and panels — never splits at the spine) */
export function elCrossesSpine(
  el: { type: string; x: number; y: number; w: number; h: number; rot: number },
  trimX: number, side: 1 | -1,
): boolean {
  if (el.type === "image" || el.type === "panel") return false;
  const [x0, x1] = elXBounds(el);
  return side === 1 ? x1 > trimX + 0.5 : x0 < trimX - 0.5;
}

/* all of one page's elements, in order, with join bands interleaved */
function drawPageEls(
  ctx: CanvasRenderingContext2D, page: Page, assets: Assets, letteringOnly: boolean,
  span?: SpineSpan | null,
) {
  const links = joinLinks(page);
  const clipAtTrim = () => {
    ctx.save();
    const c = new Path2D();
    if (span!.side === 1) c.rect(-page.w * 2, -page.h, span!.trimX + page.w * 2, page.h * 3);
    else c.rect(span!.trimX, -page.h, page.w * 3, page.h * 3);
    ctx.clip(c);
  };
  page.els.forEach((el, i) => {
    const crosses = span ? elCrossesSpine(el, span.trimX, span.side) : false;
    if (span?.mode === "only" && !crosses) {
      for (const l of links) {
        if (l.afterIndex === i && (elCrossesSpine(l.child, span.trimX, span.side) || elCrossesSpine(l.base, span.trimX, span.side)))
          drawJoinBand(ctx, page, l);
      }
      return;
    }
    const clip = span?.mode === "clip" && crosses;
    if (clip) clipAtTrim();
    if (!(letteringOnly && (el.type === "panel" || el.type === "image"))) {
      if (el.type === "balloon") {
        const { el: bEl, base } = resolveBalloon(page, el);
        let merge: MergeInfo | null = null;
        if (base) {
          const bg = balloonGeom(resolveBalloon(page, base).el);
          const [rx, ry] = rotVec(
            base.x + base.w / 2 - (el.x + el.w / 2),
            base.y + base.h / 2 - (el.y + el.h / 2), -el.rot);
          merge = {
            d: bg.d,
            bodyD: balloonGeom({ ...base, tail: null, band: false, attachTo: null }).d,
            color: base.fill.a,
            cx: el.w / 2 + rx, cy: el.h / 2 + ry,
            rot: base.rot - el.rot, bw: base.w, bh: base.h,
            ...(aabbOverlap(el, base) ? {} : { stroke: base.stroke, strokeW: base.strokeW }),
          };
        }
        const jg = joinGroupRect(page, el);
        const joinRect = jg ? { x: jg.x - el.x, y: jg.y - el.y, w: jg.w, h: jg.h } : null;
        drawEl(ctx, bEl as BalloonEl, assets, merge, joinRect);
      } else {
        drawEl(ctx, el, assets);
      }
    }
    if (clip) ctx.restore();
    /* each join link's connector band paints right after the LATER of its
       two partners (same pass structure as the editor's renderJoinBands) */
    for (const l of links) {
      if (l.afterIndex !== i) continue;
      const bandClip = span?.mode === "clip" &&
        (elCrossesSpine(l.child, span.trimX, span.side) || elCrossesSpine(l.base, span.trimX, span.side));
      if (bandClip) clipAtTrim();
      drawJoinBand(ctx, page, l);
      if (bandClip) ctx.restore();
    }
  });
}

/* The spread partner whose overhang continues onto page i, with the
   translation that joins the two at the SPINE: facing pages meet at their
   trim lines, so the partner's origin sits a page-width minus BOTH inner
   bleeds away. An element spanning the spread (a double-page KABLAAAM)
   therefore stops at one page's trim and resumes at the partner's — and in
   Two-Page Print View, where the inner bleeds are dropped, the two halves
   connect seamlessly. */
export function spreadNeighbor(doc: Doc, i: number): { page: Page; dx: number } | null {
  const pn = i + 1;
  if (pn === 1) return null;                     // page 1 is a cover — no partner
  const j = pn % 2 === 0 ? i + 1 : i - 1;
  if (j < 0 || j >= doc.pages.length) return null;
  const a = doc.pages[i], b = doc.pages[j];
  return j === i + 1
    ? { page: b, dx: a.w - pageBleed(a) - pageBleed(b) }
    : { page: b, dx: -(b.w - pageBleed(b) - pageBleed(a)) };
}

export async function renderPageToCanvas(
  page: Page, assets: Assets, scale = 1, letteringOnly = false,
  neighbor?: { page: Page; dx: number } | null,
): Promise<HTMLCanvasElement> {
  const srcs: string[] = [];
  for (const el of [...page.els, ...(neighbor?.page.els ?? [])]) {
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
  // lettering-only export: transparent background, no panels/artwork —
  // just balloons and lettering, for handing back to the artist/production
  if (!letteringOnly) paintFill(ctx, page.bg, page.w, page.h);
  /* With a facing partner, this page's bleed border on the spine side is a
     HARD split line: a spanning element stops dead at the trim here, and
     everything past it (bleed sliver included) renders on the partner. */
  const spineSide: 1 | -1 = neighbor ? (neighbor.dx > 0 ? 1 : -1) : 1;
  const trimX = spineSide === 1 ? page.w - pageBleed(page) : pageBleed(page);
  drawPageEls(ctx, page, assets, letteringOnly,
    neighbor ? { side: spineSide, trimX, mode: "clip" } : null);
  if (neighbor) {
    /* Spread partner pass: ONLY the partner's lettering that crosses ITS
       spine-side bleed line carries over — the partner's art stays put.
       It draws from the trim join outward, so the piece that sat past the
       partner's bleed line lands on THIS page starting at our own bleed
       line (the two trims coincide — also where Print View joins). */
    ctx.save();
    const clip = new Path2D();
    if (spineSide === 1) clip.rect(-page.w, -page.h, trimX + page.w, page.h * 3);
    else clip.rect(trimX, -page.h, page.w * 2, page.h * 3);
    ctx.clip(clip);
    ctx.translate(neighbor.dx, 0);
    /* partner's spine is on its opposite side */
    const nSide: 1 | -1 = spineSide === 1 ? -1 : 1;
    const nTrim = nSide === -1 ? pageBleed(neighbor.page) : neighbor.page.w - pageBleed(neighbor.page);
    drawPageEls(ctx, neighbor.page, assets, letteringOnly,
      { side: nSide, trimX: nTrim, mode: "only" });
    ctx.restore();
    /* Tuck cutouts are foreground ART — they sit in front of any lettering,
       including the partner's overhang, so a cross-spine tuck reads as the
       art passing in front of the double-page SFX. */
    if (!letteringOnly) {
      for (const el of page.els) {
        if (el.type === "image" && el.cut) drawEl(ctx, el, assets);
      }
    }
  }
  clearShadow(ctx);
  return canvas;
}

/* One join link's connector band — the export twin of JoinBandShape.
   Painted after BOTH partner balloons: the band fill covers the outline
   crossings at both junctions (open into each body), only the two sides get
   inked, and the partner's speaker-tail wedge is redrawn on top so the band
   falls behind it. Independent per link, whatever the chain looks like. */
function drawJoinBand(ctx: CanvasRenderingContext2D, page: Page, link: JoinLink) {
  const { el: bEl, base } = resolveBalloon(page, link.child);
  if (!base || !bEl.band) return;             // melted or detached — no band
  const g = balloonGeom(bEl);
  if (!g.bandFill) return;
  const el = bEl;
  ctx.save();
  ctx.globalAlpha = el.opacity ?? 1;
  ctx.translate(el.x + el.w / 2, el.y + el.h / 2);
  ctx.rotate(deg2rad(el.rot || 0));
  ctx.scale(el.flipH ? -1 : 1, el.flipV ? -1 : 1);
  ctx.translate(-el.w / 2, -el.h / 2);
  const jg = joinGroupRect(page, link.child);
  const joinRect = jg ? { x: jg.x - el.x, y: jg.y - el.y, w: jg.w, h: jg.h } : null;
  ctx.setLineDash([]);
  if (el.fill.kind === "gradient") {
    /* the band carries the shared join-group gradient, so the join reads as
       one continuous shape instead of restarting at the junction */
    paintFill(ctx, el.fill, el.w, el.h, new Path2D(g.bandFill), joinRect);
  } else {
    ctx.fillStyle = el.fill.a;
    ctx.fill(new Path2D(g.bandFill));
  }
  if (g.bandEdges && el.strokeW > 0) {
    ctx.strokeStyle = el.stroke;
    ctx.lineWidth = el.strokeW;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke(new Path2D(g.bandEdges));
  }
  /* partner's speaker-tail WEDGE (tailed shape XOR plain body, evenodd) on
     top of the band — the opening into the partner's body stays untouched */
  const bg = balloonGeom(resolveBalloon(page, base).el);
  const bodyD = balloonGeom({ ...base, tail: null, band: false, attachTo: null }).d;
  if (base.strokeW > 0 && bodyD !== bg.d) {
    const [rx, ry] = rotVec(
      base.x + base.w / 2 - (el.x + el.w / 2),
      base.y + base.h / 2 - (el.y + el.h / 2), -el.rot);
    ctx.save();
    const m = new DOMMatrix();
    m.translateSelf(el.w / 2 + rx, el.h / 2 + ry);
    m.rotateSelf(base.rot - el.rot);
    m.translateSelf(-base.w / 2, -base.h / 2);
    const clip = new Path2D();
    clip.addPath(new Path2D(bodyD), m);
    clip.addPath(new Path2D(bg.d), m);
    ctx.clip(clip, "evenodd");
    const tailP = new Path2D();
    tailP.addPath(new Path2D(bg.d), m);
    if (el.fill.kind === "gradient" && joinRect) {
      /* gradient join: the wedge carries the shared gradient (see editor) */
      paintFill(ctx, el.fill, el.w, el.h, tailP, joinRect);
    } else {
      ctx.fillStyle = base.fill.a;
      ctx.fill(tailP);
    }
    ctx.strokeStyle = base.stroke;
    ctx.lineWidth = base.strokeW;
    ctx.lineJoin = "round";
    ctx.stroke(tailP);
    ctx.restore();
  }
  ctx.restore();
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
export async function exportPageImage(page: Page, assets: Assets, filename: string, format: ImageFormat, dpi = 225, letteringOnly = false, neighbor?: { page: Page; dx: number } | null) {
  const canvas = await renderPageToCanvas(page, assets, dpi / 225, letteringOnly, neighbor);
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

export async function pageJpegBytes(page: Page, assets: Assets, dpi = 225, neighbor?: { page: Page; dx: number } | null): Promise<Uint8Array> {
  const canvas = await renderPageToCanvas(page, assets, dpi / 225, false, neighbor);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.9));
  if (!blob) throw new Error("render failed");
  return new Uint8Array(await blob.arrayBuffer());
}

export { download };

export async function exportPagePNG(page: Page, assets: Assets, filename: string, neighbor?: { page: Page; dx: number } | null) {
  return exportPageImage(page, assets, filename, "png", 225, false, neighbor);
}

export async function pageThumbnail(page: Page, assets: Assets, maxW = 160, neighbor?: { page: Page; dx: number } | null): Promise<string> {
  const canvas = await renderPageToCanvas(page, assets, Math.min(1, maxW / page.w), false, neighbor);
  return canvas.toDataURL("image/jpeg", 0.75);
}

export function docThumbnail(doc: Doc, assets: Assets): Promise<string> {
  return pageThumbnail(doc.pages[0], assets, 200);
}
