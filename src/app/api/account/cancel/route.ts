import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelSubscription, getSubscription } from "@/lib/paypal";

/* Cancel the signed-in user's PayPal subscription. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.subId) return NextResponse.json({ error: "There is no active subscription to cancel." }, { status: 400 });

  /* read the paid-through date BEFORE cancelling — PayPal drops
     next_billing_time once the subscription is cancelled */
  const sub = await getSubscription(user.subId).catch(() => null);
  const nb = sub?.billing_info?.next_billing_time ? new Date(sub.billing_info.next_billing_time) : null;
  const until = nb && Number.isFinite(nb.getTime()) && nb.getTime() > Date.now() ? nb : null;
  const ok = await cancelSubscription(user.subId, "Cancelled by the customer");
  if (!ok) {
    return NextResponse.json({ error: "PayPal could not cancel the subscription. Please try again." }, { status: 502 });
  }
  await prisma.user.update({
    where: { id: user.id },
    /* access continues to the end of the paid period (see hasAccess) */
    data: { subStatus: "cancelled", ...(until ? { subUntil: until } : {}) },
  });
  return NextResponse.json({ ok: true, accessUntil: until ? until.toISOString() : null });
}
