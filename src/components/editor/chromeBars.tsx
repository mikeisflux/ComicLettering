/* Top chrome: menu bar, toolbar and format bar.
   Plain exported render functions taking the EditorCtx bag. */
import {
  BalloonEl, COLOR_PALETTE, DEFAULT_TEXT_SIZE, FONTS, GRADIENT_PRESETS,
  MULTI_GRADIENTS, TextEl, clamp, newPage, reseedIds, starterDoc,
} from "@/lib/model";
import { fillCss } from "@/lib/fills";
import { NumField, ToolBtn } from "./chrome";
import { FontMenu, SubtypeSelect, tsVariant } from "./FontMenu";
import { clearArt, releaseAllArt } from "@/lib/assetStore";
import { gradCss } from "./GradientMaker";
import { BRUSHES } from "@/lib/brushes";
import { GLOWS } from "@/lib/glows";
import { EditorCtx } from "./ctx";
import {
  addFromTray, alignSel, applyQuickFill, applyQuickStroke, balanceRag,
  copySel, copyStyle, cutSel, deleteCustomFont, deleteSel, duplicatePage,
  duplicateSel, exportJSON, fitBalloonToText, pasteClip, pasteStyle,
  printPage, reorder, rotateSel, runInstantAlpha, runProof, saveProject,
} from "./ops";


