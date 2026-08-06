/* Right-panel tabs: Layouts, Layers, Proof, Photos, Library.
   Plain exported render functions taking the EditorCtx bag. */
import {
  LAYOUT_CATEGORIES, LayoutRect, PanelEl, SavedLayout, applyLayout, capturePageLayout, clamp, makeImage,
} from "@/lib/model";
import { loadImage } from "@/lib/exportPng";
import { elLabel } from "./textHelpers";
import { EditorCtx } from "./ctx";
import {
  applyProofFix, assignImageToPanel, deleteProject, exportAllPages,
  exportJSON, loadProject, refreshProjects, runProof, saveProject,
} from "./ops";
import { detectPanelsFromArt } from "./panelOps";


/* shared mini-preview of a layout's panels — pen-drawn shapes show their
   real outline, everything else a rect */
function layoutThumb(fracs: LayoutRect[], pts?: ([number, number][] | null)[]) {
  return (
    <svg viewBox="0 0 60 84">
      {fracs.map(([fx, fy, fw, fh, rot], j) => {
        const pp = pts?.[j];
        if (pp && pp.length > 2) {
          return <polygon key={j}
            points={pp.map(([px, py]) => `${4 + (fx + px * fw) * 52},${4 + (fy + py * fh) * 76}`).join(" ")} />;
        }
        return (
          <rect key={j} x={4 + fx * 52} y={4 + fy * 76} width={Math.max(2, fw * 52 - 2)} height={Math.max(2, fh * 76 - 2)}
            transform={rot ? `rotate(${rot} ${4 + fx * 52 + fw * 26} ${4 + fy * 76 + fh * 38})` : undefined} />
        );
      })}
    </svg>
  );
}

