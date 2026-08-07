/* Right-panel Inspector — page / element property editors.
   Plain exported render functions taking the EditorCtx bag. */
import {
  AdjustKind, BALLOON_KINDS, BLEED, BalloonEl, BalloonKind, FILTERS, FONTS, FadeDir, PAGE_SIZES,
  PanelEl, TAILLESS_KINDS, TextEl, TextStyle, clamp,
} from "@/lib/model";
import { ADJUST_META, makeAdjust } from "@/lib/pageAdjust";
import { Fld } from "./textHelpers";
import { FontMenu, SubtypeSelect, tsVariant } from "./FontMenu";
import { FillPicker } from "./FillPicker";
import { EditorCtx } from "./ctx";
import {
  applyBalloonPreset, deleteBalloonPreset, deleteCustomFont, deleteSel,
  duplicateSel, fitBalloonToText, reorder, runInstantAlpha, saveBalloonPreset,
} from "./ops";


export function tsControls(ed: EditorCtx, el: BalloonEl | TextEl) {
  const { mutateSel, fileFontRef } = ed;
  const ts = el.ts;
  const set = (patch: Partial<TextStyle>, final = true) =>
    mutateSel<BalloonEl | TextEl>((x) => { x.ts = { ...x.ts, ...patch }; }, final);
  return (
    <div className="inspSection">
      <div className="inspHead">Lettering</div>
      <Fld label="Font">
        <FontMenu value={ts.font} onImport={() => fileFontRef.current?.click()} onDeleteFont={(k) => deleteCustomFont(ed, k)} onPick={(k) => {
          const vars = FONTS[k]?.variants || ["regular"];
          const keep = vars.includes(tsVariant(ts) as never);
          set({ font: k, ...(keep ? {} : { bold: false, italic: false }) });
        }} />
      </Fld>
      <Fld label="Face">
        <SubtypeSelect ts={ts} onSet={(bold, italic) => set({ bold, italic })} />
      </Fld>
      <Fld label="Size"><input type="number" min={8} max={800} value={ts.size}
        onChange={(e) => set({ size: clamp(+e.target.value || 8, 8, 800) })} /></Fld>
      <Fld label="ALL CAPS"><input type="checkbox" checked={ts.caps} onChange={(e) => set({ caps: e.target.checked })} /></Fld>
      <Fld label="Crossbar “I”"><input type="checkbox" checked={!!ts.crossbarI} onChange={(e) => set({ crossbarI: e.target.checked })} /></Fld>
      <Fld label="Underline"><input type="checkbox" checked={!!ts.underline} onChange={(e) => set({ underline: e.target.checked })} /></Fld>
      <Fld label="Align">
        <select value={ts.align} onChange={(e) => set({ align: e.target.value as TextStyle["align"] })}>
          <option value="left">Left</option><option value="center">Center</option>
          <option value="right">Right</option><option value="justify">Justify</option>
        </select>
      </Fld>
      <Fld label="Color"><input type="color" value={ts.fillA}
        onInput={(e) => set({ fillA: (e.target as HTMLInputElement).value }, false)}
        onChange={(e) => set({ fillA: e.target.value })} /></Fld>
      <Fld label="Gradient">
        <span className="pair">
          <input type="checkbox" checked={!!ts.fillB}
            onChange={(e) => set({ fillB: e.target.checked ? "#ff7a00" : null })} />
          {ts.fillB && <input type="color" value={ts.fillB}
            onChange={(e) => set({ fillB: e.target.value })} />}
        </span>
      </Fld>
      <Fld label="Outline">
        <span className="pair">
          <input type="number" min={0} max={80} value={ts.outlineW} style={{ width: 52 }}
            onChange={(e) => set({ outlineW: clamp(+e.target.value || 0, 0, 80) })} />
          <input type="color" value={ts.outlineC} onChange={(e) => set({ outlineC: e.target.value })} />
        </span>
      </Fld>
      <Fld label="Shadow"><input type="checkbox" checked={ts.shadow} onChange={(e) => set({ shadow: e.target.checked })} /></Fld>
    </div>
  );
}

/* the fade tool's popup anchor + labels */
let fadePos = { x: 0, y: 0 };
const FADE_DIR_LABEL: Record<FadeDir, string> = {
  tl: "Top-left corner", tr: "Top-right corner", bl: "Bottom-left corner", br: "Bottom-right corner",
  left: "Left edge", right: "Right edge", top: "Top edge", bottom: "Bottom edge",
  vignette: "All around (vignette)",
};
const FADE_DIR_GLYPH: Record<FadeDir, string> = {
  tl: "◤", top: "▲", tr: "◥", left: "◀", vignette: "◎", right: "▶", bl: "◣", bottom: "▼", br: "◢",
};

