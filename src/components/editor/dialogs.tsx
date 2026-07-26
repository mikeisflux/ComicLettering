/* Balloon tray (bottom bar), context menu and modal dialogs.
   Plain exported render functions taking the EditorCtx bag. */
import { clamp, makeText } from "@/lib/model";
import { LETTER_STYLES, applyLetterStyle } from "@/lib/presets";
import { STAMPS, WORD_STAMPS, letterStyleCss } from "./textHelpers";
import { TrayBtn } from "./chrome";
import { EditorCtx } from "./ctx";
import {
  addAttachedBubble, addFromTray, alignSel, copySel, cutSel, deleteSel,
  doFindReplace, duplicateSel, importScript, insertCustomStamp, insertSfxStamp,
  pasteClip, removeCustomStamp, reorder, resizeToActual, resolveTailAsk, runExport,
} from "./ops";
import { SFX_STAMPS } from "@/lib/sfxStamps";


export function renderTray(ed: EditorCtx) {
  const {
    drawMode, setDrawMode, setStatus, stampOpen, setStampOpen, pendingLockRef, commit, setSelId, customStamps, fileStampRef, status,
    stampQuery, setStampQuery,
  } = ed;
  const page = ed.page!;
  const q = stampQuery.trim().toLowerCase();
  const sfxMatches = q ? SFX_STAMPS.filter((st) => st.l.toLowerCase().includes(q)) : SFX_STAMPS;
  return (
  <footer className="tray">
    <TrayBtn onClick={() => addFromTray(ed, "text")} label="Text">
      <svg viewBox="0 0 40 30"><rect x="4" y="6" width="32" height="18" fill="#fff" stroke="#333" strokeWidth="1.5" /><text x="20" y="19" textAnchor="middle" fontSize="9" fill="#333">ABCDE…</text></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "sfx")} label="Lettering">
      <svg viewBox="0 0 40 30"><text x="20" y="22" textAnchor="middle" fontSize="15" fontFamily="Impact, sans-serif" fill="#fc3" stroke="#222" strokeWidth="1.2" transform="rotate(-6 20 15)">POW!</text></svg>
    </TrayBtn>
    <span className="traySep" />
    <TrayBtn onClick={() => addFromTray(ed, "speech")} label="Speech">
      <svg viewBox="0 0 40 30"><ellipse cx="20" cy="12" rx="16" ry="10" fill="#fff" stroke="#222" strokeWidth="2" /><path d="M14 20 L10 28 L21 21 Z" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "rough")} label="Rough">
      <svg viewBox="0 0 40 30"><path d="M6 12 Q5 7 10 5 Q14 2 20 3 Q27 2 31 5 Q36 8 35 12 Q36 17 31 19 Q26 22 20 21 Q13 22 9 19 Q4 17 6 12 Z" fill="#fff" stroke="#222" strokeWidth="1.8" /><path d="M14 20 L10 28 L21 21 Z" fill="#fff" stroke="#222" strokeWidth="1.8" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "buzz")} label="Buzz">
      <svg viewBox="0 0 40 30"><path d="M20 2 L23 5 L28 3 L29 7 L35 8 L33 12 L37 15 L32 17 L33 21 L27 20 L24 24 L20 21 L16 24 L13 20 L7 21 L8 17 L3 15 L7 12 L5 8 L11 7 L12 3 L17 5 Z" fill="#fff" stroke="#222" strokeWidth="1.6" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "double")} label="Radio">
      <svg viewBox="0 0 40 30"><ellipse cx="20" cy="13" rx="16" ry="10" fill="#fff" stroke="#222" strokeWidth="1.8" /><ellipse cx="20" cy="13" rx="13" ry="7.6" fill="none" stroke="#222" strokeWidth="1.4" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "thought")} label="Thought">
      <svg viewBox="0 0 40 30"><ellipse cx="20" cy="11" rx="15" ry="9" fill="#fff" stroke="#222" strokeWidth="2" /><circle cx="12" cy="23" r="3" fill="#fff" stroke="#222" strokeWidth="2" /><circle cx="8" cy="28" r="1.7" fill="#fff" stroke="#222" strokeWidth="1.5" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "shout")} label="Shout">
      <svg viewBox="0 0 40 30"><path d="M36.2 10.5 L30.5 14.1 L36.1 17.9 L28.4 18.5 L29.8 23.8 L23.1 21.1 L19.8 26.0 L16.6 21.0 L9.8 23.6 L11.4 18.3 L3.8 17.5 L9.5 13.9 L3.9 10.1 L11.6 9.5 L10.2 4.2 L16.9 6.9 L20.2 2.0 L23.4 7.0 L30.2 4.4 L28.6 9.7 Z" fill="#fff" stroke="#222" strokeWidth="1.6" strokeLinejoin="miter" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "burst2")} label="Exclaim 2">
      <svg viewBox="0 0 40 30"><path d="M36.9 15.2 L31.0 16.6 L34.5 20.3 L28.3 19.7 L29.2 24.1 L24.0 21.7 L22.1 25.9 L18.8 22.1 L14.6 25.4 L14.0 21.0 L8.1 22.6 L10.3 18.4 L4.0 18.1 L8.5 15.0 L3.1 12.8 L9.0 11.4 L5.5 7.7 L11.7 8.3 L10.8 3.9 L16.0 6.3 L17.9 2.1 L21.2 5.9 L25.4 2.6 L26.0 7.0 L31.9 5.4 L29.7 9.6 L36.0 9.9 L31.5 13.0 Z" fill="#fff" stroke="#222" strokeWidth="1.4" strokeLinejoin="miter" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "whisper")} label="Whisper">
      <svg viewBox="0 0 40 30"><ellipse cx="20" cy="12" rx="16" ry="10" fill="#fff" stroke="#222" strokeWidth="2" strokeDasharray="4 3" /><path d="M14 20 L10 28 L21 21 Z" fill="#fff" stroke="#222" strokeWidth="2" strokeDasharray="3 3" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "square")} label="Square">
      <svg viewBox="0 0 40 30"><rect x="4" y="3" width="32" height="18" fill="#fff" stroke="#222" strokeWidth="2" /><path d="M14 21 L10 28 L21 21 Z" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "tv")} label="TV">
      <svg viewBox="0 0 40 30"><rect x="4" y="3" width="32" height="17" rx="3" fill="#fff" stroke="#222" strokeWidth="2" /><path d="M15 20 L12 23 L16 24 L11 29 L20 22 L16 22 Z" fill="#fff" stroke="#222" strokeWidth="1.5" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "extend")} label="Pill">
      <svg viewBox="0 0 40 30"><rect x="4" y="5" width="32" height="15" rx="7.5" fill="#fff" stroke="#222" strokeWidth="2" /><path d="M14 19 L10 28 L20 20 Z" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "caption")} label="Caption">
      <svg viewBox="0 0 40 30"><rect x="4" y="7" width="32" height="16" fill="#ffef9e" stroke="#222" strokeWidth="2" /><line x1="8" y1="12" x2="32" y2="12" stroke="#999" strokeWidth="2" /><line x1="8" y1="17" x2="26" y2="17" stroke="#999" strokeWidth="2" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "rounded")} label="Rounded">
      <svg viewBox="0 0 40 30"><rect x="4" y="6" width="32" height="18" rx="6" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "cosmic")} label="Dotted">
      <svg viewBox="0 0 40 30">
        <ellipse cx="20" cy="15" rx="13" ry="9" fill="#fff" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a, i) => (
          <circle key={a} cx={20 + 15 * Math.cos((a * Math.PI) / 180)} cy={15 + 11 * Math.sin((a * Math.PI) / 180)} r={i % 3 === 0 ? 2 : 1.3} fill="#222" />
        ))}
      </svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "sketch")} label="Sketchy">
      <svg viewBox="0 0 40 30">
        <ellipse cx="20" cy="13" rx="14" ry="9" fill="#fff" stroke="#222" strokeWidth="1.2" />
        <ellipse cx="20.6" cy="13.5" rx="13.6" ry="8.6" fill="none" stroke="#222" strokeWidth="1" />
        <path d="M15 21 L11 28 L21 22 Z" fill="#fff" stroke="#222" strokeWidth="1.2" />
      </svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "emitter")} label="Emitter">
      <svg viewBox="0 0 40 30">
        <ellipse cx="20" cy="15" rx="9" ry="6" fill="#fff" stroke="#222" strokeWidth="1.6" strokeDasharray="5 3" />
        <ellipse cx="20" cy="15" rx="14" ry="10" fill="none" stroke="#222" strokeWidth="1.6" strokeDasharray="6 4" />
      </svg>
    </TrayBtn>
    <TrayBtn active={drawMode} label="Draw" onClick={() => {
      setDrawMode((d) => !d);
      if (!drawMode) setStatus("Draw mode: drag on the page to sketch your own balloon outline in one stroke. Esc cancels.");
    }}>
      <svg viewBox="0 0 40 30"><path d="M7 20 Q4 11 13 7 Q24 3 33 9 Q39 14 31 20 Q24 25 14 23 L7 27 Z" fill="#fff" stroke="#222" strokeWidth="2" strokeDasharray="3 2" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addAttachedBubble(ed)} label="Add Bubble">
      <svg viewBox="0 0 40 30">
        <ellipse cx="23" cy="12" rx="13" ry="8.5" fill="#fff" stroke="#222" strokeWidth="2" />
        <path d="M16 18 L11 25 L20 19 Z" fill="#fff" stroke="#222" strokeWidth="1.5" />
        <path d="M7 21 v8 M3 25 h8" stroke="#222" strokeWidth="2.5" fill="none" />
      </svg>
    </TrayBtn>
    <span className="traySep" />
    <div style={{ position: "relative" }}>
      <TrayBtn onClick={() => setStampOpen((s) => !s)} label="Stamps">
        <svg viewBox="0 0 40 30"><text x="20" y="23" textAnchor="middle" fontSize="20">💥</text></svg>
      </TrayBtn>
      {stampOpen && (
        <div className="stampPop">
          <div className="stampWords">
            {WORD_STAMPS.map(([word, styleName, tilt]) => {
              const st = LETTER_STYLES.find((s) => s.name === styleName) || LETTER_STYLES[0];
              return (
                <button key={word} title={word} onClick={() => {
                  const p = page!;
                  const w = Math.round(p.w * 0.34), h = Math.round(p.w * 0.14);
                  const el = makeText(Math.round(p.w / 2 - w / 2), Math.round(p.h * 0.32), w, h, true);
                  el.text = word;
                  el.rot = tilt;
                  el.ts = applyLetterStyle({ ...el.ts, size: Math.round(p.w * 0.075) }, st);
                  el.ts.outlineW = Math.round(el.ts.size * st.outlineF);
                  p.els.push(el);
                  pendingLockRef.current.add(el.id);
                  commit();
                  setSelId(el.id);
                  setStampOpen(false);
                }}>
                  <span style={{ ...letterStyleCss(st, 15), transform: `rotate(${tilt}deg)`, display: "inline-block" }}>{word}</span>
                </button>
              );
            })}
          </div>
          <div className="stampSearch">
            <input value={stampQuery} placeholder={`Search ${SFX_STAMPS.length} sound effects…`}
              onChange={(e) => setStampQuery(e.target.value)} />
            {stampQuery && <button onClick={() => setStampQuery("")} title="Clear">✕</button>}
          </div>
          <div className="stampSfx">
            {sfxMatches.length === 0 && <p className="stampNone">No sound effect matches “{stampQuery}”.</p>}
            {sfxMatches.map((st) => (
              <button key={st.s} title={st.l} className="sfxStamp"
                onClick={() => insertSfxStamp(ed, st.s, st.l)}>
                <img src={`/stamps/${st.s}.png`} alt={st.l} loading="lazy" />
              </button>
            ))}
          </div>
          <div className="stampCustom">
            {customStamps.map((s) => (
              <span key={s.id} className="stampThumb">
                <button style={{ backgroundImage: `url(${s.url})` }} title="Place stamp"
                  onClick={() => insertCustomStamp(ed, s.url)} />
                <i title="Remove from library" onClick={() => removeCustomStamp(ed, s.id)}>✕</i>
              </span>
            ))}
            <button className="stampImport" onClick={() => fileStampRef.current?.click()}>＋ Import stamps…</button>
          </div>
          <div className="stampEmoji">
            {STAMPS.map((s) => (
              <button key={s} onClick={() => {
                const p = page!;
                const size = Math.round(p.w * 0.16);
                const el = makeText(Math.round(p.w / 2 - size / 2), Math.round(p.h * 0.35), size, size, true);
                el.text = s;
                el.ts = { ...el.ts, size: Math.round(size * 0.7), outlineW: 0, shadow: false, caps: false };
                p.els.push(el);
                pendingLockRef.current.add(el.id);
                commit();
                setSelId(el.id);
                setStampOpen(false);
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
    <TrayBtn onClick={() => addFromTray(ed, "panel")} label="Panel">
      <svg viewBox="0 0 40 30"><rect x="3" y="3" width="34" height="24" fill="#fff" stroke="#222" strokeWidth="3" /></svg>
    </TrayBtn>
    <TrayBtn onClick={() => addFromTray(ed, "image")} label="Image">
      <svg viewBox="0 0 40 30"><rect x="3" y="3" width="34" height="24" fill="#cde" /><circle cx="13" cy="11" r="4" fill="#fc3" /><path d="M6 25 L17 14 L24 21 L30 16 L36 25 Z" fill="#4a7" /></svg>
    </TrayBtn>
    <div className="tbSpacer" />
    <div className="statusbar">{status}</div>
  </footer>
  );
}

/* context menu */
export function renderContextMenu(ed: EditorCtx) {
  const { ctxMenu, setCtxMenu, commit, pendingLockRef, setUserZoomed,
    setZoom, clipboardRef, setEditingId, panelImageTarget, filePanelImageRef } = ed;
  const page = ed.page!;
  if (!ctxMenu) return null;
    const el = page.els.find((e) => e.id === ctxMenu.id);
    if (!el) return null;
    const close = () => setCtxMenu(null);
    return (
      <>
        <div className="ctxBackdrop" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
        {/* Anchored at the cursor and never taller than the room it has. Low
            on the screen it opens upward instead, and if even that is not
            enough it scrolls — so no item is ever stranded off-screen. */}
        <div className="ctxMenu" style={(() => {
          const M = 8;
          const left = Math.max(M, Math.min(ctxMenu.x, window.innerWidth - 190));
          const below = window.innerHeight - ctxMenu.y - M;
          const above = ctxMenu.y - M;
          return above > below
            ? { left, bottom: window.innerHeight - ctxMenu.y, maxHeight: above }
            : { left, top: Math.max(M, ctxMenu.y), maxHeight: below };
        })()}>
          <button disabled={el.locked} onClick={() => { reorder(ed, 1); close(); }}>Bring Forward</button>
          <button disabled={el.locked} onClick={() => { reorder(ed, 1e9); close(); }}>Bring To Front</button>
          <button disabled={el.locked} onClick={() => { reorder(ed, -1); close(); }}>Send Backward</button>
          <button disabled={el.locked} onClick={() => { reorder(ed, -1e9); close(); }}>Send To Back</button>
          <div className="ctxSep" />
          <div className="ctxSub">
            <button disabled={el.locked} className="ctxSubHead">Align Object ▸</button>
            <div className="ctxSubMenu">
              <button disabled={el.locked} onClick={() => { alignSel(ed, "left"); close(); }}>Left</button>
              <button disabled={el.locked} onClick={() => { alignSel(ed, "hcenter"); close(); }}>Center</button>
              <button disabled={el.locked} onClick={() => { alignSel(ed, "right"); close(); }}>Right</button>
              <button disabled={el.locked} onClick={() => { alignSel(ed, "top"); close(); }}>Top</button>
              <button disabled={el.locked} onClick={() => { alignSel(ed, "vcenter"); close(); }}>Middle</button>
              <button disabled={el.locked} onClick={() => { alignSel(ed, "bottom"); close(); }}>Bottom</button>
            </div>
          </div>
          <div className="ctxSep" />
          <button onClick={() => { setUserZoomed(true); setZoom((z) => clamp(z * 1.2, 0.05, 4)); close(); }}>Zoom In</button>
          <button onClick={() => { setUserZoomed(true); setZoom((z) => clamp(z / 1.2, 0.05, 4)); close(); }}>Zoom Out</button>
          <div className="ctxSep" />
          <button disabled={el.locked} onClick={() => { el.locked = true; pendingLockRef.current.delete(el.id); commit(); close(); }}>Lock</button>
          <button disabled={!el.locked} onClick={() => { el.locked = false; pendingLockRef.current.delete(el.id); commit(); close(); }}>Unlock</button>
          <div className="ctxSep" />
          <button disabled={el.locked} onClick={() => { cutSel(ed); close(); }}>Cut</button>
          <button onClick={() => { copySel(ed); close(); }}>Copy</button>
          <button disabled={!clipboardRef.current} onClick={() => { pasteClip(ed); close(); }}>Paste</button>
          <button onClick={() => { duplicateSel(ed); close(); }}>Duplicate</button>
          <button disabled={el.locked} className="danger" onClick={() => { deleteSel(ed); close(); }}>Delete</button>
          {(el.type === "balloon" || el.type === "text") && (
            <>
              <div className="ctxSep" />
              <button disabled={el.locked} onClick={() => { setEditingId(el.id); close(); }}>Edit Text</button>
              {el.type === "balloon" && el.attachTo && (
                <button disabled={el.locked} onClick={() => { el.attachTo = null; commit(); close(); }}>Detach Balloon</button>
              )}
            </>
          )}
          {(el.type === "panel" || el.type === "image") && (
            <>
              <div className="ctxSep" />
              <button disabled={el.locked} onClick={() => { panelImageTarget.current = el.id; filePanelImageRef.current?.click(); close(); }}>
                {el.img ? "Replace Image…" : "Set Image…"}
              </button>
              {el.img && <button disabled={el.locked} onClick={() => { resizeToActual(ed); close(); }}>Resize Image to Actual Size</button>}
            </>
          )}
        </div>
      </>
    );
}

/* tail chooser for a freshly sketched balloon */
export function renderTailAsk(ed: EditorCtx) {
  const { tailAsk } = ed;
  if (!tailAsk) return null;
  return (
    <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) resolveTailAsk(ed, "none"); }}>
      <div className="setupDlg" style={{ width: 330 }}>
        <div className="setupTitle">Add a tail?</div>
        <div className="setupBody" style={{ flexDirection: "column", gap: 8 }}>
          <div className="tailChoices">
            <button onClick={() => resolveTailAsk(ed, "speech")}>
              <svg viewBox="0 0 48 40"><ellipse cx="24" cy="15" rx="20" ry="12" fill="#fff" stroke="#222" strokeWidth="2" /><path d="M18 25 L13 37 L26 26 Z" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
              Speech tail
            </button>
            <button onClick={() => resolveTailAsk(ed, "thought")}>
              <svg viewBox="0 0 48 40"><ellipse cx="24" cy="14" rx="20" ry="11" fill="#fff" stroke="#222" strokeWidth="2" /><circle cx="16" cy="30" r="4" fill="#fff" stroke="#222" strokeWidth="2" /><circle cx="10" cy="37" r="2.5" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
              Thought bubbles
            </button>
            <button onClick={() => resolveTailAsk(ed, "none")}>
              <svg viewBox="0 0 48 40"><ellipse cx="24" cy="20" rx="20" ry="13" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
              No tail
            </button>
          </div>
          <div style={{ fontSize: 12, color: "#667" }}>You can aim the tail afterwards by dragging the orange dot.</div>
        </div>
      </div>
    </div>
  );
}

/* export dialog */
export function renderExportDialog(ed: EditorCtx) {
  const { showExport, setShowExport, exportFmt, setExportFmt, exportDpi, setExportDpi, exportScope, setExportScope, exportFrom, setExportFrom, exportTo, setExportTo, letteringOnly, setLetteringOnly, exportCropMarks, setExportCropMarks } = ed;
  const doc = ed.doc!;
  if (!showExport) return null;
  return (
    <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setShowExport(false); }}>
      <div className="setupDlg" style={{ width: 430 }}>
        <div className="setupTitle">Export</div>
        <div className="setupBody" style={{ flexDirection: "column" }}>
          <fieldset className="setupGroup">
            <legend>Format</legend>
            <div className="setupRow" style={{ flexWrap: "wrap" }}>
              {([["png", "PNG"], ["jpg", "JPG"], ["tiff", "TIFF (print)"], ["pdf", "PDF"], ["cbz", "CBZ (comic reader)"]] as const).map(([k, label]) => (
                <label key={k}><input type="radio" name="expfmt" checked={exportFmt === k}
                  onChange={() => setExportFmt(k)} /> {label}</label>
              ))}
            </div>
          </fieldset>
          <fieldset className="setupGroup">
            <legend>Resolution</legend>
            <div className="setupRow">
              <span className="setupLbl">Image limit:</span>
              <select value={exportDpi} onChange={(e) => setExportDpi(+e.target.value)}>
                <option value={150}>150 dpi (web)</option>
                <option value={225}>225 dpi (native)</option>
                <option value={300}>300 dpi (print)</option>
                <option value={450}>450 dpi (high-res print)</option>
              </select>
            </div>
          </fieldset>
          <fieldset className="setupGroup">
            <legend>Pages</legend>
            <div className="setupRow" style={{ flexWrap: "wrap" }}>
              <label><input type="radio" name="expscope" checked={exportScope === "all"}
                onChange={() => setExportScope("all")} /> All ({doc.pages.length})</label>
              <label><input type="radio" name="expscope" checked={exportScope === "current"}
                onChange={() => setExportScope("current")} /> Current</label>
              <label><input type="radio" name="expscope" checked={exportScope === "range"}
                onChange={() => setExportScope("range")} /> From</label>
              <input type="number" min={1} max={doc.pages.length} value={exportFrom} style={{ width: 54 }}
                onFocus={() => setExportScope("range")}
                onChange={(e) => setExportFrom(clamp(+e.target.value || 1, 1, doc.pages.length))} />
              <span>to</span>
              <input type="number" min={1} max={doc.pages.length} value={exportTo} style={{ width: 54 }}
                onFocus={() => setExportScope("range")}
                onChange={(e) => setExportTo(clamp(+e.target.value || 1, 1, doc.pages.length))} />
            </div>
          </fieldset>
          <fieldset className="setupGroup">
            <legend>Options</legend>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={letteringOnly} onChange={(e) => setLetteringOnly(e.target.checked)} />
              Lettering only — transparent PNG (balloons &amp; text, no artwork)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, opacity: exportFmt === "pdf" ? 1 : 0.5 }}>
              <input type="checkbox" checked={exportCropMarks} disabled={exportFmt !== "pdf"}
                onChange={(e) => setExportCropMarks(e.target.checked)} />
              Printer crop marks (PDF only — adds a bleed margin &amp; trim marks)
            </label>
          </fieldset>
        </div>
        <div className="setupFoot">
          <button onClick={() => setShowExport(false)}>Cancel</button>
          <button className="okBtn" onClick={() => runExport(ed, exportFmt, exportScope, exportDpi)}>Export</button>
        </div>
      </div>
    </div>
  );
}

