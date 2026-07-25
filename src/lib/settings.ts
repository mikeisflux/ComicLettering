/* Admin-managed settings stored in SQL, with .env fallback. */
import { prisma } from "./db";

export const SETTING_KEYS = [
  { key: "SITE_URL", label: "Public site URL", hint: "https://lettermycomic.com" },
  { key: "SENDGRID_API_KEY", label: "SendGrid API key", secret: true, hint: "SG.…" },
  { key: "MAIL_FROM", label: "Outgoing from address", hint: "hello@lettermycomic.com" },
  { key: "MAIL_FROM_NAME", label: "Outgoing from name", hint: "LetterMyComic" },
  { key: "PAYPAL_MODE", label: "PayPal mode", hint: "sandbox or live" },
  { key: "PAYPAL_CLIENT_ID", label: "PayPal client ID" },
  { key: "PAYPAL_CLIENT_SECRET", label: "PayPal client secret", secret: true },
  { key: "PAYPAL_PLAN_MONTHLY", label: "PayPal plan ID — $20/month", hint: "P-…" },
  { key: "PAYPAL_PLAN_YEARLY", label: "PayPal plan ID — $160/year", hint: "P-…" },
  { key: "PAYPAL_WEBHOOK_ID", label: "PayPal webhook ID", hint: "for signature verification" },
  { key: "RECAPTCHA_SITE_KEY", label: "reCAPTCHA v3 site key", hint: "from google.com/recaptcha" },
  { key: "RECAPTCHA_SECRET_KEY", label: "reCAPTCHA v3 secret key", secret: true },
] as const;

export async function getSetting(key: string): Promise<string> {
  try {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (row?.value) return row.value;
  } catch { /* table may not exist yet */ }
  return process.env[key] || "";
}

export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const k of keys) out[k] = await getSetting(k);
  return out;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function siteUrl(): Promise<string> {
  return (await getSetting("SITE_URL")) || "https://lettermycomic.com";
}
