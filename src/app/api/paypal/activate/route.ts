import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSubscription } from "@/lib/paypal";
import { getSetting } from "@/lib/settings";

/* Called after PayPal onApprove: verify the subscription server-side
   and unlock the account. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const { subscriptionId } = await req.json();
    if (!subscriptionId) return NextResponse.json({ error: "subscriptionId required" }, { status: 400 });
    const sub = await getSubscription(String(subscriptionId));
    if (!sub) return NextResponse.json({ error: "Subscription not found at PayPal." }, { status: 404 });
    if (sub.status !== "ACTIVE" && sub.status !== "APPROVED") {
      return NextResponse.json({ error: `Subscription is ${sub.status}, not active.` }, { status: 402 });
    }
    const monthly = await getSetting("PAYPAL_PLAN_MONTHLY");
    const plan = sub.plan_id === monthly ? "monthly" : "yearly";
    await prisma.user.update({
      where: { id: user.id },
      data: { subStatus: "active", subPlan: plan, subId: String(subscriptionId) },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