export function renderMenuBar(ed: EditorCtx) {
  const {
    openMenu, setOpenMenu, docRef, assetsRef, histRef, hIndexRef, setCurrent, setSelId, setPageIndex, setThumbs, autosave, force, fitZoom, setTab, fileOpenRef, demo, setStatus, setShowSetup, setShowExport, undo, redo, setShowFind, setUserZoomed, setZoom, showSafe, setShowSafe, spread, setSpread, pageIndex, commit, fileImageRef, setStampOpen, fileStampRef, fileFontRef, setShowScript, mutateSel,
  } = ed;
  const page = ed.page!;
  return (
  <nav className="menuBar">
    {openMenu && <div className="ctxBackdrop" style={{ zIndex: 179 }} onClick={() => setOpenMenu(null)} />}
    {([
      ["File", [
        ["New Document", () => { if (window.confirm("Start a new document?")) { docRef.current = starterDoc(); assetsRef.current = {}; releaseAllArt(); clearArt(); reseedIds(docRef.current); histRef.current = [JSON.stringify(docRef.current)]; hIndexRef.current = 0; setCurrent(null); setSelId(null); setPageIndex(0); setThumbs({}); autosave(); force(); fitZoom(true); } }],
        ["Open Library", () => setTab("library")],
        ["Save", () => saveProject(ed, false)],
        ["Save As…", () => saveProject(ed, true)],
        ["Import Project File…", () => fileOpenRef.current?.click()],
        ["Export Project File", () => demo ? setStatus("Export is off in the demo — subscribe to unlock.") : exportJSON(ed)],
        ["—", null],
        ["Page Setup…", () => setShowSetup(true)],
        ["Export…", () => demo ? setStatus("Export is off in the demo — subscribe to unlock.") : setShowExport(true)],
        ["Print…", () => printPage(ed)],
      ]],
      ["Edit", [
        ["Undo", () => undo()], ["Redo", () => redo()],
        ["—", null],
        ["Cut", () => cutSel(ed)], ["Copy", () => copySel(ed)],
        ["Paste", () => pasteClip(ed)], ["Duplicate", () => duplicateSel(ed)],
        ["Delete", () => deleteSel(ed)],
        ["—", null],
        ["Copy Style", () => copyStyle(ed)],
        ["Paste Style to Selection", () => pasteStyle(ed)],
        ["Find & Replace…", () => setShowFind(true)],
        ["—", null],
        ["Check Spelling & Grammar", () => { setTab("proof"); runProof(ed); }],
      ]],
      ["View", [
        ["Zoom In", () => { setUserZoomed(true); setZoom((z) => clamp(z * 1.2, 0.05, 4)); }],
        ["Zoom Out", () => { setUserZoomed(true); setZoom((z) => clamp(z / 1.2, 0.05, 4)); }],
        ["Fit Page", () => { setUserZoomed(false); fitZoom(true); }],
        ["—", null],
        [showSafe ? "Hide Safe Area" : "Show Safe Area", () => setShowSafe((s) => !s)],
        [spread ? "Single Page View" : "Two-Page Spread View", () => setSpread((s) => !s)],
        ["—", null],
        ["Panel Layouts", () => setTab("layouts")],
        ["Inspector", () => setTab("inspector")],
        ["Layers", () => setTab("layers")],
        ["Photos", () => setTab("photos")],
        ["Library", () => setTab("library")],
      ]],
      ["Insert", [
        ["New Page", () => { const d = docRef.current!; d.pages.splice(pageIndex + 1, 0, newPage(page.w, page.h, page.margin)); setPageIndex(pageIndex + 1); setSelId(null); commit(); }],
        ["Duplicate Page", () => duplicatePage(ed)],
        ["—", null],
        ["Panel", () => addFromTray(ed, "panel")],
        ["Image…", () => fileImageRef.current?.click()],
        ["Speech Balloon", () => addFromTray(ed, "speech")],
        ["Thought Balloon", () => addFromTray(ed, "thought")],
        ["Caption", () => addFromTray(ed, "caption")],
        ["Text", () => addFromTray(ed, "text")],
        ["Lettering", () => addFromTray(ed, "sfx")],
        ["Stamps…", () => setStampOpen(true)],
        ["—", null],
        ["Import Custom Stamps…", () => fileStampRef.current?.click()],
        ["Import Custom Font…", () => fileFontRef.current?.click()],
        ["—", null],
        ["Import Script → Balloons…", () => setShowScript(true)],
      ]],
      ["Format", [
        ["Bold", () => mutateSel<BalloonEl | TextEl>((x) => { if (x.ts) x.ts.bold = !x.ts.bold; })],
        ["Italic", () => mutateSel<BalloonEl | TextEl>((x) => { if (x.ts) x.ts.italic = !x.ts.italic; })],
        ["Underline", () => mutateSel<BalloonEl | TextEl>((x) => { if (x.ts) x.ts.underline = !x.ts.underline; })],
        ["—", null],
        ["Align Left", () => mutateSel<BalloonEl | TextEl>((x) => { if (x.ts) x.ts.align = "left"; })],
        ["Align Center", () => mutateSel<BalloonEl | TextEl>((x) => { if (x.ts) x.ts.align = "center"; })],
        ["Align Right", () => mutateSel<BalloonEl | TextEl>((x) => { if (x.ts) x.ts.align = "right"; })],
        ["Justify", () => mutateSel<BalloonEl | TextEl>((x) => { if (x.ts) x.ts.align = "justify"; })],
        ["—", null],
        ["Bigger", () => mutateSel<BalloonEl | TextEl>((x) => { if (x.ts) x.ts.size = clamp(Math.round(x.ts.size * 1.12), 8, 800); })],
        ["Smaller", () => mutateSel<BalloonEl | TextEl>((x) => { if (x.ts) x.ts.size = clamp(Math.round(x.ts.size / 1.12), 8, 800); })],

      ]],
      ["Arrange", [
        ["Bring Forward", () => reorder(ed, 1)], ["Bring To Front", () => reorder(ed, 1e9)],
        ["Send Backward", () => reorder(ed, -1)], ["Send To Back", () => reorder(ed, -1e9)],
        ["—", null],
        ["Rotate 90° Clockwise", () => rotateSel(ed, 90)],
        ["Rotate 90° Counter-clockwise", () => rotateSel(ed, -90)],
        ["Rotate 15° Clockwise", () => rotateSel(ed, 15)],
        ["Rotate 15° Counter-clockwise", () => rotateSel(ed, -15)],
        ["Reset Rotation", () => mutateSel((x) => { x.rot = 0; })],
        ["—", null],
        ["Fit Balloon to Text", () => fitBalloonToText(ed)],
        ["Balance Line Breaks", () => balanceRag(ed)],
        ["Tuck SFX Behind Art…", () => ed.startTuck()],
        ["Center Horizontally (Ctrl+[)", () => alignSel(ed, "hcenter")],
        ["Center Vertically (Ctrl+])", () => alignSel(ed, "vcenter")],
        ["Flip Horizontal", () => mutateSel((x) => { x.flipH = !x.flipH; })],
        ["Flip Vertical", () => mutateSel((x) => { x.flipV = !x.flipV; })],
        ["—", null],
        ["Lock", () => mutateSel((x) => { x.locked = true; })],
        ["Unlock", () => mutateSel((x) => { x.locked = false; })],
      ]],
      ["Help", [
        ["Keyboard Shortcuts", () => window.alert([
          "SELECTING",
          "  Ctrl+A  select everything on the page      Ctrl+Shift+A  deselect",
          "  Ctrl+click  add or remove one              Tab / Shift+Tab  step through",
          "  Esc  deselect, or finish editing text",
          "",
          "ADDING",
          "  B  balloon    T  text    L  lettering    P  panel",
          "",
          "EDITING",
          "  Ctrl+Z / Ctrl+Y  undo / redo               Ctrl+D  duplicate",
          "  Ctrl+C / X / V  copy / cut / paste         Del  delete",
          "  Arrows  nudge (Shift = 10x)                Ctrl+F  find & replace",
          "  Ctrl+L  lock                               Ctrl+Shift+L  unlock",
          "  Ctrl+[ / Ctrl+]  centre across / down",
          "  Ctrl+Shift+[ / ]  send to back / bring to front",
          "",
          "WHILE DRAGGING",
          "  Shift  keep proportions resizing, snap 15\u00b0 rotating",
          "  Alt  ignore snapping",
          "",
          "TEXT",
          "  Double-click to edit \u00b7 Ctrl+B / Ctrl+I bold or italic the selected words",
          "",
          "PAGES & VIEW",
          "  PageUp / PageDown  previous / next page    Ctrl+Shift+N  duplicate page",
          "  Ctrl+= / Ctrl+-  zoom                      Ctrl+0  fit page",
          "",
          "FILE",
          "  Ctrl+S  save    Ctrl+Shift+S  save as    Ctrl+E  export    Ctrl+P  print",
        ].join("\n"))],
        ["FAQ & Support", () => window.open("/faq", "_blank")],
      ]],
    ] as [string, ([string, (() => void) | null])[]][]).map(([name, items]) => (
      <div key={name} className="menuWrap">
        <button className={"menuTop" + (openMenu === name ? " on" : "")}
          onClick={() => setOpenMenu(openMenu === name ? null : name)}
          onMouseEnter={() => { if (openMenu) setOpenMenu(name); }}>
          {name}
        </button>
        {openMenu === name && (
          <div className="menuDrop">
            {items.map(([label, fn], i) => fn === null
              ? <div key={i} className="ctxSep" />
              : <button key={i} onClick={() => { setOpenMenu(null); fn(); }}>{label}</button>)}
          </div>
        )}
      </div>
    ))}
  </nav>
  );
}

