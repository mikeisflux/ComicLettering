import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ensurePlans, paypalConfigured } from "@/lib/paypal";

/* Admin one-click: create the PayPal product + $20/mo and $160/yr plans. */
export async function POST() {
  const u = await getSessionUser();
  if (!u?.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (!(await paypalConfigured())) {
    return NextResponse.json({ error: "Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET first." }, { status: 400 });
  }
  try {
    const plans = await ensurePlans();
    return NextResponse.json({ ok: true, plans });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
