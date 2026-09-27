/* Google reCAPTCHA v3 server-side verification.

   The check is ON only when BOTH keys are configured in Admin → Settings.
   Half a configuration used to be the worst of both worlds: a secret with
   no site key made every sign-up fail ("Captcha token missing" — the page
   never loaded the widget), and a site key with no secret loaded the
   widget for nothing. `captchaEnabled` is the one rule both sides use. */
import { getSetting } from "./settings";

export async function captchaSiteKey(): Promise<string | null> {
  const site = await getSetting("RECAPTCHA_SITE_KEY");
  const secret = await getSetting("RECAPTCHA_SECRET_KEY");
  return site && secret ? site : null;
}

export async function verifyCaptcha(token: string | undefined | null, action?: string, minScore = 0.5):
  Promise<{ ok: boolean; reason?: string }> {
  const secret = await getSetting("RECAPTCHA_SECRET_KEY");
  if (!secret || !(await getSetting("RECAPTCHA_SITE_KEY"))) return { ok: true }; // not (fully) configured — allow
  if (!token) return { ok: false, reason: "Captcha token missing — please try again." };
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    if (!data.success) return { ok: false, reason: "Captcha verification failed." };
    /* a token minted for the contact form must not unlock sign-up */
    if (action && typeof data.action === "string" && data.action !== action) {
      return { ok: false, reason: "Captcha verification failed — please reload and try again." };
    }
    if (typeof data.score === "number" && data.score < minScore) {
      return { ok: false, reason: "Captcha score too low — please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // don't lock users out if Google is unreachable
  }
}
