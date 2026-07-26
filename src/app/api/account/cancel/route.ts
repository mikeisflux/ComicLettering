import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cancelSubscription } from "@/lib/paypal";

/* Cancel the signed-in user's PayPal subscription. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.subId) return NextResponse.json({ error: "There is no active subscription to cancel." }, { status: 400 });

  const ok = await cancelSubscription(user.subId, "Cancelled by the customer");
  if (!ok) {
    return NextResponse.json({ error: "PayPal could not cancel the subscription. Please try again." }, { status: 502 });
  }
  await prisma.user.update({ where: { id: user.id }, data: { subStatus: "cancelled" } });
  return NextResponse.json({ ok: true });
}