/* find & replace dialog */
export function renderFindDialog(ed: EditorCtx) {
  const { showFind, setShowFind, findText, setFindText, replaceText, setReplaceText, findCase, setFindCase } = ed;
  if (!showFind) return null;
  return (
    <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setShowFind(false); }}>
      <div className="setupDlg" style={{ width: 420 }}>
        <div className="setupTitle">Find &amp; Replace</div>
        <div className="setupBody" style={{ flexDirection: "column" }}>
          <fieldset className="setupGroup">
            <legend>Find</legend>
            <input type="text" value={findText} autoFocus placeholder="Text to find…"
              style={{ width: "100%" }}
              onChange={(e) => setFindText(e.target.value)} />
          </fieldset>
          <fieldset className="setupGroup">
            <legend>Replace with</legend>
            <input type="text" value={replaceText} placeholder="Replacement text…"
              style={{ width: "100%" }}
              onChange={(e) => setReplaceText(e.target.value)} />
          </fieldset>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={findCase} onChange={(e) => setFindCase(e.target.checked)} />
            Match case
          </label>
          <div className="mutedNote" style={{ fontSize: 12, opacity: .7 }}>
            Searches all text and balloon lettering across every page. Locked items are skipped.
          </div>
        </div>
        <div className="setupFoot">
          <button onClick={() => setShowFind(false)}>Close</button>
          <button className="okBtn" disabled={!findText} onClick={() => doFindReplace(ed, true)}>Replace All</button>
        </div>
      </div>
    </div>
  );
}

