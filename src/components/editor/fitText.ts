/* Fit-to-text & line-balance engine — split from ops.ts (1500-line cap).
   Balloons re-wrap by SHAPE alone (most-oval block wins, no word counts);
   caption boxes keep the width the letterer gave them and hug the text's
   natural wrap. NOTHING here writes line breaks into the words: Fit used
   to rewrite captions as "a sentence per line, ~6 words a line" with real
   newlines, which read as stacked words and had to be deleted by hand
   after every script import. Only the explicit "Balance Line Breaks"
   command (balanceRag) changes the text. ops.ts re-exports these. */
import { BalloonEl, FONTS, TAILLESS_KINDS, TextEl, TextStyle, clamp } from "@/lib/model";
import { balloonGeom } from "@/lib/geometry";
import { EditorCtx } from "./ctx";

/* a hidden measuring node that mirrors on-canvas lettering layout */
function makeMeasurer(ts: TextStyle): HTMLDivElement {
  const meas = document.createElement("div");
  Object.assign(meas.style, {
    position: "absolute", left: "-9999px", top: "0",
    visibility: "hidden", whiteSpace: "pre",
    fontFamily: (FONTS[ts.font]?.css || FONTS.comicneue.css),
    fontSize: `${ts.size}px`,
    fontWeight: ts.bold ? "700" : "400",
    fontStyle: ts.italic ? "italic" : "normal",
    lineHeight: `${ts.lineHeight ?? 1.05}`,
    letterSpacing: ts.tracking ? `${ts.tracking}px` : "normal",
    textTransform: ts.caps ? "uppercase" : "none",
    /* the canvas breaks an over-long word mid-word; measuring it unbroken
       flagged balloons as overflowing when they visibly fit */
    wordBreak: "break-word",
  } as CSSStyleDeclaration);
  document.body.appendChild(meas);
  return meas;
}

/* measure an element's lettering: at a given wrap width, or hugging its own
   line breaks (longest line, then wrapped height) when none is given */
function measureLettering(el: BalloonEl | TextEl, wrapW?: number): { w: number; h: number } {
  const meas = makeMeasurer(el.ts);
  meas.textContent = el.text;
  /* fractional width, rounded UP — scrollWidth truncates to whole pixels,
     and a box 1px short of its longest word re-breaks it mid-word */
  const w = wrapW ?? Math.ceil(meas.getBoundingClientRect().width) + 1;
  meas.style.whiteSpace = "pre-wrap";
  meas.style.width = `${w + 2}px`;
  const h = Math.ceil(meas.getBoundingClientRect().height);
  document.body.removeChild(meas);
  return { w, h };
}

/* per-word pixel widths + the width of one space, for wrap planning */
function wordWidths(words: string[], ts: TextStyle): { wW: number[]; spaceW: number } {
  const meas = makeMeasurer(ts);
  const measure = (s: string) => { meas.textContent = s; return meas.getBoundingClientRect().width; };
  const wW = words.map(measure);
  const spaceW = measure("x x") - measure("xx");
  document.body.removeChild(meas);
  return { wW, spaceW };
}

/* greedy line count at a max width — same packing CSS wrapping does */
function linesAt(wW: number[], spaceW: number, maxW: number): number {
  let lines = 1, cur = 0;
  for (const w of wW) {
    if (cur === 0) cur = w;
    else if (cur + spaceW + w <= maxW) cur += spaceW + w;
    else { lines++; cur = w; }
  }
  return lines;
}

/* smallest wrap width that still packs into ≤ L lines (even rag) */
function widthForLines(wW: number[], spaceW: number, L: number, oneLineW: number): number {
  let lo = Math.max(...wW), hi = Math.max(lo + 1, oneLineW);
  for (let i = 0; i < 40 && hi - lo > 0.5; i++) {
    const mid = (lo + hi) / 2;
    if (linesAt(wW, spaceW, mid) <= L) hi = mid; else lo = mid;
  }
  return hi;
}

/* BALLOONS: pick the wrap width whose text block sits closest to a pleasing
   oval — try every line count and keep the one nearest the target aspect.
   The text itself is untouched; the renderer wraps naturally at this width. */
