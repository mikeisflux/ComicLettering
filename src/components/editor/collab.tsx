/* Collaboration UI: the Team dialog (sharing, review passes, the comment
   list), the pinned comment markers on the pages, and the note composer.
   Pins render on BOTH canvases — the single page and each spread half. */
import React from "react";
import { CollabState, EditorCtx } from "./ctx";

export async function collabOp(
  projectId: string, payload: Record<string, unknown>,
): Promise<{ ok?: boolean; error?: string }> {
  try {
    const r = await fetch(`/api/projects/${projectId}/collab`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await r.json();
  } catch {
    return { error: "Network problem — try again." };
  }
}

/* pinned markers for one page — page-unit coords inside a scaled page div,
   so sizes counter-scale to stay readable at any zoom */
export function renderCommentPins(ed: EditorCtx, pageIdx: number) {
  const c = ed.collab;
  if (!c) return null;
  const pins = c.comments.filter((cm) => cm.pageIndex === pageIdx && !cm.resolved);
  if (!pins.length) return null;
  const s = 22 / Math.max(0.05, ed.zoom);
  return (
    <>
      {pins.map((cm, i) => (
        <div key={cm.id} title={`${cm.author.name}: ${cm.body}`}
          onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
          onClick={(e) => {
            e.stopPropagation();
            ed.setOpenCommentId(cm.id);
            ed.setShowTeam(true);
          }}
          style={{
            position: "absolute", left: cm.x - s / 2, top: cm.y - s,
            width: s, height: s, borderRadius: `${s / 2}px ${s / 2}px ${s / 2}px 2px`,
            background: "#ffb020", color: "#241a04", border: `${2 / ed.zoom}px solid #241a04`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: s * 0.55, fontWeight: 700, cursor: "pointer", zIndex: 3,
            boxShadow: "0 2px 8px #0006",
          }}>{i + 1}</div>
      ))}
    </>
  );
}

/* full-stage click catcher while comment mode is armed — works on both
   canvases because it converts through pagePoint + the spread layout */
export function renderCommentCatcher(ed: EditorCtx) {
  if (!ed.commentMode) return null;
  return (
    <div
      style={{ position: "absolute", inset: 0, zIndex: 60, cursor: "crosshair" }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const pt = ed.pagePoint(e);
        /* which page of the (possibly two-page) canvas was hit */
        const d = ed.docRef.current;
        if (!d) return;
        const curOff = ed.spreadOffX(ed.pageIndex);
        let idx = ed.pageIndex, x = pt.x;
        for (const s of ed.spreadLayout) {
          const local = pt.x + curOff - s.off;
          if (local >= 0 && local <= d.pages[s.idx].w) { idx = s.idx; x = local; break; }
        }
        ed.setComposer({ pageIdx: idx, x: Math.round(x), y: Math.round(pt.y) });
        ed.setCommentMode(false);
      }} />
  );
}

/* the note composer — a small modal so it works identically everywhere */
export function renderCommentComposer(ed: EditorCtx) {
  if (!ed.composer) return null;
  const c = ed.composer;
  let draft = "";
  return (
    <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) ed.setComposer(null); }}>
      <div className="setupDlg" style={{ width: 380 }}>
        <div className="setupTitle">Note on page {c.pageIdx + 1}</div>
        <div className="setupBody" style={{ flexDirection: "column", gap: 8 }}>
          <textarea autoFocus rows={4} style={{ width: "100%", resize: "vertical" }}
            placeholder="What should change here?"
            onChange={(e) => { draft = e.target.value; }} />
          <div className="btnRow">
            <button onClick={async () => {
              const projectId = ed.current?.id;
              if (!projectId || !draft.trim()) { ed.setComposer(null); return; }
              const r = await collabOp(projectId, { op: "comment", pageIndex: c.pageIdx, x: c.x, y: c.y, body: draft });
              ed.setStatus(r.error ? r.error : "Note pinned.");
              ed.setComposer(null);
              ed.reloadCollab();
            }}>Pin note</button>
            <button onClick={() => ed.setComposer(null)}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- the Team dialog ---------------- */

export function renderTeamDialog(ed: EditorCtx) {
  if (!ed.showTeam) return null;
  const close = () => { ed.setShowTeam(false); ed.setOpenCommentId(null); };
  const projectId = ed.current?.id;
  if (!projectId) {
    return (
      <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="setupDlg" style={{ width: 420 }}>
          <div className="setupTitle">Share &amp; Review</div>
          <div className="setupBody" style={{ flexDirection: "column", gap: 8 }}>
            <div className="tips">Save this book to the Library first — sharing, notes and review passes live with the cloud copy.</div>
            <div className="btnRow"><button onClick={close}>Close</button></div>
          </div>
        </div>
      </div>
    );
  }
  const c = ed.collab;
  return (
    <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="setupDlg" style={{ width: 480, maxHeight: "80vh", overflow: "auto" }}>
        <div className="setupTitle">Share &amp; Review — {ed.current?.name}</div>
        <div className="setupBody" style={{ flexDirection: "column", gap: 12 }}>
          {!c ? <div className="tips">Loading the team…</div> : (
            <>
              <ReviewSection ed={ed} c={c} projectId={projectId} />
              <CommentsSection ed={ed} c={c} projectId={projectId} />
              {c.role === "owner" && <ShareSection ed={ed} c={c} projectId={projectId} />}
              {c.role !== "owner" && c.owner && (
                <div className="tips">Owned by <b>{c.owner.name}</b> — you have <b>{c.role}</b> access.</div>
              )}
            </>
          )}
          <div className="btnRow"><button onClick={close}>Close</button></div>
        </div>
      </div>
    </div>
  );
}

