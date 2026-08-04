import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSubscription, paypalConfigured } from "@/lib/paypal";
import { getSetting } from "@/lib/settings";

const STATUS_MAP: Record<string, string> = {
  ACTIVE: "active", APPROVED: "active", APPROVAL_PENDING: "none",
  SUSPENDED: "suspended", CANCELLED: "cancelled", EXPIRED: "cancelled",
};

/* Current subscription for the signed-in account. When a PayPal subscription
   id is on file we re-read it live and self-heal the stored plan/status
   (this also picks up plan changes made via the revise/approve flow). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let plan = user.subPlan || null;
  let status = user.subStatus;
  let nextBilling: string | null = null;

  if (user.subId && (await paypalConfigured())) {
    const sub = await getSubscription(user.subId);
    if (sub) {
      const monthlyPlan = await getSetting("PAYPAL_PLAN_MONTHLY");
      plan = sub.plan_id && monthlyPlan && sub.plan_id === monthlyPlan ? "monthly" : "yearly";
      status = STATUS_MAP[sub.status] ?? status;
      nextBilling = sub.billing_info?.next_billing_time ?? null;
      if (user.subStatus === "cancelled" && status === "active") {
        /* PayPal cancellations propagate with a delay: a stale ACTIVE read
           must never overwrite a locally-stored cancellation (which the
           webhook may have just written) — trust our own record. */
        status = user.subStatus;
      } else if (plan !== user.subPlan || status !== user.subStatus) {
        await prisma.user.update({
          where: { id: user.id },
          data: { subPlan: plan, subStatus: status, subUpdatedAt: new Date() },
        });
      }
    }
  }

  /* one-time passes expire by date, not by PayPal state */
  const passExpired = !!user.subUntil && user.subUntil.getTime() <= Date.now();
  if (plan?.startsWith("pass") && passExpired) status = "cancelled";

  const price =
    plan === "monthly" ? "$20 / month" :
    plan === "yearly" ? "$160 / year" :
    plan === "pass3" ? "$40 one-time" :
    plan === "pass6" ? "$80 one-time" :
    plan === "lifetime" ? "$500 one-time" : null;
  return NextResponse.json({
    email: user.email,
    isAdmin: user.isAdmin,
    plan, status, price, nextBilling,
    accessUntil: user.subUntil ? user.subUntil.toISOString() : null,
    hasSubscription: !!user.subId,
    managed: plan === "comp" || plan === "lifetime" || plan?.startsWith("pass") ? "manual" : "paypal",
    active: user.isAdmin || (status === "active" && !passExpired),
  });
}
