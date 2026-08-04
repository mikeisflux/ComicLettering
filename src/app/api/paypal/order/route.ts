import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { PASSES, createPassOrder, paypalConfigured } from "@/lib/paypal";

/* Create a one-time pass order server-side (3-month, 6-month, lifetime) —
   the client never chooses the amount. */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!(await paypalConfigured())) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  const { tier } = await req.json().catch(() => ({}));
  if (!PASSES[String(tier)]) return NextResponse.json({ error: "Unknown pass." }, { status: 400 });
  /* an active recurring subscription and a pass don't mix — the pass's
     expiry would cut off access the subscription is still paying for */
  if (String(tier) !== "lifetime" && user.subId && user.subStatus === "active" && !user.subUntil) {
    return NextResponse.json(
      { error: "You already have an active subscription — cancel it first, or choose Lifetime (which replaces it)." },
      { status: 409 });
  }
  const order = await createPassOrder(String(tier));
  if ("error" in order) return NextResponse.json({ error: order.error }, { status: 502 });
  return NextResponse.json({ id: order.id });
}
