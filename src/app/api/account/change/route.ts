import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { reviseSubscription } from "@/lib/paypal";
import { getSetting, siteUrl } from "@/lib/settings";

/* Switch the signed-in user's subscription between monthly and yearly.
   PayPal typically returns an approval URL to redirect the user to; once
   approved the plan change takes effect and the account self-heals on the
   /account page's next load. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!user.subId) return NextResponse.json({ error: "You don't have a subscription to change. Choose a plan on the pricing page." }, { status: 400 });

  const { plan } = await req.json();
  if (plan !== "monthly" && plan !== "yearly") {
    return NextResponse.json({ error: "Choose 'monthly' or 'yearly'." }, { status: 400 });
  }
  if (plan === user.subPlan) {
    return NextResponse.json({ error: `You're already on the ${plan} plan.` }, { status: 400 });
  }

  const newPlanId = await getSetting(plan === "monthly" ? "PAYPAL_PLAN_MONTHLY" : "PAYPAL_PLAN_YEARLY");
  if (!newPlanId) return NextResponse.json({ error: "The billing plans aren't configured yet." }, { status: 503 });

  const base = await siteUrl();
  const r = await reviseSubscription(user.subId, newPlanId, `${base}/account?changed=1`, `${base}/account`);
  if (!r.ok) return NextResponse.json({ error: "PayPal couldn't change the plan. Please try again." }, { status: 502 });

  if (r.approveUrl) {
    return NextResponse.json({ approveUrl: r.approveUrl });
  }
  // applied immediately (no approval needed)
  await prisma.user.update({ where: { id: user.id }, data: { subPlan: plan } });
  return NextResponse.json({ ok: true });
}