function planOvalWrap(el: BalloonEl): number | null {
  const words = el.text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length < 2) return null;
  const { wW, spaceW } = wordWidths(words, el.ts);
  const oneLineW = wW.reduce((a, b) => a + b, 0) + spaceW * (wW.length - 1);
  const lineHpx = el.ts.size * (el.ts.lineHeight ?? 1.05);
  /* letters are short and wide, so the PIXEL block of a pleasing oval is
     much wider than tall — ~2.6:1 lands the drawn balloon near 1.5-1.8:1.
     (1.4 here read as "square-ish" and produced 1-2 word columns.) */
  const TARGET = 2.6;
  let bestW: number | null = null, bestScore = Infinity, lastRows = 0;
  for (let L = 1; L <= words.length; L++) {
    const W = widthForLines(wW, spaceW, L, oneLineW);
    const rows = linesAt(wW, spaceW, W);
    if (rows === lastRows) continue;   // same packing as the previous L
    lastRows = rows;
    const score = Math.abs(Math.log((W / (rows * lineHpx)) / TARGET));
    if (score < bestScore) { bestScore = score; bestW = W; }
  }
  return bestW;
}

/* Fit to text (Ctrl+\) — every SELECTED balloon and text box, each measured
   and sized individually, so Ctrl+A then Ctrl+\ fits the whole page in one
   stroke. BALLOONS use shape logic only: the text re-wraps to whatever line
   count reads closest to a clean oval. TEXT BOXES keep their width and hug
   the natural wrap. The text itself is never rewritten. Locked and empty
   items are skipped; art and panels never touched. */
export function fitBalloonToText(ed: EditorCtx) {
  const { page, selIds, setStatus, commit } = ed;
  if (!page) return;
  const targets = page.els.filter((x): x is BalloonEl | TextEl =>
    selIds.includes(x.id) && (x.type === "balloon" || x.type === "text"));
  if (!targets.length) { setStatus("Select a balloon or text box to fit (Ctrl+A grabs the whole page)."); return; }
  let fitted = 0, locked = 0, empty = 0;
  for (const el of targets) {
    if (el.locked) { locked++; continue; }
    if (!el.text.trim()) { empty++; continue; }
    const ts = el.ts;
    /* a "text box" is a TextEl OR a tailless box balloon (caption, rounded,
       cosmic, emitter) — those read as prose, so they take the sentence
       rules. Only tailed SPEECH balloons get the oval shape logic. */
    const isBox = el.type === "text" ||
      (el.type === "balloon" && TAILLESS_KINDS.includes(el.kind));
    let newW: number, newH: number;
    if (el.type === "balloon" && !isBox) {
      /* the lettering sits in an inner fraction of the balloon (shape-
         dependent) — size the balloon so that inner rect hugs the text */
      const g = balloonGeom(el);
      const [, , tw, th] = g.textRect;
      const fracW = tw / el.w, fracH = th / el.h;
      if (!(fracW > 0) || !(fracH > 0)) continue;
      /* author's own line breaks are respected; otherwise re-plan the wrap
         for the most oval block the words allow */
      const wrapW = /\n/.test(el.text) ? undefined : planOvalWrap(el) ?? undefined;
      const { w: lineW, h: lineH } = measureLettering(el, wrapW);
      const targetTW = clamp(lineW + ts.size * 0.5, 24, page.w * 0.9);
      const targetTH = lineH + ts.size * 0.35;
      newW = clamp(Math.round(targetTW / fracW), 60, page.w);
      newH = clamp(Math.round(targetTH / fracH), 44, page.h);
    } else {
      /* text boxes and caption-style balloons: the words are left exactly
         as written. The box keeps the width the letterer gave it (a caption
         is usually drawn to span its panel) and hugs the text's natural
         wrap at that width — shrinking only when the whole text fits on
         one shorter line. Author line breaks are honoured as-is. */
      let innerW: number;
      if (el.type === "balloon") innerW = balloonGeom(el).textRect[2];
      else innerW = el.w - Math.round(ts.size * 0.6);
      const hug = measureLettering(el);           // longest line, unwrapped
      const wrapW = /\n/.test(el.text) || hug.w <= innerW ? undefined : Math.max(ts.size * 2, innerW);
      const { w: lineW, h: lineH } = wrapW === undefined ? hug : measureLettering(el, wrapW);
      if (el.type === "balloon") {
        /* a box balloon still pads its lettering by its own geometry */
        const g = balloonGeom(el);
        const [, , tw, th] = g.textRect;
        const fracW = tw / el.w, fracH = th / el.h;
        if (!(fracW > 0) || !(fracH > 0)) continue;
        newW = clamp(Math.round((lineW + ts.size * 0.5) / fracW), 60, page.w);
        newH = clamp(Math.round((lineH + ts.size * 0.35) / fracH), 44, page.h);
      } else {
        newW = clamp(Math.round(lineW + ts.size * 0.6), 40, page.w);
        newH = clamp(Math.round(lineH + ts.size * 0.4), 24, page.h);
      }
    }
    /* keep each item centred where it was while it resizes */
    const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
    el.w = newW; el.h = newH;
    el.x = Math.round(cx - newW / 2);
    el.y = Math.round(cy - newH / 2);
    fitted++;
  }
  if (fitted) {
    commit();
    setStatus(fitted === 1
      ? "Fitted to its lettering."
      : `Fitted ${fitted} balloons & text boxes to their lettering${locked ? ` (${locked} locked skipped)` : ""}.`);
  } else if (locked) setStatus("Those items are locked — unlock them to resize.");
  else if (empty) setStatus("Type some text first, then fit to it.");
}

