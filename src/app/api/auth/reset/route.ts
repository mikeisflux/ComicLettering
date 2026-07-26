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

    /* atomic consume: the token match is part of the UPDATE itself, so two
       concurrent requests can never both redeem the same token */
    const res = await prisma.user.updateMany({
      where: { resetToken: hashResetToken(t), resetExpiry: { gt: new Date() } },
      data: { passwordHash: await hashPassword(pw), resetToken: null, resetExpiry: null },
    });
    if (res.count !== 1) {
      return NextResponse.json({ error: "This reset link is invalid or has expired. Request a new one." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Could not reset the password." }, { status: 500 });
  }
}
