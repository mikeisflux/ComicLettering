import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

/* Public config for the pricing page's PayPal buttons. */
export async function GET() {
  const clientId = await getSetting("PAYPAL_CLIENT_ID");
  const monthly = await getSetting("PAYPAL_PLAN_MONTHLY");
  const yearly = await getSetting("PAYPAL_PLAN_YEARLY");
  return NextResponse.json({
    /* the monthly plan is retired — its id is optional (only existing
       subscribers still reference it); a store with only the yearly plan
       set up must not read as 'Payments are being set up' */
    configured: !!(clientId && yearly),
    clientId: clientId || null,
    plans: { monthly: monthly || null, yearly: yearly || null },
  });
}
