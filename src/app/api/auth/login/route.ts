import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { verifyCaptcha } from "@/lib/captcha";

export async function POST(req: Request) {
  try {
    const { email, password, captcha } = await req.json();
    const cap = await verifyCaptcha(captcha);
    if (!cap.ok) return NextResponse.json({ error: cap.reason }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { email: String(email || "").trim().toLowerCase() } });
    if (!user || !(await verifyPassword(String(password || ""), user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ ok: true, isAdmin: user.isAdmin, subStatus: user.subStatus });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
