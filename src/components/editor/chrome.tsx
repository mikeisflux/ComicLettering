"use client";
/* ComicLettering Studio — editor chrome: rulers, toolbar/tray buttons and
   the Page Setup dialog, split out of Editor.tsx (module-level code, unchanged). */
import { ReactNode, useEffect, useRef, useState } from "react";
import { COMIC_H_IN, COMIC_W_IN, DPI, MARGIN_IN, PAPER_CATEGORIES, Page, PageMargin, bleedFor, clamp, pageBleed, pageMargins } from "@/lib/model";

/* ---------------- rulers ---------------- */

export function Ruler({ length, zoom, vertical, offset = 0, hi }: {
  length: number; zoom: number; vertical: boolean; offset?: number;
  hi?: [number, number] | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = Math.max(1, Math.round(length * zoom)) + offset;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const T = 22;
    c.width = vertical ? T : px;
    c.height = vertical ? px : T;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#e6e8ec";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#8a919c";
    ctx.fillStyle = "#4a505a";
    ctx.font = "9px Arial";
    const minor = DPI / 8;
    ctx.beginPath();
    /* tick 0 sits exactly at the page's corner (offset = stage margin) */
    for (let v = 0; v <= length; v += minor) {
      const p = offset + v * zoom;
      const idx = Math.round(v / minor);
      const size = idx % 8 === 0 ? T * 0.85 : idx % 4 === 0 ? T * 0.5 : T * 0.3;
      if (vertical) { ctx.moveTo(T, p); ctx.lineTo(T - size, p); }
      else { ctx.moveTo(p, T); ctx.lineTo(p, T - size); }
      if (idx % 8 === 0) {
        const label = String(idx / 8);
        if (vertical) ctx.fillText(label, 2, p + 9);
        else ctx.fillText(label, p + 3, 9);
      }
    }
    ctx.stroke();
    /* highlight the dragged element's span, like Comic Life */
    if (hi) {
      const a = offset + hi[0] * zoom, b = offset + hi[1] * zoom;
      ctx.fillStyle = "rgba(30,136,229,0.30)";
      if (vertical) ctx.fillRect(0, a, T, b - a); else ctx.fillRect(a, 0, b - a, T);
      ctx.strokeStyle = "#1e88e5";
      ctx.beginPath();
      if (vertical) { ctx.moveTo(0, a + 0.5); ctx.lineTo(T, a + 0.5); ctx.moveTo(0, b - 0.5); ctx.lineTo(T, b - 0.5); }
      else { ctx.moveTo(a + 0.5, 0); ctx.lineTo(a + 0.5, T); ctx.moveTo(b - 0.5, 0); ctx.lineTo(b - 0.5, T); }
      ctx.stroke();
    }
    ctx.strokeStyle = "#70767f";
    ctx.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  }, [px, zoom, length, vertical, offset, hi?.[0], hi?.[1]]);
  return <canvas ref={ref} className={vertical ? "rulerV" : "rulerH"} />;
}

/* stage offsets inside the canvas area — rulers compensate so 0 = page corner */
export const STAGE_MX = 40;
export const STAGE_MY = 26;

/* A number field you can actually type in.

   The obvious version — value straight from the model, clamp on every
   change — is unusable for any number whose first digit is below the
   minimum. Typing "24" into a field with a minimum of 8 goes: "2" clamps to
   8, the field now reads 8, the "4" lands after it, and you get 84. The only
   way through was to type a big number and backspace it.

   So: while the field has focus you are editing text, not a number. Values
   are pushed through live once they are legal on their own, and what you
   leave behind is clamped on blur or Enter. Escape puts it back. */
export function NumField({ value, min, max, disabled, width, title, onCommit }: {
  value: number; min: number; max: number;
  disabled?: boolean; width?: number; title?: string;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const settle = (raw: string | null) => {
    const n = parseInt(raw ?? "", 10);
    if (!isNaN(n)) onCommit(clamp(n, min, max));
    setDraft(null);
  };

  return (
    <input
      type="number" min={min} max={max} disabled={disabled} title={title}
      style={{ width: width ?? 56 }}
      value={draft ?? String(value)}
      onFocus={(e) => { setDraft(String(value)); e.currentTarget.select(); }}
      onChange={(e) => {
        const t = e.target.value;
        setDraft(t);
        /* live-update only while the typed number already stands on its own;
           a half-typed one waits for blur rather than being clamped */
        const n = parseInt(t, 10);
        if (t !== "" && !isNaN(n) && n >= min && n <= max) onCommit(n);
      }}
      onBlur={() => settle(draft)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { settle(draft); e.currentTarget.blur(); }
        else if (e.key === "Escape") { setDraft(null); e.currentTarget.blur(); }
      }}
    />
  );
}

/* ---------------- toolbar / tray buttons ---------------- */

export function ToolBtn({ label, icon, onClick, disabled, accent, title }: {
  label: string; icon: string; onClick: () => void; disabled?: boolean; accent?: boolean; title?: string;
}) {
  return (
    <button className={"toolBtn" + (accent ? " accent" : "")} onClick={onClick} disabled={disabled} title={title || label}>
      <span className="tIcon">{icon}</span>
      <span className="tLabel">{label}</span>
    </button>
  );
}

export function TrayBtn({ children, label, onClick, active }: { children: ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button className={`trayBtn${active ? " on" : ""}`} onClick={onClick} title={label}>
      {children}
      <span>{label}</span>
    </button>
  );
}

/* ---------------- Page Setup dialog (paper sizes, orientation, margins) ---------------- */

