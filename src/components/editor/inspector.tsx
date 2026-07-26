/* Right-panel Inspector — page / element property editors.
   Plain exported render functions taking the EditorCtx bag. */
import {
  BALLOON_KINDS, BalloonEl, BalloonKind, FILTERS, FONTS, PAGE_SIZES,
  PanelEl, TAILLESS_KINDS, TextEl, TextStyle, clamp,
} from "@/lib/model";
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
              if (s) { p.w = s.w; p.h = s.h; commit(); fitZoom(true); }
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
            <button onClick={() => fitBalloonToText(ed)} title="Resize the balloon to hug its lettering">Fit to text</button>
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
    </div>
  );
}
