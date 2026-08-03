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
}

/* true → this pointerdown is a palm resting near the pen; ignore it */
export function rejectPalm(e: { pointerType?: string }): boolean {
  if (e.pointerType === "pen") { penUntil = performance.now() + PEN_LINGER_MS; return false; }
  return e.pointerType === "touch" && performance.now() < penUntil;
}