/* each adjustment tool's tile icon — small 24×24 glyphs in the spirit of
   the Photoshop adjustments panel, with a touch of colour where the tool
   is about colour */
const ADJ_ICONS: Record<AdjustKind, React.ReactNode> = {
  colorvib: (
    <svg viewBox="0 0 24 24"><path d="M12 4 L20 19 H4 Z" fill="none" stroke="currentColor" strokeWidth={1.8} />
      <path d="M12 9 L16.4 17.5 H7.6 Z" fill="#f0812c" stroke="none" /></svg>
  ),
  brightness: (
    <svg viewBox="0 0 24 24"><circle cx={12} cy={12} r={4} fill="#f5c518" stroke="currentColor" strokeWidth={1.2} />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={12 + Math.cos(a) * 6.5} y1={12 + Math.sin(a) * 6.5}
          x2={12 + Math.cos(a) * 9.5} y2={12 + Math.sin(a) * 9.5} stroke="currentColor" strokeWidth={1.6} />;
      })}</svg>
  ),
  exposure: (
    <svg viewBox="0 0 24 24"><rect x={3.5} y={3.5} width={17} height={17} rx={2} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path d="M20 4 L4 20" stroke="currentColor" strokeWidth={1.2} />
      <path d="M7 8 h4 M9 6 v4 M13.5 16.5 h4" stroke="currentColor" strokeWidth={1.6} /></svg>
  ),
  levels: (
    <svg viewBox="0 0 24 24">{[[4, 12], [8, 7], [12, 15], [16, 9]].map(([x, h], i) => (
      <rect key={i} x={x} y={20 - h} width={3.2} height={h} fill="currentColor" />))}
      <path d="M3 21 h18" stroke="currentColor" strokeWidth={1.4} /></svg>
  ),
  curves: (
    <svg viewBox="0 0 24 24"><rect x={3.5} y={3.5} width={17} height={17} fill="none" stroke="currentColor" strokeWidth={1.4} />
      <path d="M5 19 C 10 18 14 6 19 5" fill="none" stroke="#2f7fd6" strokeWidth={2} />
      <circle cx={12} cy={12} r={1.8} fill="#2f7fd6" /></svg>
  ),
  hsl: (
    <svg viewBox="0 0 24 24"><rect x={4} y={5} width={16} height={3.6} rx={1.4} fill="#e33" />
      <rect x={4} y={10.2} width={16} height={3.6} rx={1.4} fill="#3b3" />
      <rect x={4} y={15.4} width={16} height={3.6} rx={1.4} fill="#36e" /></svg>
  ),
  colorbalance: (
    <svg viewBox="0 0 24 24"><path d="M12 4 v16 M5 7 h14" stroke="currentColor" strokeWidth={1.6} fill="none" />
      <path d="M5 7 l-2.6 6 a3 3 0 0 0 5.2 0 Z" fill="#0cc" stroke="none" />
      <path d="M19 7 l-2.6 6 a3 3 0 0 0 5.2 0 Z" fill="#e33" stroke="none" />
      <path d="M9 20 h6" stroke="currentColor" strokeWidth={1.6} /></svg>
  ),
  bw: (
    <svg viewBox="0 0 24 24"><rect x={4} y={4} width={16} height={16} rx={2} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path d="M12 4 v16 H6 a2 2 0 0 1 -2 -2 V6 a2 2 0 0 1 2 -2 Z" fill="currentColor" /></svg>
  ),
  photofilter: (
    <svg viewBox="0 0 24 24"><rect x={3} y={7} width={18} height={12} rx={2} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path d="M8 7 l1.5 -2.5 h5 L16 7" fill="none" stroke="currentColor" strokeWidth={1.6} />
      <circle cx={12} cy={13} r={3.6} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <circle cx={12} cy={13} r={2} fill="#f0812c" /></svg>
  ),
  channelmixer: (
    <svg viewBox="0 0 24 24"><circle cx={9.4} cy={9.5} r={4.6} fill="#e33" opacity={0.85} />
      <circle cx={14.6} cy={9.5} r={4.6} fill="#3b3" opacity={0.7} />
      <circle cx={12} cy={14.2} r={4.6} fill="#36e" opacity={0.6} /></svg>
  ),
  colorlookup: (
    <svg viewBox="0 0 24 24">{["#e33", "#f5c518", "#3b3", "#0cc", "#36e", "#c3c", "#888", "#432", "#111"].map((c, i) => (
      <rect key={i} x={4.5 + (i % 3) * 5.2} y={4.5 + Math.floor(i / 3) * 5.2} width={4.4} height={4.4} rx={0.8} fill={c} />))}</svg>
  ),
  selectivecolor: (
    <svg viewBox="0 0 24 24"><rect x={4} y={4} width={16} height={16} rx={2} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path d="M4.8 4.8 L19.2 19.2 M19.2 4.8 L4.8 19.2" stroke="currentColor" strokeWidth={1.4} />
      <path d="M6 5 h12 l-6 6.4 Z" fill="#e33" opacity={0.8} /></svg>
  ),
  invert: (
    <svg viewBox="0 0 24 24"><rect x={4} y={4} width={16} height={16} rx={2} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path d="M19 5 L5 19 V7 a2 2 0 0 1 2 -2 Z" fill="currentColor" />
      <circle cx={15} cy={15} r={2.6} fill="currentColor" />
      <circle cx={9} cy={9} r={2.6} fill="#fff" /></svg>
  ),
  posterize: (
    <svg viewBox="0 0 24 24"><path d="M4 20 V16 h4 V12 h4 V8 h4 V4 h4 V20 Z" fill="currentColor" /></svg>
  ),
  threshold: (
    <svg viewBox="0 0 24 24"><rect x={4} y={4} width={16} height={16} rx={2} fill="none" stroke="currentColor" strokeWidth={1.6} />
      <path d="M12 4 h6 a2 2 0 0 1 2 2 v12 a2 2 0 0 1 -2 2 h-6 Z" fill="currentColor" />
      <path d="M8 8 v8 M12 8 v8" stroke="currentColor" strokeWidth={1.4} /></svg>
  ),
  gradientmap: (
    <svg viewBox="0 0 24 24">{[0, 1, 2, 3, 4].map((i) => (
      <rect key={i} x={4 + i * 3.2} y={7} width={3.2} height={10} fill="currentColor" opacity={1 - i * 0.21} />))}
      <rect x={3.6} y={6.6} width={16.6} height={10.8} rx={1.5} fill="none" stroke="currentColor" strokeWidth={1.4} /></svg>
  ),
  grain: (
    <svg viewBox="0 0 24 24">{[[6, 7, 1.3], [11, 5, 1], [16, 8, 1.5], [8, 12, 1], [13, 11, 1.3], [18, 13, 1], [5, 16, 1.4], [10, 17, 1.1], [15, 16, 1.4], [19, 18, 1]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill="currentColor" />))}</svg>
  ),
  clarity: (
    <svg viewBox="0 0 24 24"><circle cx={12} cy={12} r={7.5} fill="none" stroke="currentColor" strokeWidth={1.8} strokeDasharray="3 2.6" />
      <circle cx={12} cy={12} r={3} fill="currentColor" /></svg>
  ),
};