export function renderToolbar(ed: EditorCtx) {
  const {
    setTab, undo, redo, histRef, hIndexRef, setUserZoomed, setZoom, fitZoom, selEl, mutateSel, setShowSetup, setShowExport, demo, setStatus, docRef, assetsRef, setCurrent, setSelId, setPageIndex, setThumbs, autosave, force, commit, pageIndex,
  } = ed;
  const page = ed.page!;
  const selTs = selEl && (selEl.type === "balloon" || selEl.type === "text") ? selEl.ts : null;
  return (
  <header className="toolbar">
    <a className="brand" href="/" title="lettermycomic.com">Letter<span>My</span>Comic</a>
    <ToolBtn label="New" icon="🗋" onClick={() => {
      if (!window.confirm("Start a new document?")) return;
      docRef.current = starterDoc();
      assetsRef.current = {};
      releaseAllArt(); clearArt();
      reseedIds(docRef.current);
      histRef.current = [JSON.stringify(docRef.current)];
      hIndexRef.current = 0;
      setCurrent(null); setSelId(null); setPageIndex(0); setThumbs({});
      autosave(); force(); fitZoom(true);
    }} />
    <ToolBtn label="Save" icon="✔" accent onClick={() => saveProject(ed, false)} />
    <ToolBtn label="Library" icon="🗀" onClick={() => setTab("library")} />
    <ToolBtn label="New Page" icon="🗎+" onClick={() => {
      const d = docRef.current!;
      d.pages.splice(pageIndex + 1, 0, newPage(page.w, page.h, page.margin));
      setPageIndex(pageIndex + 1);
      setSelId(null);
      commit();
    }} />
    <span className="tbSep" />
    <ToolBtn label="Undo" icon="↶" disabled={hIndexRef.current <= 0} onClick={undo} />
    <ToolBtn label="Redo" icon="↷" disabled={hIndexRef.current >= histRef.current.length - 1} onClick={redo} />
    <span className="tbSep" />
    <ToolBtn label="Zoom In" icon="🔍+" onClick={() => { setUserZoomed(true); setZoom((z) => clamp(z * 1.2, 0.05, 4)); }} />
    <ToolBtn label="Zoom Out" icon="🔍−" onClick={() => { setUserZoomed(true); setZoom((z) => clamp(z / 1.2, 0.05, 4)); }} />
    <ToolBtn label="Fit" icon="⛶" onClick={() => { setUserZoomed(false); fitZoom(true); }} />
    <span className="tbSep" />
    <ToolBtn label="Front" icon="⬆" disabled={!selEl} onClick={() => reorder(ed, 1e9)} />
    <ToolBtn label="Back" icon="⬇" disabled={!selEl} onClick={() => reorder(ed, -1e9)} />
    <ToolBtn label="Rotate ⟲" icon="↺" disabled={!selEl} onClick={() => rotateSel(ed, -15)} />
    <ToolBtn label="Rotate ⟳" icon="↻" disabled={!selEl} onClick={() => rotateSel(ed, 15)} />
    <ToolBtn label="Bigger" icon="A+" disabled={!selTs} onClick={() =>
      mutateSel<BalloonEl | TextEl>((x) => { x.ts.size = clamp(Math.round(x.ts.size * 1.12), 8, 800); })} />
    <ToolBtn label="Smaller" icon="A−" disabled={!selTs} onClick={() =>
      mutateSel<BalloonEl | TextEl>((x) => { x.ts.size = clamp(Math.round(x.ts.size / 1.12), 8, 800); })} />
    <span className="tbSep" />
    <ToolBtn label="Instant Alpha" icon="🪄"
      disabled={!selEl || (selEl.type !== "image" && selEl.type !== "panel") || !selEl.img}
      onClick={() => { if (selEl && (selEl.type === "image" || selEl.type === "panel") && selEl.img) runInstantAlpha(ed, selEl.id, selEl.img); }} />
    <ToolBtn label="Behind Art" icon="🖼️⃰" accent
      title="Tuck SFX behind the art: select your sound-effect lettering, then draw around the part of the artwork that should come forward — it is cut out and placed in front, so the word sits behind it like hand-traced masking."
      disabled={!selEl || selEl.type !== "text"}
      onClick={() => ed.startTuck()} />
    <ToolBtn label="Page Setup" icon="📐" onClick={() => setShowSetup(true)} />
    <ToolBtn label="Print" icon="🖨" onClick={() => printPage(ed)} />
    <ToolBtn label="Export" icon="🖼⇩" accent onClick={() => demo ? setStatus("Export is off in the demo — subscribe to unlock.") : setShowExport(true)} />
    <ToolBtn label="Inspector" icon="ⓘ" onClick={() => setTab("inspector")} />
    <div className="tbSpacer" />
    <div className="tbHint">Runs entirely in your browser — nothing is uploaded.</div>
  </header>
  );
}

