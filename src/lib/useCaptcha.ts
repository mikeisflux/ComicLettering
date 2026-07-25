"use client";
/* reCAPTCHA v3 client hook: loads the script only when a site key is
   configured, and hands back tokens per action. */
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

export function useCaptcha() {
  const siteKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { siteKey } = await fetch("/api/captcha").then((r) => r.json());
        if (cancelled || !siteKey) return;
        siteKeyRef.current = siteKey;
        if (!document.getElementById("recaptcha-v3")) {
          const s = document.createElement("script");
          s.id = "recaptcha-v3";
          s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
          document.head.appendChild(s);
        }
      } catch { /* captcha optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  return async function getToken(action: string): Promise<string | null> {
    const key = siteKeyRef.current;
    if (!key || !window.grecaptcha) return null;
    try {
      await new Promise<void>((res) => window.grecaptcha!.ready(res));
      return await window.grecaptcha.execute(key, { action });
    } catch { return null; }
  };
}
