"use client";
import { useCallback, useEffect, useState } from "react";
import "./admin.css";

interface Msg {
  id: string; direction: string; channel: string; fromEmail: string;
  fromName: string | null; toEmail: string | null; subject: string;
  body: string; read: boolean; threadId: string | null; createdAt: string;
}
interface UserRow {
  id: string; email: string; name: string; isAdmin: boolean;
  subStatus: string; subPlan: string | null; subId: string | null; createdAt: string;
}
interface KnownSetting { key: string; label: string; hint?: string; secret?: boolean; value: string; set: boolean }

type Tab = "inbox" | "settings" | "users" | "payments";

export default function AdminPanel({ adminEmail }: { adminEmail: string }) {
  const [tab, setTab] = useState<Tab>("inbox");
  return (
    <div className="adm">
      <header className="admHeader">
        <div className="brand">Letter<span>My</span>Comic <small style={{ fontFamily: "sans-serif", fontSize: 12 }}>ADMIN</small></div>
        <nav>
          {(["inbox", "settings", "users", "payments"] as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </nav>
        <a href="/app">Open Studio</a>
        <a href="/">View Site</a>
        <a href="#" onClick={async (e) => { e.preventDefault(); await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }}>
          Sign out ({adminEmail})
        </a>
      </header>
      <div className="admBody">
        {tab === "inbox" && <Inbox />}
        {tab === "settings" && <Settings />}
        {tab === "users" && <Users />}
        {tab === "payments" && <Payments />}
      </div>
    </div>
  );
}

/* ---------------- Inbox ---------------- */

function Inbox() {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/messages");
    if (res.ok) setMsgs(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function markRead(m: Msg, read: boolean) {
    await fetch("/api/admin/messages", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, read }) });
    load();
  }
  async function remove(m: Msg) {
    if (!confirm("Delete this message?")) return;
    await fetch("/api/admin/messages", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id }) });
    setOpenId(null); load();
  }
  async function reply(m: Msg, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNote("");
    const f = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/messages", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId: m.id, to: m.fromEmail, subject: "Re: " + m.subject, body: f.get("body") }),
    });
    if (res.ok) { setNote("Reply sent via SendGrid ✓"); load(); }
    else setNote("Send failed: " + ((await res.json()).error || "unknown error"));
  }

  if (!msgs) return <div className="admCard">Loading inbox…</div>;
  const open = msgs.find((m) => m.id === openId) || null;
  const unread = msgs.filter((m) => m.direction === "in" && !m.read).length;

  return (
    <>
      <div className="admCard">
        <h2>Inbox {unread > 0 && <span className="admin-badge b-active">{unread} unread</span>}</h2>
        <p className="hint">
          Contact-form submissions and inbound email land here. Replies send through
          SendGrid (configure the API key in Settings). For site email, point your
          domain&apos;s MX at SendGrid Inbound Parse → <code>/api/inbound-email</code>.
        </p>
        <table className="admTable">
          <thead><tr><th>From</th><th>Subject</th><th>Via</th><th>Date</th><th /></tr></thead>
          <tbody>
            {msgs.map((m) => (
              <tr key={m.id} className={m.direction === "in" && !m.read ? "unread" : ""}>
                <td>{m.direction === "out" ? `→ ${m.toEmail}` : `${m.fromName || ""} <${m.fromEmail}>`}</td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); setOpenId(m.id); setNote(""); if (!m.read) markRead(m, true); }}>{m.subject}</a></td>
                <td>{m.channel}</td>
                <td>{new Date(m.createdAt).toLocaleString()}</td>
                <td><button className="admBtn" onClick={() => remove(m)}>✕</button></td>
              </tr>
            ))}
            {msgs.length === 0 && <tr><td colSpan={5}>No messages yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="admCard">
          <h2>{open.subject}</h2>
          <p className="hint">
            {open.direction === "in" ? `From ${open.fromName || ""} <${open.fromEmail}> via ${open.channel}` : `Sent to ${open.toEmail}`}
            {" · "}{new Date(open.createdAt).toLocaleString()}
            {" · "}<a href="#" onClick={(e) => { e.preventDefault(); markRead(open, !open.read); }}>{open.read ? "Mark unread" : "Mark read"}</a>
          </p>
          <div className="msgBody">{open.body}</div>
          {open.direction === "in" && (
            <form className="replyBox" onSubmit={(e) => reply(open, e)}>
              <textarea name="body" placeholder={`Reply to ${open.fromEmail}…`} required />
              <div className="admRow">
                <button className="admBtn primary">Send reply</button>
                {note && <span className={note.includes("✓") ? "okNote" : "errNote"}>{note}</span>}
              </div>
            </form>
          )}
        </div>
      )}
    </>
  );
}

/* ---------------- Settings ---------------- */

