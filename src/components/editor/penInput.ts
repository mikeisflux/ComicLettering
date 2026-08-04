"use client";
/* Pen-first tablet input: palm rejection shared by EVERY stroke tool
   (element drags, balloon sketching, the Tuck Back lasso, pinch-zoom).

   Two rules make a stylus feel right on iPad/Android tablets:

   1. While a pen is near the screen, finger/palm touches are noise. A
      global capture listener notes every pen contact (and hover — pens
      report hover moves), and for a short window afterwards touch
      pointers are rejected before they can start a stroke or a pinch.
   2. A stroke belongs to the pointer that started it. Every tool's
      window-level move/up handlers filter on the starting pointerId, so
      a palm landing mid-stroke can neither bend the line nor end it. */

let penUntil = 0;
const PEN_LINGER_MS = 800;

const note = (e: PointerEvent) => {
  if (e.pointerType === "pen") penUntil = performance.now() + PEN_LINGER_MS;
};

/* module-level init: the tracker exists before any tool can fire */
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", note, true);
  window.addEventListener("pointermove", note, true);
  /* backstop: if the owning pointer ends and its tool somehow never
     released the claim (listener leak, thrown handler), release it here
     so input can never get stuck dead. Bubble phase — the tools' own
     handlers run first. */
  window.addEventListener("pointerup", (e) => releaseDrag(e.pointerId));
  window.addEventListener("pointercancel", (e) => releaseDrag(e.pointerId));
  /* Android long-press fires contextmenu — mid-drag that popped the menu
     under a held finger. Ignore it while any drag is running. */
  window.addEventListener("contextmenu", (e) => {
    if (dragOwner !== null) e.preventDefault();
  }, true);
}

/* true → this pointerdown is a palm resting near the pen; ignore it */
export function rejectPalm(e: { pointerType?: string }): boolean {
  if (e.pointerType === "pen") { penUntil = performance.now() + PEN_LINGER_MS; return false; }
  return e.pointerType === "touch" && performance.now() < penUntil;
}

/* ---- double-tap detection ----
   Touch double-taps are supposed to synthesize dblclick, but browsers
   swallow them unevenly (double-tap-zoom heuristics, Safari). Tools that
   open on double-click call this from pointerdown as a reliable fallback:
   same key, two touch taps within 350ms and 30px = a double tap. */
const lastTap = new Map<string, { t: number; x: number; y: number }>();
export function isDoubleTap(key: string, e: { pointerType?: string; clientX: number; clientY: number }): boolean {
  if (e.pointerType !== "touch") return false;
  const now = performance.now();
  const prev = lastTap.get(key);
  lastTap.set(key, { t: now, x: e.clientX, y: e.clientY });
  if (lastTap.size > 40) lastTap.delete(lastTap.keys().next().value!);
  return !!prev && now - prev.t < 350 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30;
}

/* ---- drag exclusivity ----
   One gesture at a time: while a drag (move/resize/tail/warp/lasso/sketch)
   is running, no other pointer may start a second drag or a pinch-zoom.
   Without this, a second fingertip or the heel of a hand resting on the
   tablet starts its own move/pan DURING a resize — the element resizes
   and slides at the same time. */
let dragOwner: number | null = null;
export function claimDrag(pointerId: number): boolean {
  if (dragOwner !== null) return false;   // someone else is mid-drag
  dragOwner = pointerId;
  return true;
}
export function releaseDrag(pointerId: number) {
  if (dragOwner === pointerId) dragOwner = null;
}
export const dragInProgress = () => dragOwner !== null;
