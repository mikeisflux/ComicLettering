/* Google reCAPTCHA v3 server-side verification. If no secret key is
   configured in Admin → Settings, verification is skipped. */
import { getSetting } from "./settings";

export async function verifyCaptcha(token: string | undefined | null, minScore = 0.5):
  Promise<{ ok: boolean; reason?: string }> {
  const secret = await getSetting("RECAPTCHA_SECRET_KEY");
  if (!secret) return { ok: true }; // not configured — allow
  if (!token) return { ok: false, reason: "Captcha token missing — please try again." };
  try {
    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = await res.json();
    if (!data.success) return { ok: false, reason: "Captcha verification failed." };
    if (typeof data.score === "number" && data.score < minScore) {
      return { ok: false, reason: "Captcha score too low — please try again." };
    }
    return { ok: true };
  } catch {
    return { ok: true }; // don't lock users out if Google is unreachable
  }
}
