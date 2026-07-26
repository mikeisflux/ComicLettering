"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCaptcha } from "@/lib/useCaptcha";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const params = useSearchParams();
  const next = params.get("next");
  const isDemo = params.get("demo") === "1";
  const getCaptcha = useCaptcha();
  const suffix = `${next ? `?next=${encodeURIComponent(next)}` : ""}${isDemo ? `${next ? "&" : "?"}demo=1` : ""}`;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr("");
    const f = new FormData(e.currentTarget);
    const captcha = await getCaptcha(mode);
    const res = await fetch(mode === "signup" ? "/api/auth/register" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: f.get("email"), password: f.get("password"), captcha,
        ...(mode === "signup" ? { name: f.get("name") } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || "Something went wrong."); setBusy(false); return; }
    if (next) window.location.href = next;
    else if (data.isAdmin) window.location.href = "/admin";
    else if (data.subStatus === "active") window.location.href = "/app";
    else window.location.href = "/pricing";
  }

  return (
    <form className="formCard" onSubmit={submit}>
      <h1>{mode === "signup" ? "Create Your Account" : "Welcome Back"}</h1>
      {isDemo && (
        <p className="demoNote">
          In order to access the free demo, you must create an account. It only takes a moment —
          no credit card required. You can try the full studio; saving, export and printing unlock
          when you subscribe.
        </p>
      )}
      {mode === "signup" && (
        <>
          <label htmlFor="a-name">Name</label>
          <input id="a-name" name="name" autoComplete="name" />
        </>
      )}
      <label htmlFor="a-email">Email</label>
      <input id="a-email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="a-password">Password {mode === "signup" && "(8+ characters)"}</label>
      <input id="a-password" name="password" type="password" required minLength={mode === "signup" ? 8 : 1}
        autoComplete={mode === "signup" ? "new-password" : "current-password"} />
      <button disabled={busy}>{busy ? "One moment…" : mode === "signup" ? "Create Account" : "Sign In"}</button>
      {mode === "login" && <p className="alt" style={{ marginTop: 10 }}><a href="/forgot">Forgot your password?</a></p>}
      {err && <p className="formErr">{err}</p>}
      <p className="alt">
        {mode === "signup"
          ? <>Already have an account? <a href={`/login${suffix}`}>Sign in</a></>
          : <>New here? <a href={`/signup${suffix}`}>Create an account</a></>}
      </p>
    </form>
  );
}
