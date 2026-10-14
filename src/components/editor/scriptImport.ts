/* Script import — split from ops.ts (1500-line cap). A comic script
   becomes balloons laid out per page and panel; ops.ts re-exports it so
   every call site is unchanged. */
import {
  BalloonEl, BalloonKind, El, TextEl, clamp, makeBalloon, makeText, newPage, pageMargins,
} from "@/lib/model";
import { LETTER_STYLES, applyLetterStyle } from "@/lib/presets";
import { parseScript } from "@/lib/scriptParse";
import { isZip, readZipDirectory, zipEntryText } from "@/lib/zipFile";
import { EditorCtx } from "./ctx";
import { sizeTextToContent } from "./ops";

/* The text of a script file: plain text as-is, a Word .docx by reading its
   document.xml — one paragraph per line, tabs and line breaks kept — so a
   writer's script opens straight into the import box without a copy-paste
   through Word (which also loses the curly quotes the parser strips). */
export async function readScriptFile(f: File): Promise<string> {
  if (await isZip(f)) {
    const dir = await readZipDirectory(f);
    const e = dir.get("word/document.xml");
    if (!e) throw new Error("not a Word document");
    return docxText(await zipEntryText(f, e));
  }
  return f.text();
}

function docxText(xml: string): string {
  const ent: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
  return xml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, c: string) =>
      c[0] === "#" ? String.fromCodePoint(c[1].toLowerCase() === "x" ? parseInt(c.slice(2), 16) : parseInt(c.slice(1), 10)) : (ent[c.toLowerCase()] ?? _))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function importScript(ed: EditorCtx) {
  const { scriptText, setStatus, docRef, pageIndexRef, activeStyleRef, commit, rebuildThumbs, setShowScript, setScriptText, setSelId } = ed;
  const items = parseScript(scriptText);
  if (!items.length) { setStatus("No dialogue found — use CHARACTER: text (one per line)."); return; }
  const d = docRef.current!;
  const start = pageIndexRef.current;
  const first = d.pages[start];

  /* A script is a book, not a page. Its PAGE headers decide which document
     page each line lands on — everything used to pile onto whatever page
     happened to be open, which for a 28-page script is a wall of balloons
     nobody can untangle. Script page numbers are kept relative to the
     lowest one, so a script starting at PAGE 5 still begins where you are. */
  const lowest = Math.min(...items.map((i) => i.page));
  const byPage = new Map<number, typeof items>();
  for (const it of items) {
    const off = it.page - lowest;
    if (!byPage.has(off)) byPage.set(off, []);
    byPage.get(off)!.push(it);
  }

  let count = 0, madePages = 0;
  for (const [off, group] of [...byPage.entries()].sort((a, bb) => a[0] - bb[0])) {
    while (d.pages.length <= start + off) {
      const np = newPage(first.w, first.h, first.margin && { ...first.margin });
      np.bleed = first.bleed;
      d.pages.push(np); madePages++;
    }
    const p = d.pages[start + off];
    const m = pageMargins(p);
    const colW = Math.round((p.w - m.l - m.r) * 0.46);
    const gap = Math.round(p.w * 0.025);
    /* Split the page into a band per panel so balloons land near the art
       they belong to, rather than all in one stack at the top. */
    const panels = [...new Set(group.map((i) => i.panel))].sort((a, bb) => a - bb);
    const usable = p.h - m.t - m.b;
    const band = usable / panels.length;
    for (let bi = 0; bi < panels.length; bi++) {
      const inPanel = group.filter((i) => i.panel === panels[bi]);
      let x = m.l;
      let y = Math.round(m.t + bi * band);
      /* the last speech balloon placed in this panel, and who said it — a
         following line from the SAME character becomes a JOINED secondary
         bubble instead of a separate one, the way a letterer breaks one
         character's two sentences across connected balloons */
      let prev: { el: BalloonEl; speaker: string } | null = null;
      const bandTop = Math.round(m.t + bi * band);
      const bottom = p.h - m.b;
      for (const it of inPanel) {
        const lineCt = Math.max(1, Math.ceil(it.text.length / 26));
        let el: El;
        let joinToPrev: BalloonEl | null = null;
        if (it.kind === "sfx") {
          el = makeText(x, y, colW, Math.round(p.w * 0.16), true);
          const st = LETTER_STYLES.find((s) => s.name === activeStyleRef.current) || LETTER_STYLES[0];
          (el as TextEl).ts = applyLetterStyle((el as TextEl).ts, st);
          (el as TextEl).ts.outlineW = Math.round((el as TextEl).ts.size * st.outlineF);
          el.text = it.text;
          /* size the slab to the words, as the tray does — a fixed block
             clipped long effects and swam around short ones */
          sizeTextToContent(el as TextEl, p.w);
          prev = null; // an effect breaks a run of dialogue
        } else {
          /* every balloon kind the parser can name maps straight through;
             anything unexpected stays a speech balloon */
          const KINDS: BalloonKind[] = ["caption", "thought", "whisper", "shout", "double", "rough", "buzz", "burst2"];
          const kind = (KINDS.includes(it.kind as BalloonKind) ? it.kind : "speech") as BalloonKind;
          const h = clamp(Math.round(lineCt * p.w * 0.05 + p.w * 0.06), Math.round(p.w * 0.12), Math.round(p.h * 0.3));
          /* join to the previous bubble when the same NAMED character speaks
             again, or the script says so outright — (CONT'D) / (LINK) —
             never captions (not a character) and never a bare/■ SFX */
          const named = kind !== "caption" && !!it.speaker
            && !/^(SFX|SOUND|FX|CAPTION|CAP|NARRATION|NARR|BOX|TITLE)$/.test(it.speaker);
          joinToPrev = named && prev && (prev.speaker === it.speaker || it.link) ? prev.el : null;
          const bel = makeBalloon(kind, x, y, joinToPrev ? Math.round(colW * 0.9) : colW, h);
          bel.text = it.text;
          el = bel;
          prev = named ? { el: bel, speaker: it.speaker } : null;
        }
        /* FIT BEFORE PLACING: an item that would run off the bottom moves
           to the next column first; when the columns are used up it is
           pulled back up so it still sits on the page — anything placed
           below the page is invisible in the editor (the page clips at its
           edge) and printed only as a hairline at the bleed line */
        if (y + el.h > bottom && y > bandTop) {
          y = bandTop;
          x = x + colW + gap <= p.w - m.r - colW ? x + colW + gap : m.l;
        }
        if (y + el.h > bottom) y = Math.max(m.t, bottom - el.h);
        el.x = x; el.y = y;
        if (joinToPrev && el.type === "balloon") {
          el.attachTo = joinToPrev.id;
          /* the connector aims from this child's centre at the parent's;
             resolveBalloon turns that into the open band */
          const pcx = (joinToPrev.x + joinToPrev.w / 2) - (el.x + el.w / 2);
          const pcy = (joinToPrev.y + joinToPrev.h / 2) - (el.y + el.h / 2);
          el.tail = { dx: Math.round(pcx), dy: Math.round(pcy) };
        }
        p.els.push(el);
        count++;
        y += el.h + gap;
      }
    }
  }
  commit();
  rebuildThumbs();
  setShowScript(false);
  setScriptText("");
  setSelId(null);
  const spread = byPage.size;
  const kinds = new Map<string, number>();
  for (const it of items) kinds.set(it.kind, (kinds.get(it.kind) || 0) + 1);
  const recap = [...kinds.entries()].sort((a, bb) => bb[1] - a[1])
    .map(([k, n]) => `${n} ${k === "double" ? "radio" : k === "sfx" ? "SFX" : k}`).join(", ");
  setStatus(`Added ${count} item${count > 1 ? "s" : ""} (${recap}) across ${spread} page${spread > 1 ? "s" : ""}`
    + (madePages ? ` — ${madePages} new page${madePages > 1 ? "s" : ""} added.` : "."));
}

