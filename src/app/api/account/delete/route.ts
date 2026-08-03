import { NextRequest, NextResponse } from "next/server";
import { destroySession, getSessionUser, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelSubscription } from "@/lib/paypal";

/* Permanently delete the signed-in user's account (Play/App Store account-
   deletion requirement, and plain good practice). Password re-entry guards
   against a hijacked session doing it. Deleting the User row cascades to
   projects, assets, shares and comments; an active PayPal subscription is
   cancelled first so nobody keeps getting billed for a dead account. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let password = "";
  try { password = String((await req.json())?.password ?? ""); } catch { /* missing body */ }
  if (!password || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "That password is incorrect." }, { status: 403 });
  }

  if (user.subId && (user.subStatus === "active" || user.subStatus === "suspended")) {
    /* best effort — if PayPal is down, the deletion still proceeds; the
       subscription webhook for a missing user is simply ignored */
    await cancelSubscription(user.subId, "Account deleted by the customer").catch(() => false);
  }

  await prisma.user.delete({ where: { id: user.id } });
  await destroySession();
  return NextResponse.json({ ok: true });
}
