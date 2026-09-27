/* One in-app text prompt for every "name this…" moment.

   window.prompt() is NOT available in every form the studio ships in: the
   Electron desktop wrapper throws on it (Save Project could never name a
   book there), and installed-app / TWA windows render it as a bare system
   sheet that ignores the page's fonts and keyboard focus. The dialog
   below is React state on the editor (`textAsk`), rendered by
   `renderTextAsk` in dialogs.tsx; Escape/backdrop resolve to null exactly
   like a cancelled prompt, so callers keep their `if (v === null) return`. */
import type { EditorCtx } from "./ctx";

export interface TextAsk {
  title: string;
  value: string;
  placeholder?: string;
  ok?: string;
  resolve: (value: string | null) => void;
}

export function askText(ed: Pick<EditorCtx, "setTextAsk">, title: string, value = "", opts: { placeholder?: string; ok?: string } = {}): Promise<string | null> {
  if (!ed.setTextAsk) {
    /* no editor state (unit context) — the browser's prompt is the fallback */
    try { return Promise.resolve(window.prompt(title, value)); } catch { return Promise.resolve(null); }
  }
  return new Promise((resolve) => ed.setTextAsk({ title, value, resolve, ...opts }));
}