/* PAGE ADJUSTMENTS — a Photoshop-style tool grid. Every click adds an
   ADJUSTMENT LAYER to the current page (it appears in the Layers panel
   with its own eyeball) and opens that layer's slider dialog. Double-click
   the layer any time to re-tune it; delete the layer to drop the grade. */
export function renderPageAdjustSection(ed: EditorCtx) {
  const { page } = ed;
  if (!page) return null;
  return (
    <div className="inspSection">
      <div className="inspHead">Page adjustments</div>
      <div className="adjGrid">
        {(Object.keys(ADJUST_META) as AdjustKind[]).map((k) => (
          <button key={k} className="adjBtn" title={`Add a ${ADJUST_META[k].label} adjustment layer to this page`}
            onClick={() => {
              const layer = makeAdjust(k, page.w, page.h);
              page.els.push(layer);           // top of the stack
              ed.commit();
              ed.setSelId(layer.id);
              ed.setAdjustEdit(layer.id);
              ed.setStatus(`${ADJUST_META[k].label} layer added to this page — find it in Layers, eyeball it off, or double-click it to re-tune.`);
            }}>
            {ADJ_ICONS[k]}
            <span>{ADJUST_META[k].label}</span>
          </button>
        ))}
      </div>
      <div className="tips">
        Each tool adds an adjustment LAYER grading this whole page — switch it
        off with the layer&apos;s eyeball in Layers, double-click the layer to
        reopen its sliders, delete the layer to remove the grade. Grades print
        exactly as previewed.
      </div>
    </div>
  );
}

