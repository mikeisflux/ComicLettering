import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, hashResetToken } from "@/lib/auth";

/* Complete a password reset with the token from the email link. */
export async function POST(req: Request) {
  try {
    const { token, password } = await req.json();
    const t = String(token || "");
    const pw = String(password || "");
    if (!t) return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
    if (pw.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

    const user = await prisma.user.findFirst({
      where: { resetToken: hashResetToken(t), resetExpiry: { gt: new Date() } },
    });
    if (!user) {
      return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(pw), resetToken: null, resetExpiry: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
