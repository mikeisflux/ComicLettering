import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PASSES, cancelSubscription, capturePassOrder } from "@/lib/paypal";

/* Capture an approved pass order and unlock the account. Passes extend an
   existing unexpired pass rather than overwriting it; lifetime replaces
   everything and cancels any recurring PayPal subscription (best effort)
   so nobody keeps getting billed on top of a lifetime purchase. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { orderId } = await req.json().catch(() => ({}));
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const cap = await capturePassOrder(String(orderId));
  if (!cap.ok) return NextResponse.json({ error: cap.error }, { status: 402 });
  const pass = PASSES[cap.tier];
  if (!pass || cap.amount !== pass.price) {
    return NextResponse.json({ error: "Captured order does not match a known pass." }, { status: 400 });
  }

  if (pass.months === null) {
    /* lifetime */
    if (user.subId && user.subStatus === "active") {
      await cancelSubscription(user.subId, "Replaced by lifetime purchase").catch(() => false);
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { subStatus: "active", subPlan: "lifetime", subUntil: null, subId: null },
    });
  } else {
    /* stack passes: extend from the current expiry when one is still running */
    const base = user.subUntil && user.subUntil.getTime() > Date.now() && user.subStatus === "active"
      ? new Date(user.subUntil) : new Date();
    base.setMonth(base.getMonth() + pass.months);
    await prisma.user.update({
      where: { id: user.id },
      data: { subStatus: "active", subPlan: cap.tier, subUntil: base },
    });
  }
  return NextResponse.json({ ok: true });
}
