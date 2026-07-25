import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyCaptcha } from "@/lib/captcha";
import { blockIP, clientIp, isBlocked, noteSuspicious } from "@/lib/botblock";

/* Public contact form — lands in the internal admin inbox. */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent");
    if (await isBlocked(ip)) return NextResponse.json({ ok: true }); // already firewalled
    const { name, email, subject, message, website, captcha } = await req.json();
    if (website) {
      // honeypot filled = definitely a bot → drop it at the firewall
      await blockIP(ip || "", "Honeypot triggered on contact form", { userAgent: ua, path: "/api/contact" });
      return NextResponse.json({ ok: true });
    }
    const cap = await verifyCaptcha(captcha);
    if (!cap.ok) {
      await noteSuspicious(ip, "Failed captcha on contact form", { userAgent: ua, path: "/api/contact" });
      return NextResponse.json({ error: cap.reason }, { status: 400 });
    }
    if (!email || !message) {
      return NextResponse.json({ error: "Email and message are required." }, { status: 400 });
    }
    await prisma.message.create({
      data: {
        direction: "in",
        channel: "contact",
        fromEmail: String(email).slice(0, 200),
        fromName: String(name || "").slice(0, 120) || null,
        subject: String(subject || "Contact form message").slice(0, 250),
        body: String(message).slice(0, 20000),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
