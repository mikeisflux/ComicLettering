import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";
import { clientIp, isBlocked, noteSuspicious } from "@/lib/botblock";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent");
    if (await isBlocked(ip)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const { email, password, captcha } = await req.json();
    const cap = await verifyCaptcha(captcha);
    if (!cap.ok) {
      await noteSuspicious(ip, "Failed captcha on login", { userAgent: ua, path: "/api/auth/login" });
      return NextResponse.json({ error: cap.reason }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email: String(email || "").trim().toLowerCase() } });
    if (!user || !(await verifyPassword(String(password || ""), user.passwordHash))) {
      // brute-force protection: repeated failures escalate to a firewall block
      await noteSuspicious(ip, "Failed login", { userAgent: ua, path: "/api/auth/login" }, 10, 10);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ ok: true, isAdmin: user.isAdmin, subStatus: user.subStatus });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