export function renderLayoutsTab(ed: EditorCtx) {
  const { layoutCat, setLayoutCat, page, commit, myLayouts, setMyLayouts, setStatus } = ed;
  const MY = LAYOUT_CATEGORIES.length;   // "My Layouts" pseudo-category index
  const mine = layoutCat >= MY;
  const cat = mine ? null : LAYOUT_CATEGORIES[layoutCat];
  const apply = (fracs: LayoutRect[], pts?: SavedLayout["pts"]) => {
    if (!page) return;
    applyLayout(page, fracs);
    /* applyLayout puts the fresh panels at the head of els in fracs order —
       hand pen-drawn outlines back to their panels */
    if (pts) pts.forEach((pp, i) => {
      const el = page.els[i];
      if (pp && el?.type === "panel") (el as PanelEl).pts = pp;
    });
    commit();
  };
  const saveCurrent = () => {
    if (!page) return;
    const cap = capturePageLayout(page);
    if (!cap) { setStatus("No panels on this page yet — apply a layout or draw panels, arrange them, then save."); return; }
    const name = window.prompt("Name this layout:", "My layout");
    if (!name) return;
    setMyLayouts([...myLayouts.filter((l) => l.name !== name), { name, fracs: cap.fracs, pts: cap.pts }]);
    setLayoutCat(MY);
    setStatus(`Saved “${name}” to My Layouts (${cap.fracs.length} panel${cap.fracs.length > 1 ? "s" : ""}).`);
  };
  return (
    <div className="inspBody">
      <div className="fld">
        <label>Layout</label>
        <select value={layoutCat} onChange={(e) => setLayoutCat(+e.target.value)}>
          {LAYOUT_CATEGORIES.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
          <option value={MY}>My Layouts ({myLayouts.length})</option>
        </select>
      </div>
      {!mine && (
        <div className="layoutGrid">
          {cat!.layouts.map((fracs, i) => (
            <button key={i} className="layoutBtn" title={`${fracs.length} panel${fracs.length > 1 ? "s" : ""}`}
              onClick={() => apply(fracs as LayoutRect[])}>
              {layoutThumb(fracs as LayoutRect[])}
            </button>
          ))}
        </div>
      )}
      {mine && (myLayouts.length ? (
        <div className="layoutGrid">
          {myLayouts.map((l) => (
            <span key={l.name} className="layoutWrap">
              <button className="layoutBtn" title={`${l.name} — ${l.fracs.length} panel${l.fracs.length > 1 ? "s" : ""}`}
                onClick={() => apply(l.fracs, l.pts)}>
                {layoutThumb(l.fracs, l.pts)}
              </button>
              <button className="layoutDel" title={`Delete “${l.name}”`}
                onClick={() => { if (window.confirm(`Delete layout “${l.name}”?`)) setMyLayouts(myLayouts.filter((x) => x.name !== l.name)); }}>
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="tips">Nothing saved yet. Arrange panels on a page — start from any premade layout and drag, resize or rotate the frames, or draw your own — then hit <b>Save page as layout</b> below.</div>
      ))}
      <div className="tips">Applying a layout replaces the page&apos;s panels; balloons, lettering and images are kept. Panels are normal frames — move, resize or rotate them right on the page to customise any layout.</div>
      <div className="btnRow">
        <button onClick={() => {
          ed.setPenMode(true);
          setStatus("Pen tool: click the page to place corners, click-and-DRAG to curve a point, click your first point (or press Enter) to close the panel — Esc cancels.");
        }}>Draw Your Own</button>
      </div>
      <div className="tips">A pen tool for panels of any shape — corners on click, curves on click-drag (every point can arc), close on the first point. The shape fills, clips artwork and inks its border just like a normal panel.</div>
      <div className="btnRow">
        <button onClick={saveCurrent}>Save page as layout…</button>
      </div>
      <div className="tips">Keeps this page&apos;s panel arrangement under My Layouts — saving with the same name replaces it.</div>
      <div className="btnRow">
        <button onClick={() => detectPanelsFromArt(ed)}>Detect panels from page art</button>
      </div>
      <div className="tips">Already have the page drawn? This reads the artwork on the page and lays panel frames over the panels it finds — works best with clear gutters between panels.</div>
    </div>
  );
}

/* ---------------- layers tab ---------------- */

export function renderLayersTab(ed: EditorCtx) {
  const { page, autoLock, setAutoLock, selId, select, pendingLockRef, commit } = ed;
  if (!page) return null;
  const els = [...page.els].reverse(); // top layer first, like CL3
  const move = (id: string, delta: number) => {
    const p = page;
    const i = p.els.findIndex((e) => e.id === id);
    if (i < 0) return;
    const [el] = p.els.splice(i, 1);
    p.els.splice(clamp(i + delta, 0, p.els.length), 0, el);
    commit();
  };
  return (
    <div className="inspBody">
      <div className="fld">
        <label>Auto-lock new items</label>
        <input type="checkbox" checked={autoLock} onChange={(e) => setAutoLock(e.target.checked)} />
      </div>
      <div className="tips">Every item you place is its own layer. Top of this list = front of the page. New items lock automatically when you click away — right-click any item (or use 🔒) to unlock.</div>
      <div className="layerList">
        {els.map((el) => (
          <div key={el.id} className={"layerRow" + (selId === el.id ? " on" : "")}
            onClick={() => select(el.id)}>
            <span className="layerName">{elLabel(el)}</span>
            <button className="layerBtn" title="Forward" onClick={(e) => { e.stopPropagation(); move(el.id, 1); }}>▲</button>
            <button className="layerBtn" title="Backward" onClick={(e) => { e.stopPropagation(); move(el.id, -1); }}>▼</button>
            <button className={"layerBtn" + (el.locked ? " lockOn" : "")} title={el.locked ? "Unlock" : "Lock"}
              onClick={(e) => {
                e.stopPropagation();
                el.locked = !el.locked;
                pendingLockRef.current.delete(el.id);
                commit();
              }}>{el.locked ? "🔒" : "🔓"}</button>
          </div>
        ))}
        {els.length === 0 && <div className="tips">Nothing on this page yet.</div>}
      </div>
    </div>
  );
}

export function renderProofTab(ed: EditorCtx) {
  const { proof, select } = ed;
  return (
    <div className="inspBody">
      <div className="btnRow">
        <button onClick={() => runProof(ed)} disabled={proof?.busy}>
          {proof?.busy ? "Checking…" : "Check spelling & grammar"}
        </button>
      </div>
      <div className="tips">
        Checks every balloon and lettering item on this page with LanguageTool
        (free &amp; open source). Typos also get red underlines while you type.
      </div>
      {proof?.error && <div className="tips error">{proof.error}</div>}
      {proof && !proof.busy && !proof.error && proof.matches.length === 0 && (
        <div className="tips" style={{ color: "#1d8a3c", fontWeight: 600 }}>No issues found on this page ✓</div>
      )}
      {proof?.matches.map((m, i) => (
        <div key={i} className="proofCard" onClick={() => select(m.elId)}>
          <div className="proofMsg">{m.message}</div>
          <div className="proofCtx">…{m.context}…</div>
          <div className="btnRow">
            {m.reps.map((r) => (
              <button key={r} onClick={(e) => { e.stopPropagation(); applyProofFix(ed, m, r); }}>“{r}”</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function renderPhotosTab(ed: EditorCtx) {
  const { assetsRef, fileImageRef, selEl, docRef, pageIndexRef, commit, setSelId } = ed;
  const entries = Object.entries(assetsRef.current);
  return (
    <div className="inspBody">
      <div className="btnRow">
        <button onClick={() => fileImageRef.current?.click()}>Import photos…</button>
      </div>
      {entries.length === 0 && <div className="tips">Import photos (or drop them onto the page). They appear here so you can reuse them: select a panel, then click a photo to place it inside.</div>}
      <div className="photoGrid">
        {entries.map(([aid, url]) => (
          <button key={aid} className="photoBtn" style={{ backgroundImage: `url(${url})` }}
            title="Click: fill selected panel (or add to page)"
            onClick={() => {
              if (selEl && (selEl.type === "panel" || selEl.type === "image" || selEl.type === "balloon")) assignImageToPanel(ed, selEl.id, aid);
              else {
                const d = docRef.current!;
                const p = d.pages[pageIndexRef.current];
                loadImage(url).then((img) => {
                  const w = Math.min(Math.round(p.w * 0.45), img.naturalWidth);
                  const h = Math.round(w * (img.naturalHeight / img.naturalWidth));
                  const el = makeImage(Math.round(p.w / 2 - w / 2), Math.round(p.h / 2 - h / 2), w, h, aid);
                  p.els.push(el);
                  commit();
                  setSelId(el.id);
                });
              }
            }} />
        ))}
      </div>
    </div>
  );
}

export function renderLibraryTab(ed: EditorCtx) {
  const { fileOpenRef, demo, setStatus, docRef, assetsRef, current, dbError, projects } = ed;
  return (
    <div className="inspBody">
      <div className="btnRow">
        <button onClick={() => saveProject(ed, false)}>Save</button>
        <button onClick={() => saveProject(ed, true)}>Save As…</button>
        <button onClick={() => refreshProjects(ed)}>Refresh</button>
      </div>
      <div className="btnRow">
        <button onClick={() => exportJSON(ed)}>Export file</button>
        <button onClick={() => fileOpenRef.current?.click()}>Import file</button>
      </div>
      <div className="btnRow">
        <button onClick={() => exportAllPages(ed)}>Export all pages (PNG)</button>
        <button onClick={async () => {
          if (demo) { setStatus("Export is off in the demo — subscribe to export print-ready pages."); return; }
          try {
            const { exportPdf } = await import("@/lib/pdfExport");
            await exportPdf(docRef.current!, assetsRef.current, (current?.name || "comic") + ".pdf",
              (i, n) => setStatus(`Rendering PDF page ${i}/${n}…`));
            setStatus("PDF exported.");
          } catch (err) {
            setStatus("PDF export failed: " + String(err).slice(0, 100));
          }
        }}>Export PDF (all pages)</button>
      </div>
      {current && <div className="tips">Current: <b>{current.name}</b></div>}
      {dbError && <div className="tips error">{dbError}<br />Run <code>npm run setup</code> to create the database.</div>}
      <div className="projList">
        {(projects || []).map((p) => (
          <div key={p.id} className={"projRow" + (current?.id === p.id ? " on" : "")}>
            {p.thumbnail ? <img src={p.thumbnail} alt="" /> : <div className="noThumb" />}
            <div className="projName">
              <div>{p.name}{p.sharedBy ? <span title={`Shared by ${p.sharedBy} — ${p.role} access`}> 👥</span> : null}</div>
              <small>{p.sharedBy ? `${p.sharedBy} · ${p.role}` : new Date(p.updatedAt).toLocaleString()}</small>
            </div>
            <div className="projActs">
              <button onClick={() => loadProject(ed, p.id)}>Open</button>
              {!p.sharedBy && <button onClick={() => deleteProject(ed, p.id)}>✕</button>}
            </div>
          </div>
        ))}
        {projects && projects.length === 0 && !dbError && <div className="tips">No saved projects yet.</div>}
      </div>
    </div>
  );
}
