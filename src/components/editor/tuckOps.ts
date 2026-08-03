/* Tuck Back handler factory, split from Editor.tsx (1500-line cap).
   Rebuilt as plain closures every render — they live in the per-render
   EditorCtx bag, so callback identity doesn't matter. */
import type React from "react";
import { Assets, Doc, makeImage } from "@/lib/model";
import { encodeImage, samError, segmentBox } from "@/lib/sam";
import { TuckAsk, coverRect, tuckPreview } from "./tuck";
import { beginTuckLasso } from "./tuckDrag";
import { facingOffset } from "./spreadOps";
import { nextAid } from "./ops";
import type { EditorCtx } from "./ctx";

type SetTuckAsk = (v: TuckAsk | null | ((t: TuckAsk | null) => TuckAsk | null)) => void;

export interface TuckDeps {
  docRef: React.RefObject<Doc | null>;
  assetsRef: React.RefObject<Assets>;
  pageIndexRef: React.RefObject<number>;
  pageDivRef: React.RefObject<HTMLDivElement | null>;
  tuckPtsRef: React.RefObject<number[][] | null>;
  tuckAskRef: React.RefObject<TuckAsk | null>;
  selId: string | null;
  zoom: number;
  pagePoint: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  force: () => void;
  commit: () => void;
  rebuildThumbs: () => void;
  setStatus: (s: string) => void;
  setTuckMode: (v: boolean) => void;
  setTuckAsk: SetTuckAsk;
  /* persist a generated cutout into the artwork store (Editor-local) */
  keepGenerated: (aid: string, dataUrl: string) => void;
  /* for nextAid — read at call time, so the latest ctx bag is used */
  getEd: () => EditorCtx;
}

export function makeTuckHandlers(d: TuckDeps) {
  const startTuck = () => {
    const s = d.docRef.current?.pages[d.pageIndexRef.current].els.find((x) => x.id === d.selId);
    if (!s || s.type !== "text") {
      d.setStatus("Select your SFX lettering first, then Tuck Back.");
      return;
    }
    d.setTuckMode(true);
    d.setStatus("Draw around the art the SFX should hide behind — Esc cancels.");
  };

  const startTuckDrag = (e: React.PointerEvent) => {
    /* spread view: hand the lasso the facing page and where it sits on
       screen, so the trace can sweep across the spine and cut the facing
       page's art */
    beginTuckLasso({
      docRef: d.docRef, assetsRef: d.assetsRef, pageIndexRef: d.pageIndexRef,
      ptsRef: d.tuckPtsRef,
      pagePoint: d.pagePoint, zoom: d.zoom, force: d.force,
      setStatus: d.setStatus, setTuckMode: d.setTuckMode, setTuckAsk: d.setTuckAsk,
      facing: facingOffset(d.pageDivRef.current, d.zoom),
    }, e);
  };

  const retuneTuck = (patch: Partial<TuckAsk>) => {
    d.setTuckAsk((t) => {
      if (!t) return t;
      const next = { ...t, ...patch };
      return { ...next, preview: tuckPreview(next) };
    });
  };

  /* The model route, on demand — it costs seconds on the first page, so it is
     no longer run behind the reader's back for every trace. */
  const runTuckAuto = () => {
    d.setTuckAsk((t) => t && { ...t, auto: "busy", preview: null });
    (async () => {
      const t = d.tuckAskRef.current;
      if (!t) return;
      d.setStatus("Reading the artwork…");
      const emb = await encodeImage(t.artKey, t.src.img, (_, note) => d.setStatus(note));
      /* the trace is in element-local page units; the mask wants source pixels */
      const cm = coverRect(t.src);
      const mask = emb && await segmentBox(emb, cm.sx, cm.sy, cm.sx + cm.sw, cm.sy + cm.sh);
      if (!mask) {
        d.setStatus(samError()
          ? "Auto-detect isn't available in this browser — use your outline."
          : "Auto-detect found nothing there — use your outline.");
        d.setTuckAsk((p) => p && { ...p, auto: "fail" });
        return;
      }
      d.setStatus("Foreground detected — place it, or go back to your outline.");
      d.setTuckAsk((p) => {
        if (!p) return p;
        const next: TuckAsk = { ...p, mask, auto: "done" };
        return { ...next, preview: tuckPreview(next) };
      });
    })();
  };

  /* side effects OUTSIDE the state updater — React StrictMode double-invokes
     updaters, which would place the cutout twice */
  const applyTuck = (t: TuckAsk | null) => {
    d.setTuckAsk(null);
    if (!t || !t.preview) return;
    const aid = nextAid(d.getEd());
    /* show it at once, and put it in the artwork store so the tuck is still
       there after a refresh — assetsRef alone is not persisted */
    d.assetsRef.current[aid] = t.preview;
    d.keepGenerated(aid, t.preview);
    const el = makeImage(t.pageX, t.pageY, t.pageW, t.pageH, aid);
    el.borderW = 0;
    el.cut = true;              // so the next pass traces the art, not this
    /* a cross-spine trace cut the FACING page's art — the cutout lives there */
    const doc = d.docRef.current!;
    const tp = Math.min(Math.max(0, t.targetPage ?? d.pageIndexRef.current), doc.pages.length - 1);
    doc.pages[tp].els.push(el); // topmost → art in front
    d.commit();
    if (tp !== d.pageIndexRef.current) d.rebuildThumbs(); // facing preview shows it
    /* A word is normally tucked a letter at a time, so stay armed: the reader
       traces the next letter straight away instead of going back to the
       toolbar between every one. */
    d.setTuckMode(true);
    d.setStatus(tp !== d.pageIndexRef.current
      ? `Cutout placed on page ${tp + 1} — draw around the next letter, or press Esc when done.`
      : "Cutout placed — draw around the next letter, or press Esc when the word is done.");
  };

  return { startTuck, startTuckDrag, retuneTuck, runTuckAuto, applyTuck };
}
