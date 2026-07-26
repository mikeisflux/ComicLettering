/* The STYLES sidebar. What it offers follows the selection: lettering
   colourways for text, balloon colourways for word balloons, box colourways
   for captions. Clicking a swatch restyles whatever is selected — and also
   becomes the style the next new element of that kind is created with. */
import { BalloonEl, TextEl, TAILLESS_KINDS } from "@/lib/model";
import { LETTER_STYLES, applyLetterStyle } from "@/lib/presets";
import { BALLOON_STYLES, BOX_STYLES, ShapeStyle, applyShapeStyle, shapeCss } from "@/lib/balloonStyles";
import { EditorCtx } from "./ctx";
import { letterStyleCss } from "./textHelpers";

export type StyleTab = "letter" | "balloon" | "box";

/** which swatch set matches the current selection */
export function tabForSelection(sel: { type: string; kind?: string } | null): StyleTab | null {
  if (!sel) return null;
  if (sel.type === "text") return "letter";
  if (sel.type === "balloon") {
    return TAILLESS_KINDS.includes(sel.kind as BalloonEl["kind"]) ? "box" : "balloon";
  }
  return null;
}

function ShapeSwatch({ s, on, box, onPick }: {
  s: ShapeStyle; on: boolean; box: boolean; onPick: () => void;
}) {
  return (
    <button className={"styleBtn shapeBtn" + (on ? " on" : "")} title={s.name} onClick={onPick}>
      <span className={"shapeSw" + (box ? " box" : "") + (s.none ? " none" : "")}
        style={{ background: shapeCss(s), borderColor: s.stroke, borderWidth: Math.max(1, Math.round(s.strokeW / 1.6)) }}>
        <i style={{ color: s.ink ?? "#000000" }}>ABC</i>
      </span>
    </button>
  );
}

export function StylesPanel({ ed }: { ed: EditorCtx }) {
  const {
    selEl, mutateSel, setStatus, styleTab, setStyleTab,
    activeStyle, setActiveStyle, activeShape, setActiveShape,
  } = ed;

  const locked = () => {
    if (selEl && selEl.locked) { setStatus("That item is locked — unlock it to restyle."); return true; }
    return false;
  };

  const shapes = styleTab === "box" ? BOX_STYLES : BALLOON_STYLES;
  const kindWord = styleTab === "box" ? "caption boxes" : "balloons";

  return (
    <>
      <div className="sideTitle">Styles</div>
      <div className="styleTabs" role="tablist">
        {([["letter", "Text"], ["balloon", "Balloon"], ["box", "Box"]] as [StyleTab, string][]).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={styleTab === k}
            className={styleTab === k ? "on" : ""} onClick={() => setStyleTab(k)}>{label}</button>
        ))}
      </div>
      <div className="stylesGrid">
        {styleTab === "letter"
          ? LETTER_STYLES.map((s) => (
            <button key={s.name} className={"styleBtn" + (activeStyle === s.name ? " on" : "")} title={s.name}
              onClick={() => {
                setActiveStyle(s.name);
                if (selEl && (selEl.type === "text" || selEl.type === "balloon")) {
                  if (locked()) return;
                  mutateSel<BalloonEl | TextEl>((x) => {
                    x.ts = applyLetterStyle(x.ts, s);
                    x.ts.outlineW = Math.round(x.ts.size * s.outlineF);
                  });
                } else {
                  setStatus(`Style “${s.name}” selected — new lettering will use it.`);
                }
              }}>
              <span style={letterStyleCss(s, 21)}>ABC</span>
            </button>
          ))
          : shapes.map((s) => (
            <ShapeSwatch key={s.name} s={s} box={styleTab === "box"}
              on={activeShape[styleTab] === s.name}
              onPick={() => {
                setActiveShape(styleTab, s.name);
                if (selEl && selEl.type === "balloon") {
                  if (locked()) return;
                  mutateSel<BalloonEl>((x) => applyShapeStyle(x, s));
                } else {
                  setStatus(`Style “${s.name}” selected — new ${kindWord} will use it.`);
                }
              }} />
          ))}
      </div>
    </>
  );
}
