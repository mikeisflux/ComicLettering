"use client";
import { useCallback, useEffect, useState } from "react";

interface Sub {
  email: string;
  isAdmin: boolean;
  plan: "monthly" | "yearly" | "comp" | "lifetime" | null;
  status: string;
  price: string | null;
  nextBilling: string | null;
  hasSubscription: boolean;
  managed: "manual" | "paypal";
  active: boolean;
}

export default function AccountPanel() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/account/subscription");
    if (res.ok) setSub(await res.json());
  }, []);
  useEffect(() => {
    load();
    if (new URLSearchParams(location.search).get("changed")) setNote("Plan change approved — your subscription is updated.");
  }, [load]);

  async function cancel() {
    if (!window.confirm("Cancel your subscription? You'll keep access until the current period ends, then lose Studio access.")) return;
    setBusy("cancel"); setNote("");
    const res = await fetch("/api/account/cancel", { method: "POST" });
    const d = await res.json();
    if (!res.ok) setNote(d.error || "Could not cancel."); else { setNote("Your subscription has been cancelled."); await load(); }
    setBusy("");
  }

  async function change(plan: "monthly" | "yearly") {
    setBusy("change"); setNote("");
    const res = await fetch("/api/account/change", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }),
    });
    const d = await res.json();
    if (!res.ok) { setNote(d.error || "Could not change plan."); setBusy(""); return; }
    if (d.approveUrl) { window.location.href = d.approveUrl; return; } // approve at PayPal
    setNote("Your plan has been changed."); await load(); setBusy("");
  }

  if (!sub) return <div className="acctCard">Loading your account…</div>;

  const badge =
    sub.status === "active" ? "b-active" :
    sub.status === "cancelled" ? "b-cancelled" :
    sub.status === "suspended" ? "b-suspended" : "b-none";

  return (
    <div className="acctCard">
      {note && <p className="acctNote">{note}</p>}

      <div className="acctRow"><span>Email</span><b>{sub.email}</b></div>
      <div className="acctRow">
        <span>Status</span>
        <b><span className={`acct-badge ${badge}`}>{sub.status}</span></b>
      </div>

      {sub.isAdmin || sub.managed === "manual" ? (
        <>
          <div className="acctRow"><span>Plan</span><b>{sub.isAdmin ? "Admin — full access" : "Complimentary / lifetime"}</b></div>
          <p className="acctHint">Your access is granted manually and isn’t billed through PayPal.</p>
        </>
      ) : sub.hasSubscription && (sub.status === "active" || sub.status === "suspended") ? (
        <>
          <div className="acctRow"><span>Plan</span><b>{sub.plan === "monthly" ? "Monthly" : "Yearly"} · {sub.price}</b></div>
          {sub.nextBilling && (
            <div className="acctRow"><span>Next billing</span><b>{new Date(sub.nextBilling).toLocaleDateString()}</b></div>
          )}
          <div className="acctActions">
            {sub.plan === "monthly" ? (
              <button className="acctBtn" disabled={!!busy} onClick={() => change("yearly")}>
                {busy === "change" ? "One moment…" : "Switch to Yearly ($160/yr — save $80)"}
              </button>
            ) : (
              <button className="acctBtn" disabled={!!busy} onClick={() => change("monthly")}>
                {busy === "change" ? "One moment…" : "Switch to Monthly ($20/mo)"}
              </button>
            )}
            <button className="acctBtn danger" disabled={!!busy} onClick={cancel}>
              {busy === "cancel" ? "Cancelling…" : "Cancel subscription"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="acctRow"><span>Plan</span><b>No active subscription</b></div>
          <p className="acctHint">Subscribe to unlock saving, export and printing in the Studio.</p>
          <div className="acctActions">
            <a className="acctBtn primary" href="/pricing">Choose a plan</a>
          </div>
        </>
      )}

      <hr className="acctSep" />
      <div className="acctActions">
        <a className="acctBtn" href="/app">Open the Studio</a>
        <a className="acctBtn" href="/forgot">Change password</a>
        <button className="acctBtn" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