export function renderFormatBar(ed: EditorCtx) {
  const {
    selEl, mutateSel, showStroke, setShowStroke, showFill, setShowFill, showTextColor, setShowTextColor, fileFontRef,
    setShowGradMaker, myGrads,
  } = ed;
  const selTs = selEl && (selEl.type === "balloon" || selEl.type === "text") ? selEl.ts : null;
  return (
  <div className="formatBar">
    <span className="fbLabel">Stroke:</span>
    <NumField min={0} max={80} width={48} disabled={!selEl} title="Outline / border width"
      value={selEl?.type === "balloon" ? selEl.strokeW
        : selEl?.type === "panel" || selEl?.type === "image" ? selEl.borderW
        : selEl?.type === "text" ? selEl.ts.outlineW : 0}
      onCommit={(v) => mutateSel((x) => {
        if (x.type === "balloon") x.strokeW = v;
        else if (x.type === "panel" || x.type === "image") x.borderW = v;
        else if (x.type === "text") x.ts.outlineW = v;
      })} />
    <div style={{ position: "relative" }}>
      <button className="fillSwatch" title="Stroke / outline color"
        style={{
          background: selEl?.type === "balloon" ? selEl.stroke
            : selEl?.type === "panel" || selEl?.type === "image" ? selEl.borderC
            : selEl?.type === "text" ? selEl.ts.outlineC : "#111111",
        }}
        onClick={() => setShowStroke((s) => !s)} />
      {showStroke && (
        <div className="fillPop">
          <div className="fillPopHead">Stroke color</div>
          <div className="palGrid">
            {COLOR_PALETTE.flat().map((c, i) => (
              <button key={i} style={{ background: c }} title={c}
                onClick={() => applyQuickStroke(ed, c)} />
            ))}
          </div>
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Custom</label>
            <input type="color" onChange={(e) => applyQuickStroke(ed, e.target.value)} />
          </div>
        </div>
      )}
    </div>
    <span className="fbLabel">Fill:</span>
    <div style={{ position: "relative" }}>
      <button className="fillSwatch" title="Fill with a color or gradient"
        style={(selEl?.type === "balloon" || selEl?.type === "panel")
          ? fillCss(selEl.fill)
          : (selEl?.type === "text" && selEl.ts.fillB)
            ? { background: `linear-gradient(180deg, ${selEl.ts.fillA}, ${selEl.ts.fillB})` }
            : { background: selEl?.type === "text" ? selEl.ts.fillA : "#ffffff" }}
        onClick={() => setShowFill((s) => !s)} />
      {showFill && (
        <div className="fillPop" onPointerLeave={() => { /* stay open until click */ }}>
          <div className="fillPopCols">
            <div>
              <div className="fillPopHead">Colors</div>
              <div className="palGrid">
                {COLOR_PALETTE.flat().map((c, i) => (
                  <button key={i} style={{ background: c }} title={c}
                    onClick={() => { applyQuickFill(ed, { solidColor: c }); }} />
                ))}
              </div>
              <div className="fld" style={{ marginTop: 6 }}>
                <label>Custom</label>
                <input type="color" onChange={(e) => applyQuickFill(ed, { solidColor: e.target.value })} />
              </div>
            </div>
            <div>
              <div className="fillPopHead">Gradients</div>
              <div className="palGrid grads">
                {GRADIENT_PRESETS.map(([a, b], i) => (
                  <button key={i} style={{ background: `linear-gradient(180deg, ${a}, ${b})` }}
                    onClick={() => { applyQuickFill(ed, { gradient: [a, b] }); }} />
                ))}
              </div>
              <div className="fillPopHead" style={{ marginTop: 8 }}>Multi-tier</div>
              <div className="palGrid grads">
                {MULTI_GRADIENTS.map((m) => (
                  <button key={m.name} title={m.name} style={{ background: gradCss(m.stops) }}
                    onClick={() => { applyQuickFill(ed, { stops: m.stops }); }} />
                ))}
              </div>
              {myGrads.length > 0 && (
                <>
                  <div className="fillPopHead" style={{ marginTop: 8 }}>Yours</div>
                  <div className="palGrid grads">
                    {myGrads.map((g) => (
                      <button key={g.name} title={g.name} style={{ background: gradCss(g.stops) }}
                        onClick={() => { applyQuickFill(ed, { stops: g.stops }); }} />
                    ))}
                  </div>
                </>
              )}
              <button className="gmOpen" onClick={() => { setShowFill(false); setShowGradMaker(true); }}>
                🎨 Make a gradient…
              </button>
            </div>
          </div>
          <div className="tips" style={{ margin: "6px 2px 0" }}>
            Applies to the selected balloon, panel or lettering — or the page background when nothing is selected.
          </div>
        </div>
      )}
    </div>
    <label className="fbCheck">
      <input type="checkbox" disabled={!selEl} checked={!!selEl?.shadow}
        onChange={(e) => mutateSel((x) => { x.shadow = e.target.checked; })} /> Shadow
    </label>
    <span className="tbSep" />
    <FontMenu value={selTs?.font || "comicneue"} disabled={!selTs}
      onImport={() => fileFontRef.current?.click()}
      onDeleteFont={(k) => deleteCustomFont(ed, k)}
      onPick={(k) => mutateSel<BalloonEl | TextEl>((x) => {
        x.ts.font = k;
        const vars = FONTS[k]?.variants || ["regular"];
        if (!vars.includes(tsVariant(x.ts) as never)) { x.ts.bold = false; x.ts.italic = false; }
      })} />
    <SubtypeSelect ts={selTs}
      onSet={(bold, italic) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.bold = bold; x.ts.italic = italic; })} />
    <NumField min={8} max={800} width={56} disabled={!selTs} title="Font size"
      value={selTs?.size ?? DEFAULT_TEXT_SIZE}
      onCommit={(v) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.size = v; })} />
    <div style={{ position: "relative" }}>
      <button className="fillSwatch" title="Text color" disabled={!selTs}
        style={{ background: selTs?.fillA || "#111111", width: 28 }}
        onClick={() => setShowTextColor((s) => !s)} />
      {showTextColor && (
        <div className="fillPop" style={{ width: 250 }}>
          <div className="fillPopHead">Text color</div>
          <div className="palGrid">
            {COLOR_PALETTE.flat().map((c, i) => (
              <button key={i} style={{ background: c }} title={c}
                onClick={() => {
                  mutateSel<BalloonEl | TextEl>((x) => { x.ts.fillA = c; x.ts.fillB = null; });
                  setShowTextColor(false);
                }} />
            ))}
          </div>
          <div className="fld" style={{ marginTop: 6 }}>
            <label>Custom</label>
            <input type="color" onChange={(e) => {
              mutateSel<BalloonEl | TextEl>((x) => { x.ts.fillA = e.target.value; x.ts.fillB = null; });
              setShowTextColor(false);
            }} />
          </div>
        </div>
      )}
    </div>
    <button className={"fbTog" + (selTs?.bold ? " on" : "")} disabled={!selTs}
      onClick={() => mutateSel<BalloonEl | TextEl>((x) => { x.ts.bold = !x.ts.bold; })}><b>B</b></button>
    <button className={"fbTog" + (selTs?.italic ? " on" : "")} disabled={!selTs}
      onClick={() => mutateSel<BalloonEl | TextEl>((x) => { x.ts.italic = !x.ts.italic; })}><i>I</i></button>
    <button className={"fbTog" + (selTs?.underline ? " on" : "")} disabled={!selTs}
      onClick={() => mutateSel<BalloonEl | TextEl>((x) => { x.ts.underline = !x.ts.underline; })}><u>U</u></button>
    {(["left", "center", "right", "justify"] as const).map((a) => (
      <button key={a} className={"fbTog" + (selTs?.align === a ? " on" : "")} disabled={!selTs}
        title={a[0].toUpperCase() + a.slice(1)}
        onClick={() => mutateSel<BalloonEl | TextEl>((x) => { x.ts.align = a; })}>
        {a === "left" ? "⯇" : a === "center" ? "≡" : a === "right" ? "⯈" : "☰"}
      </button>
    ))}
    <span className="fbSep" />
    <span className="fbLead" title="Line spacing (leading)">
      <span className="fbLeadIcon" aria-hidden>≣</span>
      <select className="fbLeadSel" disabled={!selTs}
        value={String(selTs?.lineHeight ?? 1.05)}
        onChange={(e) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.lineHeight = parseFloat(e.target.value); })}>
        <option value="0.9">0.9×</option>
        <option value="1">1.0×</option>
        <option value="1.1">1.1×</option>
        <option value="1.25">1.25×</option>
        <option value="1.4">1.4×</option>
        <option value="1.6">1.6×</option>
        <option value="1.8">1.8×</option>
        <option value="2">2.0×</option>
      </select>
    </span>
    <span className="fbLead" title="Letter spacing (tracking)">
      <span className="fbLeadIcon" aria-hidden>A↔A</span>
      <select className="fbLeadSel" disabled={!selTs}
        value={String(selTs?.tracking ?? 0)}
        onChange={(e) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.tracking = parseFloat(e.target.value); })}>
        <option value="-2">Tight −2</option>
        <option value="-1">−1</option>
        <option value="0">Normal</option>
        <option value="1">+1</option>
        <option value="2">+2</option>
        <option value="4">Wide +4</option>
        <option value="6">+6</option>
        <option value="10">+10</option>
      </select>
    </span>

    {/* brushes: dry-media texture masked over the lettering */}
    <span className="fbGroup fbBrush">
      <span className="fbLeadIcon" aria-hidden>🖌</span>
      <select className="fbBrushSel" disabled={!selTs}
        title={BRUSHES.find((b) => b.k === (selTs?.brush ?? "none"))?.hint || "Brush texture"}
        value={selTs?.brush ?? "none"}
        onChange={(e) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.brush = e.target.value; })}>
        {BRUSHES.map((b) => <option key={b.k} value={b.k} title={b.hint}>{b.label}</option>)}
      </select>
    </span>

    {/* glow: a coloured halo thrown off the lettering */}
    <span className="fbGroup fbGlow">
      <span className="fbLeadIcon" aria-hidden>✨</span>
      <select className="fbGlowSel" disabled={!selTs} title="Glow around the lettering"
        value={selTs?.glow ?? "none"}
        onChange={(e) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.glow = e.target.value; })}>
        {GLOWS.map((g) => (
          <option key={g.k} value={g.k}>{g.label}</option>
        ))}
      </select>
      <select className="fbGlowAmt" disabled={!selTs || (selTs.glow ?? "none") === "none"}
        title="How far the glow spreads"
        value={String(selTs?.glowW ?? 1)}
        onChange={(e) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.glowW = parseFloat(e.target.value); })}>
        <option value="0.5">Soft</option>
        <option value="1">Normal</option>
        <option value="1.6">Strong</option>
        <option value="2.4">Blazing</option>
      </select>
    </span>
  </div>
  );
}
