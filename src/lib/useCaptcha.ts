"use client";
/* reCAPTCHA v3 client hook: loads the script only when a site key is
   configured, and hands back tokens per action.

   Failure modes matter here — this hook gates SIGNUP. A fast first submit
   used to race both the config fetch and the script load and go to the
   server tokenless ("Captcha token missing"), and a user whose ad blocker
   blocks google.com/recaptcha could never sign up and never learned why.
   getToken now awaits the config, waits for the script, and throws a
   plain-language, actionable error when the check genuinely can't run. */
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      execute: (siteKey: string, opts: { action: string }) => Promise<string>;
    };
  }
}

const BLOCKED_MSG =
  "We couldn't load the sign-up check (Google reCAPTCHA) — an ad or privacy " +
  "blocker may be blocking it. Allow google.com/recaptcha for this site, or " +
  "try another browser, then submit again.";

export function useCaptcha() {
  /* resolves to the site key, or null when captcha is disabled */
  const configRef = useRef<Promise<string | null> | null>(null);

  const loadConfig = () => {
    if (!configRef.current) {
      configRef.current = (async () => {
        try {
          const { siteKey } = await fetch("/api/captcha").then((r) => r.json());
          if (!siteKey) return null;
          if (!document.getElementById("recaptcha-v3")) {
            const s = document.createElement("script");
            s.id = "recaptcha-v3";
            s.async = true;
            s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
            document.head.appendChild(s);
          }
          return siteKey as string;
        } catch {
          /* config endpoint unreachable — treat as disabled; the server
             makes the final call either way */
          return null;
        }
      })();
    }
    return configRef.current;
  };

  useEffect(() => {
    loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return async function getToken(action: string): Promise<string | null> {
    const key = await loadConfig();
    if (!key) return null; // captcha not configured — server allows this
    /* the script loads async after the page — wait for it (up to 6s)
       instead of failing a fast first submit */
    for (let i = 0; i < 48 && !window.grecaptcha; i++) {
      await new Promise((r) => setTimeout(r, 125));
    }
    if (!window.grecaptcha) throw new Error(BLOCKED_MSG);
    try {
      await new Promise<void>((res) => window.grecaptcha!.ready(res));
      return await window.grecaptcha.execute(key, { action });
    } catch {
      throw new Error("The sign-up check didn't run — please reload the page and try again.");
    }
  };
}
