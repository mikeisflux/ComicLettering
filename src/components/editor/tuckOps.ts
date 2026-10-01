/* Tuck Back handler factory, split from Editor.tsx (1500-line cap).
   Rebuilt as plain closures every render — they live in the per-render
   EditorCtx bag, so callback identity doesn't matter. */
import type React from "react";
import { Assets, Doc, makeImage } from "@/lib/model";
import { encodeImage, samError, segmentBox } from "@/lib/sam";
import { TuckAsk, coverRect, tuckPreview } from "./tuck";
import { beginTuckLasso, buildTuckAsk } from "./tuckDrag";
import { facingOffset } from "./spreadOps";
import { nextAid } from "./ops";
import type { EditorCtx } from "./ctx";
import { placeActionLines } from "./actionOps";

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
  /* which trace tool the reader picked on the toolbar (magnet or nib) */
  getTool: () => "lasso" | "pen";
  /* for nextAid — read at call time, so the latest ctx bag is used */
  getEd: () => EditorCtx;
  /* what the armed trace is FOR: a Tuck Back cutout, or Instaction lines */
  purposeRef: React.RefObject<"tuck" | "action">;
  setTracePurpose: (p: "tuck" | "action") => void;
  pendingLockRef: React.RefObject<Set<string>>;
  setSelId: (id: string | null) => void;
  setPageIndex: (i: number) => void;
  showTab: (k: "inspector") => void;
}

export function makeTuckHandlers(d: TuckDeps) {
  const startTuck = () => {
    const s = d.docRef.current?.pages[d.pageIndexRef.current].els.find((x) => x.id === d.selId);
    /* anything made of lettering can be tucked behind the art: SFX
       lettering, word balloons AND caption/text boxes (a user request —
       this was text-only). The cutout goes on top of the page, so the
       pipeline downstream is the same for all of them. */
    if (!s || (s.type !== "text" && s.type !== "balloon")) {
      d.setStatus("Select the lettering, balloon or text box to tuck first, then Tuck Back.");
      return;
    }
    (d.purposeRef as { current: "tuck" | "action" }).current = "tuck";
    d.setTracePurpose("tuck");
    d.setTuckMode(true);
    d.setStatus(d.getTool() === "pen"
      ? "Tuck Back pen: click around the art this should hide behind — click-and-drag curves a point, close on your first point (Enter closes, Ctrl+Z removes a point, Esc cancels)."
      : "Draw around the art this should hide behind — the lasso snaps to the art's edges, hold Alt for freehand. Esc cancels.");
  };

  /* Instaction: the same lasso/pen, armed for action lines instead of a
     cutout. Needs no selection — the object is whatever gets traced. */
  const startInstaction = () => {
    (d.purposeRef as { current: "tuck" | "action" }).current = "action";
    d.setTracePurpose("action");
    d.setTuckMode(true);
    d.setStatus(d.getTool() === "pen"
      ? "Instaction pen: click around the object that gets action lines — close on your first point (Enter closes, Esc cancels)."
      : "Instaction: draw around the object that gets action lines — the lasso snaps to the art's edges, hold Alt for freehand. Esc cancels.");
  };
  const actionDeps = () => ({
    docRef: d.docRef, pageIndexRef: d.pageIndexRef, pendingLockRef: d.pendingLockRef,
    commit: d.commit, rebuildThumbs: d.rebuildThumbs, setSelId: d.setSelId, setPageIndex: d.setPageIndex, setStatus: d.setStatus,
    setTuckMode: d.setTuckMode, showTab: d.showTab,
    facing: facingOffset(d.pageDivRef.current, d.zoom),
  });

  /* spread view: hand the trace the facing page and where it sits on
     screen, so it can sweep across the spine and cut the facing page's art */
  const dragDeps = () => ({
    ...(d.purposeRef.current === "action" ? { onRing: (ring: number[][]) => placeActionLines(actionDeps(), ring) } : {}),
    docRef: d.docRef, assetsRef: d.assetsRef, pageIndexRef: d.pageIndexRef,
    ptsRef: d.tuckPtsRef,
    pagePoint: d.pagePoint, zoom: d.zoom, force: d.force,
    setStatus: d.setStatus, setTuckMode: d.setTuckMode, setTuckAsk: d.setTuckAsk,
    facing: facingOffset(d.pageDivRef.current, d.zoom),
  });

  const startTuckDrag = (e: React.PointerEvent) => beginTuckLasso(dragDeps(), e);

  /* the PEN route: a closed anchor path (flattened, exact — no hand-shake
     smoothing) drops into the same pipeline the lasso feeds */
  const finishTuckPen = async (body: number[][]) => {
    d.setTuckMode(false);
    if (d.purposeRef.current === "action") { placeActionLines(actionDeps(), body); d.force(); return; }
    const ask = await buildTuckAsk(dragDeps(), body, false);
    if (ask) d.setTuckAsk(ask);
    d.force();
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

  return { startTuck, startInstaction, startTuckDrag, finishTuckPen, retuneTuck, runTuckAuto, applyTuck };
}
