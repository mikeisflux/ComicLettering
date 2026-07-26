"use client";
/* ComicLettering Studio — font menu + face subtype selector
   split out of Editor.tsx (module-level code, unchanged). */
import { useState } from "react";
import { FONTS, FONT_GROUPS, TextStyle } from "@/lib/model";

/* ---------------- font menu with live previews ---------------- */

export function FontMenu({ value, disabled, onPick, onImport, onDeleteFont }: {
  value: string; disabled?: boolean; onPick: (key: string) => void;
  onImport?: () => void; onDeleteFont?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const f = FONTS[value] || FONTS.comicneue;
  return (
    <div style={{ position: "relative" }}>
      <button className="fontBtn" disabled={disabled} style={{ fontFamily: f.css }}
        onClick={() => setOpen((o) => !o)}>
        {f.label} <span style={{ fontFamily: "sans-serif", fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <>
          <div className="ctxBackdrop" style={{ zIndex: 149 }} onClick={() => setOpen(false)} />
          <div className="fontMenu">
            {FONT_GROUPS.map((gr) => {
              const entries = Object.entries(FONTS).filter(([, x]) => x.group === gr);
              if (!entries.length) return null;
              return (
                <div key={gr}>
                  <div className="fontGroup">{gr}</div>
                  {entries.map(([k, x]) => (
                    <span key={k} className="fontRow">
                      <button className={"fontItem" + (k === value ? " on" : "")}
                        style={{ fontFamily: x.css }}
                        onClick={() => { onPick(k); setOpen(false); }}>
                        {x.label}
                      </button>
                      {gr === "My Fonts" && onDeleteFont && (
                        <i className="fontDel" title="Remove from your library"
                          onClick={(e) => { e.stopPropagation(); onDeleteFont(k); }}>✕</i>
                      )}
                    </span>
                  ))}
                </div>
              );
            })}
            {onImport && (
              <>
                <div className="ctxSep" />
                <button className="fontItem" style={{ fontSize: 13 }}
                  onClick={() => { setOpen(false); onImport(); }}>
                  ＋ Import font… (.ttf .otf .woff)
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const VARIANT_LABELS: Record<string, string> = {
  regular: "Regular", bold: "Bold", italic: "Italic", bolditalic: "Bold Italic",
};

export function tsVariant(ts: TextStyle): string {
  return ts.bold && ts.italic ? "bolditalic" : ts.bold ? "bold" : ts.italic ? "italic" : "regular";
}

/* Face subtype selector — only lists the faces the family actually has. */
export function SubtypeSelect({ ts, disabled, onSet }: {
  ts: TextStyle | null; disabled?: boolean;
  onSet: (bold: boolean, italic: boolean) => void;
}) {
  const variants = (ts && FONTS[ts.font]?.variants) || ["regular"];
  const cur = ts ? tsVariant(ts) : "regular";
  return (
    <select disabled={disabled || !ts || variants.length < 2}
      value={variants.includes(cur as never) ? cur : "regular"}
      onChange={(e) => {
        const v = e.target.value;
        onSet(v === "bold" || v === "bolditalic", v === "italic" || v === "bolditalic");
      }}>
      {variants.map((v) => <option key={v} value={v}>{VARIANT_LABELS[v]}</option>)}
    </select>
  );
}
