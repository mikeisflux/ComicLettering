/* PayPal subscriptions (REST v1 billing). Plans: $20/month, $160/year. */
import { getSetting, setSetting } from "./settings";

export const PRICES = { monthly: "20.00", yearly: "160.00" };

/* One-time passes (Orders v2, no recurring billing). */
export const LIFETIME_CAP = 200;   // only 200 lifetime spots, ever
export const PASSES: Record<string, { price: string; label: string; months: number | null }> = {
  pass3: { price: "40.00", label: "LetterMyComic — 3-month pass", months: 3 },
  pass6: { price: "80.00", label: "LetterMyComic — 6-month pass", months: 6 },
  lifetime: { price: "500.00", label: "LetterMyComic — lifetime access", months: null },
};

async function apiBase(): Promise<string> {
  const mode = (await getSetting("PAYPAL_MODE")) || "sandbox";
  return mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

export async function paypalConfigured(): Promise<boolean> {
  return !!(await getSetting("PAYPAL_CLIENT_ID")) && !!(await getSetting("PAYPAL_CLIENT_SECRET"));
}

async function accessToken(): Promise<string> {
  const id = await getSetting("PAYPAL_CLIENT_ID");
  const secret = await getSetting("PAYPAL_CLIENT_SECRET");
  if (!id || !secret) throw new Error("PayPal credentials are not configured.");
  const res = await fetch(`${await apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  return (await res.json()).access_token;
}

async function pp(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  return fetch(`${await apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

export async function getSubscription(id: string): Promise<{
  status: string; plan_id: string;
  subscriber?: { email_address?: string };
  billing_info?: { next_billing_time?: string };
} | null> {
  const res = await pp(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
}

/* Switch an existing subscription to a different plan (monthly ⇄ yearly).
   PayPal usually requires the subscriber to approve the change: returns the
   approval URL to redirect them to, or null if the change applied directly. */
export async function reviseSubscription(
  id: string, newPlanId: string, returnUrl: string, cancelUrl: string
): Promise<{ ok: boolean; approveUrl: string | null; error?: string }> {
  const res = await pp(`/v1/billing/subscriptions/${encodeURIComponent(id)}/revise`, {
    method: "POST",
    body: JSON.stringify({
      plan_id: newPlanId,
      application_context: { return_url: returnUrl, cancel_url: cancelUrl },
    }),
  });
  if (!res.ok) return { ok: false, approveUrl: null, error: (await res.text()).slice(0, 300) };
  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  const links = (data.links || []) as { rel: string; href: string }[];
  const approve = links.find((l) => l.rel === "approve");
  return { ok: true, approveUrl: approve?.href || null };
}

export async function cancelSubscription(id: string, reason = "Cancelled by site"): Promise<boolean> {
  const res = await pp(`/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return res.status === 204;
}

/* One-click setup: create the product + both billing plans and store their ids. */
export async function ensurePlans(): Promise<{ monthly: string; yearly: string }> {
  const existingM = await getSetting("PAYPAL_PLAN_MONTHLY");
  const existingY = await getSetting("PAYPAL_PLAN_YEARLY");
  if (existingM && existingY) return { monthly: existingM, yearly: existingY };

  const prodRes = await pp("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      name: "LetterMyComic Subscription",
      description: "Full access to the LetterMyComic web comic lettering studio.",
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });
  if (!prodRes.ok) throw new Error(`PayPal product create failed: ${await prodRes.text()}`);
  const product = await prodRes.json();

  const makePlan = async (name: string, interval: "MONTH" | "YEAR", value: string) => {
    const res = await pp("/v1/billing/plans", {
      method: "POST",
      body: JSON.stringify({
        product_id: product.id,
        name,
        billing_cycles: [{
          frequency: { interval_unit: interval, interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0, // until cancelled — no free trial
          pricing_scheme: { fixed_price: { value, currency_code: "USD" } },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          payment_failure_threshold: 2,
        },
      }),
    });
    if (!res.ok) throw new Error(`PayPal plan create failed: ${await res.text()}`);
    return (await res.json()).id as string;
  };

  const monthly = existingM || await makePlan("LetterMyComic Monthly — $20/mo", "MONTH", PRICES.monthly);
  const yearly = existingY || await makePlan("LetterMyComic Yearly — $160/yr", "YEAR", PRICES.yearly);
  await setSetting("PAYPAL_PLAN_MONTHLY", monthly);
  await setSetting("PAYPAL_PLAN_YEARLY", yearly);
  return { monthly, yearly };
}

/* Verify a webhook signature with PayPal's verification endpoint. */
export async function verifyWebhook(headers: Headers, rawBody: string): Promise<boolean> {
  const webhookId = await getSetting("PAYPAL_WEBHOOK_ID");
  if (!webhookId) return false;
  try {
    const res = await pp("/v1/notifications/verify-webhook-signature", {
      method: "POST",
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    });
    if (!res.ok) return false;
    return (await res.json()).verification_status === "SUCCESS";
  } catch { return false; }
}

/* ---------------- one-time passes (Orders v2) ----------------
   The server creates the order (so the amount can never be tampered with
   client-side) and captures it after approval. An order captures exactly
   once at PayPal, which also makes the activation replay-safe. */

export async function createPassOrder(tier: keyof typeof PASSES): Promise<{ id: string } | { error: string }> {
  const pass = PASSES[tier];
  if (!pass) return { error: "Unknown pass." };
  const res = await pp("/v2/checkout/orders", {
    method: "POST",
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        amount: { currency_code: "USD", value: pass.price },
        description: pass.label,
        custom_id: tier,
      }],
    }),
  });
  if (!res.ok) return { error: `PayPal order failed: ${(await res.text()).slice(0, 200)}` };
  const data = await res.json();
  return { id: data.id as string };
}

export async function capturePassOrder(orderId: string): Promise<
  { ok: true; tier: string; amount: string } | { ok: false; error: string }
> {
  const res = await pp(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: "POST" });
  if (!res.ok) return { ok: false, error: `Capture failed: ${(await res.text()).slice(0, 200)}` };
  const data = await res.json();
  if (data.status !== "COMPLETED") return { ok: false, error: `Order is ${data.status}, not completed.` };
  const unit = (data.purchase_units || [])[0] || {};
  const cap = ((unit.payments || {}).captures || [])[0] || {};
  return {
    ok: true,
    tier: String(unit.custom_id || cap.custom_id || ""),
    amount: String(cap.amount?.value ?? ""),
  };
}