const inch = (px: number) => (px / DPI).toFixed(3);

export function PageSetupDialog({ page, onClose, onApply }: {
  page: Page;
  onClose: () => void;
  onApply: (w: number, h: number, margin: PageMargin | null, bleed: number, applyAll: boolean) => void;
}) {
  const m0 = pageMargins(page);
  const [cat, setCat] = useState(0);
  const [wIn, setWIn] = useState(inch(page.w));
  const [hIn, setHIn] = useState(inch(page.h));
  const [mT, setMT] = useState(inch(m0.t));
  const [mR, setMR] = useState(inch(m0.r));
  const [mB, setMB] = useState(inch(m0.b));
  const [mL, setML] = useState(inch(m0.l));
  const [bIn, setBIn] = useState(inch(pageBleed(page)));
  const [applyAll, setApplyAll] = useState(true);
  const [selSize, setSelSize] = useState(-1);
  const landscape = parseFloat(wIn) > parseFloat(hIn);

  const setOrientation = (land: boolean) => {
    const w = parseFloat(wIn) || 0, h = parseFloat(hIn) || 0;
    if (land !== (w > h)) { setWIn(hIn); setHIn(wIn); }
  };

  const ok = () => {
    const w = Math.round((parseFloat(wIn) || COMIC_W_IN) * DPI);
    const h = Math.round((parseFloat(hIn) || COMIC_H_IN) * DPI);
    /* kept exact: an eighth or a tenth of an inch is not a whole number of
       pixels at this DPI, and rounding hands the value back changed */
    const margin: PageMargin = {
      t: (parseFloat(mT) || 0) * DPI,
      r: (parseFloat(mR) || 0) * DPI,
      b: (parseFloat(mB) || 0) * DPI,
      l: (parseFloat(mL) || 0) * DPI,
    };
    const bleed = clamp((parseFloat(bIn) || 0) * DPI, 0, Math.min(w, h) / 4);
    /* Leaving the margins at the default means "no custom margins" — do not
       stamp a guide onto the page just because someone changed its size. */
    const s = MARGIN_IN * DPI;
    const plain = margin.t === s && margin.r === s && margin.b === s && margin.l === s;
    onApply(clamp(w, 200, 8000), clamp(h, 200, 8000), plain ? null : margin, bleed, applyAll);
  };

  return (
    <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="setupDlg">
        <div className="setupTitle">Page Setup</div>
        <div className="setupBody">
          <div className="setupLeft">
            <select value={cat} onChange={(e) => { setCat(+e.target.value); setSelSize(-1); }}>
              {PAPER_CATEGORIES.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
            </select>
            <div className="sizeList">
              {PAPER_CATEGORIES[cat].sizes.map(([name, w, h], i) => (
                <div key={name} className={"sizeRow" + (i === selSize ? " on" : "")}
                  onClick={() => {
                    setSelSize(i);
                    if (landscape) { setWIn(h.toFixed(3)); setHIn(w.toFixed(3)); }
                    else { setWIn(w.toFixed(3)); setHIn(h.toFixed(3)); }
                    /* the listed comic sizes are quoted WITH bleed, and an
                       oversize board scales its bleed with everything else */
                    if (bleedFor(name) != null) setBIn(bleedFor(name)!.toFixed(4));
                  }}>{name}</div>
              ))}
            </div>
          </div>
          <div className="setupRight">
            <fieldset className="setupGroup">
              <div className="setupRow">
                <span className="setupLbl">Page Size:</span>
                <span className="dimBox"><input value={wIn} onChange={(e) => { setWIn(e.target.value); setSelSize(-1); }} /> in<br /><small>width</small></span>
                <span className="dimBox"><input value={hIn} onChange={(e) => { setHIn(e.target.value); setSelSize(-1); }} /> in<br /><small>height</small></span>
              </div>
              <div className="setupRow">
                <span className="setupLbl">Bleed:</span>
                <span className="dimBox"><input value={bIn} onChange={(e) => setBIn(e.target.value)} /> in<br /><small>each edge</small></span>
                <small style={{ opacity: .7, maxWidth: 210 }}>
                  Page size includes this. The trim — where the blade lands —
                  sits this far inside every edge.
                </small>
              </div>
              <div className="setupRow">
                <span className="setupLbl">Orientation:</span>
                <label><input type="radio" name="orient" checked={!landscape} onChange={() => setOrientation(false)} /> Portrait</label>
                <label><input type="radio" name="orient" checked={landscape} onChange={() => setOrientation(true)} /> Landscape</label>
              </div>
            </fieldset>
            <fieldset className="setupGroup">
              <legend>Document Margins</legend>
              <div className="marginGrid">
                <span className="dimBox mid"><input value={mT} onChange={(e) => setMT(e.target.value)} /> in<br /><small>Top</small></span>
                <div className="marginMid">
                  <span className="dimBox"><input value={mL} onChange={(e) => setML(e.target.value)} /> in<br /><small>Left</small></span>
                  <span className="dimBox"><input value={mR} onChange={(e) => setMR(e.target.value)} /> in<br /><small>Right</small></span>
                </div>
                <span className="dimBox mid"><input value={mB} onChange={(e) => setMB(e.target.value)} /> in<br /><small>Bottom</small></span>
              </div>
            </fieldset>
            <label className="setupAll"><input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} /> Apply to all pages in this document</label>
          </div>
        </div>
        <div className="setupFoot">
          <button onClick={onClose}>Cancel</button>
          <button className="okBtn" onClick={ok}>OK</button>
        </div>
      </div>
    </div>
  );
}
