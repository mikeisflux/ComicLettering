"use client";
/* Sentinel — the bug management console (Admin → Sentinel).
   Counts, filters and a searchable list; a detail pane with the captured
   diagnostics, the page picture, the error log and a timeline of notes,
   status changes and emailed replies. */
import { useCallback, useEffect, useState } from "react";
import { ACTIVE_STATUSES, BUG_SEVERITIES, BUG_STATUSES, STATUS_LABEL, type BugStatus } from "@/lib/bugs";

interface Row {
  id: string; title: string; status: string; severity: string; email: string | null; name: string | null;
  form: string | null; build: string | null; url: string | null; createdAt: string; updatedAt: string;
  _count: { events: number };
}
interface Bug extends Omit<Row, "_count"> {
  description: string; steps: string | null; userAgent: string | null; context: string | null;
  errors: string | null; screenshot: string | null; ip: string | null; resolvedAt: string | null; userId: string | null;
  events: { id: string; kind: string; author: string; body: string; createdAt: string }[];
}

const sevClass = (s: string) => s === "critical" ? "sev-critical" : s === "high" ? "sev-high" : s === "low" ? "sev-low" : "sev-normal";
const stClass = (s: string) => ACTIVE_STATUSES.includes(s as BugStatus) ? (s === "open" ? "b-cancelled" : "b-admin") : s === "fixed" ? "b-active" : "b-none";
const when = (iso: string) => new Date(iso).toLocaleString();

