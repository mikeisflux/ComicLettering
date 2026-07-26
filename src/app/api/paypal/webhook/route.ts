import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhook } from "@/lib/paypal";

/* PayPal webhook: keeps subscription status in sync (cancellations,
   suspensions, payment failures). Configure the webhook in the PayPal
   dashboard pointing at /api/paypal/webhook and store its ID in
   Admin → Settings for signature verification. */
export async function POST(req: Request) {
  const raw = await req.text();
  const verified = await verifyWebhook(req.headers, raw);
  if (!verified) return NextResponse.json({ error: "signature verification failed" }, { status: 400 });
  try {
    const event = JSON.parse(raw);
    const type: string = event.event_type || "";
    const subId: string | undefined = event.resource?.id;

    /* Idempotency/ordering guard: only apply an event if it is newer than the
       last applied one, so retried or out-of-order deliveries (e.g. a delayed
       ACTIVATED arriving after CANCELLED) can never regress the stored status.
       Without a usable create_time we apply unconditionally (old behavior) but
       still stamp subUpdatedAt. */
    const parsed = Date.parse(event.create_time || "");
    const eventTime = Number.isFinite(parsed) ? new Date(parsed) : new Date();
    const timeGuard = Number.isFinite(parsed)
      ? { OR: [{ subUpdatedAt: null }, { subUpdatedAt: { lt: eventTime } }] }
      : {};

    if (subId && type.startsWith("BILLING.SUBSCRIPTION.")) {
      const map: Record<string, string> = {
        "BILLING.SUBSCRIPTION.CANCELLED": "cancelled",
        "BILLING.SUBSCRIPTION.SUSPENDED": "suspended",
        "BILLING.SUBSCRIPTION.EXPIRED": "cancelled",
        "BILLING.SUBSCRIPTION.ACTIVATED": "active",
        "BILLING.SUBSCRIPTION.RE-ACTIVATED": "active",
      };
      const status = map[type];
      if (status) {
        await prisma.user.updateMany({
          where: { subId, ...timeGuard },
          data: { subStatus: status, subUpdatedAt: eventTime },
        });
      }
    }
    if (type === "PAYMENT.SALE.DENIED" && event.resource?.billing_agreement_id) {
      await prisma.user.updateMany({
        where: { subId: event.resource.billing_agreement_id, ...timeGuard },
        data: { subStatus: "suspended", subUpdatedAt: eventTime },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
