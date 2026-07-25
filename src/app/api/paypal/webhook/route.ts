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
        await prisma.user.updateMany({ where: { subId }, data: { subStatus: status } });
      }
    }
    if (type === "PAYMENT.SALE.DENIED" && event.resource?.billing_agreement_id) {
      await prisma.user.updateMany({
        where: { subId: event.resource.billing_agreement_id },
        data: { subStatus: "suspended" },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
