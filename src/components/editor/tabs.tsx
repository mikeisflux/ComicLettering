/* Right-panel tabs: Layouts, Layers, Proof, Photos, Library.
   Plain exported render functions taking the EditorCtx bag. */
import {
  LAYOUT_CATEGORIES, LayoutRect, PanelEl, SavedLayout, applyLayout, capturePageLayout, clamp, makeImage, uid,
} from "@/lib/model";
import { loadImage } from "@/lib/exportPng";
import { elLabel } from "./textHelpers";
import { EditorCtx } from "./ctx";
import {
  addFromTray, applyProofFix, assignImageToPanel, deleteProject, deleteSel,
  duplicateSel, exportAllPages,
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
      <div className="fld" style={{ marginBottom: 2 }}><label>Draw Your Own Panel</label></div>
      <div className="shapeRow">
        <button className={"shapeBtn" + (ed.penMode ? " on" : "")}
          title="Pen — click corners, click-and-drag to curve, close on your first point (Enter closes, Ctrl+Z removes a point, Esc cancels)"
          onClick={() => {
            ed.setShapeMode(null);
            ed.setPenMode(true);
            setStatus("Pen tool: click the page to place corners, click-and-DRAG to curve a point, click your first point (or press Enter) to close — Ctrl+Z removes the last point, Esc cancels.");
          }}>
          <svg viewBox="0 0 24 24">
            <path d="M12 2.5 L16 9 L13.4 18.5 L10.6 18.5 L8 9 Z" />
            <line x1={12} y1={9} x2={12} y2={14} />
            <circle cx={12} cy={8.2} r={1.4} />
          </svg>
        </button>
        <button className={"shapeBtn" + (ed.shapeMode === "rect" ? " on" : "")} title="Rectangle — drag a box on the page"
          onClick={() => { ed.setPenMode(false); ed.setShapeMode("rect"); setStatus("Drag on the page to sweep out a rectangle panel — Esc cancels."); }}>
          <svg viewBox="0 0 24 24"><rect x={4} y={6} width={16} height={12} strokeDasharray="3 2" /></svg>
        </button>
        <button className={"shapeBtn" + (ed.shapeMode === "oval" ? " on" : "")} title="Oval — drag on the page"
          onClick={() => { ed.setPenMode(false); ed.setShapeMode("oval"); setStatus("Drag on the page to sweep out an oval panel — Esc cancels."); }}>
          <svg viewBox="0 0 24 24"><ellipse cx={12} cy={12} rx={9} ry={6} /></svg>
        </button>
        <button className={"shapeBtn" + (ed.shapeMode === "circle" ? " on" : "")} title="Circle — drag on the page (stays perfectly round)"
          onClick={() => { ed.setPenMode(false); ed.setShapeMode("circle"); setStatus("Drag on the page to sweep out a circle panel — it stays perfectly round. Esc cancels."); }}>
          <svg viewBox="0 0 24 24"><circle cx={12} cy={12} r={8} /></svg>
        </button>
      </div>
      <div className="tips">Panels of any shape: the pen builds polygons and curved shapes point by point (every point can arc), the marquees drag out rectangles, ovals and perfect circles. Each one fills, clips artwork and inks its border just like a normal panel.</div>
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

/* which layer groups are folded shut, and where the layer context menu
   opened — session-local UI state (plain render functions hold no hooks) */
const collapsedGroups = new Set<string>();
let layerCtxPos = { x: 0, y: 0 };
let layerCtxRange = "";
let layerCtxAsking = false;

/* "2, 4-6" → zero-based page indices, clamped to the document */
function parsePageList(s: string, n: number): number[] {
  const out = new Set<number>();
  for (const part of s.split(/[,\s]+/)) {
    const m = part.match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = +m[1], b = m[2] ? +m[2] : a;
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
      if (i >= 1 && i <= n) out.add(i - 1);
    }
  }
  return [...out].sort((x, y) => x - y);
}

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
  const rename = (el: (typeof els)[number]) => {
    const n = window.prompt("Layer name:", el.name ?? elLabel(el));
    if (n === null) return;
    el.name = n.trim() || undefined;
    commit();
  };
  /* copy a layer onto other pages (the layer context menu's big feature —
     grade or stamp once, apply book-wide) */
  const copyToPages = (el: (typeof els)[number], targets: number[]) => {
    const d = ed.docRef.current!;
    let count = 0;
    for (const pi of targets) {
      if (pi === ed.pageIndex) continue;
      const copy = JSON.parse(JSON.stringify(el)) as typeof el;
      copy.id = uid();
      d.pages[pi].els.push(copy);
      count++;
    }
    commit();
    ed.rebuildThumbs();
    ed.setStatus(count
      ? `Copied “${elLabel(el)}” onto ${count} page${count === 1 ? "" : "s"}.`
      : "No other pages in that range.");
  };
  const groupSelected = () => {
    const ids = new Set(ed.selIds);
    const members = page.els.filter((e) => ids.has(e.id));
    if (members.length < 2) {
      ed.setStatus("Pick at least two layers first (Ctrl+click rows adds to the selection), then group.");
      return;
    }
    const gname = window.prompt("Group name:", "Group");
    if (gname === null) return;
    const g = gname.trim() || "Group";
    const top = Math.max(...members.map((e) => page.els.indexOf(e)));
    const insertAt = page.els.slice(0, top + 1).filter((e) => !ids.has(e.id)).length;
    const rest = page.els.filter((e) => !ids.has(e.id));
    members.forEach((m) => { m.group = g; });
    page.els = [...rest.slice(0, insertAt), ...members, ...rest.slice(insertAt)];
    commit();
  };
  const ungroup = (g: string) => {
    for (const e of page.els) if (e.group === g) delete e.group;
    collapsedGroups.delete(g);
    commit();
  };
  /* drag the grip to reorder — the row follows the finger and drops into
     whichever slot it's released over (the list shows FRONT first, so
     dragging DOWN moves the element BACK in the stack) */
  const dragRow = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const grip = e.currentTarget as HTMLElement;
    const rowEl = grip.closest(".layerRow") as HTMLElement;
    const list = rowEl.parentElement as HTMLElement;
    const rows = [...list.querySelectorAll(".layerRow")] as HTMLElement[];
    const pitch = rows.length > 1 ? rows[1].offsetTop - rows[0].offsetTop : rowEl.offsetHeight + 4;
    const di = rows.indexOf(rowEl);
    const startY = e.clientY;
    const pid = e.pointerId;
    let dragging = false;
    const slotsOf = (ev: PointerEvent) =>
      clamp(Math.round((ev.clientY - startY) / Math.max(1, pitch)), -di, rows.length - 1 - di);
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      const dy = ev.clientY - startY;
      if (!dragging && Math.abs(dy) > 5) { dragging = true; rowEl.classList.add("dragging"); }
      if (!dragging) return;
      ev.preventDefault();
      rowEl.style.transform = `translateY(${slotsOf(ev) * pitch}px)`;
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pid) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      rowEl.style.transform = "";
      rowEl.classList.remove("dragging");
      if (!dragging) return;
      const slots = slotsOf(ev);
      if (slots) move(id, -slots);   // list is reversed vs the els array
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };
  return (
    <div className="inspBody">
      <div className="fld">
        <label>Auto-lock new items</label>
        <input type="checkbox" checked={autoLock} onChange={(e) => setAutoLock(e.target.checked)} />
      </div>
      <div className="tips">Every item is its own layer; top of the list = front of the page. Drag the ⠿ grip to reorder, double-click to rename, Ctrl+click to pick several, right-click for more (copy to other pages…).</div>
      <div className="layerList">
        {(() => {
          const rows: React.ReactNode[] = [];
          let lastGroup: string | undefined;
          const eyeSvg = (hidden: boolean | undefined) => (
            <svg viewBox="0 0 24 24">
              <path d="M2.5 12 C5.5 6.8 9 5 12 5 s6.5 1.8 9.5 7 C18.5 17.2 15 19 12 19 s-6.5-1.8-9.5-7 Z" />
              {!hidden && <circle cx={12} cy={12} r={3} />}
              {hidden && <line x1={4} y1={20} x2={20} y2={4} />}
            </svg>
          );
          for (const el of els) {
            const g = el.group;
            if (g && g !== lastGroup) {
              const members = page.els.filter((e) => e.group === g);
              const allHid = members.every((m) => m.hidden);
              const shut = collapsedGroups.has(g);
              rows.push(
                <div key={`grp-${g}-${rows.length}`} className="layerGroupRow"
                  onClick={() => { if (shut) collapsedGroups.delete(g); else collapsedGroups.add(g); ed.force(); }}
                  onDoubleClick={() => {
                    const n = window.prompt("Group name:", g);
                    if (n === null) return;
                    const name = n.trim() || g;
                    for (const m of members) m.group = name;
                    commit();
                  }}>
                  <span className="grpChev">{shut ? "▸" : "▾"}</span>
                  <svg className="grpFolder" viewBox="0 0 24 24">
                    <path d="M3.5 7 a1.5 1.5 0 0 1 1.5 -1.5 h4.4 l2 2.2 h7.6 a1.5 1.5 0 0 1 1.5 1.5 V17 a1.5 1.5 0 0 1 -1.5 1.5 H5 A1.5 1.5 0 0 1 3.5 17 Z" />
                  </svg>
                  <span className="layerName">{g}</span>
                  <button className={"layerBtn eye" + (allHid ? " shut" : "")}
                    title={allHid ? "Show the whole group" : "Hide the whole group"}
                    onClick={(e) => {
                      e.stopPropagation();
                      for (const m of members) m.hidden = !allHid ? true : undefined;
                      commit();
                    }}>{eyeSvg(allHid)}</button>
                  <button className="layerBtn" title="Ungroup"
                    onClick={(e) => { e.stopPropagation(); ungroup(g); }}>✕</button>
                </div>
              );
            }
            lastGroup = g;
            if (g && collapsedGroups.has(g)) continue;
            rows.push(
              <div key={el.id}
                className={"layerRow" + (ed.selIds.includes(el.id) ? " on" : "") + (el.hidden ? " off" : "") + (g ? " inGroup" : "")}
                onClick={(e) => select(el.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                onDoubleClick={() => rename(el)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  select(el.id);
                  layerCtxPos = { x: Math.min(e.clientX, innerWidth - 230), y: Math.min(e.clientY, innerHeight - 240) };
                  layerCtxAsking = false;
                  layerCtxRange = "";
                  ed.setOpenMenu(`layerCtx:${el.id}`);
                }}>
                <span className="layerGrip" title="Drag to reorder"
                  onPointerDown={(e) => dragRow(e, el.id)}>
                  <svg viewBox="0 0 8 16">{[2, 6].map((x) => [2, 8, 14].map((y) => (
                    <circle key={`${x}${y}`} cx={x} cy={y} r={1.2} />)))}</svg>
                </span>
                <button className={"layerBtn eye" + (el.hidden ? " shut" : "")}
                  title={el.hidden ? "Show this layer" : "Hide this layer (it leaves the page, thumbnails and exports until switched back on)"}
                  onClick={(e) => {
                    e.stopPropagation();
                    el.hidden = !el.hidden;
                    commit();
                  }}>{eyeSvg(el.hidden)}</button>
                <span className="layerName" title={elLabel(el) + " — double-click to rename"}>{elLabel(el)}</span>
                {el.type === "adjust" && (
                  <button className="layerBtn" title="Edit this adjustment's sliders"
                    onClick={(e) => { e.stopPropagation(); ed.setAdjustEdit(el.id); }}>✎</button>
                )}
                <button className={"layerBtn" + (el.locked ? " lockOn" : "")} title={el.locked ? "Unlock" : "Lock"}
                  onClick={(e) => {
                    e.stopPropagation();
                    el.locked = !el.locked;
                    pendingLockRef.current.delete(el.id);
                    commit();
                  }}>{el.locked ? "🔒" : "🔓"}</button>
              </div>
            );
          }
          return rows;
        })()}
        {els.length === 0 && <div className="tips">Nothing on this page yet.</div>}
      </div>
      {/* the layer context menu: rename, copy to other pages, delete */}
      {ed.openMenu?.startsWith("layerCtx:") && (() => {
        const el = page.els.find((x) => x.id === ed.openMenu!.slice(9));
        if (!el) return null;
        const close = () => ed.setOpenMenu(null);
        return (
          <>
            <div className="menuBackdrop" onPointerDown={close} />
            <div className="lfMenu layerCtxMenu" style={{ left: layerCtxPos.x, top: layerCtxPos.y }}>
              {!layerCtxAsking ? (
                <>
                  <button onClick={() => { close(); rename(el); }}>Rename…</button>
                  {el.type === "adjust" && (
                    <button onClick={() => { close(); ed.setAdjustEdit(el.id); }}>Edit sliders…</button>
                  )}
                  <div className="lfSep" />
                  <button onClick={() => {
                    close();
                    copyToPages(el, ed.doc!.pages.map((_, i) => i));
                  }}>Copy to ALL pages</button>
                  <button onClick={() => { layerCtxAsking = true; ed.force(); }}>Copy to pages…</button>
                  <div className="lfSep" />
                  <button className="lfDanger" onClick={() => {
                    close();
                    if (el.locked) { ed.setStatus("This layer is locked — unlock it first."); return; }
                    page.els = page.els.filter((x) => x.id !== el.id);
                    commit();
                  }}>Delete layer</button>
                </>
              ) : (
                <>
                  <div className="lfLabel">Pages (e.g. 2, 4-6):</div>
                  <input autoFocus defaultValue={layerCtxRange} placeholder={`1-${ed.doc!.pages.length}`}
                    onChange={(e) => { layerCtxRange = e.target.value; }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        close();
                        copyToPages(el, parsePageList(layerCtxRange, ed.doc!.pages.length));
                      }
                      e.stopPropagation();
                    }} />
                  <div className="lfRow">
                    <button onClick={() => { layerCtxAsking = false; ed.force(); }}>Back</button>
                    <button className="lfGo" onClick={() => {
                      close();
                      copyToPages(el, parsePageList(layerCtxRange, ed.doc!.pages.length));
                    }}>Apply</button>
                  </div>
                </>
              )}
            </div>
          </>
        );
      })()}
      {/* the standard layers control strip: new / duplicate / delete —
          layers shouldn't have to live forever */}
      <div className="layerFoot">
        <span className="lfWrap">
          <button className="layerBtn lfBtn" title="New layer…"
            onClick={(e) => { e.stopPropagation(); ed.setOpenMenu(ed.openMenu === "layerAdd" ? null : "layerAdd"); }}>
            <svg viewBox="0 0 24 24"><rect x={4} y={4} width={16} height={16} rx={3} /><path d="M12 8.5 v7 M8.5 12 h7" /></svg>
          </button>
          {ed.openMenu === "layerAdd" && (
            <>
              <div className="menuBackdrop" onPointerDown={() => ed.setOpenMenu(null)} />
              <div className="lfMenu">
                {([["Balloon", "speech"], ["Caption box", "caption"], ["Text", "text"], ["SFX lettering", "sfx"], ["Panel", "panel"]] as const).map(([label, kind]) => (
                  <button key={kind} onClick={() => { ed.setOpenMenu(null); addFromTray(ed, kind); }}>{label}</button>
                ))}
                <button onClick={() => {
                  ed.setOpenMenu(null);
                  ed.setTab("inspector");
                  ed.setStatus("Adjustment layers live at the bottom of the Inspector — pick a tool there.");
                }}>Adjustment layer…</button>
              </div>
            </>
          )}
        </span>
        <button className="layerBtn lfBtn" disabled={!selId} title="Duplicate the selected layer (Ctrl+D)"
          onClick={() => duplicateSel(ed)}>
          <svg viewBox="0 0 24 24"><rect x={8} y={8} width={12} height={12} rx={2.5} /><path d="M16 4.5 H7 a2.5 2.5 0 0 0 -2.5 2.5 V16" /></svg>
        </button>
        <button className="layerBtn lfBtn" disabled={ed.selIds.length < 2}
          title="Group the selected layers (Ctrl+click rows to pick several)"
          onClick={groupSelected}>
          <svg viewBox="0 0 24 24"><path d="M3.5 7 a1.5 1.5 0 0 1 1.5 -1.5 h4.4 l2 2.2 h7.6 a1.5 1.5 0 0 1 1.5 1.5 V17 a1.5 1.5 0 0 1 -1.5 1.5 H5 A1.5 1.5 0 0 1 3.5 17 Z" /><path d="M12 10.5 v5 M9.5 13 h5" /></svg>
        </button>
        <span className="lfSpacer" />
        <button className="layerBtn lfBtn lfTrash" disabled={!selId} title="Delete the selected layer (Del)"
          onClick={() => deleteSel(ed)}>
          <svg viewBox="0 0 24 24"><path d="M5.5 7 h13 M10 7 V5 a1 1 0 0 1 1 -1 h2 a1 1 0 0 1 1 1 v2 M7 7 l1 12.2 a1.6 1.6 0 0 0 1.6 1.3 h4.8 a1.6 1.6 0 0 0 1.6 -1.3 L17 7 M10.2 10.5 l.4 7 M13.8 10.5 l-.4 7" /></svg>
        </button>
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
