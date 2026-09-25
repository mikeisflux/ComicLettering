import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";
import { clientIp, isBlocked, noteSuspicious } from "@/lib/botblock";

export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent");
    if (await isBlocked(ip)) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const { email, name, password, captcha } = await req.json();
    const cap = await verifyCaptcha(captcha);
    if (!cap.ok) {
      await noteSuspicious(ip, "Failed captcha on sign-up", { userAgent: ua, path: "/api/auth/register" });
      return NextResponse.json({ error: cap.reason }, { status: 400 });
    }
    /* a burst of sign-ups from one address is a bot, captcha or not */
    await noteSuspicious(ip, "Sign-up", { userAgent: ua, path: "/api/auth/register" }, 20, 20);
    if (!email || !password || String(password).length < 8) {
      return NextResponse.json({ error: "Valid email and a password of at least 8 characters are required." }, { status: 400 });
    }
    const normEmail = String(email).trim().toLowerCase().slice(0, 254);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email: normEmail } });
    if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    /* First account ever created becomes the site admin. */
    const count = await prisma.user.count();
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: normEmail,
          name: String(name || "").trim().slice(0, 120) || normEmail.split("@")[0],
          passwordHash: await hashPassword(String(password)),
          isAdmin: count === 0,
        },
      });
    } catch (e) {
      /* unique-constraint race: two signups with the same email at once */
      if ((e as { code?: string })?.code === "P2002") {
        return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
      }
      throw e;
    }
    await createSession(user.id);
    return NextResponse.json({ ok: true, isAdmin: user.isAdmin });
  } catch {
    return NextResponse.json({ error: "Sign-up failed — please try again." }, { status: 500 });
  }
}
