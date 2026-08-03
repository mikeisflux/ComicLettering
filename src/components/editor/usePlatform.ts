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
import { rejectPalm } from "./penInput";

/* Two fingers on the workspace background pinch-zoom the page, anchored
   under the fingers (and panning with them). Single-finger touch still
   scrolls the workspace natively (touch-action: pan-x pan-y in CSS), and
   element drags are untouched — only pointers that start on empty
   workspace count. */
export function usePinchZoom(
  areaRef: { current: HTMLDivElement | null },
  zoom: number,
  setZoom: (z: number) => void,
  setUserZoomed: (v: boolean) => void,
) {
  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const pts = new Map<number, { x: number; y: number }>();
    let baseDist = 0, baseZoom = 1, baseDoc = { x: 0, y: 0 };
    const onBg = (t: EventTarget | null) =>
      t instanceof Element && !t.closest(".el") && !t.closest(".overlay") && !t.closest(".bandOverlay");
    const mid = () => {
      const [a, b] = [...pts.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !onBg(e.target)) return;
      if (rejectPalm(e)) return;   // no palm-pinch while the pen is working
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
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
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
    const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) baseDist = 0; };
    area.addEventListener("pointerdown", down);
    area.addEventListener("pointermove", move);
    area.addEventListener("pointerup", up);
    area.addEventListener("pointercancel", up);
    return () => {
      area.removeEventListener("pointerdown", down);
      area.removeEventListener("pointermove", move);
      area.removeEventListener("pointerup", up);
      area.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/* Browsers only offer "Install app" quietly (an address-bar icon or a
   buried menu item), so surface it: capture the install prompt and expose
   it as File → Install as App…, with honest per-platform guidance where
   the prompt API doesn't exist (Safari, Firefox). */
export function useInstallPrompt(setStatus: (s: string) => void): () => void {
  const installEvtRef = useRef<(Event & { prompt: () => Promise<void> }) | null>(null);
  useEffect(() => {
    const onBip = (e: Event) => { e.preventDefault(); installEvtRef.current = e as Event & { prompt: () => Promise<void> }; };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);
  return useCallback(() => {
    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setStatus("LetterMyComic is already installed — you're running the app now.");
      return;
    }
    const ev = installEvtRef.current;
    if (ev) { ev.prompt(); return; }
    const ua = navigator.userAgent;
    setStatus(/iPhone|iPad|iPod/.test(ua)
      ? "On iPhone/iPad: tap Share, then “Add to Home Screen”."
      : /Mac/.test(ua) && /Safari/.test(ua) && !/Chrome|Edg/.test(ua)
        ? "In Safari: File → Add to Dock installs LetterMyComic as an app."
        : "In Chrome or Edge: look for the install icon at the right end of the address bar, or the browser menu → “Install LetterMyComic”. Installing also gives .lmc project files the app's icon.");
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
