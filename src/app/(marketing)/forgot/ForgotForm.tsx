"use client";
import { useState } from "react";

export default function ForgotForm() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email") }),
    });
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div className="formCard">
        <h1>Check Your Email</h1>
        <p className="alt">
          If an account exists for that email, we’ve sent a link to reset your password.
          The link expires in 1 hour. Don’t see it? Check your spam folder.
        </p>
        <p className="alt"><a href="/login">Back to sign in</a></p>
      </div>
    );
  }

  return (
    <form className="formCard" onSubmit={submit}>
      <h1>Forgot Your Password?</h1>
      <p className="alt">Enter your account email and we’ll send you a link to reset it.</p>
      <label htmlFor="f-email">Email</label>
      <input id="f-email" name="email" type="email" required autoComplete="email" />
      <button disabled={busy}>{busy ? "Sending…" : "Send Reset Link"}</button>
      <p className="alt">Remembered it? <a href="/login">Sign in</a></p>
    </form>
  );
}
