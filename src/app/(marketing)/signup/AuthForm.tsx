"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCaptcha } from "@/lib/useCaptcha";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const params = useSearchParams();
  const next = params.get("next");
  const getCaptcha = useCaptcha();

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
      {err && <p className="formErr">{err}</p>}
      <p className="alt">
        {mode === "signup"
          ? <>Already have an account? <a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Sign in</a></>
          : <>New here? <a href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`}>Create an account</a></>}
      </p>
    </form>
  );
}