function Settings() {
  const [known, setKnown] = useState<KnownSetting[] | null>(null);
  const [custom, setCustom] = useState<{ key: string; value: string }[]>([]);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings");
    if (res.ok) { const d = await res.json(); setKnown(d.known); setCustom(d.custom); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(key: string, value: string) {
    const res = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) });
    setNote(res.ok ? `Saved ${key} ✓` : `Failed to save ${key}`);
    load();
  }

  if (!known) return <div className="admCard">Loading settings…</div>;
  return (
    <>
      <div className="admCard">
        <h2>API Keys & Configuration</h2>
        <p className="hint">
          Values are stored in the SQL database and override <code>.env</code>.
          Secrets show only their last 4 characters once saved — enter a new value to replace one.
        </p>
        {known.map((s) => (
          <form key={s.key} className="admRow" onSubmit={(e) => {
            e.preventDefault();
            const input = (e.currentTarget.elements.namedItem("v") as HTMLInputElement);
            if (input.value) save(s.key, input.value);
          }}>
            <label>{s.label}<br /><span className="k-hint">{s.key}{s.hint ? ` — ${s.hint}` : ""}</span></label>
            <input className="admInput" name="v" placeholder={s.set ? s.value : s.hint || ""}
              type={s.secret ? "password" : "text"} autoComplete="off" />
            <button className="admBtn">Save</button>
          </form>
        ))}
        {note && <p className={note.includes("✓") ? "okNote" : "errNote"}>{note}</p>}
      </div>
      <div className="admCard">
        <h2>Custom keys</h2>
        <p className="hint">Store any additional key/value your integrations need.</p>
        {custom.map((c) => (
          <div key={c.key} className="admRow">
            <label>{c.key}</label>
            <input className="admInput" defaultValue={c.value} onBlur={(e) => { if (e.target.value !== c.value) save(c.key, e.target.value); }} />
            <button className="admBtn" onClick={async () => {
              await fetch("/api/admin/settings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: c.key }) });
              load();
            }}>Delete</button>
          </div>
        ))}
        <form className="admRow" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const k = String(f.get("k") || "").trim();
          if (k) { save(k, String(f.get("v") || "")); (e.target as HTMLFormElement).reset(); }
        }}>
          <input className="admInput" name="k" placeholder="NEW_KEY" style={{ maxWidth: 240 }} />
          <input className="admInput" name="v" placeholder="value" />
          <button className="admBtn primary">Add</button>
        </form>
      </div>
    </>
  );
}

/* ---------------- Users ---------------- */

function Users() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) setUsers(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function update(id: string, patch: Record<string, unknown>) {
    await fetch("/api/admin/users", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...patch }) });
    load();
  }

  if (!users) return <div className="admCard">Loading users…</div>;
  return (
    <div className="admCard">
      <h2>Users ({users.length})</h2>
      <p className="hint">Grant complimentary access with “Activate”, or suspend an account. PayPal keeps statuses in sync automatically via the webhook.</p>
      <table className="admTable">
        <thead><tr><th>Email</th><th>Name</th><th>Status</th><th>Plan</th><th>Joined</th><th>Actions</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email} {u.isAdmin && <span className="admin-badge b-admin">admin</span>}</td>
              <td>{u.name}</td>
              <td><span className={`admin-badge b-${u.subStatus}`}>{u.subStatus}</span></td>
              <td>{u.subPlan || "—"}</td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td style={{ display: "flex", gap: 4 }}>
                {u.subStatus !== "active"
                  ? <button className="admBtn" onClick={() => update(u.id, { subStatus: "active" })}>Activate</button>
                  : <button className="admBtn" onClick={() => update(u.id, { subStatus: "suspended" })}>Suspend</button>}
                {!u.isAdmin
                  ? <button className="admBtn" onClick={() => update(u.id, { isAdmin: true })}>Make admin</button>
                  : <button className="admBtn" onClick={() => update(u.id, { isAdmin: false })}>Remove admin</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Payments ---------------- */

function Payments() {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="admCard">
      <h2>PayPal Subscription Setup</h2>
      <p className="hint">
        1) Enter <code>PAYPAL_CLIENT_ID</code>, <code>PAYPAL_CLIENT_SECRET</code> and
        <code> PAYPAL_MODE</code> (sandbox/live) in Settings. 2) Click the button below to
        create the product and both billing plans ($20/month, $160/year — no trials) in your
        PayPal account automatically. 3) In the PayPal dashboard add a webhook pointing at
        <code> /api/paypal/webhook</code> (subscribe to Billing subscription events) and save
        its ID as <code>PAYPAL_WEBHOOK_ID</code>.
      </p>
      <button className="admBtn primary" disabled={busy} onClick={async () => {
        setBusy(true); setNote("");
        const res = await fetch("/api/paypal/setup", { method: "POST" });
        const d = await res.json();
        setNote(res.ok ? `Plans ready ✓ monthly=${d.plans.monthly} yearly=${d.plans.yearly}` : `Failed: ${d.error}`);
        setBusy(false);
      }}>{busy ? "Creating plans…" : "Create / verify PayPal plans"}</button>
      {note && <p className={note.includes("✓") ? "okNote" : "errNote"}>{note}</p>}
    </div>
  );
}