/* import script dialog */
export function renderScriptDialog(ed: EditorCtx) {
  const { showScript, setShowScript, scriptText, setScriptText } = ed;
  if (!showScript) return null;
  return (
    <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setShowScript(false); }}>
      <div className="setupDlg" style={{ width: 560 }}>
        <div className="setupTitle">Import Script → Balloons</div>
        <div className="setupBody" style={{ flexDirection: "column" }}>
          <div className="mutedNote" style={{ fontSize: 12, opacity: .75, marginBottom: 6 }}>
            Paste your script. One line each: <code>CHARACTER: dialogue</code>.
            Use <code>CAPTION:</code>, <code>SFX:</code>, and parentheticals like
            <code> JANE (thought):</code> or <code>(whisper)</code>. PAGE / PANEL headers are ignored.
            Balloons are laid out on the current page for you to arrange.
          </div>
          <textarea value={scriptText} autoFocus
            onChange={(e) => setScriptText(e.target.value)}
            placeholder={"PAGE 1\nPANEL 1\nJANE: We shouldn't be here.\nMARK (whisper): Too late now.\nCAPTION: Later that night…\nSFX: KRAKKA-THOOM"}
            style={{ width: "100%", height: 220, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, resize: "vertical" }} />
        </div>
        <div className="setupFoot">
          <button onClick={() => setShowScript(false)}>Cancel</button>
          <button className="okBtn" disabled={!scriptText.trim()} onClick={() => importScript(ed)}>Add to page</button>
        </div>
      </div>
    </div>
  );
}
