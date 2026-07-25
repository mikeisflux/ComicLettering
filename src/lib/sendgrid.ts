/* Outgoing email via the SendGrid v3 API. */
import { getSetting } from "./settings";

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export async function sendMail(input: MailInput): Promise<{ ok: boolean; error?: string }> {
  const key = await getSetting("SENDGRID_API_KEY");
  if (!key) return { ok: false, error: "SENDGRID_API_KEY is not configured (Admin → Settings)." };
  const from = (await getSetting("MAIL_FROM")) || "no-reply@lettermycomic.com";
  const fromName = (await getSetting("MAIL_FROM_NAME")) || "LetterMyComic";

  const body = {
    personalizations: [{ to: [{ email: input.to }] }],
    from: { email: from, name: fromName },
    ...(input.replyTo ? { reply_to: { email: input.replyTo } } : {}),
    subject: input.subject,
    content: [
      { type: "text/plain", value: input.text },
      ...(input.html ? [{ type: "text/html", value: input.html }] : []),
    ],
  };
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 202) return { ok: true };
    return { ok: false, error: `SendGrid ${res.status}: ${(await res.text()).slice(0, 300)}` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
