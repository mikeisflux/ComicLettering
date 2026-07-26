import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { newResetToken } from "@/lib/auth";
import { sendMail } from "@/lib/sendgrid";
import { siteUrl } from "@/lib/settings";
import { clientIp, noteSuspicious } from "@/lib/botblock";

/* Request a password reset. Always returns a generic success so the form
   never reveals whether an email is registered. */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const ua = req.headers.get("user-agent");
  try {
    const { email } = await req.json();
    const em = String(email || "").trim().toLowerCase();
    // light abuse throttle — many requests from one IP escalate to a block
    await noteSuspicious(ip, "password reset request", { userAgent: ua, path: "/api/auth/forgot" }, 20, 10);

    if (/^\S+@\S+\.\S+$/.test(em)) {
      const user = await prisma.user.findUnique({ where: { email: em } });
      if (user) {
        const { token, hash } = newResetToken();
        await prisma.user.update({
          where: { id: user.id },
          data: { resetToken: hash, resetExpiry: new Date(Date.now() + 60 * 60 * 1000) }, // 1 hour
        });
        const link = `${await siteUrl()}/reset?token=${token}`;
        const text =
          `Hi${user.name ? " " + user.name : ""},\n\n` +
          `We received a request to reset your LetterMyComic password. ` +
          `Click the link below to choose a new password. It expires in 1 hour.\n\n${link}\n\n` +
          `If you didn't request this, you can ignore this email — your password won't change.`;
        const html =
          `<p>Hi${user.name ? " " + user.name : ""},</p>` +
          `<p>We received a request to reset your <strong>LetterMyComic</strong> password. ` +
          `Click the button below to choose a new one. This link expires in 1 hour.</p>` +
          `<p><a href="${link}" style="display:inline-block;background:#f0812c;color:#1d1105;` +
          `font-weight:700;padding:11px 22px;border-radius:8px;text-decoration:none">Reset your password</a></p>` +
          `<p style="color:#667;font-size:13px">Or paste this link into your browser:<br>${link}</p>` +
          `<p style="color:#667;font-size:13px">If you didn't request this, ignore this email — your password won't change.</p>`;
        const r = await sendMail({ to: em, subject: "Reset your LetterMyComic password", text, html });
        if (!r.ok) console.error("[forgot] mail failed:", r.error);
      }
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never leak details
  }
}
