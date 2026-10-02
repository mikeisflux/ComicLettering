"use client";
/* The bug-report form — ONE component for the studio's Help → Report a
   bug… dialog and the site's /report-a-bug page. The studio hands it the
   live context (document stats, a page screenshot, recent errors); the
   site version sends the environment alone. Nothing is sent until the
   person presses Send, and the diagnostics it will attach are listed in
   plain words first. */
import { useEffect, useState } from "react";
import { useCaptcha } from "@/lib/useCaptcha";
import { environmentInfo, recentErrors } from "@/lib/errorLog";

export interface BugFormProps {
  /* extra context from the studio (merged over the environment) */
  context?: () => Record<string, unknown>;
  /* a PNG data URL of the current page, built on demand */
  screenshot?: () => Promise<string | null>;
  compact?: boolean;
  onDone?: () => void;
  onCancel?: () => void;
}

export default function BugReportForm({ context, screenshot, compact, onDone, onCancel }: BugFormProps) {
  const [state, setState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [err, setErr] = useState("");
  const [reportId, setReportId] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [withShot, setWithShot] = useState(!!screenshot);
  const [withDiag, setWithDiag] = useState(true);
  const getCaptcha = useCaptcha();

  /* a signed-in person never has to type their address */
  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.json()).then((d) => {
      if (d?.user?.email) { setEmail(d.user.email); setName(d.user.name || ""); }
    }).catch(() => { /* signed out */ });
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("busy"); setErr("");
    const f = new FormData(e.currentTarget);
    let captcha: string | null = null;
    try { captcha = await getCaptcha("bug"); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "The spam check didn't run — reload and try again."); setState("err"); return; }
    const ctx: Record<string, unknown> = withDiag ? { ...environmentInfo(), ...(context?.() ?? {}) } : { build: environmentInfo().build, url: environmentInfo().url, form: environmentInfo().form };
    const errors = withDiag ? recentErrors().map((l) => `${new Date(l.t).toISOString().slice(11, 19)} ${l.msg}`).join("\n") : "";
    let shot: string | null = null;
    if (withShot && screenshot) { try { shot = await screenshot(); } catch { shot = null; } }
    const res = await fetch("/api/bugs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: f.get("title"), description: f.get("description"), steps: f.get("steps"),
        severity: f.get("severity"), email: f.get("email"), name: f.get("name"),
        website: f.get("website"), captcha, context: ctx, errors, screenshot: shot,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error || "Something went wrong."); setState("err"); return; }
    setReportId(String(d.id || "").slice(-8));
    setState("ok");
  }

  if (state === "ok") {
    return (
      <div className={compact ? "bugForm compact" : "formCard"}>
        <h1>Thank you!</h1>
        <p>Your report is in — reference <b>{reportId}</b>. {email ? "We'll reply to " + email + " if we need more." : "Add an email next time if you'd like a reply."}</p>
        {onDone && <button type="button" onClick={onDone}>Back to work</button>}
      </div>
    );
  }
  const errCount = recentErrors().length;
  return (
    <form className={compact ? "bugForm compact" : "formCard"} onSubmit={submit}>
      <h1>Report a bug</h1>
      {!compact && <p className="sub" style={{ marginTop: -6 }}>Something broke, looked wrong or didn't do what it said? Tell us — every report is read by a person.</p>}
      <label htmlFor="b-title">What went wrong? *</label>
      <input id="b-title" name="title" required maxLength={200} placeholder="One line, like a headline" />
      <label htmlFor="b-desc">Details *</label>
      <textarea id="b-desc" name="description" required placeholder="What you expected, what happened instead" />
      <label htmlFor="b-steps">How to make it happen again</label>
      <textarea id="b-steps" name="steps" placeholder={"1. Open a book\n2. Add a balloon\n3. …"} style={{ minHeight: 80 }} />
      <div className="bugRow">
        <div>
          <label htmlFor="b-sev">How bad is it?</label>
          <select id="b-sev" name="severity" defaultValue="normal">
            <option value="low">Cosmetic</option>
            <option value="normal">Annoying</option>
            <option value="high">Blocks my work</option>
            <option value="critical">Lost work / crash</option>
          </select>
        </div>
        <div>
          <label htmlFor="b-email">Email for a reply</label>
          <input id="b-email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
      </div>
      <input type="hidden" name="name" value={name} />
      <input name="website" tabIndex={-1} autoComplete="off" style={{ position: "absolute", left: -9999 }} aria-hidden />
      <div className="bugAttach">
        <label><input type="checkbox" checked={withDiag} onChange={(e) => setWithDiag(e.target.checked)} />
          Attach diagnostics — app version, browser and device, which form of the app, page and document stats{errCount ? `, and the last ${errCount} error${errCount > 1 ? "s" : ""} the app logged` : ""}. No text from your balloons.</label>
        {screenshot && <label><input type="checkbox" checked={withShot} onChange={(e) => setWithShot(e.target.checked)} />
          Attach a picture of the current page (the artwork and lettering as rendered)</label>}
      </div>
      <div className="bugBtns">
        <button disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send report"}</button>
        {onCancel && <button type="button" className="plain" onClick={onCancel}>Cancel</button>}
      </div>
      {state === "err" && <p className="formErr">{err}</p>}
    </form>
  );
}
