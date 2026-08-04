"use client";
import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: Record<string, unknown>) => { render: (el: HTMLElement) => void };
    };
  }
}

interface Config {
  configured: boolean;
  clientId: string | null;
  plans: { monthly: string | null; yearly: string | null };
}

/* ONE shared SDK load for every button on the page. The old per-component
   loader raced: the second card saw the first card's <script> tag already
   in the DOM, assumed the SDK was ready, found window.paypal undefined and
   silently stayed on "Loading…" forever. A single cached promise means
   every card waits for the same real load — and a timeout surfaces
   blocked scripts (ad-blockers, VPNs) instead of hanging. */
let sdkPromise: Promise<void> | null = null;
function loadPayPalSdk(clientId: string): Promise<void> {
  if (window.paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const fail = (why: string) => { sdkPromise = null; reject(new Error(why)); };
    const id = "paypal-sdk";
    document.getElementById(id)?.remove();   // stale/failed tag from a prior try
    const s = document.createElement("script");
    s.id = id;
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&vault=true&intent=subscription`;
    const timer = setTimeout(() => fail("PayPal is taking too long to load."), 15000);
    s.onload = () => {
      clearTimeout(timer);
      if (window.paypal) resolve();
      else fail("PayPal loaded but is unavailable.");
    };
    s.onerror = () => { clearTimeout(timer); fail("Could not load PayPal — a VPN, ad-blocker or firewall may be blocking it."); };
    document.head.appendChild(s);
  });
  return sdkPromise;
}

export default function PayPalButtons({ plan }: { plan: "monthly" | "yearly" }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unconfigured" | "loggedout" | "done" | "error">("loading");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);   // Retry re-runs the effect

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    (async () => {
      const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ user: null }));
      if (cancelled) return;
      if (!me.user) { setState("loggedout"); return; }
      const cfg: Config = await fetch("/api/paypal/config").then((r) => r.json()).catch(() => ({ configured: false, clientId: null, plans: { monthly: null, yearly: null } }));
      if (cancelled) return;
      if (!cfg.configured || !cfg.plans[plan] || !cfg.clientId) { setState("unconfigured"); return; }

      try { await loadPayPalSdk(cfg.clientId); }
      catch (e) {
        if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setState("error"); }
        return;
      }
      if (cancelled || !window.paypal || !holder.current) return;
      holder.current.innerHTML = "";
      window.paypal.Buttons({
        style: { shape: "rect", label: "subscribe", color: plan === "yearly" ? "gold" : "blue" },
        createSubscription: (_d: unknown, actions: { subscription: { create: (o: { plan_id: string }) => Promise<string> } }) =>
          actions.subscription.create({ plan_id: cfg.plans[plan] as string }),
        onApprove: async (data: { subscriptionID?: string }) => {
          const res = await fetch("/api/paypal/activate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subscriptionId: data.subscriptionID }),
          });
          if (res.ok) { setState("done"); window.location.href = "/app"; }
          else { setError((await res.json()).error || "Activation failed"); setState("error"); }
        },
        onError: (err: unknown) => { setError(String(err).slice(0, 200)); setState("error"); },
      }).render(holder.current);
      setState("ready");
    })();
    return () => { cancelled = true; };
  }, [plan, attempt]);

  if (state === "loggedout") {
    return <a className="btnBig primary" style={{ display: "block" }} href={`/signup?next=/pricing`}>Create account to subscribe</a>;
  }
  if (state === "unconfigured") {
    return <p className="ppNote">Payments are being set up — check back shortly or <a href="/contact">contact us</a>.</p>;
  }
  return (
    <div>
      <div ref={holder} className="ppButtons" />
      {state === "loading" && <p className="ppNote">Loading secure PayPal checkout…</p>}
      {state === "error" && (
        <p className="ppNote" style={{ color: "#c22" }}>
          {error}{" "}
          <button className="acctBtn" style={{ padding: "4px 10px", fontSize: 13 }}
            onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </p>
      )}
    </div>
  );
}
