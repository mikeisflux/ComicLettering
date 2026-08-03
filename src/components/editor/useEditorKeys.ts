"use client";
/* The global keyboard map, split from Editor.tsx (1500-line cap).

   One listener for the whole session: deps are re-supplied every render into
   a ref and destructured per keydown, so every shortcut always runs the
   CURRENT render's closures — the stale-closure bugs this design exists for
   (Ctrl+S re-creating projects, Ctrl+V pasting onto a previously viewed
   page) cannot come back. */
import React, { useEffect, useRef } from "react";
import { Doc, clamp } from "@/lib/model";
import { toggleEmphasis } from "./textHelpers";
import type { TuckAsk } from "./tuck";

/* the per-render shortcut handlers Editor refreshes into keyFnsRef */
export interface KeyFns {
  duplicateSel: () => void; saveProject: (b: boolean) => void;
  copySel: () => void; cutSel: () => void; pasteClip: () => void;
  alignSel: (m: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => void;
  addFromTray: (k: string) => void; deleteSel: () => void;
  setLocked: (v: boolean) => void;
  finishEditing: () => void; reorder: (d: number) => void;
  fitBalloonToText: () => void; printPage: () => void;
  duplicatePage: () => void;
}

interface Ref<T> { current: T }

export interface EditorKeyDeps {
  demo: boolean;
  selId: string | null;
  editingId: string | null;
  docRef: Ref<Doc | null>;
  pageIndexRef: Ref<number>;
  selIdsRef: Ref<string[]>;
  keyFnsRef: Ref<KeyFns>;
  modalOpenRef: Ref<boolean>;
  drawPtsRef: Ref<number[][] | null>;
  tuckPtsRef: Ref<number[][] | null>;
  dragTipRef: Ref<{ x: number; y: number; w: number; h: number; mode: string; live: boolean } | null>;
  thumbTimer: Ref<ReturnType<typeof setTimeout> | null>;
  setDrawMode: (v: boolean) => void;
  setTuckMode: (v: boolean) => void;
  setTuckAsk: (t: TuckAsk | null) => void;
  setSelId: (v: string | null) => void;
  setPageIndex: React.Dispatch<React.SetStateAction<number>>;
  setUserZoomed: (v: boolean) => void;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setShowFind: (v: boolean) => void;
  setShowExport: (v: boolean) => void;
  setStatus: (s: string) => void;
  select: (id: string | null, additive?: boolean) => void;
  selectAllOnPage: () => void;
  finishEditing: () => void;
  undo: () => void;
  redo: () => void;
  fitZoom: (force: boolean) => void;
  force: () => void;
  commit: () => void;
}

export function useEditorKeys(deps: EditorKeyDeps) {
  const ref = useRef(deps);
  ref.current = deps;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const {
        demo, selId, editingId, docRef, pageIndexRef, selIdsRef, keyFnsRef,
        modalOpenRef, drawPtsRef, tuckPtsRef, dragTipRef, thumbTimer,
        setDrawMode, setTuckMode, setTuckAsk, setSelId, setPageIndex,
        setUserZoomed, setZoom, setShowFind, setShowExport, setStatus,
        select, selectAllOnPage, finishEditing, undo, redo, fitZoom, force, commit,
      } = ref.current;
      const t = e.target as HTMLElement;
      const inField = t.closest?.("input, select, textarea") || t.isContentEditable;
      if (e.key === "Escape") {
        setDrawMode(false);
        drawPtsRef.current = null;
        setTuckMode(false);
        tuckPtsRef.current = null;
        setTuckAsk(null);
        if (editingId) finishEditing();
        else setSelId(null);
        return;
      }
      /* take Ctrl+B / Ctrl+I over from the browser while lettering is being
         edited — its own handling strands the caret inside the run it just
         closed (see toggleEmphasis) */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && t.isContentEditable &&
          ["b", "i", "u"].includes(e.key.toLowerCase())) {
        const kind = e.key.toLowerCase() === "b" ? "bold" : e.key.toLowerCase() === "i" ? "italic" : "underline";
        if (toggleEmphasis(t, kind)) e.preventDefault();
        return;
      }
      if (inField) return;
      /* A modal is open (Export, Find, Script, Page Setup, gradient maker,
         the tuck dialog, the tail chooser). Its own inputs are covered by
         `inField` above, but with focus on the backdrop the canvas
         shortcuts below would still fire — Delete would remove the element
         behind the dialog, B/T/L/P would add one. Block them. */
      if (modalOpenRef.current) return;
      const fns = keyFnsRef.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); fns.duplicateSel(); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); fns.saveProject(false); return; }
      if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); fns.copySel(); return; }
      if (mod && e.key.toLowerCase() === "x") { e.preventDefault(); fns.cutSel(); return; }
      if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); fns.pasteClip(); return; }
      if (mod && e.key === "[" && !e.shiftKey) { e.preventDefault(); fns.alignSel("hcenter"); return; }
      if (mod && e.key === "]" && !e.shiftKey) { e.preventDefault(); fns.alignSel("vcenter"); return; }
      /* selection */
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (e.shiftKey) setSelId(null); else selectAllOnPage();
        return;
      }
      /* stacking order — Shift with the bracket keys, as everywhere else */
      if (mod && e.shiftKey && (e.key === "]" || e.key === "}")) { e.preventDefault(); fns.reorder(1e9); return; }
      if (mod && e.shiftKey && (e.key === "[" || e.key === "{")) { e.preventDefault(); fns.reorder(-1e9); return; }
      if (mod && !e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault(); fns.setLocked(true);
        setStatus("Locked. Ctrl+Shift+L unlocks."); return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault(); fns.setLocked(false);
        setStatus("Unlocked."); return;
      }
      /* view */
      if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); setUserZoomed(true); setZoom((z) => clamp(z * 1.2, 0.05, 4)); return; }
      if (mod && e.key === "-") { e.preventDefault(); setUserZoomed(true); setZoom((z) => clamp(z / 1.2, 0.05, 4)); return; }
      if (mod && e.key === "0") { e.preventDefault(); setUserZoomed(false); fitZoom(true); return; }
      /* document */
      if (mod && e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); fns.saveProject(true); return; }
      if (mod && e.key.toLowerCase() === "f") { e.preventDefault(); setShowFind(true); return; }
      if (mod && e.key.toLowerCase() === "p") { e.preventDefault(); fns.printPage(); return; }
      if (mod && e.key.toLowerCase() === "e") { e.preventDefault(); if (!demo) setShowExport(true); return; }
      if (mod && e.shiftKey && e.key.toLowerCase() === "n") { e.preventDefault(); fns.duplicatePage(); return; }
      /* page navigation */
      if (!mod && (e.key === "PageDown" || e.key === "PageUp")) {
        e.preventDefault();
        const n = docRef.current!.pages.length;
        setPageIndex((i) => clamp(e.key === "PageDown" ? i + 1 : i - 1, 0, n - 1));
        setSelId(null);
        return;
      }
      /* step through what is on the page — faster than hunting with the mouse
         for something buried under artwork */
      if (!mod && e.key === "Tab") {
        /* only cycle page elements when focus is loose on the canvas — if a
           toolbar button or link has focus, leave Tab to move between them */
        if (t.closest("button, a, select, [tabindex]")) return;
        e.preventDefault();
        const els = docRef.current!.pages[pageIndexRef.current].els;
        if (!els.length) return;
        const at = els.findIndex((x) => x.id === selId);
        const next = e.shiftKey
          ? (at <= 0 ? els.length - 1 : at - 1)
          : (at < 0 || at === els.length - 1 ? 0 : at + 1);
        select(els[next].id);
        return;
      }
      /* letterer hotkeys: B balloon, T text, L lettering, P panel */
      if (!mod && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "b") { e.preventDefault(); fns.addFromTray("speech"); return; }
        if (k === "t") { e.preventDefault(); fns.addFromTray("text"); return; }
        if (k === "l") { e.preventDefault(); fns.addFromTray("sfx"); return; }
        if (k === "p") { e.preventDefault(); fns.addFromTray("panel"); return; }
      }
      const d = docRef.current!;
      const p = d.pages[pageIndexRef.current];
      const el = p.els.find((x) => x.id === selId);
      if (!el) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); fns.deleteSel(); return; }
      /* micro-nudge: 1 page unit per press (~0.1mm in print), Shift = 10.
         At a fit zoom a single unit is sub-pixel on screen, which used to
         read as "arrows do nothing" — so the drag's coordinate tip pops up
         as visible confirmation of every nudge. */
      const step = e.shiftKey ? 10 : 1;
      const dxy: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      if (dxy[e.key]) {
        e.preventDefault();
        /* nudges the whole selection, skipping anything locked */
        let any = false;
        for (const id of selIdsRef.current) {
          const t2 = p.els.find((x) => x.id === id);
          if (!t2 || t2.locked) continue;
          t2.x += dxy[e.key][0]; t2.y += dxy[e.key][1];
          any = true;
        }
        if (!any) return;
        const lead = p.els.find((x) => x.id === selId);
        if (lead) {
          const tip = { x: lead.x, y: lead.y, w: lead.w, h: lead.h, mode: "move", live: true };
          dragTipRef.current = tip;
          setTimeout(() => {
            if (dragTipRef.current === tip) { dragTipRef.current = null; force(); }
          }, 900);
        }
        force();
        if (thumbTimer.current) clearTimeout(thumbTimer.current);
        thumbTimer.current = setTimeout(commit, 400);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
