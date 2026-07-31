"use client";
import { useState } from "react";
import { useCaptcha } from "@/lib/useCaptcha";

export default function ContactForm() {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [err, setErr] = useState("");
  const getCaptcha = useCaptcha();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy");
    const f = new FormData(e.currentTarget);
    let captcha: string | null = null;
    try {
      captcha = await getCaptcha("contact");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "The spam check didn't run — please reload and try again.");
      setState("err");
      return;
    }
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.get("name"), email: f.get("email"),
        subject: f.get("subject"), message: f.get("message"),
        website: f.get("website"), captcha, // honeypot + recaptcha v3
      }),
    });
    if (res.ok) setState("ok");
    else { setErr((await res.json()).error || "Something went wrong."); setState("err"); }
  }

  if (state === "ok") {
    return (
      <div className="formCard">
        <h1>Message sent!</h1>
        <p>Thanks for reaching out — we read every message and will reply to your email address.</p>
      </div>
    );
  }
  return (
    <form className="formCard" onSubmit={submit}>
      <h1>Contact Us</h1>
      <label htmlFor="c-name">Your name</label>
      <input id="c-name" name="name" autoComplete="name" />
      <label htmlFor="c-email">Email *</label>
      <input id="c-email" name="email" type="email" required autoComplete="email" />
      <label htmlFor="c-subject">Subject</label>
      <input id="c-subject" name="subject" />
      <label htmlFor="c-message">Message *</label>
      <textarea id="c-message" name="message" required />
      <input name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: -9999 }} aria-hidden />
      <button disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send Message"}</button>
      {state === "err" && <p className="formErr">{err}</p>}
    </form>
  );
}