export function renderInspector(ed: EditorCtx) {
  const { page, selEl, commit, fitZoom, setShowSetup, force, mutateSel, presets, panelImageTarget, filePanelImageRef } = ed;
  if (!page) return null;
  if (!selEl) {
    const p = page;
    const sizeKey = PAGE_SIZES.find((s) => s.w === p.w && s.h === p.h)?.k || "custom";
    return (
      <div className="inspBody">
        <div className="inspSection">
          <div className="inspHead">Page</div>
          <Fld label="Size">
            <select value={sizeKey} onChange={(e) => {
              const s = PAGE_SIZES.find((x) => x.k === e.target.value);
              /* the preset carries its own bleed: an oversize board
                 needs an oversize bleed or the trim guide lies */
              if (s) { p.w = s.w; p.h = s.h; p.bleed = s.bleed ?? BLEED; commit(); fitZoom(true); }
            }}>
              {PAGE_SIZES.map((s) => <option key={s.k} value={s.k}>{s.label}</option>)}
              <option value="custom">Custom</option>
            </select>
          </Fld>
          <Fld label="Width px"><input type="number" min={200} max={6000} value={p.w}
            onChange={(e) => { p.w = clamp(+e.target.value || 200, 200, 6000); commit(); fitZoom(true); }} /></Fld>
          <Fld label="Height px"><input type="number" min={200} max={6000} value={p.h}
            onChange={(e) => { p.h = clamp(+e.target.value || 200, 200, 6000); commit(); fitZoom(true); }} /></Fld>
          <div className="btnRow">
            <button onClick={() => setShowSetup(true)}>Page Setup… (inches &amp; margins)</button>
          </div>
        </div>
        <div className="inspSection">
          <div className="inspHead">Page background</div>
          <FillPicker value={p.bg} onChange={(f, final) => { p.bg = f; if (final) commit(); else force(); }} />
        </div>
        {renderPageAdjustSection(ed)}
        <div className="inspSection">
          <div className="inspHead">Tips</div>
          <div className="tips">
            Select any element to edit it here. Double-click balloons to type,
            double-click panels to set their photo. Ctrl+Z undo · Ctrl+D duplicate ·
            arrow keys nudge · Shift+rotate snaps.
          </div>
        </div>
      </div>
    );
  }

  const el = selEl;
  return (
    <div className="inspBody">
      {el.type === "balloon" && (
        <div className="inspSection">
          <div className="inspHead">{BALLOON_KINDS[el.kind]} balloon</div>
          <Fld label="Type">
            <select value={el.kind} onChange={(e) => mutateSel<BalloonEl>((b) => {
              b.kind = e.target.value as BalloonKind;
              if (TAILLESS_KINDS.includes(b.kind)) b.tail = null;
              else if (!b.tail) b.tail = { dx: -b.w * 0.25, dy: b.h * 0.85 };
            })}>
              {Object.entries(BALLOON_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </Fld>
          <Fld label="Outline">
            <span className="pair">
              <input type="number" min={0} max={30} value={el.strokeW} style={{ width: 52 }}
                onChange={(e) => mutateSel<BalloonEl>((b) => { b.strokeW = clamp(+e.target.value || 0, 0, 30); })} />
              <input type="color" value={el.stroke}
                onChange={(e) => mutateSel<BalloonEl>((b) => { b.stroke = e.target.value; })} />
            </span>
          </Fld>
          <Fld label="Shadow"><input type="checkbox" checked={el.shadow}
            onChange={(e) => mutateSel((b) => { b.shadow = e.target.checked; })} /></Fld>
          <div className="btnRow">
            <button onClick={() => fitBalloonToText(ed)} title="Resize the balloon to hug its lettering (Ctrl+\)">Fit to text</button>
          </div>
          <div className="btnRow">
            <button onClick={() => { panelImageTarget.current = el.id; filePanelImageRef.current?.click(); }}>
              {el.img ? "Replace inner image…" : "Place image inside…"}
            </button>
            {el.img && <button onClick={() => mutateSel<BalloonEl>((b) => { b.img = null; })}>Remove image</button>}
          </div>
          <Fld label="Presets">
            <span className="pair">
              <select value="" onChange={(e) => { if (e.target.value) applyBalloonPreset(ed, e.target.value); }}
                style={{ maxWidth: 120 }} disabled={presets.length === 0}
                title={presets.length ? "Apply a saved preset" : "No presets saved yet"}>
                <option value="">{presets.length ? "Apply…" : "None saved"}</option>
                {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </span>
          </Fld>
          <div className="btnRow">
            <button onClick={() => saveBalloonPreset(ed)} title="Save this balloon's style as a reusable preset">Save preset…</button>
            {presets.length > 0 && (
              <select value="" onChange={(e) => { if (e.target.value) deleteBalloonPreset(ed, e.target.value); }}
                title="Delete a saved preset">
                <option value="">Delete…</option>
                {presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            )}
          </div>
        </div>
      )}
      {(el.type === "balloon") && (
        <div className="inspSection">
          <div className="inspHead">Balloon fill</div>
          <FillPicker value={el.fill} onChange={(f, final) => mutateSel<BalloonEl>((b) => { b.fill = f; }, final)} />
        </div>
      )}
      {(el.type === "balloon" || el.type === "text") && tsControls(ed, el)}
      {el.type === "text" && (
        <div className="inspSection">
          <div className="inspHead">SFX warp</div>
          <Fld label="Arc">
            <span className="pair">
              <input type="range" min={-100} max={100} step={1} value={el.warp ?? 0}
                onChange={(e) => mutateSel<TextEl>((x) => { x.warp = +e.target.value; }, false)}
                onPointerUp={() => commit()} style={{ width: 120 }} />
              <input type="number" min={-100} max={100} value={el.warp ?? 0} style={{ width: 54 }}
                onChange={(e) => mutateSel<TextEl>((x) => { x.warp = clamp(+e.target.value || 0, -100, 100); })} />
            </span>
          </Fld>
          <div className="btnRow">
            <button onClick={() => mutateSel<TextEl>((x) => { x.warp = 0; })}>Straighten</button>
          </div>
          <div className="tips" style={{ fontSize: 11 }}>Bend SFX text along an arc — positive curves up, negative curves down. Double-click to edit, then release for the warped look.</div>
        </div>
      )}
      {(el.type === "panel" || el.type === "image") && (
        <>
          <div className="inspSection">
            <div className="inspHead">{el.type === "panel" ? "Panel" : "Image"}</div>
            <Fld label="Border">
              <span className="pair">
                <input type="number" min={0} max={40} value={el.borderW} style={{ width: 52 }}
                  onChange={(e) => mutateSel<PanelEl>((b) => { b.borderW = clamp(+e.target.value || 0, 0, 40); })} />
                <input type="color" value={el.borderC}
                  onChange={(e) => mutateSel<PanelEl>((b) => { b.borderC = e.target.value; })} />
              </span>
            </Fld>
            <Fld label="Photo filter">
              <select value={el.filter} onChange={(e) => mutateSel<PanelEl>((b) => { b.filter = e.target.value as PanelEl["filter"]; })}>
                {Object.entries(FILTERS).map(([k, f]) => <option key={k} value={k}>{f.label}</option>)}
              </select>
            </Fld>
            <Fld label="Shadow"><input type="checkbox" checked={el.shadow}
              onChange={(e) => mutateSel((b) => { b.shadow = e.target.checked; })} /></Fld>
            {/* fade tool: one button, both kinds in the popup — the popup
                floats with NO veil so the fade previews live on the page */}
            <Fld label="Fade">
              <button className="fadePick" onClick={(e) => {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                fadePos = { x: Math.min(r.left - 120, innerWidth - 240), y: Math.min(r.bottom + 6, innerHeight - 330) };
                ed.setOpenMenu(ed.openMenu === "fadeMenu" ? null : "fadeMenu");
              }}>
                {el.fade ? `${el.fade.to === "black" ? "⬛ Black" : "⬜ White"} · ${FADE_DIR_LABEL[el.fade.dir]}` : "Fade tool…"}
              </button>
            </Fld>
            {ed.openMenu === "fadeMenu" && (
              <>
                <div className="menuBackdrop" onPointerDown={() => ed.setOpenMenu(null)} />
                <div className="lfMenu fadeMenu" style={{ left: fadePos.x, top: fadePos.y }}>
                  <div className="lfLabel">Fade the art into…</div>
                  <div className="fadeKinds">
                    <button className={el.fade && el.fade.to !== "black" ? "on" : ""}
                      onClick={() => mutateSel<PanelEl>((b) => {
                        b.fade = { to: "white", dir: b.fade?.dir ?? "br", size: b.fade?.size ?? 35 };
                      })}>⬜ White</button>
                    <button className={el.fade?.to === "black" ? "on" : ""}
                      onClick={() => mutateSel<PanelEl>((b) => {
                        b.fade = { to: "black", dir: b.fade?.dir ?? "br", size: b.fade?.size ?? 35 };
                      })}>⬛ Black</button>
                  </div>
                  {el.fade && (
                    <>
                      <div className="lfLabel">From</div>
                      <div className="fadeDirs">
                        {(["tl", "top", "tr", "left", "vignette", "right", "bl", "bottom", "br"] as FadeDir[]).map((d) => (
                          <button key={d} className={el.fade?.dir === d ? "on" : ""} title={FADE_DIR_LABEL[d]}
                            onClick={() => mutateSel<PanelEl>((b) => { if (b.fade) b.fade = { ...b.fade, dir: d }; })}>
                            {FADE_DIR_GLYPH[d]}
                          </button>
                        ))}
                      </div>
                      <div className="lfLabel">Reach</div>
                      <input type="range" min={5} max={100} value={el.fade.size}
                        onChange={(e) => mutateSel<PanelEl>((b) => { if (b.fade) b.fade = { ...b.fade, size: +e.target.value }; }, false)}
                        onPointerUp={() => ed.commit()} />
                      <div className="lfRow">
                        <button onClick={() => { mutateSel<PanelEl>((b) => { b.fade = undefined; }); ed.setOpenMenu(null); }}>Remove</button>
                        <button className="lfGo" onClick={() => ed.setOpenMenu(null)}>Done</button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
            <div className="btnRow">
              <button onClick={() => { panelImageTarget.current = el.id; filePanelImageRef.current?.click(); }}>
                {el.img ? "Replace image…" : "Set image…"}
              </button>
              {el.img && el.type === "panel" && (
                <button onClick={() => mutateSel<PanelEl>((b) => { b.img = null; })}>Remove image</button>
              )}
            </div>
            {el.img && (
              <div className="btnRow">
                <button title="Instant Alpha: makes the background around the image edges transparent"
                  onClick={() => runInstantAlpha(ed, el.id, el.img!)}>Instant Alpha (remove bg)</button>
              </div>
            )}
          </div>
          {el.type === "panel" && (
            <div className="inspSection">
              <div className="inspHead">Panel fill</div>
              <FillPicker value={el.fill} onChange={(f, final) => mutateSel<PanelEl>((b) => { b.fill = f; }, final)} />
            </div>
          )}
        </>
      )}
      <div className="inspSection">
        <div className="inspHead">Arrange</div>
        <div className="btnRow">
          <button onClick={() => reorder(ed, 1e9)}>Front</button>
          <button onClick={() => reorder(ed, 1)}>Fwd</button>
          <button onClick={() => reorder(ed, -1)}>Back</button>
          <button onClick={() => reorder(ed, -1e9)}>Rear</button>
        </div>
        <div className="btnRow">
          <button onClick={() => duplicateSel(ed)}>Duplicate</button>
          <button onClick={() => deleteSel(ed)}>Delete</button>
        </div>
        {(el.type === "image" || el.type === "panel") && (
          <div className="btnRow">
            <button onClick={() => mutateSel((b) => { b.flipH = !b.flipH; })}>Flip ↔</button>
            <button onClick={() => mutateSel((b) => { b.flipV = !b.flipV; })}>Flip ↕</button>
          </div>
        )}
        <Fld label="Rotation °"><input type="number" min={-180} max={180} value={Math.round(el.rot)}
          onChange={(e) => mutateSel((b) => { b.rot = clamp(+e.target.value || 0, -180, 180); })} /></Fld>
        <Fld label="Opacity">
          <input type="range" min={10} max={100} value={Math.round((el.opacity ?? 1) * 100)}
            onChange={(e) => mutateSel((b) => { b.opacity = (+e.target.value) / 100; }, false)}
            onPointerUp={() => commit()} />
        </Fld>
        <Fld label="Lock position">
          <input type="checkbox" checked={!!el.locked}
            onChange={(e) => mutateSel((b) => { b.locked = e.target.checked; })} />
        </Fld>
      </div>
      {renderPageAdjustSection(ed)}
    </div>
  );
}
