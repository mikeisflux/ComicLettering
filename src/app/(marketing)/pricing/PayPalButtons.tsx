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

export default function PayPalButtons({ plan }: { plan: "monthly" | "yearly" }) {
  const holder = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unconfigured" | "loggedout" | "done" | "error">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetch("/api/auth/me").then((r) => r.json()).catch(() => ({ user: null }));
      if (cancelled) return;
      if (!me.user) { setState("loggedout"); return; }
      const cfg: Config = await fetch("/api/paypal/config").then((r) => r.json()).catch(() => ({ configured: false }));
      if (cancelled) return;
      if (!cfg.configured || !cfg.plans[plan]) { setState("unconfigured"); return; }

      const renderButtons = () => {
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
      };

      const id = "paypal-sdk";
      if (document.getElementById(id)) { renderButtons(); return; }
      const s = document.createElement("script");
      s.id = id;
      s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.clientId!)}&vault=true&intent=subscription`;
      s.onload = renderButtons;
      s.onerror = () => { setError("Could not load PayPal."); setState("error"); };
      document.head.appendChild(s);
    })();
    return () => { cancelled = true; };
  }, [plan]);

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
      {state === "error" && <p className="ppNote" style={{ color: "#c22" }}>{error}</p>}
    </div>
  );
}
