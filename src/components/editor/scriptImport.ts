/* Script import — split from ops.ts (1500-line cap). A comic script
   becomes balloons laid out per page and panel; ops.ts re-exports it so
   every call site is unchanged. */
import {
  BalloonEl, BalloonKind, El, TextEl, clamp, makeBalloon, makeText, newPage, pageMargins,
} from "@/lib/model";
import { LETTER_STYLES, applyLetterStyle } from "@/lib/presets";
import { parseScript } from "@/lib/scriptParse";
import { EditorCtx } from "./ctx";
import { sizeTextToContent } from "./ops";

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
      for (const it of inPanel) {
        const lineCt = Math.max(1, Math.ceil(it.text.length / 26));
        let el: El;
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
          const joinToPrev = named && prev && (prev.speaker === it.speaker || it.link);
          const bel = makeBalloon(kind, x, y, joinToPrev ? Math.round(colW * 0.9) : colW, h);
          bel.text = it.text;
          if (joinToPrev && prev) {
            bel.attachTo = prev.el.id;
            /* the connector aims from this child's centre at the parent's;
               resolveBalloon turns that into the open band */
            const pcx = (prev.el.x + prev.el.w / 2) - (bel.x + bel.w / 2);
            const pcy = (prev.el.y + prev.el.h / 2) - (bel.y + bel.h / 2);
            bel.tail = { dx: Math.round(pcx), dy: Math.round(pcy) };
          }
          el = bel;
          prev = named ? { el: bel, speaker: it.speaker } : null;
        }
        p.els.push(el);
        count++;
        y += el.h + gap;
        /* a talky panel spills into the second column rather than over the
           next panel's balloons */
        if (y > p.h - m.b) {
          y = Math.round(m.t + bi * band);
          x = x + colW + gap <= p.w - m.r - colW ? x + colW + gap : m.l;
        }
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