function ReviewSection({ ed, c, projectId }: { ed: EditorCtx; c: CollabState; projectId: string }) {
  const open = c.reviews.find((r) => r.status === "open");
  const act = async (payload: Record<string, unknown>) => {
    const r = await collabOp(projectId, payload);
    ed.setStatus(r.error ? r.error : "Done.");
    ed.reloadCollab();
  };
  return (
    <div>
      <div className="sideTitle">Review pass</div>
      {open ? (
        <div className="tips" style={{ marginBottom: 6 }}>
          <b>Review requested</b>{open.note ? <> — “{open.note}”</> : null}
          {(c.role === "owner" || c.role === "editor") && (
            <div className="btnRow" style={{ marginTop: 6 }}>
              <button onClick={() => act({ op: "close", status: "approved" })}>Approve</button>
              <button onClick={() => {
                const note = window.prompt("What needs to change?") ?? "";
                if (note.trim()) act({ op: "close", status: "changes", note });
              }}>Request changes</button>
            </div>
          )}
          {c.role === "letterer" && <div>Waiting for the editor.</div>}
        </div>
      ) : (
        (c.role === "owner" || c.role === "letterer") && (
          <div className="btnRow" style={{ marginBottom: 6 }}>
            <button onClick={() => {
              const note = window.prompt("Anything the reviewer should focus on? (optional)") ?? "";
              act({ op: "review", note });
            }}>Request review</button>
          </div>
        )
      )}
      {c.reviews.filter((r) => r.status !== "open").slice(0, 5).map((r) => (
        <div key={r.id} className="tips">
          {r.status === "approved" ? "✅ Approved" : "✏️ Changes requested"}
          {r.note ? <> — “{r.note}”</> : null}
          {r.closedAt ? <> · {new Date(r.closedAt).toLocaleDateString()}</> : null}
        </div>
      ))}
    </div>
  );
}

function CommentsSection({ ed, c, projectId }: { ed: EditorCtx; c: CollabState; projectId: string }) {
  const act = async (payload: Record<string, unknown>) => {
    const r = await collabOp(projectId, payload);
    if (r.error) ed.setStatus(r.error);
    ed.reloadCollab();
  };
  const items = [...c.comments].sort((a, b) => a.pageIndex - b.pageIndex || +new Date(a.createdAt) - +new Date(b.createdAt));
  return (
    <div>
      <div className="sideTitle">Notes</div>
      <div className="btnRow" style={{ marginBottom: 6 }}>
        <button onClick={() => { ed.setShowTeam(false); ed.setCommentMode(true); ed.setStatus("Click anywhere on a page to pin a note — Esc cancels."); }}>
          Pin a note…
        </button>
      </div>
      {!items.length && <div className="tips">No notes yet.</div>}
      {items.map((cm) => (
        <div key={cm.id} className="tips" style={{
          padding: 6, borderRadius: 6, marginBottom: 4,
          background: cm.id === ed.openCommentId ? "#ffb02022" : undefined,
          opacity: cm.resolved ? 0.55 : 1,
        }}>
          <b>p.{cm.pageIndex + 1}</b> · {cm.author.name}: {cm.body}
          <div className="btnRow" style={{ marginTop: 4 }}>
            <button onClick={() => {
              ed.setShowTeam(false);
              ed.setPageIndex(cm.pageIndex);
              ed.setOpenCommentId(cm.id);
            }}>Go to</button>
            <button onClick={() => act({ op: "resolve", commentId: cm.id, resolved: !cm.resolved })}>
              {cm.resolved ? "Reopen" : "Resolve"}
            </button>
            {(cm.authorId === c.me || c.role === "owner") && (
              <button onClick={() => act({ op: "uncomment", commentId: cm.id })}>Delete</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ShareSection({ ed, c, projectId }: { ed: EditorCtx; c: CollabState; projectId: string }) {
  let email = "";
  let role = "letterer";
  const act = async (payload: Record<string, unknown>) => {
    const r = await collabOp(projectId, payload);
    ed.setStatus(r.error ? r.error : "Team updated.");
    ed.reloadCollab();
  };
  return (
    <div>
      <div className="sideTitle">Team</div>
      <div className="btnRow" style={{ marginBottom: 6 }}>
        <input type="email" placeholder="collaborator@email.com" style={{ flex: 1, minWidth: 0 }}
          onChange={(e) => { email = e.target.value; }} />
        <select defaultValue="letterer" onChange={(e) => { role = e.target.value; }}>
          <option value="letterer">Letterer (edits)</option>
          <option value="editor">Editor (reviews)</option>
        </select>
        <button onClick={() => { if (email.trim()) act({ op: "share", email, role }); }}>Invite</button>
      </div>
      {!c.shares.length && <div className="tips">Only you can see this book.</div>}
      {c.shares.map((s) => (
        <div key={s.id} className="tips">
          <b>{s.name}</b> ({s.email}) — {s.role}
          {" "}<button onClick={() => act({ op: "unshare", shareId: s.id })}>Remove</button>
        </div>
      ))}
    </div>
  );
}