export function balanceRag(ed: EditorCtx) {
  const { page, selId, setStatus, mutateSel } = ed;
  const el = page?.els.find((x) => x.id === selId);
  if (!el || (el.type !== "balloon" && el.type !== "text")) { setStatus("Select a balloon or text to balance."); return; }
  if (el.locked) { setStatus("That item is locked — unlock it first."); return; }
  const raw = el.text.replace(/\s+/g, " ").trim();
  const words = raw.split(" ").filter(Boolean);
  if (words.length < 2) { setStatus("Nothing to balance."); return; }
  const availW = el.type === "balloon" ? balloonGeom(el).textRect[2] : el.w;
  const ts = el.ts;
  const meas = document.createElement("div");
  Object.assign(meas.style, {
    position: "absolute", left: "-9999px", top: "0", visibility: "hidden",
    whiteSpace: "pre",
    fontFamily: (FONTS[ts.font]?.css || FONTS.comicneue.css),
    fontSize: `${ts.size}px`,
    fontWeight: ts.bold ? "700" : "400",
    fontStyle: ts.italic ? "italic" : "normal",
    letterSpacing: ts.tracking ? `${ts.tracking}px` : "normal",
    textTransform: ts.caps ? "uppercase" : "none",
    /* the canvas breaks an over-long word mid-word; measuring it unbroken
       flagged balloons as overflowing when they visibly fit */
    wordBreak: "break-word",
  } as CSSStyleDeclaration);
  document.body.appendChild(meas);
  const measure = (s: string) => { meas.textContent = s; return meas.scrollWidth; };
  const wordW = words.map(measure);
  const spaceW = measure("x x") - measure("xx");
  document.body.removeChild(meas);
  const linesAt = (maxW: number) => {
    let lines = 1, cur = 0;
    for (const w of wordW) {
      if (cur === 0) cur = w;
      else if (cur + spaceW + w <= maxW) cur += spaceW + w;
      else { lines++; cur = w; }
    }
    return lines;
  };
  const targetLines = linesAt(availW);
  if (targetLines <= 1) { setStatus("Text already fits on one line."); return; }
  /* smallest max-width that still yields the same number of lines → even rag */
  let lo = Math.max(...wordW), hi = availW;
  for (let it = 0; it < 40 && hi - lo > 0.5; it++) {
    const mid = (lo + hi) / 2;
    if (linesAt(mid) <= targetLines) hi = mid; else lo = mid;
  }
  const W = hi;
  const out: string[] = [];
  let cur = "", curW = 0;
  for (let i = 0; i < words.length; i++) {
    if (cur === "") { cur = words[i]; curW = wordW[i]; }
    else if (curW + spaceW + wordW[i] <= W) { cur += " " + words[i]; curW += spaceW + wordW[i]; }
    else { out.push(cur); cur = words[i]; curW = wordW[i]; }
  }
  if (cur) out.push(cur);
  ed.mutateText((x) => { x.text = out.join("\n"); x.runs = undefined; });
  setStatus(`Balanced into ${out.length} even line${out.length > 1 ? "s" : ""}.`);
}
