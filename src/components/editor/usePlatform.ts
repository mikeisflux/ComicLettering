"use client";
/* Platform / OS integration hooks, split from Editor.tsx (1500-line cap):
   tablet pinch-zoom on the workspace, the PWA install prompt behind
   File → Install as App…, and the file-open bridge that installed-app
   launches (manifest file_handlers) and the desktop wrapper (/desktop)
   use to hand .lmc files to the studio. */
import { useCallback, useEffect, useRef } from "react";
import { clamp } from "@/lib/model";
import { EditorCtx } from "./ctx";
import { importJSON } from "./ops";
import { dragInProgress, dragOwnerId, rejectPalm } from "./penInput";

/* The editor owns every touch gesture on the workspace (the canvas is
   touch-action: none — with native pan the browser scroll-claimed the
   first finger and then SUPPRESSED the second finger's events entirely,
   so a real two-finger pinch never reached this hook; that was the
   reported "pinch doesn't work" bug):
   - one finger on empty workspace PANS it (re-implemented here);
   - one finger on an element drags it (the drag tools, untouched here);
   - two fingers ANYWHERE pinch-zoom, anchored under the fingers. When the
     first finger already started an element drag (on a zoomed-in tablet a
     finger always lands on something), the second finger converts the
     gesture: the drag is cancelled — the drag hook reverts the partial
     move — and the two fingers zoom instead. */
export function usePinchZoom(
  areaRef: { current: HTMLDivElement | null },
  zoom: number,
  setZoom: (z: number) => void,
  setUserZoomed: (v: boolean) => void,
  /* the editor's FIRST render is the loading screen, so a run-once effect
     fires while areaRef is still null and the listeners never attach —
     pinch was dead everywhere. The caller flips this once the canvas is
     really mounted and the effect re-runs against the live element. */
  ready = true,
) {
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const pts = new Map<number, { x: number; y: number }>();
    let baseDist = 0, baseZoom = 1, baseDoc = { x: 0, y: 0 };
    let pan: { x: number; y: number } | null = null;
    const mid = () => {
      const [a, b] = [...pts.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      if (rejectPalm(e)) return;   // no palm-pinch while the pen is working
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        /* may become a one-finger pan — it only pans if no tool claims the
           pointer (move() checks dragInProgress on every frame) */
        pan = { x: e.clientX, y: e.clientY };
      } else if (pts.size === 2) {
        /* two fingers = pinch, no matter what they landed on. A drag the
           first finger started hands the gesture over: cancelling it makes
           the drag hook revert the element and release the claim. */
        pan = null;
        const owner = dragOwnerId();
        if (owner !== null) {
          window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: owner }));
        }
        const [a, b] = [...pts.values()];
        baseDist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        baseZoom = zoomRef.current;
        const r = area.getBoundingClientRect();
        const m = mid();
        /* document-space point currently under the finger midpoint */
        baseDoc = {
          x: (area.scrollLeft + m.x - r.left) / baseZoom,
          y: (area.scrollTop + m.y - r.top) / baseZoom,
        };
      }
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId)!;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        /* one finger on the workspace pans it — unless a tool owns the
           pointer (element drag, sketch, lasso), which takes precedence */
        if (pan && !dragInProgress()) {
          area.scrollLeft -= e.clientX - prev.x;
          area.scrollTop -= e.clientY - prev.y;
        }
        return;
      }
      if (pts.size !== 2) return;
      const [a, b] = [...pts.values()];
      const z = clamp(baseZoom * (Math.hypot(a.x - b.x, a.y - b.y) / baseDist), 0.05, 4);
      setUserZoomed(true);
      setZoom(z);
      /* keep the same document point under the (possibly moving) midpoint */
      requestAnimationFrame(() => {
        const r = area.getBoundingClientRect();
        const m = mid();
        area.scrollLeft = baseDoc.x * z - (m.x - r.left);
        area.scrollTop = baseDoc.y * z - (m.y - r.top);
      });
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) baseDist = 0;
      if (pts.size === 0) pan = null;
    };
    /* belt & braces: the canvas is touch-action none, but any browser that
       still tries to claim a two-finger gesture (viewport pinch) is told no */
    const tm = (e: TouchEvent) => { if (pts.size === 2 && e.cancelable) e.preventDefault(); };
    area.addEventListener("pointerdown", down);
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerup", up);
    area.addEventListener("pointercancel", up);
    area.addEventListener("touchmove", tm, { passive: false });
    return () => {
      area.removeEventListener("pointerdown", down);
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerup", up);
      area.removeEventListener("pointercancel", up);
      area.removeEventListener("touchmove", tm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
}

/* Browsers only offer "Install app" quietly (an address-bar icon or a
   buried menu item), so surface it: capture the install prompt and fire it
   from the Install button / File → Install as App…. Where no native prompt
   exists (Firefox, Safari, or Chromium withholding it), the click opens a
   VISIBLE step-by-step dialog — the old status-line hint sat unnoticed at
   the bottom of the screen, which read as the button "doing nothing". */
export function useInstallPrompt(setStatus: (s: string) => void, openHelp: () => void): () => void {
  const installEvtRef = useRef<(Event & {
    prompt: () => Promise<void>;
    userChoice?: Promise<{ outcome: string }>;
  }) | null>(null);
  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      installEvtRef.current = e as Event & { prompt: () => Promise<void> };
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);
  return useCallback(() => {
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setStatus("LetterMyComic is already installed — you're running the app now.");
      return;
    }
    const ev = installEvtRef.current;
    if (ev) {
      /* a captured prompt is single-use — clear it so a second click falls
         through to the help dialog instead of failing silently */
      installEvtRef.current = null;
      ev.prompt().catch(() => openHelp());
      return;
    }
    openHelp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* Installed-app file handling: when LetterMyComic is installed as an app,
   the OS hands double-clicked .lmc files here (see file_handlers in
   src/app/manifest.ts) — open them straight into the studio. The desktop
   wrapper feeds files through window.lmcOpenProject. */
export function useOpenFileBridge(ed: EditorCtx) {
  const edRef = useRef<EditorCtx>(ed);
  edRef.current = ed;
  useEffect(() => {
    (window as unknown as { lmcOpenProject?: (text: string, name?: string) => void }).lmcOpenProject =
      (text, name = "project.lmc") => {
        importJSON(edRef.current, new File([text], name, { type: "application/x-lettermycomic" }));
      };
    const lq = (window as unknown as {
      launchQueue?: { setConsumer: (cb: (p: { files?: { getFile: () => Promise<File> }[] }) => void) => void };
    }).launchQueue;
    if (!lq) return;
    lq.setConsumer(async (params) => {
      const fh = params.files?.[0];
      if (!fh) return;
      try { await importJSON(edRef.current, await fh.getFile()); } catch { /* bad file — importJSON reports */ }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
