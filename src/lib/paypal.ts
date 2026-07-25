/* PayPal subscriptions (REST v1 billing). Plans: $20/month, $160/year. */
import { getSetting, setSetting } from "./settings";

export const PRICES = { monthly: "20.00", yearly: "160.00" };

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
  status: string; plan_id: string; subscriber?: { email_address?: string };
} | null> {
  const res = await pp(`/v1/billing/subscriptions/${encodeURIComponent(id)}`);
  if (!res.ok) return null;
  return res.json();
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
