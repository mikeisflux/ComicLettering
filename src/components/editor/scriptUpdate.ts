/* Update Script — the second button in Import Script → Balloons.

   A script gets revised after the balloons are placed. Re-importing would
   pile a fresh set of balloons on the page; this instead MATCHES the new
   script's lines to the balloons, captions and SFX already there — page by
   page, in order, by how alike the words are — and rewrites just the
   words. Every matched balloon stays exactly where it is and grows only
   if the new line needs more room (never shrinks, never moves), locked or
   not: a lock protects against stray drags, not against the writer's
   corrections. Lines with no balloon to match are added below the last
   matched one on that page; balloons with no line in the new script are
   left alone and counted in the status. */
import { BalloonEl, El, TextEl, makeBalloon, makeText, pageMargins } from "@/lib/model";
import { ScriptItem, parseScript } from "@/lib/scriptParse";
import type { EditorCtx } from "./ctx";
import { growBalloonToFit, sizeTextToContent } from "./ops";

/* words only, lower-case, no punctuation or quotes */
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/* 0..1 — how alike two lines are: exact after normalising = 1, otherwise
   the Dice coefficient of their word sets blended with a character-bigram
   Dice, so a line with one word changed still scores high */
export function lineSimilarity(a: string, b: string): number {
  const na = norm(a), nb = norm(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const words = (s: string) => new Set(s.split(" "));
  const wa = words(na), wb = words(nb);
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  const wordDice = (2 * common) / (wa.size + wb.size);
  const grams = (s: string) => { const m = new Map<string, number>(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const ga = grams(na), gb = grams(nb);
  let inter = 0, total = 0;
  for (const [g, n] of ga) { total += n; inter += Math.min(n, gb.get(g) || 0); }
  for (const [, n] of gb) total += n;
  const gramDice = total ? (2 * inter) / total : 0;
  return 0.5 * wordDice + 0.5 * gramDice;
}

/* can this script line live in this element? captions ↔ caption boxes,
   SFX ↔ lettering, dialogue ↔ any other balloon */
function compatible(it: ScriptItem, el: BalloonEl | TextEl): boolean {
  if (it.kind === "sfx") return el.type === "text";
  if (el.type !== "balloon") return false;
  if (it.kind === "caption") return el.kind === "caption";
  return el.kind !== "caption";
}

const MATCH = 0.3;

/* order-preserving alignment (weighted longest common subsequence) of the
   script's lines against the page's existing items, best total similarity */
function align(items: ScriptItem[], els: (BalloonEl | TextEl)[]): Map<number, number> {
  const n = items.length, m = els.length;
  const sim: number[][] = items.map((it) => els.map((el) => (compatible(it, el) ? lineSimilarity(it.text, el.text) : 0)));
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const s = sim[i - 1][j - 1];
      dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1], s >= MATCH ? dp[i - 1][j - 1] + s : 0);
    }
  }
  const out = new Map<number, number>();
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const s = sim[i - 1][j - 1];
    if (s >= MATCH && dp[i][j] === dp[i - 1][j - 1] + s) { out.set(i - 1, j - 1); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return out;
}

/* grow a lettering block for new words, keeping its centre */
function growText(el: TextEl, pageW: number) {
  const probe = JSON.parse(JSON.stringify(el)) as TextEl;
  sizeTextToContent(probe, pageW);
  if (probe.w <= el.w && probe.h <= el.h) return false;
  const cx = el.x + el.w / 2, cy = el.y + el.h / 2;
  el.w = Math.max(el.w, probe.w); el.h = Math.max(el.h, probe.h);
  el.x = Math.round(cx - el.w / 2); el.y = Math.round(cy - el.h / 2);
  return true;
}

export function updateScript(ed: EditorCtx) {
  const { scriptText, setStatus, docRef, pageIndexRef, commit, rebuildThumbs, setShowScript, setScriptText, setSelId } = ed;
  const items = parseScript(scriptText);
  if (!items.length) { setStatus("No dialogue found — use CHARACTER: text (one per line)."); return; }
  const d = docRef.current!;
  const start = pageIndexRef.current;
  const lowest = Math.min(...items.map((i) => i.page));
  const byPage = new Map<number, ScriptItem[]>();
  for (const it of items) {
    const off = it.page - lowest;
    if (!byPage.has(off)) byPage.set(off, []);
    byPage.get(off)!.push(it);
  }
  let updated = 0, grown = 0, same = 0, added = 0, orphaned = 0, missingPages = 0;
  for (const [off, group] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    const p = d.pages[start + off];
    if (!p) { missingPages++; continue; }
    const candidates = p.els.filter((e): e is BalloonEl | TextEl => (e.type === "balloon" || e.type === "text") && !e.hidden);
    const matched = align(group, candidates);
    const used = new Set<number>();
    let lastEl: El | null = null;
    group.forEach((it, gi) => {
      const ci = matched.get(gi);
      if (ci != null) {
        const el = candidates[ci];
        used.add(ci);
        lastEl = el;
        if (norm(el.text) === norm(it.text) && el.text === it.text) { same++; return; }
        el.text = it.text;
        delete el.runs;                       // emphasis runs were for the old words
        updated++;
        const wasLocked = el.locked;
        el.locked = false;                    // a lock is not a veto on the writer's corrections
        const g = el.type === "balloon" ? growBalloonToFit(p, el) : growText(el, p.w);
        el.locked = wasLocked;
        if (g) grown++;
        return;
      }
      /* a new line: place it below the last matched item on this page (or
         at the top margin) so it lands near its neighbours */
      const m = pageMargins(p);
      const colW = Math.round((p.w - m.l - m.r) * 0.46);
      const gap = Math.round(p.w * 0.025);
      const x = lastEl ? lastEl.x : m.l;
      const y = lastEl ? lastEl.y + lastEl.h + gap : m.t;
      let el: El;
      if (it.kind === "sfx") {
        el = makeText(x, y, colW, Math.round(p.w * 0.16), true);
        el.text = it.text;
        sizeTextToContent(el as TextEl, p.w);
      } else {
        const kind = it.kind === "caption" ? "caption" : it.kind === "thought" || it.kind === "whisper" || it.kind === "shout" || it.kind === "double" || it.kind === "rough" || it.kind === "buzz" || it.kind === "burst2" ? it.kind : "speech";
        const bel = makeBalloon(kind, x, y, colW, Math.round(p.w * 0.12));
        bel.text = it.text;
        growBalloonToFit(p, bel);
        el = bel;
      }
      if (el.y + el.h > p.h - m.b) el.y = Math.max(m.t, p.h - m.b - el.h);
      p.els.push(el);
      lastEl = el;
      added++;
    });
    orphaned += candidates.filter((_, i) => !used.has(i)).length;
  }
  commit();
  rebuildThumbs();
  setShowScript(false);
  setScriptText("");
  setSelId(null);
  const parts = [
    `${updated} balloon${updated === 1 ? "" : "s"} reworded`,
    grown ? `${grown} grown to fit` : "",
    same ? `${same} unchanged` : "",
    added ? `${added} new line${added === 1 ? "" : "s"} added` : "",
    orphaned ? `${orphaned} balloon${orphaned === 1 ? "" : "s"} had no line in the new script and ${orphaned === 1 ? "was" : "were"} left alone` : "",
    missingPages ? `${missingPages} script page${missingPages === 1 ? "" : "s"} past the end of the book skipped` : "",
  ].filter(Boolean);
  setStatus(`Script updated: ${parts.join(", ")}. Every balloon stayed where it was (Ctrl+Z undoes).`);
}