export default function Sentinel({ onCount }: { onCount?: (active: number) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tally, setTally] = useState<Record<string, number>>({});
  const [status, setStatus] = useState("active");
  const [severity, setSeverity] = useState("");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [bug, setBug] = useState<Bug | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (severity) params.set("severity", severity);
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch("/api/admin/bugs?" + params.toString());
    if (!res.ok) return;
    const d = await res.json();
    setRows(d.rows); setTally(d.tally);
    onCount?.(ACTIVE_STATUSES.reduce((n, s) => n + (d.tally[s] || 0), 0));
  }, [status, severity, q, onCount]);
  useEffect(() => { load(); }, [load]);

  const openBug = useCallback(async (id: string) => {
    setOpenId(id); setNote("");
    const res = await fetch(`/api/admin/bugs/${id}`);
    if (res.ok) setBug(await res.json()); else setBug(null);
  }, []);

  async function update(id: string, patch: { status?: string; severity?: string }) {
    setBusy(true);
    const res = await fetch("/api/admin/bugs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
    setNote(res.ok ? "Saved ✓" : "Save failed");
    setBusy(false);
    await load();
    if (openId === id) openBug(id);
  }
  async function addEvent(id: string, kind: "note" | "reply", e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = String(f.get("body") || "");
    setBusy(true);
    const res = await fetch(`/api/admin/bugs/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, body }) });
    const d = await res.json().catch(() => ({}));
    setNote(res.ok ? (kind === "reply" ? "Reply sent ✓" : "Note added ✓") : (d.error || "Failed"));
    setBusy(false);
    if (res.ok) { (e.target as HTMLFormElement).reset(); openBug(id); load(); }
  }
  async function remove(id: string) {
    if (!window.confirm("Delete this bug report and its timeline? This cannot be undone.")) return;
    await fetch(`/api/admin/bugs/${id}`, { method: "DELETE" });
    setOpenId(null); setBug(null); load();
  }

  const active = ACTIVE_STATUSES.reduce((n, s) => n + (tally[s] || 0), 0);
  let ctx: Record<string, unknown> = {};
  try { ctx = bug?.context ? JSON.parse(bug.context) : {}; } catch { ctx = {}; }

  return (
    <>
      <div className="admCard">
        <h2>Sentinel {active > 0 && <span className="admin-badge b-cancelled">{active} active</span>}</h2>
        <p className="hint">
          Bug reports from Help → Report a bug… in the studio and from /report-a-bug on the site. Each carries the
          build, the form of the app, device and document stats, the app&apos;s recent error log and, when the
          reporter allowed it, a picture of the page.
        </p>
        <div className="sentStats">
          {BUG_STATUSES.map((s) => (
            <button key={s} className={"sentStat" + (status === s ? " on" : "")} onClick={() => setStatus(status === s ? "active" : s)}>
              <b>{tally[s] || 0}</b><span>{STATUS_LABEL[s]}</span>
            </button>
          ))}
        </div>
        <div className="admRow" style={{ flexWrap: "wrap" }}>
          <select className="admInput" style={{ maxWidth: 170 }} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">Active (open, triaged, in progress)</option>
            <option value="">Everything</option>
            {BUG_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select className="admInput" style={{ maxWidth: 140 }} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">Any severity</option>
            {BUG_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className="admInput" style={{ maxWidth: 280 }} placeholder="Search title, text, email, build, id…" value={q}
            onChange={(e) => setQ(e.target.value)} />
        </div>
        {!rows ? <p>Loading…</p> : (
          <table className="admTable sentTable">
            <thead><tr><th>Sev</th><th>Title</th><th>Reporter</th><th>Where</th><th>Build</th><th>Status</th><th>Filed</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={openId === r.id ? "sentOpen" : ""} onClick={() => openBug(r.id)}>
                  <td><span className={"admin-badge " + sevClass(r.severity)}>{r.severity}</span></td>
                  <td><a href="#" onClick={(e) => e.preventDefault()}>{r.title}</a>{r._count.events > 0 && <span className="sentEv"> · {r._count.events}</span>}</td>
                  <td>{r.name || r.email || "anonymous"}</td>
                  <td>{r.form || "?"}{r.url ? <span className="k-hint"> {r.url}</span> : null}</td>
                  <td className="k-hint">{r.build || "—"}</td>
                  <td><span className={"admin-badge " + stClass(r.status)}>{STATUS_LABEL[r.status as BugStatus] ?? r.status}</span></td>
                  <td>{when(r.createdAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7}>Nothing here — {status === "active" ? "no active bugs." : "no reports match."}</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      {openId && bug && (
        <div className="admCard sentDetail">
          <div className="sentHead">
            <h2>{bug.title}</h2>
            <span className="k-hint">#{bug.id.slice(-8)} · filed {when(bug.createdAt)}{bug.resolvedAt ? ` · resolved ${when(bug.resolvedAt)}` : ""}</span>
          </div>
          <div className="admRow" style={{ flexWrap: "wrap" }}>
            <label style={{ flex: "0 0 auto" }}>Status</label>
            <select className="admInput" style={{ maxWidth: 160 }} value={bug.status} disabled={busy}
              onChange={(e) => update(bug.id, { status: e.target.value })}>
              {BUG_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <label style={{ flex: "0 0 auto" }}>Severity</label>
            <select className="admInput" style={{ maxWidth: 130 }} value={bug.severity} disabled={busy}
              onChange={(e) => update(bug.id, { severity: e.target.value })}>
              {BUG_SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button className="admBtn danger" onClick={() => remove(bug.id)}>Delete</button>
            {note && <span className={note.includes("✓") ? "okNote" : "errNote"}>{note}</span>}
          </div>

          <div className="sentCols">
            <div>
              <h3>What happened</h3>
              <div className="msgBody">{bug.description}</div>
              {bug.steps && <><h3>Steps</h3><div className="msgBody">{bug.steps}</div></>}
              <h3>Reporter</h3>
              <p className="sentKv">
                {bug.name || "—"} {bug.email ? <a href={`mailto:${bug.email}`}>{bug.email}</a> : <i>no email</i>}
                {bug.userId ? <span className="k-hint"> · account {bug.userId.slice(-8)}</span> : <span className="k-hint"> · not signed in</span>}
                {bug.ip ? <span className="k-hint"> · {bug.ip}</span> : null}
              </p>
              {bug.errors && <><h3>Error log</h3><pre className="sentErrors">{bug.errors}</pre></>}
            </div>
            <div>
              <h3>Environment</h3>
              <table className="sentCtx"><tbody>
                {Object.entries(ctx).map(([k, v]) => (
                  <tr key={k}><th>{k}</th><td>{typeof v === "object" && v ? JSON.stringify(v) : String(v)}</td></tr>
                ))}
                {bug.userAgent && <tr><th>userAgent</th><td>{bug.userAgent}</td></tr>}
              </tbody></table>
              {bug.screenshot && (
                <>
                  <h3>Page as the reporter saw it</h3>
                  <a href={bug.screenshot} target="_blank" rel="noreferrer" title="Open full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="sentShot" src={bug.screenshot} alt="Reporter's page" />
                  </a>
                </>
              )}
            </div>
          </div>

          <h3>Timeline</h3>
          <div className="sentTimeline">
            {bug.events.length === 0 && <p className="hint">No notes yet.</p>}
            {bug.events.map((ev) => (
              <div key={ev.id} className={"sentEvent kind-" + ev.kind}>
                <span className="k-hint">{when(ev.createdAt)} · {ev.author} · {ev.kind}</span>
                <div>{ev.body}</div>
              </div>
            ))}
          </div>
          <div className="sentForms">
            <form className="replyBox" onSubmit={(e) => addEvent(bug.id, "note", e)}>
              <textarea name="body" placeholder="Internal note (never sent to the reporter)…" required />
              <div className="admRow"><button className="admBtn" disabled={busy}>Add note</button></div>
            </form>
            <form className="replyBox" onSubmit={(e) => addEvent(bug.id, "reply", e)}>
              <textarea name="body" placeholder={bug.email ? `Reply by email to ${bug.email}…` : "No email on this report — reply is off."} required disabled={!bug.email} />
              <div className="admRow"><button className="admBtn primary" disabled={busy || !bug.email}>Send reply</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
