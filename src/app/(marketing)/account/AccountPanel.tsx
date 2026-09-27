"use client";
import { useCallback, useEffect, useState } from "react";

interface Sub {
  email: string;
  isAdmin: boolean;
  plan: "monthly" | "yearly" | "comp" | "lifetime" | "pass3" | "pass6" | null;
  status: string;
  price: string | null;
  nextBilling: string | null;
  accessUntil: string | null;
  hasSubscription: boolean;
  managed: "manual" | "paypal";
  active: boolean;
}

const PLAN_LABELS: Record<string, string> = {
  lifetime: "Lifetime — full access forever",
  comp: "Complimentary",
  pass3: "3-Month Pass",
  pass6: "6-Month Pass",
};

export default function AccountPanel() {
  const [sub, setSub] = useState<Sub | null>(null);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState("");
  /* window.prompt is blocked in installed-app and Android shells — the
     password confirmation is an inline form instead */
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  async function change(plan: "yearly") {
    setBusy("change"); setNote("");
    const res = await fetch("/api/account/change", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan }),
    });
    const d = await res.json();
    if (!res.ok) { setNote(d.error || "Could not change plan."); setBusy(""); return; }
    if (d.approveUrl) { window.location.href = d.approveUrl; return; } // approve at PayPal
    setNote("Your plan has been changed."); await load(); setBusy("");
  }

  async function deleteAccount(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") || "");
    if (!password) { setNote("Type your password to confirm deletion."); return; }
    setBusy("delete"); setNote("");
    const res = await fetch("/api/account/delete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setNote(d.error || "Could not delete the account."); setBusy(""); return; }
    window.location.href = "/?deleted=1";
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
          <div className="acctRow"><span>Plan</span>
            <b>{sub.isAdmin ? "Admin — full access" : PLAN_LABELS[sub.plan ?? ""] ?? "Complimentary / lifetime"}</b></div>
          {sub.accessUntil && (
            <div className="acctRow"><span>Access until</span>
              <b>{new Date(sub.accessUntil).toLocaleDateString()}</b></div>
          )}
          {sub.plan?.startsWith("pass") ? (
            <p className="acctHint">
              One-time pass — nothing renews automatically.{" "}
              {/* the renewal pitch is an external-purchase direction —
                  hidden in the iOS App Store build (guideline 3.1.1) */}
              <span data-extpay>{sub.status === "cancelled"
                ? <>It has ended — grab a new pass or subscription on the <a href="/pricing">pricing page</a>.</>
                : <>Buying another pass from the <a href="/pricing">pricing page</a> stacks onto your remaining time.</>}</span>
            </p>
          ) : (
            <p className="acctHint">Your access is granted manually and isn’t billed through PayPal.</p>
          )}
        </>
      ) : sub.hasSubscription && (sub.status === "active" || sub.status === "suspended") ? (
        <>
          <div className="acctRow"><span>Plan</span><b>{sub.plan === "monthly" ? "Monthly" : "Yearly"} · {sub.price}</b></div>
          {sub.nextBilling && (
            <div className="acctRow"><span>Next billing</span><b>{new Date(sub.nextBilling).toLocaleDateString()}</b></div>
          )}
          <div className="acctActions">
            {/* the monthly plan is retired: existing monthly subscribers keep
                it (and may still move up to yearly) but nobody can switch TO it */}
            {sub.plan === "monthly" && (
              <button className="acctBtn" disabled={!!busy} onClick={() => change("yearly")}>
                {busy === "change" ? "One moment…" : "Switch to Yearly ($160/yr — save $80)"}
              </button>
            )}
            <button className="acctBtn danger" disabled={!!busy} onClick={cancel}>
              {busy === "cancel" ? "Cancelling…" : "Cancel subscription"}
            </button>
          </div>
        </>
      ) : sub.status === "cancelled" && sub.accessUntil && new Date(sub.accessUntil).getTime() > Date.now() ? (
        <>
          {/* cancelled but paid through — the Terms promise access until the
              period ends; this used to fall into "No active subscription" */}
          <div className="acctRow"><span>Plan</span><b>{sub.plan === "monthly" ? "Monthly" : "Yearly"} — cancelled</b></div>
          <div className="acctRow"><span>Access until</span><b>{new Date(sub.accessUntil).toLocaleDateString()}</b></div>
          <p className="acctHint" data-extpay>Your subscription won't renew. You keep full Studio access until that date — subscribe again from the <a href="/pricing">pricing page</a> whenever you're ready.</p>
          <div className="acctActions">
            <a className="acctBtn primary" href="/pricing" data-extpay>Choose a plan</a>
          </div>
        </>
      ) : (
        <>
          <div className="acctRow"><span>Plan</span><b>No active subscription</b></div>
          <p className="acctHint" data-extpay>Subscribe to unlock saving, export and printing in the Studio.</p>
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

      <hr className="acctSep" />
      <p className="acctHint">
        Deleting your account permanently removes your profile, saved projects,
        imported fonts and stamps, shared-book access and comments, and cancels
        any active subscription. This cannot be undone.
      </p>
      {confirmDelete ? (
        <form className="acctActions" onSubmit={deleteAccount} style={{ alignItems: "center" }}>
          <input className="admInput" name="password" type="password" autoComplete="current-password"
            placeholder="Your password" required autoFocus
            style={{ flex: "1 1 180px", padding: "8px 10px", fontSize: 15, borderRadius: 8, border: "1px solid #c8ced6" }} />
          <button className="acctBtn danger" disabled={!!busy}>
            {busy === "delete" ? "Deleting…" : "Permanently delete"}
          </button>
          <button className="acctBtn" type="button" disabled={!!busy} onClick={() => { setConfirmDelete(false); setNote(""); }}>Keep my account</button>
        </form>
      ) : (
        <div className="acctActions">
          <button className="acctBtn danger" disabled={!!busy} onClick={() => { setNote(""); setConfirmDelete(true); }}>
            Delete my account
          </button>
        </div>
      )}
    </div>
  );
}
