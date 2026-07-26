"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ResetForm() {
  const token = useSearchParams().get("token") || "";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErr("");
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") || "");
    if (password !== String(f.get("confirm") || "")) { setErr("Passwords don’t match."); return; }
    setBusy(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || "Something went wrong."); setBusy(false); return; }
    setDone(true);
  }

  if (!token) {
    return (
      <div className="formCard">
        <h1>Reset Password</h1>
        <p className="formErr">This reset link is missing its token. Request a new one from the
          <a href="/forgot"> forgot password</a> page.</p>
      </div>
    );
  }
  if (done) {
    return (
      <div className="formCard">
        <h1>Password Updated</h1>
        <p className="alt">Your password has been changed. You can now sign in with it.</p>
        <p className="alt"><a href="/login">Go to sign in →</a></p>
      </div>
    );
  }

  return (
    <form className="formCard" onSubmit={submit}>
      <h1>Choose a New Password</h1>
      <label htmlFor="r-pw">New password (8+ characters)</label>
      <input id="r-pw" name="password" type="password" required minLength={8} autoComplete="new-password" />
      <label htmlFor="r-cf">Confirm new password</label>
      <input id="r-cf" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
      <button disabled={busy}>{busy ? "Saving…" : "Set New Password"}</button>
      {err && <p className="formErr">{err}</p>}
    </form>
  );
}
