/* Sentinel — the studio's bug-report instrumentation, client side.

   Keeps the last few runtime errors (uncaught exceptions, unhandled
   promise rejections, console.error calls) in a small ring buffer so a
   bug report can carry what actually went wrong, not just the reporter's
   memory of it. Nothing leaves the browser until the person presses Send. */

export interface ErrLine { t: number; msg: string }

const MAX = 40;
const ring: ErrLine[] = [];
let installed = false;

function push(msg: string) {
  const line = String(msg).replace(/\s+/g, " ").slice(0, 600);
  if (!line) return;
  const last = ring[ring.length - 1];
  if (last && last.msg === line && Date.now() - last.t < 2000) return;   // the same error in a loop
  ring.push({ t: Date.now(), msg: line });
  if (ring.length > MAX) ring.shift();
}

export function installErrorLog() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    const where = e.filename ? ` (${e.filename.split("/").pop()}:${e.lineno})` : "";
    push(`${e.message || "Script error"}${where}`);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    push("Unhandled: " + (r instanceof Error ? `${r.message}${r.stack ? " @ " + r.stack.split("\n")[1]?.trim() : ""}` : String(r)));
  });
  const orig = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      push("console.error: " + args.map((a) => (a instanceof Error ? a.message : typeof a === "string" ? a : JSON.stringify(a)?.slice(0, 200))).join(" "));
    } catch { /* never let logging throw */ }
    orig(...args);
  };
}

export function recentErrors(): ErrLine[] { return ring.slice(); }

/* which form of the app this is — the same code ships as all of them */
export function appForm(): string {
  if (typeof navigator === "undefined") return "server";
  const ua = navigator.userAgent;
  if (/LmcIOS|PWAShell/.test(ua)) return "ios-app";
  if (/Electron/.test(ua)) return "desktop-electron";
  const standalone = typeof window !== "undefined" &&
    (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
  if (standalone && /Android/.test(ua)) return "android-app";
  if (standalone) return "installed-pwa";
  return "browser";
}

export function layoutMode(): string {
  if (typeof window === "undefined") return "";
  const coarse = window.matchMedia?.("(pointer: coarse)").matches;
  if (window.innerWidth < 700) return "phone";
  if (coarse) return "tablet";
  return "desktop";
}

/* everything about the environment a bug lives in, as a flat record */
export function environmentInfo(): Record<string, string | number | boolean> {
  if (typeof window === "undefined") return {};
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { effectiveType?: string } };
  const mem = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  return {
    build: process.env.NEXT_PUBLIC_LMC_BUILD ?? "dev",
    url: location.pathname + location.search,
    form: appForm(),
    layout: layoutMode(),
    viewport: `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x`,
    screen: `${screen.width}×${screen.height}`,
    language: nav.language,
    platform: nav.platform,
    cores: nav.hardwareConcurrency ?? 0,
    deviceMemoryGB: nav.deviceMemory ?? 0,
    heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 0,
    online: nav.onLine,
    touch: nav.maxTouchPoints ?? 0,
    connection: nav.connection?.effectiveType ?? "",
  };
}
