"use client";
/* ComicLettering Studio — main editor. Original implementation of a
   Comic Life-style comic lettering workflow: pages, panels, balloons,
   lettering styles, fills, SQL project library and PNG export. */
import React, {
  CSSProperties, useCallback, useEffect, useReducer, useRef, useState,
} from "react";
import {
  Assets, BALLOON_KINDS, BalloonEl, BalloonKind, Doc, El, FILTERS, FONTS,
  FONT_GROUPS, FillStyle, GRADIENT_PRESETS, HALFTONE_VARIANTS, LAYOUT_CATEGORIES,
  LayoutRect, PAGE_SIZES, PATTERN_VARIANTS, Page, PanelEl, SPEEDLINE_VARIANTS,
  COLOR_PALETTE, DPI, PAPER_CATEGORIES, PageMargin, TAILLESS_KINDS,
  TEXTURE_VARIANTS, TextEl, TextStyle, aabbOverlap, applyLayout, clamp,
  lightenHex, makeBalloon, makeImage, makePanel, makeText, newPage, reseedIds,
  resolveBalloon, rotVec, solid, starterDoc, uid,
} from "@/lib/model";
import { balloonGeom } from "@/lib/geometry";
import { LETTER_STYLES, LetterStyle, applyLetterStyle } from "@/lib/presets";
import { defaultFillFor, fillCss, fillOverlayTile, fillOverlayURL, isRepeating } from "@/lib/fills";
import { ImageFormat, docThumbnail, exportPageImage, exportPagePNG, loadImage, pageThumbnail } from "@/lib/exportPng";

const AUTOSAVE_KEY = "comiclettering.autosave.v2";
const MIN_SIZE = 24;
const HINT = "Double-click a balloon to type · orange dot aims the tail · drop images onto the page · Del removes";

/* ---------------- small shared helpers ---------------- */

function textCss(ts: TextStyle): CSSProperties {
  const st: CSSProperties & Record<string, string | number> = {
    fontFamily: FONTS[ts.font]?.css || FONTS.comicneue.css,
    fontSize: ts.size,
    fontWeight: ts.bold ? 700 : 400,
    fontStyle: ts.italic ? "italic" : "normal",
    textAlign: ts.align,
    textDecoration: ts.underline ? "underline" : "none",
    textTransform: ts.caps ? "uppercase" : "none",
    lineHeight: 1.25,
  };
  if (ts.fillB) {
    /* glossy 3-stop gradient: highlight → colour → depth */
    st.backgroundImage = `linear-gradient(180deg, ${lightenHex(ts.fillA, 0.55)} 0%, ${ts.fillA} 38%, ${ts.fillB} 100%)`;
    st.WebkitBackgroundClip = "text";
    st.backgroundClip = "text";
    st.color = "transparent";
  } else {
    st.color = ts.fillA;
  }
  if (ts.outlineW > 0) {
    st.WebkitTextStroke = `${ts.outlineW}px ${ts.outlineC}`;
    st.paintOrder = "stroke fill";
  }
  if (ts.shadow) {
    st.filter = `drop-shadow(${ts.size * 0.05}px ${ts.size * 0.05}px ${ts.size * 0.06}px ${ts.shadowC || "#00000088"})`;
  }
  return st;
}

function letterStyleCss(s: LetterStyle, size: number): CSSProperties {
  return textCss({
    font: s.font, size, bold: false, italic: false, caps: true, align: "center",
    fillA: s.fillA, fillB: s.fillB, outlineC: s.outlineC,
    outlineW: Math.max(s.outlineF > 0 ? 1 : 0, Math.round(size * s.outlineF)),
    shadow: s.shadow, shadowC: "#00000066",
  });
}

/* ---------------- font menu with live previews ---------------- */

function FontMenu({ value, disabled, onPick }: {
  value: string; disabled?: boolean; onPick: (key: string) => void;
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
            {FONT_GROUPS.map((gr) => (
              <div key={gr}>
                <div className="fontGroup">{gr}</div>
                {Object.entries(FONTS).filter(([, x]) => x.group === gr).map(([k, x]) => (
                  <button key={k} className={"fontItem" + (k === value ? " on" : "")}
                    style={{ fontFamily: x.css }}
                    onClick={() => { onPick(k); setOpen(false); }}>
                    {x.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const VARIANT_LABELS: Record<string, string> = {
  regular: "Regular", bold: "Bold", italic: "Italic", bolditalic: "Bold Italic",
};

function tsVariant(ts: TextStyle): string {
  return ts.bold && ts.italic ? "bolditalic" : ts.bold ? "bold" : ts.italic ? "italic" : "regular";
}

/* Face subtype selector — only lists the faces the family actually has. */
function SubtypeSelect({ ts, disabled, onSet }: {
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

/* ---------------- rulers ---------------- */

function Ruler({ length, zoom, vertical, offset = 0 }: {
  length: number; zoom: number; vertical: boolean; offset?: number;
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
    ctx.strokeStyle = "#70767f";
    ctx.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  }, [px, zoom, length, vertical, offset]);
  return <canvas ref={ref} className={vertical ? "rulerV" : "rulerH"} />;
}

/* stage offsets inside the canvas area — rulers compensate so 0 = page corner */
const STAGE_MX = 40;
const STAGE_MY = 26;

/* ---------------- fill picker ---------------- */

const FILL_KINDS: { k: FillStyle["kind"]; label: string }[] = [
  { k: "solid", label: "Solid" }, { k: "gradient", label: "Gradient" },
  { k: "halftone", label: "Halftone" }, { k: "pattern", label: "Tiles" },
  { k: "speedlines", label: "Speedlines" }, { k: "texture", label: "Texture" },
];

function FillPicker({ value, onChange }: { value: FillStyle; onChange: (f: FillStyle, final: boolean) => void }) {
  const v = value;
  const set = (patch: Partial<FillStyle>, final = true) =>
    onChange({ ...v, ...patch } as FillStyle, final);

  const variantSwatches = (variants: Record<string, string>, current: string, build: (key: string) => FillStyle) => (
    <div className="variantGrid">
      {Object.entries(variants).map(([key, label]) => {
        const f = build(key);
        const url = fillOverlayURL(f);
        return (
          <button
            key={key}
            title={label}
            className={"variantBtn" + (current === key ? " on" : "")}
            style={{
              backgroundColor: "#ffffff",
              backgroundImage: url ? `url(${url})` : undefined,
              backgroundSize: isRepeating(f) ? "auto" : "100% 100%",
            }}
            onClick={() => onChange(f, true)}
          />
        );
      })}
    </div>
  );

  return (
    <div className="fillPicker">
      <div className="fld">
        <label>Fill type</label>
        <select value={v.kind} onChange={(e) => onChange(defaultFillFor(e.target.value as FillStyle["kind"], "a" in v ? v.a : "#ffffff"), true)}>
          {FILL_KINDS.map((f) => <option key={f.k} value={f.k}>{f.label}</option>)}
        </select>
      </div>
      <div className="fld">
        <label>{v.kind === "gradient" ? "Top" : "Base"}</label>
        <input type="color" value={v.a} onInput={(e) => set({ a: (e.target as HTMLInputElement).value }, false)} onChange={(e) => set({ a: e.target.value })} />
      </div>
      {v.kind === "gradient" && (
        <>
          <div className="fld">
            <label>Bottom</label>
            <input type="color" value={v.b} onInput={(e) => set({ b: (e.target as HTMLInputElement).value } as Partial<FillStyle>, false)} onChange={(e) => set({ b: e.target.value } as Partial<FillStyle>)} />
          </div>
          <div className="fld">
            <label>Angle</label>
            <input type="range" min={0} max={360} value={v.angle} onChange={(e) => set({ angle: +e.target.value } as Partial<FillStyle>)} />
          </div>
          <div className="variantGrid">
            {GRADIENT_PRESETS.map(([a, b], i) => (
              <button key={i} className="variantBtn" style={{ background: `linear-gradient(180deg, ${a}, ${b})` }}
                onClick={() => onChange({ kind: "gradient", a, b, angle: 180 }, true)} />
            ))}
          </div>
        </>
      )}
      {v.kind === "halftone" && (
        <>
          <div className="fld"><label>Dots</label>
            <input type="color" value={v.dot} onChange={(e) => set({ dot: e.target.value } as Partial<FillStyle>)} /></div>
          <div className="fld"><label>Cell</label>
            <select value={v.cell} onChange={(e) => set({ cell: +e.target.value as 8 | 16 | 32 } as Partial<FillStyle>)}>
              <option value={8}>Fine (8)</option><option value={16}>Medium (16)</option><option value={32}>Coarse (32)</option>
            </select></div>
          {variantSwatches(HALFTONE_VARIANTS, v.variant, (key) => ({ ...v, variant: key } as FillStyle))}
        </>
      )}
      {v.kind === "pattern" && (
        <>
          <div className="fld"><label>Ink</label>
            <input type="color" value={v.fg} onChange={(e) => set({ fg: e.target.value } as Partial<FillStyle>)} /></div>
          <div className="fld"><label>Scale</label>
            <input type="range" min={8} max={64} value={v.scale} onChange={(e) => set({ scale: +e.target.value } as Partial<FillStyle>)} /></div>
          {variantSwatches(PATTERN_VARIANTS, v.variant, (key) => ({ ...v, variant: key } as FillStyle))}
        </>
      )}
      {v.kind === "speedlines" && (
        <>
          <div className="fld"><label>Lines</label>
            <input type="color" value={v.line} onChange={(e) => set({ line: e.target.value } as Partial<FillStyle>)} /></div>
          {variantSwatches(SPEEDLINE_VARIANTS, v.variant, (key) => ({ ...v, variant: key } as FillStyle))}
        </>
      )}
      {v.kind === "texture" && (
        <>
          <div className="fld"><label>Grain</label>
            <input type="color" value={v.fg} onChange={(e) => set({ fg: e.target.value } as Partial<FillStyle>)} /></div>
          {variantSwatches(TEXTURE_VARIANTS, v.variant, (key) => ({ ...v, variant: key } as FillStyle))}
        </>
      )}
    </div>
  );
}

/* ---------------- balloon SVG ---------------- */

export interface MergeBaseInfo { d: string; color: string; tf: string }

function BalloonShape({ el, mergeBase, imgSrc }: { el: BalloonEl; mergeBase?: MergeBaseInfo | null; imgSrc?: string | null }) {
  const g = balloonGeom(el);
  const f = el.fill;
  const gid = `grad-${el.id}`, cid = `clip-${el.id}`, pid = `pat-${el.id}`;
  const tile = f.kind !== "solid" && f.kind !== "gradient" ? fillOverlayTile(f) : null;
  const tileURL = tile ? fillOverlayURL(f) : null;
  const needClip = !!tileURL || !!imgSrc;
  const repeating = isRepeating(f);
  let fillRef = "#ffffff";
  if (f.kind === "solid") fillRef = f.a;
  else if (f.kind === "gradient") fillRef = `url(#${gid})`;
  else fillRef = f.a;
  return (
    <svg
      width={el.w} height={el.h}
      style={{ position: "absolute", inset: 0, overflow: "visible", filter: el.shadow ? "drop-shadow(8px 8px 10px #00000059)" : undefined }}
    >
      <defs>
        {f.kind === "gradient" && (
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1" gradientTransform={`rotate(${f.angle - 180}, 0.5, 0.5)`}>
            <stop offset="0" stopColor={f.a} />
            <stop offset="1" stopColor={f.b} />
          </linearGradient>
        )}
        {needClip && <clipPath id={cid}><path d={g.d} /></clipPath>}
        {tileURL && repeating && tile && (
          <pattern id={pid} patternUnits="userSpaceOnUse" width={tile.width} height={tile.height}>
            <image href={tileURL} width={tile.width} height={tile.height} />
          </pattern>
        )}
      </defs>
      {mergeBase && el.strokeW > 0 && (
        /* joined balloons: stroke under, fills over → outlines union */
        <path d={g.d} fill="none" stroke={el.stroke} strokeWidth={el.strokeW * 2}
          strokeLinejoin="round" strokeDasharray={g.dash ? g.dash.join(" ") : undefined} />
      )}
      <path d={g.d} fill={fillRef} />
      {tileURL && (repeating
        ? <rect x={-el.w} y={-el.h} width={el.w * 3} height={el.h * 3} fill={`url(#${pid})`} clipPath={`url(#${cid})`} />
        : <image href={tileURL} x={0} y={0} width={el.w} height={el.h} preserveAspectRatio="none" clipPath={`url(#${cid})`} />)}
      {imgSrc && (
        <image href={imgSrc} x={0} y={0} width={el.w} height={el.h}
          preserveAspectRatio="xMidYMid slice" clipPath={`url(#${cid})`} />
      )}
      {mergeBase && <g transform={mergeBase.tf}><path d={mergeBase.d} fill={mergeBase.color} /></g>}
      {!mergeBase && el.strokeW > 0 && (
        <path d={g.d} fill="none" stroke={el.stroke} strokeWidth={el.strokeW}
          strokeLinejoin="round" strokeDasharray={g.dash ? g.dash.join(" ") : undefined} />
      )}
      {!mergeBase && el.strokeW > 0 && g.d2 && (
        <path d={g.d2} fill="none" stroke={el.stroke} strokeWidth={el.strokeW}
          strokeLinejoin="round" strokeDasharray={g.dash ? g.dash.join(" ") : undefined} />
      )}
    </svg>
  );
}

/* ==================================================================== */

interface ProjectMeta { id: string; name: string; updatedAt: string; thumbnail: string | null }
interface ProofMatch { elId: string; message: string; context: string; offset: number; length: number; reps: string[] }

const STAMPS = ["💥", "⚡", "🔥", "💫", "⭐", "💢", "💦", "💤", "❗", "❓", "🎯", "🏆", "❤️", "💀", "🤖", "👊"];
/* Pre-made SFX word stamps, each paired with a lettering style preset + tilt */
const WORD_STAMPS: [string, string, number][] = [
  ["ZAP!", "Hazard", -6], ["POW!", "Sunburst", 5], ["BAM!", "Crimson", -4],
  ["BOOM!", "Blaze", 3], ["KRAK!", "Stone", -5], ["WHAM!", "Panic", 6],
  ["HA HA!", "Classic", -3], ["SPLOOSH!", "Ocean", 4],
];
const LT_URL = "https://api.languagetool.org/v2/check";

const elLabel = (el: El) =>
  el.type === "balloon" ? `Balloon: ${el.text.slice(0, 18) || "(empty)"}`
    : el.type === "text" ? `Lettering: ${el.text.slice(0, 18) || "(empty)"}`
    : el.type === "panel" ? "Panel"
    : "Image";

export default function Editor() {
  const [, force] = useReducer((c: number) => c + 1, 0);
  const docRef = useRef<Doc | null>(null);
  const assetsRef = useRef<Assets>({});
  const histRef = useRef<string[]>([]);
  const hIndexRef = useRef(-1);
  const pageDivRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const aidRef = useRef(1);

  const [mounted, setMounted] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.35);
  const [userZoomed, setUserZoomed] = useState(false);
  const [tab, setTab] = useState<"layouts" | "inspector" | "layers" | "photos" | "library" | "proof">("layouts");
  const [layoutCat, setLayoutCat] = useState(0);
  const [status, setStatusRaw] = useState(HINT);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [current, setCurrent] = useState<{ id: string; name: string } | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelImageTarget = useRef<string | null>(null);
  const pendingLockRef = useRef<Set<string>>(new Set());
  const snapRef = useRef<{ x: number | null; y: number | null }>({ x: null, y: null });
  const autoLockRef = useRef(true);
  const [autoLock, setAutoLockState] = useState(true);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFmt, setExportFmt] = useState<ImageFormat | "pdf" | "cbz">("png");
  const [exportScope, setExportScope] = useState<"current" | "all" | "range">("all");
  const [exportDpi, setExportDpi] = useState(225);
  const [exportFrom, setExportFrom] = useState(1);
  const [exportTo, setExportTo] = useState(1);
  const [stampOpen, setStampOpen] = useState(false);
  const [showFill, setShowFill] = useState(false);
  const [showStroke, setShowStroke] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  /* active lettering style — like Comic Life, styles are not objects: they
     restyle the selection and set the style used by new lettering */
  const [activeStyle, setActiveStyleState] = useState("Sunburst");
  const activeStyleRef = useRef("Sunburst");
  useEffect(() => {
    try {
      const s = localStorage.getItem("lmc.style");
      if (s && LETTER_STYLES.some((x) => x.name === s)) { activeStyleRef.current = s; setActiveStyleState(s); }
    } catch { /* ignore */ }
  }, []);
  const setActiveStyle = (name: string) => {
    activeStyleRef.current = name;
    setActiveStyleState(name);
    try { localStorage.setItem("lmc.style", name); } catch { /* ignore */ }
  };
  const [proof, setProof] = useState<{ busy: boolean; error: string | null; matches: ProofMatch[] } | null>(null);

  useEffect(() => {
    try { autoLockRef.current = localStorage.getItem("lmc.autolock") !== "0"; } catch { /* ignore */ }
    setAutoLockState(autoLockRef.current);
  }, []);
  const setAutoLock = (v: boolean) => {
    autoLockRef.current = v;
    setAutoLockState(v);
    try { localStorage.setItem("lmc.autolock", v ? "1" : "0"); } catch { /* ignore */ }
  };

  /* auto-lock: newly placed items lock themselves once you click away */
  const settlePendingLock = useCallback((exceptId: string | null) => {
    const pend = pendingLockRef.current;
    if (!pend.size) return;
    const d = docRef.current;
    if (!d) return;
    let changed = false;
    for (const id of [...pend]) {
      if (id === exceptId) continue;
      pend.delete(id);
      if (!autoLockRef.current) continue;
      for (const p of d.pages) {
        const el = p.els.find((e) => e.id === id);
        if (el) { el.locked = true; changed = true; }
      }
    }
    if (changed) setTimeout(() => commitRef.current?.(), 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const commitRef = useRef<(() => void) | null>(null);

  const doc = docRef.current;
  const page: Page | null = doc ? doc.pages[Math.min(pageIndex, doc.pages.length - 1)] : null;
  const selEl: El | null = page?.els.find((e) => e.id === selId) || null;

  const setStatus = useCallback((msg: string) => {
    setStatusRaw(msg);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusRaw(HINT), 4500);
  }, []);

  /* ---------------- history / persistence ---------------- */

  const scheduleThumb = useCallback((pi: number) => {
    if (thumbTimer.current) clearTimeout(thumbTimer.current);
    thumbTimer.current = setTimeout(async () => {
      const d = docRef.current;
      if (!d || !d.pages[pi]) return;
      try {
        const url = await pageThumbnail(d.pages[pi], assetsRef.current, 140);
        setThumbs((t) => ({ ...t, [pi]: url }));
      } catch { /* ignore */ }
    }, 700);
  }, []);

  const autosave = useCallback(() => {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ doc: docRef.current, assets: assetsRef.current }));
    } catch { /* too large for localStorage — library/save still works */ }
  }, []);

  const commit = useCallback(() => {
    const j = JSON.stringify(docRef.current);
    const h = histRef.current;
    h.splice(hIndexRef.current + 1);
    h.push(j);
    if (h.length > 50) h.shift();
    hIndexRef.current = h.length - 1;
    autosave();
    scheduleThumb(pageIndexRef.current);
    force();
  }, [autosave, scheduleThumb]);

  const pageIndexRef = useRef(0);
  useEffect(() => { pageIndexRef.current = pageIndex; }, [pageIndex]);
  useEffect(() => { commitRef.current = commit; }, [commit]);

  const undo = useCallback(() => {
    if (hIndexRef.current <= 0) return;
    hIndexRef.current--;
    docRef.current = JSON.parse(histRef.current[hIndexRef.current]);
    reseedIds(docRef.current!);
    setSelId(null); setEditingId(null);
    setPageIndex((p) => clamp(p, 0, docRef.current!.pages.length - 1));
    autosave(); force();
  }, [autosave]);

  const redo = useCallback(() => {
    if (hIndexRef.current >= histRef.current.length - 1) return;
    hIndexRef.current++;
    docRef.current = JSON.parse(histRef.current[hIndexRef.current]);
    reseedIds(docRef.current!);
    setSelId(null); setEditingId(null);
    setPageIndex((p) => clamp(p, 0, docRef.current!.pages.length - 1));
    autosave(); force();
  }, [autosave]);

  /* ---------------- boot ---------------- */

  useEffect(() => {
    let restored = false;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload?.doc?.app === "comiclettering" && Array.isArray(payload.doc.pages)) {
          docRef.current = payload.doc;
          assetsRef.current = payload.assets || {};
          restored = true;
        }
      }
    } catch { /* ignore corrupt autosave */ }
    if (!docRef.current) docRef.current = starterDoc();
    reseedIds(docRef.current);
    let maxA = 0;
    for (const k of Object.keys(assetsRef.current)) {
      const n = parseInt(k.replace(/\D/g, ""), 10);
      if (!isNaN(n)) maxA = Math.max(maxA, n);
    }
    aidRef.current = maxA + 1;
    histRef.current = [JSON.stringify(docRef.current)];
    hIndexRef.current = 0;
    setMounted(true);
    if (restored) setStatus("Restored your last session from this browser.");
    (async () => {
      const d = docRef.current!;
      for (let i = 0; i < d.pages.length; i++) {
        try {
          const url = await pageThumbnail(d.pages[i], assetsRef.current, 140);
          setThumbs((t) => ({ ...t, [i]: url }));
        } catch { /* ignore */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* fit zoom */
  const fitZoom = useCallback((forceFit: boolean) => {
    const d = docRef.current;
    const area = areaRef.current;
    if (!d || !area) return;
    if (userZoomed && !forceFit) return;
    const p = d.pages[Math.min(pageIndexRef.current, d.pages.length - 1)];
    const z = Math.min((area.clientWidth - 110) / p.w, (area.clientHeight - 90) / p.h);
    setZoom(clamp(z, 0.05, 2));
  }, [userZoomed]);

  useEffect(() => { if (mounted) fitZoom(true); }, [mounted, pageIndex, fitZoom]);
  useEffect(() => {
    const onR = () => fitZoom(false);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [fitZoom]);

  /* ---------------- selection / editing ---------------- */

  const select = useCallback((id: string | null) => {
    setSelId(id);
    setCtxMenu(null);
    settlePendingLock(id);
    if (editingId && editingId !== id) finishEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, settlePendingLock]);

  const finishEditing = useCallback(() => {
    setEditingId((eid) => {
      if (!eid) return null;
      const d = docRef.current!;
      const p = d.pages[pageIndexRef.current];
      const el = p.els.find((e) => e.id === eid) as BalloonEl | TextEl | undefined;
      const dom = pageDivRef.current?.querySelector(`.el[data-id="${eid}"] .txt`) as HTMLElement | null;
      if (el && dom) {
        const txt = dom.innerText.replace(/ /g, " ").replace(/\n$/, "");
        if (txt !== el.text) { el.text = txt; setTimeout(commit, 0); }
      }
      return null;
    });
  }, [commit]);

  useEffect(() => {
    if (!editingId) return;
    const dom = pageDivRef.current?.querySelector(`.el[data-id="${editingId}"] .txt`) as HTMLElement | null;
    if (!dom) return;
    dom.focus();
    const range = document.createRange();
    range.selectNodeContents(dom);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editingId]);

  /* ---------------- pointer interactions ---------------- */

  const pagePoint = useCallback((e: { clientX: number; clientY: number }) => {
    const r = pageDivRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  }, [zoom]);

  const startDrag = useCallback((
    e: React.PointerEvent, el: El,
    mode: "move" | "resize" | "rotate" | "tail" | "bow", handle = ""
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const start = pagePoint(e);
    const orig = JSON.parse(JSON.stringify(el)) as El;
    let moved = false;
    const onMove = (ev: PointerEvent) => {
      const d = docRef.current!;
      const p = d.pages[pageIndexRef.current];
      const cur = p.els.find((x) => x.id === el.id);
      if (!cur) return;
      const pt = pagePoint(ev);
      const dx = pt.x - start.x, dy = pt.y - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 1) moved = true;
      if (mode === "move") {
        let nx = Math.round(orig.x + dx), ny = Math.round(orig.y + dy);
        snapRef.current = { x: null, y: null };
        if (!ev.altKey) {
          /* snap to margins, page centre and other elements (Alt disables) */
          const tol = Math.max(4, 8 / zoom);
          const def = Math.round(p.w * 0.035);
          const m = p.margin ?? { t: def, r: def, b: def, l: def };
          const others = p.els.filter((o) => o.id !== cur.id);
          /* snap targets: page bleed edges, margins, centre, other elements */
          const vTargets = [0, p.w, m.l, p.w - m.r, p.w / 2, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
          const hTargets = [0, p.h, m.t, p.h - m.b, p.h / 2, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
          /* level/mirror helpers: same spot on the opposite side of the page */
          for (const o of others) {
            vTargets.push(p.w - (o.x + o.w), p.w - o.x, p.w - (o.x + o.w / 2));
            hTargets.push(p.h - (o.y + o.h), p.h - o.y, p.h - (o.y + o.h / 2));
          }
          /* equal-spacing helpers: reuse existing gaps between stacked items */
          const colMates = others.filter((o) => o.x < nx + cur.w && o.x + o.w > nx).sort((a, b) => a.y - b.y);
          const vGaps = new Set<number>();
          for (let i = 0; i < colMates.length - 1; i++) {
            const gap = colMates[i + 1].y - (colMates[i].y + colMates[i].h);
            if (gap > 4) vGaps.add(Math.round(gap));
          }
          for (const o of colMates) for (const gap of vGaps) {
            hTargets.push(o.y + o.h + gap, o.y - gap - cur.h);
          }
          const rowMates = others.filter((o) => o.y < ny + cur.h && o.y + o.h > ny).sort((a, b) => a.x - b.x);
          const hGaps = new Set<number>();
          for (let i = 0; i < rowMates.length - 1; i++) {
            const gap = rowMates[i + 1].x - (rowMates[i].x + rowMates[i].w);
            if (gap > 4) hGaps.add(Math.round(gap));
          }
          for (const o of rowMates) for (const gap of hGaps) {
            vTargets.push(o.x + o.w + gap, o.x - gap - cur.w);
          }
          let best = tol + 1;
          for (const own of [0, cur.w / 2, cur.w]) for (const t of vTargets) {
            const delta = t - (nx + own);
            if (Math.abs(delta) < Math.abs(best)) { best = delta; snapRef.current.x = t; }
          }
          if (Math.abs(best) <= tol) nx += Math.round(best); else snapRef.current.x = null;
          best = tol + 1;
          for (const own of [0, cur.h / 2, cur.h]) for (const t of hTargets) {
            const delta = t - (ny + own);
            if (Math.abs(delta) < Math.abs(best)) { best = delta; snapRef.current.y = t; }
          }
          if (Math.abs(best) <= tol) ny += Math.round(best); else snapRef.current.y = null;
        }
        cur.x = nx;
        cur.y = ny;
      } else if (mode === "resize") {
        const [ldx, ldy] = rotVec(dx, dy, -orig.rot);
        if (handle.includes("e")) cur.w = Math.max(MIN_SIZE, Math.round(orig.w + ldx));
        if (handle.includes("s")) cur.h = Math.max(MIN_SIZE, Math.round(orig.h + ldy));
        if (handle.includes("w")) { cur.w = Math.max(MIN_SIZE, Math.round(orig.w - ldx)); cur.x = orig.x + (orig.w - cur.w); }
        if (handle.includes("n")) { cur.h = Math.max(MIN_SIZE, Math.round(orig.h - ldy)); cur.y = orig.y + (orig.h - cur.h); }
        /* Shift on a corner handle: keep proportions locked */
        if (ev.shiftKey && handle.length === 2) {
          const s = Math.max(cur.w / orig.w, cur.h / orig.h);
          cur.w = Math.max(MIN_SIZE, Math.round(orig.w * s));
          cur.h = Math.max(MIN_SIZE, Math.round(orig.h * s));
          if (handle.includes("w")) cur.x = orig.x + (orig.w - cur.w);
          if (handle.includes("n")) cur.y = orig.y + (orig.h - cur.h);
        }
      } else if (mode === "rotate") {
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        let ang = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI + 90;
        if (ev.shiftKey) ang = Math.round(ang / 15) * 15;
        const norm = ((ang % 360) + 360) % 360;
        if (norm < 3 || norm > 357) ang = 0;
        cur.rot = Math.round(ang * 10) / 10;
      } else if (mode === "tail" && cur.type === "balloon") {
        cur.attachTo = null; // dragging the tip detaches a joined balloon
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        const [ldx, ldy] = rotVec(pt.x - cx, pt.y - cy, -orig.rot);
        const oldTail = (orig as BalloonEl).tail;
        const next: NonNullable<BalloonEl["tail"]> = { dx: Math.round(ldx), dy: Math.round(ldy) };
        /* the bend lever owns the tail's exit point — keep it planted while
           the tip moves */
        if (oldTail && oldTail.bx != null && oldTail.by != null) {
          next.bx = oldTail.bx;
          next.by = oldTail.by;
        }
        cur.tail = next;
      } else if (mode === "bow" && cur.type === "balloon" && cur.tail) {
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        const [ldx, ldy] = rotVec(pt.x - cx, pt.y - cy, -orig.rot);
        cur.tail = { ...cur.tail, bx: Math.round(ldx), by: Math.round(ldy) };
      }
      force();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      snapRef.current = { x: null, y: null };
      if (moved) {
        /* balloons auto-join when dragged close to another balloon */
        if (mode === "move" && el.type === "balloon") {
          const d = docRef.current!;
          const p = d.pages[pageIndexRef.current];
          const cur = p.els.find((x) => x.id === el.id) as BalloonEl | undefined;
          if (cur) {
            const near = Math.round(Math.min(cur.w, cur.h) * 0.18);
            const probe = { x: cur.x - near, y: cur.y - near, w: cur.w + near * 2, h: cur.h + near * 2 };
            const cand = p.els.find((o) =>
              o.id !== cur.id && o.type === "balloon" &&
              (o as BalloonEl).attachTo !== cur.id && aabbOverlap(probe, o)) as BalloonEl | undefined;
            if (cand) {
              if (cur.attachTo !== cand.id) setStatus("Balloons joined — drag the red lever to bend the link, drag the orange tip to detach.");
              cur.attachTo = cand.id;
            }
          }
        }
        commit();
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [pagePoint, commit]);

  /* ---------------- keyboard ---------------- */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField = t.closest?.("input, select, textarea") || t.isContentEditable;
      if (e.key === "Escape") {
        if (editingId) finishEditing();
        else setSelId(null);
        return;
      }
      if (inField) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateSel(); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); saveProject(false); return; }
      if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); copySel(); return; }
      if (mod && e.key.toLowerCase() === "x") { e.preventDefault(); cutSel(); return; }
      if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); pasteClip(); return; }
      if (mod && e.key === "[") { e.preventDefault(); alignSel("hcenter"); return; }
      if (mod && e.key === "]") { e.preventDefault(); alignSel("vcenter"); return; }
      /* letterer hotkeys: B balloon, T text, L lettering, P panel */
      if (!mod && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "b") { e.preventDefault(); addFromTray("speech"); return; }
        if (k === "t") { e.preventDefault(); addFromTray("text"); return; }
        if (k === "l") { e.preventDefault(); addFromTray("sfx"); return; }
        if (k === "p") { e.preventDefault(); addFromTray("panel"); return; }
      }
      const d = docRef.current!;
      const p = d.pages[pageIndexRef.current];
      const el = p.els.find((x) => x.id === selId);
      if (!el) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSel(); return; }
      if (el.locked) return;
      const step = e.shiftKey ? 10 : 2;
      const dxy: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      if (dxy[e.key]) {
        e.preventDefault();
        el.x += dxy[e.key][0]; el.y += dxy[e.key][1];
        force();
        if (thumbTimer.current) clearTimeout(thumbTimer.current);
        thumbTimer.current = setTimeout(commit, 400);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, editingId, undo, redo, finishEditing]);

  /* ---------------- element ops ---------------- */

  const mutateSel = useCallback(<T extends El>(fn: (el: T) => void, final = true) => {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const el = p.els.find((x) => x.id === selId) as T | undefined;
    if (!el) return;
    fn(el);
    if (final) commit(); else force();
  }, [selId, commit]);

  function deleteSel() {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const i = p.els.findIndex((x) => x.id === selId);
    if (i < 0) return;
    if (p.els[i].locked) { setStatus("This item is locked — right-click it to unlock before deleting."); return; }
    pendingLockRef.current.delete(p.els[i].id);
    p.els.splice(i, 1);
    setSelId(null);
    commit();
  }

  function duplicateSel() {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const el = p.els.find((x) => x.id === selId);
    if (!el) return;
    const copy = JSON.parse(JSON.stringify(el)) as El;
    copy.id = uid();
    copy.x += 40; copy.y += 40;
    copy.locked = false;
    p.els.push(copy);
    pendingLockRef.current.add(copy.id);
    commit();
    setSelId(copy.id);
  }

  /* quick fill/stroke from the format-bar pickers — applies to the selected
     balloon/panel/lettering, or the page background when nothing is selected */
  function applyQuickFill(opt: { solidColor?: string; gradient?: [string, string] }) {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const el = p.els.find((e) => e.id === selId);
    if (el?.locked) { setStatus("That item is locked — unlock it first."); return; }
    const asFill = (): FillStyle => opt.gradient
      ? { kind: "gradient", a: opt.gradient[0], b: opt.gradient[1], angle: 180 }
      : solid(opt.solidColor!);
    if (el && (el.type === "balloon" || el.type === "panel")) {
      el.fill = asFill();
    } else if (el && el.type === "text") {
      if (opt.gradient) { el.ts.fillA = opt.gradient[0]; el.ts.fillB = opt.gradient[1]; }
      else { el.ts.fillA = opt.solidColor!; el.ts.fillB = null; }
    } else if (el && el.type === "image") {
      setStatus("Images have no fill — select a balloon, panel or lettering.");
      return;
    } else {
      p.bg = asFill();
    }
    commit();
    setShowFill(false);
  }

  function applyQuickStroke(color: string) {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const el = p.els.find((e) => e.id === selId);
    if (!el) { setStatus("Select an item to change its stroke."); setShowStroke(false); return; }
    if (el.locked) { setStatus("That item is locked — unlock it first."); return; }
    if (el.type === "balloon") el.stroke = color;
    else if (el.type === "panel" || el.type === "image") {
      el.borderC = color;
      if (!el.borderW) el.borderW = 4;
    } else if (el.type === "text") {
      el.ts.outlineC = color;
      if (!el.ts.outlineW) el.ts.outlineW = Math.max(2, Math.round(el.ts.size * 0.08));
    }
    commit();
    setShowStroke(false);
  }

  const clipboardRef = useRef<El | null>(null);

  function copySel() {
    const el = page?.els.find((x) => x.id === selId);
    if (!el) return;
    clipboardRef.current = JSON.parse(JSON.stringify(el));
    setStatus("Copied.");
  }
  function cutSel() {
    const el = page?.els.find((x) => x.id === selId);
    if (!el) return;
    if (el.locked) { setStatus("This item is locked — unlock it to cut."); return; }
    clipboardRef.current = JSON.parse(JSON.stringify(el));
    deleteSel();
  }
  function pasteClip() {
    if (!clipboardRef.current || !page) return;
    const copy = JSON.parse(JSON.stringify(clipboardRef.current)) as El;
    copy.id = uid();
    copy.x += 30; copy.y += 30;
    copy.locked = false;
    page.els.push(copy);
    pendingLockRef.current.add(copy.id);
    commit();
    setSelId(copy.id);
  }
  function alignSel(mode: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") {
    const el = page?.els.find((x) => x.id === selId);
    if (!el || !page) return;
    if (el.locked) { setStatus("This item is locked."); return; }
    const def = Math.round(page.w * 0.035);
    const m = page.margin ?? { t: def, r: def, b: def, l: def };
    if (mode === "left") el.x = m.l;
    if (mode === "hcenter") el.x = Math.round((page.w - el.w) / 2);
    if (mode === "right") el.x = page.w - m.r - el.w;
    if (mode === "top") el.y = m.t;
    if (mode === "vcenter") el.y = Math.round((page.h - el.h) / 2);
    if (mode === "bottom") el.y = page.h - m.b - el.h;
    commit();
  }
  async function resizeToActual() {
    const el = page?.els.find((x) => x.id === selId);
    if (!el || (el.type !== "image" && el.type !== "panel") || !el.img) return;
    if (el.locked) { setStatus("This item is locked."); return; }
    const src = assetsRef.current[el.img];
    if (!src) return;
    const img = await loadImage(src);
    el.w = img.naturalWidth; el.h = img.naturalHeight;
    commit();
  }

  function reorder(delta: number) {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const i = p.els.findIndex((x) => x.id === selId);
    if (i < 0) return;
    const [el] = p.els.splice(i, 1);
    p.els.splice(clamp(i + delta, 0, p.els.length), 0, el);
    commit();
  }

  function addFromTray(kind: string) {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const n = p.els.length % 5;
    const spawn = (w: number, h: number) =>
      ({ x: Math.round(p.w / 2 - w / 2 + n * 40), y: Math.round(p.h * 0.3 + n * 40), w, h });
    let el: El | null = null;
    if (kind === "panel") {
      const w = Math.round(p.w * 0.42), h = Math.round(w * 0.75);
      const s = spawn(w, h);
      el = makePanel(s.x, s.y, w, h);
    } else if (kind === "image") {
      fileImageRef.current?.click();
      return;
    } else if (kind === "sfx" || kind === "text") {
      const w = Math.round(p.w * 0.4), h = Math.round(p.w * (kind === "sfx" ? 0.18 : 0.12));
      const s = spawn(w, h);
      el = makeText(s.x, s.y, w, h, kind === "sfx");
      if (kind === "sfx") {
        /* new lettering uses the active style from the STYLES panel */
        const st = LETTER_STYLES.find((x) => x.name === activeStyleRef.current) || LETTER_STYLES[0];
        el.ts = applyLetterStyle(el.ts, st);
        el.ts.outlineW = Math.round(el.ts.size * st.outlineF);
      }
    } else {
      const caption = TAILLESS_KINDS.includes(kind as BalloonKind);
      const w = Math.round(p.w * (caption ? 0.36 : 0.34));
      const h = caption ? Math.round(w * 0.32) : Math.round(w * 0.62);
      const s = spawn(w, h);
      el = makeBalloon(kind as BalloonKind, s.x, s.y, w, h);
    }
    if (el) {
      p.els.push(el);
      pendingLockRef.current.add(el.id);
      commit();
      setSelId(el.id);
    }
  }

  /* ---------------- images ---------------- */

  const fileImageRef = useRef<HTMLInputElement>(null);
  const filePanelImageRef = useRef<HTMLInputElement>(null);
  const fileOpenRef = useRef<HTMLInputElement>(null);

  const readAsDataURL = (f: File) => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });

  function placeAsset(aid: string, natW: number, natH: number, x?: number, y?: number) {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const w = Math.min(Math.round(p.w * 0.45), natW);
    const h = Math.round(w * (natH / natW));
    const el = makeImage(Math.round((x ?? p.w / 2) - w / 2), Math.round((y ?? p.h / 2) - h / 2), w, h, aid);
    p.els.push(el);
    pendingLockRef.current.add(el.id);
    commit();
    setSelId(el.id);
  }

  async function importPdfFile(f: File, x?: number, y?: number) {
    setStatus("Rendering PDF…");
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    const pdf = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
    const n = Math.min(pdf.numPages, 10);
    let first: { aid: string; w: number; h: number } | null = null;
    for (let i = 1; i <= n; i++) {
      const pg = await pdf.getPage(i);
      const vp1 = pg.getViewport({ scale: 1 });
      const scale = Math.min(3, 1600 / vp1.width);
      const vp = pg.getViewport({ scale });
      const c = document.createElement("canvas");
      c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await pg.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport: vp }).promise;
      const url = c.toDataURL("image/png");
      const aid = "a" + aidRef.current++;
      assetsRef.current[aid] = url;
      await loadImage(url);
      if (!first) first = { aid, w: c.width, h: c.height };
    }
    if (first) placeAsset(first.aid, first.w, first.h, x, y);
    setStatus(`Imported ${n} PDF page${n > 1 ? "s" : ""} — extra pages are in the Photos tab.`);
  }

  async function importImageFile(f: File, x?: number, y?: number) {
    if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
      await importPdfFile(f, x, y);
      return;
    }
    const url = await readAsDataURL(f);
    const img = await loadImage(url);
    const aid = "a" + aidRef.current++;
    assetsRef.current[aid] = url;
    placeAsset(aid, img.naturalWidth, img.naturalHeight, x, y);
  }

  /* Instant Alpha: flood-remove the background color from the image edges. */
  async function runInstantAlpha(elId: string, aid: string) {
    const tolStr = window.prompt("Background removal strength (1–100):", "30");
    if (!tolStr) return;
    const tol = clamp(+tolStr || 30, 1, 100);
    const src = assetsRef.current[aid];
    if (!src) return;
    setStatus("Removing background…");
    const img = await loadImage(src);
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    const thr2 = (tol * 4.41) ** 2;
    const visited = new Uint8Array(W * H);
    for (const [sx, sy] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) {
      const si = sy * W + sx;
      if (visited[si]) continue;
      const sr = d[si * 4], sg = d[si * 4 + 1], sb = d[si * 4 + 2];
      const q = [si];
      visited[si] = 1;
      while (q.length) {
        const i = q.pop()!;
        const o = i * 4;
        const dr = d[o] - sr, dg = d[o + 1] - sg, db = d[o + 2] - sb;
        if (dr * dr + dg * dg + db * db > thr2) continue;
        d[o + 3] = 0;
        const px = i % W, py = (i / W) | 0;
        if (px > 0 && !visited[i - 1]) { visited[i - 1] = 1; q.push(i - 1); }
        if (px < W - 1 && !visited[i + 1]) { visited[i + 1] = 1; q.push(i + 1); }
        if (py > 0 && !visited[i - W]) { visited[i - W] = 1; q.push(i - W); }
        if (py < H - 1 && !visited[i + W]) { visited[i + W] = 1; q.push(i + W); }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    const url = c.toDataURL("image/png");
    const newAid = "a" + aidRef.current++;
    assetsRef.current[newAid] = url;
    await loadImage(url);
    const p = docRef.current!.pages[pageIndexRef.current];
    const el = p.els.find((e) => e.id === elId);
    if (el && (el.type === "image" || el.type === "panel")) {
      el.img = newAid;
      commit();
      setStatus("Background removed — undo (Ctrl+Z) if it took too much.");
    }
  }

  function hitElAt(x: number, y: number): El | null {
    const p = docRef.current!.pages[pageIndexRef.current];
    for (let i = p.els.length - 1; i >= 0; i--) {
      const el = p.els[i];
      if (x >= el.x && x <= el.x + el.w && y >= el.y && y <= el.y + el.h) return el;
    }
    return null;
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])].filter(
      (f) => f.type.startsWith("image/") || f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (!files.length) return;
    const pt = pagePoint(e);
    let off = 0;
    for (const f of files) {
      const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      /* dropping an image onto a balloon or panel fills it in place */
      const target = !isPdf && off === 0 ? hitElAt(pt.x, pt.y) : null;
      if (target && (target.type === "balloon" || target.type === "panel" || target.type === "image") && !target.locked) {
        const url = await readAsDataURL(f);
        await loadImage(url);
        const aid = "a" + aidRef.current++;
        assetsRef.current[aid] = url;
        target.img = aid;
        commit();
        setSelId(target.id);
        setStatus(target.type === "balloon" ? "Image placed inside the balloon." : "Image placed in the panel.");
      } else {
        await importImageFile(f, pt.x + off, pt.y + off);
      }
      off += 60;
    }
  }

  async function assignImageToPanel(elId: string, aid: string) {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const el = p.els.find((x) => x.id === elId);
    if (!el || (el.type !== "panel" && el.type !== "image" && el.type !== "balloon")) return;
    el.img = aid;
    await loadImage(assetsRef.current[aid]);
    commit();
  }

  /* ---------------- project library (SQL) ---------------- */

  async function refreshProjects() {
    try {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error(await res.text());
      setProjects(await res.json());
      setDbError(null);
    } catch (err) {
      setDbError("Library unavailable: " + String(err).slice(0, 140));
      setProjects([]);
    }
  }
  useEffect(() => { if (tab === "library" && projects === null) refreshProjects(); }, [tab, projects]);

  async function saveProject(saveAs: boolean) {
    const d = docRef.current!;
    let target = current;
    let name = current?.name;
    if (saveAs || !target) {
      const entered = window.prompt("Project name:", name || "My comic");
      if (!entered) return;
      name = entered;
      target = null;
    }
    setStatus("Saving to library…");
    try {
      let thumbnail = "";
      try { thumbnail = await docThumbnail(d, assetsRef.current); } catch { /* optional */ }
      const payload = { name, data: { doc: d, assets: assetsRef.current }, thumbnail };
      const res = target
        ? await fetch(`/api/projects/${target.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
      const meta = await res.json();
      setCurrent({ id: meta.id, name: meta.name });
      setStatus(`Saved “${meta.name}” to the library.`);
      refreshProjects();
    } catch (err) {
      setStatus("Save failed: " + String(err).slice(0, 120));
    }
  }

  async function loadProject(id: string) {
    setStatus("Loading project…");
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error(res.statusText);
      const p = await res.json();
      const payload = p.data;
      if (!payload?.doc?.pages) throw new Error("bad project data");
      docRef.current = payload.doc;
      assetsRef.current = payload.assets || {};
      reseedIds(docRef.current!);
      histRef.current = [JSON.stringify(docRef.current)];
      hIndexRef.current = 0;
      setCurrent({ id: p.id, name: p.name });
      setSelId(null); setEditingId(null); setPageIndex(0);
      setThumbs({});
      autosave();
      force();
      fitZoom(true);
      const d = docRef.current!;
      for (let i = 0; i < d.pages.length; i++) {
        pageThumbnail(d.pages[i], assetsRef.current, 140).then((url) =>
          setThumbs((t) => ({ ...t, [i]: url }))).catch(() => { });
      }
      setStatus(`Opened “${p.name}”.`);
    } catch (err) {
      setStatus("Load failed: " + String(err).slice(0, 120));
    }
  }

  async function deleteProject(id: string) {
    if (!window.confirm("Delete this project from the library?")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (current?.id === id) setCurrent(null);
    refreshProjects();
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ doc: docRef.current, assets: assetsRef.current })], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (current?.name || "comic-project") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  async function importJSON(f: File) {
    try {
      const payload = JSON.parse(await f.text());
      const d: Doc = payload.doc ?? payload;
      if (d?.app !== "comiclettering" || !Array.isArray(d.pages)) throw new Error("not a ComicLettering project");
      if ((d as { version?: number }).version !== 2) throw new Error("this file is from an old version");
      docRef.current = d;
      assetsRef.current = payload.assets || {};
      reseedIds(d);
      histRef.current = [JSON.stringify(d)];
      hIndexRef.current = 0;
      setCurrent(null);
      setSelId(null); setPageIndex(0); setThumbs({});
      autosave(); force(); fitZoom(true);
      setStatus("Project imported.");
    } catch (err) {
      window.alert("Could not open that file: " + (err as Error).message);
    }
  }

  async function printPage() {
    if (!page) return;
    setStatus("Preparing print…");
    const { renderPageToCanvas } = await import("@/lib/exportPng");
    const canvas = await renderPageToCanvas(page, assetsRef.current, 1);
    const url = canvas.toDataURL("image/png");
    const w = window.open("", "_blank");
    if (!w) { setStatus("Pop-up blocked — allow pop-ups to print."); return; }
    w.document.write(`<!doctype html><title>Print — LetterMyComic</title><style>body{margin:0}img{width:100%}</style><img src="${url}" onload="setTimeout(function(){window.print()},150)">`);
    w.document.close();
    setStatus("Sent to print.");
  }

  async function exportAllPages() {
    const d = docRef.current!;
    for (let i = 0; i < d.pages.length; i++) {
      setStatus(`Exporting page ${i + 1}/${d.pages.length}…`);
      await exportPagePNG(d.pages[i], assetsRef.current, `comic-page-${i + 1}.png`);
    }
    setStatus(`Exported ${d.pages.length} page${d.pages.length > 1 ? "s" : ""}.`);
  }

  async function runExport(
    format: ImageFormat | "pdf" | "cbz",
    scope: "current" | "all" | "range", dpi: number
  ) {
    const d = docRef.current!;
    const nameBase = (current?.name || "comic").replace(/[^\w\- ]+/g, "");
    const idxs =
      scope === "current" ? [pageIndexRef.current]
        : scope === "all" ? d.pages.map((_, i) => i)
        : d.pages.map((_, i) => i).filter((i) =>
            i + 1 >= Math.min(exportFrom, exportTo) && i + 1 <= Math.max(exportFrom, exportTo));
    if (!idxs.length) { setStatus("No pages in that range."); return; }
    try {
      if (format === "pdf") {
        const sub = { ...d, pages: idxs.map((i) => d.pages[i]) };
        const { exportPdf } = await import("@/lib/pdfExport");
        await exportPdf(sub, assetsRef.current, `${nameBase}.pdf`, (i, n) => setStatus(`Rendering PDF page ${i}/${n}…`), dpi);
      } else if (format === "cbz") {
        const { exportCbz } = await import("@/lib/cbz");
        await exportCbz(d, assetsRef.current, `${nameBase}.cbz`, dpi, idxs, (i, n) => setStatus(`Packing CBZ page ${i}/${n}…`));
      } else {
        for (const pi of idxs) {
          setStatus(`Exporting page ${pi + 1} (${format.toUpperCase()} @ ${dpi} dpi)…`);
          await exportPageImage(d.pages[pi], assetsRef.current, `${nameBase}-page-${pi + 1}.${format}`, format, dpi);
        }
      }
      setStatus("Export complete.");
      setShowExport(false);
    } catch (err) {
      setStatus("Export failed: " + String(err).slice(0, 120));
    }
  }

  /* ---------------- render helpers ---------------- */

  function renderEl(el: El) {
    const tf = [
      el.rot ? `rotate(${el.rot}deg)` : "",
      el.flipH ? "scaleX(-1)" : "",
      el.flipV ? "scaleY(-1)" : "",
    ].filter(Boolean).join(" ");
    const style: CSSProperties = {
      left: el.x, top: el.y, width: el.w, height: el.h,
      transform: tf || undefined,
      opacity: el.opacity ?? 1,
    };
    const common = {
      key: el.id,
      "data-id": el.id,
      onPointerDown: (e: React.PointerEvent) => {
        if (editingId === el.id) return;
        select(el.id);
        if (!el.locked) startDrag(e, el, "move");
        else e.preventDefault();
      },
      onDoubleClick: () => {
        if (el.locked) { setStatus("This item is locked — right-click it to unlock."); return; }
        if (el.type === "balloon" || el.type === "text") { select(el.id); setEditingId(el.id); }
        else if (el.type === "panel" || el.type === "image") { panelImageTarget.current = el.id; filePanelImageRef.current?.click(); }
      },
      onContextMenu: (e: React.MouseEvent) => {
        e.preventDefault();
        select(el.id);
        setCtxMenu({ x: e.clientX, y: e.clientY, id: el.id });
      },
    };

    if (el.type === "panel" || el.type === "image") {
      const src = el.img ? assetsRef.current[el.img] : null;
      const st: CSSProperties = {
        ...style,
        ...(el.type === "panel" ? fillCss(el.fill) : {}),
        border: el.borderW > 0 ? `${el.borderW}px solid ${el.borderC}` : "none",
        overflow: "hidden",
        boxShadow: el.shadow ? "8px 8px 12px #00000059" : undefined,
      };
      return (
        <div {...common} className={"el " + el.type} style={st}>
          {src && (
            <img src={src} className="cover" draggable={false} alt=""
              style={{ filter: FILTERS[el.filter]?.css || undefined }} />
          )}
        </div>
      );
    }

    if (el.type === "balloon") {
      const { el: bEl, base } = resolveBalloon(page!, el);
      let mergeBase: MergeBaseInfo | null = null;
      if (base && aabbOverlap(el, base)) {
        const bg = balloonGeom(resolveBalloon(page!, base).el);
        const [rx, ry] = rotVec(
          base.x + base.w / 2 - (el.x + el.w / 2),
          base.y + base.h / 2 - (el.y + el.h / 2), -el.rot);
        mergeBase = {
          d: bg.d,
          color: base.fill.a,
          tf: `translate(${el.w / 2 + rx} ${el.h / 2 + ry}) rotate(${base.rot - el.rot}) translate(${-base.w / 2} ${-base.h / 2})`,
        };
      }
      const g = balloonGeom(bEl);
      const [tx, ty, tw, th] = g.textRect;
      const editing = editingId === el.id;
      return (
        <div {...common} className="el balloon" style={style}>
          <BalloonShape el={bEl} mergeBase={mergeBase} imgSrc={el.img ? assetsRef.current[el.img] : null} />
          <div
            key={editing ? "edit" : "static"}
            className="txt"
            style={{ ...textCss(el.ts), left: tx, top: ty, width: tw, height: th }}
            contentEditable={editing}
            suppressContentEditableWarning
            spellCheck={editing}
            onBlur={() => editing && finishEditing()}
          >{el.text}</div>
        </div>
      );
    }

    /* text / SFX */
    const editing = editingId === el.id;
    return (
      <div {...common} className="el text" style={style}>
        <div
          key={editing ? "edit" : "static"}
          className="txt"
          style={{ ...textCss(el.ts), left: 0, top: 0, width: el.w, height: el.h }}
          contentEditable={editing}
          suppressContentEditableWarning
          spellCheck={editing}
          onBlur={() => editing && finishEditing()}
        >{el.text}</div>
      </div>
    );
  }

  function renderOverlay() {
    if (!selEl || !page) return null;
    const el = selEl.type === "balloon" ? resolveBalloon(page, selEl).el : selEl;
    const z = zoom;
    if (el.locked) {
      return (
        <div className="overlay" style={{
          left: el.x * z, top: el.y * z, width: el.w * z, height: el.h * z,
          transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
        }}>
          <div className="box" style={{ borderStyle: "dashed" }} />
          <div className="lockBadge" title="Locked — unlock in the Inspector">🔒</div>
        </div>
      );
    }
    const handles: [string, number, number][] = [
      ["nw", 0, 0], ["n", 0.5, 0], ["ne", 1, 0], ["e", 1, 0.5],
      ["se", 1, 1], ["s", 0.5, 1], ["sw", 0, 1], ["w", 0, 0.5],
    ];
    return (
      <div
        className={"overlay" + (editingId === el.id ? " editing" : "")}
        style={{
          left: el.x * z, top: el.y * z, width: el.w * z, height: el.h * z,
          transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
        }}
      >
        <div className="box" />
        {handles.map(([k, fx, fy]) => (
          <div key={k} className={`handle h-${k}`}
            style={{ left: `calc(${fx * 100}% - 6px)`, top: `calc(${fy * 100}% - 6px)` }}
            onPointerDown={(e) => startDrag(e, el, "resize", k)} />
        ))}
        <div className="handle rot" title="Rotate (Shift snaps to 15°)"
          style={{ left: "calc(50% - 6px)", top: -28 }}
          onPointerDown={(e) => startDrag(e, el, "rotate")} />
        {el.type === "balloon" && el.tail && (
          <div className="handle tail" title="Drag to aim the tail tip"
            style={{ left: (el.w / 2 + el.tail.dx) * z - 7, top: (el.h / 2 + el.tail.dy) * z - 7 }}
            onPointerDown={(e) => startDrag(e, el, "tail")} />
        )}
        {el.type === "balloon" && el.tail && ["speech", "whisper", "double", "thought"].includes(el.kind) && (() => {
          const t = Math.atan2(el.tail.dy, el.tail.dx);
          const ex = el.w / 2 + (el.w / 2) * Math.cos(t);
          const ey = el.h / 2 + (el.h / 2) * Math.sin(t);
          const bx = el.tail.bx ?? (ex + el.w / 2 + el.tail.dx) / 2 - el.w / 2;
          const by = el.tail.by ?? (ey + el.h / 2 + el.tail.dy) / 2 - el.h / 2;
          return (
            <div className="handle tailBow" title="Drag to bend the tail"
              style={{ left: (el.w / 2 + bx) * z - 6, top: (el.h / 2 + by) * z - 6 }}
              onPointerDown={(e) => startDrag(e, el, "bow")} />
          );
        })()}
      </div>
    );
  }

  /* small field helpers */
  const Fld = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="fld"><label>{label}</label>{children}</div>
  );

  function tsControls(el: BalloonEl | TextEl) {
    const ts = el.ts;
    const set = (patch: Partial<TextStyle>, final = true) =>
      mutateSel<BalloonEl | TextEl>((x) => { x.ts = { ...x.ts, ...patch }; }, final);
    return (
      <div className="inspSection">
        <div className="inspHead">Lettering</div>
        <Fld label="Font">
          <FontMenu value={ts.font} onPick={(k) => {
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

  function renderInspector() {
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
              <button onClick={() => { panelImageTarget.current = el.id; filePanelImageRef.current?.click(); }}>
                {el.img ? "Replace inner image…" : "Place image inside…"}
              </button>
              {el.img && <button onClick={() => mutateSel<BalloonEl>((b) => { b.img = null; })}>Remove image</button>}
            </div>
          </div>
        )}
        {(el.type === "balloon") && (
          <div className="inspSection">
            <div className="inspHead">Balloon fill</div>
            <FillPicker value={el.fill} onChange={(f, final) => mutateSel<BalloonEl>((b) => { b.fill = f; }, final)} />
          </div>
        )}
        {(el.type === "balloon" || el.type === "text") && tsControls(el)}
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
                    onClick={() => runInstantAlpha(el.id, el.img!)}>Instant Alpha (remove bg)</button>
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
            <button onClick={() => reorder(1e9)}>Front</button>
            <button onClick={() => reorder(1)}>Fwd</button>
            <button onClick={() => reorder(-1)}>Back</button>
            <button onClick={() => reorder(-1e9)}>Rear</button>
          </div>
          <div className="btnRow">
            <button onClick={duplicateSel}>Duplicate</button>
            <button onClick={deleteSel}>Delete</button>
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

  function renderLayoutsTab() {
    const cat = LAYOUT_CATEGORIES[layoutCat];
    return (
      <div className="inspBody">
        <div className="fld">
          <label>Layout</label>
          <select value={layoutCat} onChange={(e) => setLayoutCat(+e.target.value)}>
            {LAYOUT_CATEGORIES.map((c, i) => <option key={c.name} value={i}>{c.name}</option>)}
          </select>
        </div>
        <div className="layoutGrid">
          {cat.layouts.map((fracs, i) => (
            <button key={i} className="layoutBtn" title={`${fracs.length} panel${fracs.length > 1 ? "s" : ""}`}
              onClick={() => { if (page) { applyLayout(page, fracs as LayoutRect[]); commit(); } }}>
              <svg viewBox="0 0 60 84">
                {fracs.map(([fx, fy, fw, fh, rot], j) => (
                  <rect key={j} x={4 + fx * 52} y={4 + fy * 76} width={Math.max(2, fw * 52 - 2)} height={Math.max(2, fh * 76 - 2)}
                    transform={rot ? `rotate(${rot} ${4 + fx * 52 + fw * 26} ${4 + fy * 76 + fh * 38})` : undefined} />
                ))}
              </svg>
            </button>
          ))}
        </div>
        <div className="tips">Applying a layout replaces the page&apos;s panels; balloons, lettering and images are kept.</div>
      </div>
    );
  }

  /* ---------------- layers tab ---------------- */

  function renderLayersTab() {
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

  /* ---------------- proofing tab (open-source LanguageTool) ---------------- */

  async function runProof() {
    if (!page) return;
    setProof({ busy: true, error: null, matches: [] });
    const targets = page.els.filter((e): e is BalloonEl | TextEl => e.type === "balloon" || e.type === "text");
    const all: ProofMatch[] = [];
    try {
      for (const el of targets) {
        if (!el.text.trim()) continue;
        const res = await fetch(LT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ text: el.text, language: "en-US" }),
        });
        if (!res.ok) throw new Error(`LanguageTool ${res.status}`);
        const data = await res.json();
        for (const m of data.matches || []) {
          all.push({
            elId: el.id,
            message: m.message,
            context: m.context?.text || "",
            offset: m.offset, length: m.length,
            reps: (m.replacements || []).slice(0, 3).map((r: { value: string }) => r.value),
          });
        }
      }
      setProof({ busy: false, error: null, matches: all });
    } catch (err) {
      setProof({ busy: false, error: "Check failed: " + String(err).slice(0, 120) + " (LanguageTool is a free open-source service — it rate-limits heavy use)", matches: all });
    }
  }

  function applyProofFix(m: ProofMatch, rep: string) {
    if (!page) return;
    const el = page.els.find((e) => e.id === m.elId) as BalloonEl | TextEl | undefined;
    if (!el) return;
    if (el.locked) { setStatus("That item is locked — unlock it to apply fixes."); return; }
    el.text = el.text.slice(0, m.offset) + rep + el.text.slice(m.offset + m.length);
    commit();
    setProof((p) => p ? { ...p, matches: p.matches.filter((x) => x !== m && x.elId !== m.elId) } : p);
  }

  function renderProofTab() {
    return (
      <div className="inspBody">
        <div className="btnRow">
          <button onClick={runProof} disabled={proof?.busy}>
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
                <button key={r} onClick={(e) => { e.stopPropagation(); applyProofFix(m, r); }}>“{r}”</button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderPhotosTab() {
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
                if (selEl && (selEl.type === "panel" || selEl.type === "image" || selEl.type === "balloon")) assignImageToPanel(selEl.id, aid);
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

  function renderLibraryTab() {
    return (
      <div className="inspBody">
        <div className="btnRow">
          <button onClick={() => saveProject(false)}>Save</button>
          <button onClick={() => saveProject(true)}>Save As…</button>
          <button onClick={refreshProjects}>Refresh</button>
        </div>
        <div className="btnRow">
          <button onClick={exportJSON}>Export file</button>
          <button onClick={() => fileOpenRef.current?.click()}>Import file</button>
        </div>
        <div className="btnRow">
          <button onClick={exportAllPages}>Export all pages (PNG)</button>
          <button onClick={async () => {
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
                <div>{p.name}</div>
                <small>{new Date(p.updatedAt).toLocaleString()}</small>
              </div>
              <div className="projActs">
                <button onClick={() => loadProject(p.id)}>Open</button>
                <button onClick={() => deleteProject(p.id)}>✕</button>
              </div>
            </div>
          ))}
          {projects && projects.length === 0 && !dbError && <div className="tips">No saved projects yet.</div>}
        </div>
      </div>
    );
  }

  /* ---------------- top-level render ---------------- */

  if (!mounted || !doc || !page) {
    return <div className="booting">Loading ComicLettering Studio…</div>;
  }

  const selTs = selEl && (selEl.type === "balloon" || selEl.type === "text") ? selEl.ts : null;

  return (
    <div className="app">
      {/* ---------- menu bar ---------- */}
      <nav className="menuBar">
        {openMenu && <div className="ctxBackdrop" style={{ zIndex: 179 }} onClick={() => setOpenMenu(null)} />}
        {([
          ["File", [
            ["New Document", () => { if (window.confirm("Start a new document?")) { docRef.current = starterDoc(); assetsRef.current = {}; reseedIds(docRef.current); histRef.current = [JSON.stringify(docRef.current)]; hIndexRef.current = 0; setCurrent(null); setSelId(null); setPageIndex(0); setThumbs({}); autosave(); force(); fitZoom(true); } }],
            ["Open Library", () => setTab("library")],
            ["Save", () => saveProject(false)],
            ["Save As…", () => saveProject(true)],
            ["Import Project File…", () => fileOpenRef.current?.click()],
            ["Export Project File", () => exportJSON()],
            ["—", null],
            ["Page Setup…", () => setShowSetup(true)],
            ["Export…", () => setShowExport(true)],
            ["Print…", () => printPage()],
          ]],
          ["Edit", [
            ["Undo", () => undo()], ["Redo", () => redo()],
            ["—", null],
            ["Cut", () => cutSel()], ["Copy", () => copySel()],
            ["Paste", () => pasteClip()], ["Duplicate", () => duplicateSel()],
            ["Delete", () => deleteSel()],
            ["—", null],
            ["Check Spelling & Grammar", () => { setTab("proof"); runProof(); }],
          ]],
          ["View", [
            ["Zoom In", () => { setUserZoomed(true); setZoom((z) => clamp(z * 1.2, 0.05, 4)); }],
            ["Zoom Out", () => { setUserZoomed(true); setZoom((z) => clamp(z / 1.2, 0.05, 4)); }],
            ["Fit Page", () => { setUserZoomed(false); fitZoom(true); }],
            ["—", null],
            ["Panel Layouts", () => setTab("layouts")],
            ["Inspector", () => setTab("inspector")],
            ["Layers", () => setTab("layers")],
            ["Photos", () => setTab("photos")],
            ["Library", () => setTab("library")],
          ]],
          ["Insert", [
            ["New Page", () => { const d = docRef.current!; d.pages.splice(pageIndex + 1, 0, newPage(page.w, page.h, page.margin)); setPageIndex(pageIndex + 1); setSelId(null); commit(); }],
            ["—", null],
            ["Panel", () => addFromTray("panel")],
            ["Image…", () => fileImageRef.current?.click()],
            ["Speech Balloon", () => addFromTray("speech")],
            ["Thought Balloon", () => addFromTray("thought")],
            ["Caption", () => addFromTray("caption")],
            ["Text", () => addFromTray("text")],
            ["Lettering", () => addFromTray("sfx")],
            ["Stamps…", () => setStampOpen(true)],
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
            ["Bring Forward", () => reorder(1)], ["Bring To Front", () => reorder(1e9)],
            ["Send Backward", () => reorder(-1)], ["Send To Back", () => reorder(-1e9)],
            ["—", null],
            ["Center Horizontally (Ctrl+[)", () => alignSel("hcenter")],
            ["Center Vertically (Ctrl+])", () => alignSel("vcenter")],
            ["Flip Horizontal", () => mutateSel((x) => { x.flipH = !x.flipH; })],
            ["Flip Vertical", () => mutateSel((x) => { x.flipV = !x.flipV; })],
            ["—", null],
            ["Lock", () => mutateSel((x) => { x.locked = true; })],
            ["Unlock", () => mutateSel((x) => { x.locked = false; })],
          ]],
          ["Help", [
            ["Keyboard Shortcuts", () => window.alert("B/T/L/P — add balloon/text/lettering/panel\nCtrl+Z / Ctrl+Y — undo / redo\nCtrl+C/X/V/D — copy / cut / paste / duplicate\nCtrl+S — save · Ctrl+[ / Ctrl+] — center H / V\nShift while resizing — keep proportions\nShift while rotating — snap 15° · Alt while dragging — no snapping\nDouble-click — edit text / set image · Right-click — full menu")],
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

      {/* ---------- toolbar ---------- */}
      <header className="toolbar">
        <a className="brand" href="/" title="lettermycomic.com">Letter<span>My</span>Comic</a>
        <ToolBtn label="New" icon="🗋" onClick={() => {
          if (!window.confirm("Start a new document?")) return;
          docRef.current = starterDoc();
          assetsRef.current = {};
          reseedIds(docRef.current);
          histRef.current = [JSON.stringify(docRef.current)];
          hIndexRef.current = 0;
          setCurrent(null); setSelId(null); setPageIndex(0); setThumbs({});
          autosave(); force(); fitZoom(true);
        }} />
        <ToolBtn label="Save" icon="✔" accent onClick={() => saveProject(false)} />
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
        <ToolBtn label="Front" icon="⬆" disabled={!selEl} onClick={() => reorder(1e9)} />
        <ToolBtn label="Back" icon="⬇" disabled={!selEl} onClick={() => reorder(-1e9)} />
        <ToolBtn label="Bigger" icon="A+" disabled={!selTs} onClick={() =>
          mutateSel<BalloonEl | TextEl>((x) => { x.ts.size = clamp(Math.round(x.ts.size * 1.12), 8, 800); })} />
        <ToolBtn label="Smaller" icon="A−" disabled={!selTs} onClick={() =>
          mutateSel<BalloonEl | TextEl>((x) => { x.ts.size = clamp(Math.round(x.ts.size / 1.12), 8, 800); })} />
        <span className="tbSep" />
        <ToolBtn label="Instant Alpha" icon="🪄"
          disabled={!selEl || (selEl.type !== "image" && selEl.type !== "panel") || !selEl.img}
          onClick={() => { if (selEl && (selEl.type === "image" || selEl.type === "panel") && selEl.img) runInstantAlpha(selEl.id, selEl.img); }} />
        <ToolBtn label="Page Setup" icon="📐" onClick={() => setShowSetup(true)} />
        <ToolBtn label="Print" icon="🖨" onClick={printPage} />
        <ToolBtn label="Export" icon="🖼⇩" accent onClick={() => setShowExport(true)} />
        <ToolBtn label="Inspector" icon="ⓘ" onClick={() => setTab("inspector")} />
        <div className="tbSpacer" />
        <div className="tbHint">Runs entirely in your browser — nothing is uploaded.</div>
      </header>

      {/* ---------- format bar ---------- */}
      <div className="formatBar">
        <span className="fbLabel">Stroke:</span>
        <input type="number" min={0} max={80} disabled={!selEl}
          value={selEl?.type === "balloon" ? selEl.strokeW
            : selEl?.type === "panel" || selEl?.type === "image" ? selEl.borderW
            : selEl?.type === "text" ? selEl.ts.outlineW : 0}
          onChange={(e) => mutateSel((x) => {
            const v = clamp(+e.target.value || 0, 0, 80);
            if (x.type === "balloon") x.strokeW = v;
            else if (x.type === "panel" || x.type === "image") x.borderW = v;
            else if (x.type === "text") x.ts.outlineW = v;
          })} style={{ width: 48 }} />
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
                    onClick={() => applyQuickStroke(c)} />
                ))}
              </div>
              <div className="fld" style={{ marginTop: 6 }}>
                <label>Custom</label>
                <input type="color" onChange={(e) => applyQuickStroke(e.target.value)} />
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
                        onClick={() => { applyQuickFill({ solidColor: c }); }} />
                    ))}
                  </div>
                  <div className="fld" style={{ marginTop: 6 }}>
                    <label>Custom</label>
                    <input type="color" onChange={(e) => applyQuickFill({ solidColor: e.target.value })} />
                  </div>
                </div>
                <div>
                  <div className="fillPopHead">Gradients</div>
                  <div className="palGrid grads">
                    {GRADIENT_PRESETS.map(([a, b], i) => (
                      <button key={i} style={{ background: `linear-gradient(180deg, ${a}, ${b})` }}
                        onClick={() => { applyQuickFill({ gradient: [a, b] }); }} />
                    ))}
                  </div>
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
          onPick={(k) => mutateSel<BalloonEl | TextEl>((x) => {
            x.ts.font = k;
            const vars = FONTS[k]?.variants || ["regular"];
            if (!vars.includes(tsVariant(x.ts) as never)) { x.ts.bold = false; x.ts.italic = false; }
          })} />
        <SubtypeSelect ts={selTs}
          onSet={(bold, italic) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.bold = bold; x.ts.italic = italic; })} />
        <input type="number" min={8} max={800} disabled={!selTs} value={selTs?.size || 42} style={{ width: 56 }}
          onChange={(e) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.size = clamp(+e.target.value || 8, 8, 800); })} />
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
      </div>

      {/* ---------- main ---------- */}
      <div className="main">
        <aside className="leftbar">
          <div className="sideTitle">Pages</div>
          <div className="pageList">
            {doc.pages.map((p, i) => (
              <button key={i} className={"pageThumb" + (i === pageIndex ? " on" : "")}
                style={{ aspectRatio: `${p.w} / ${p.h}` }}
                onClick={() => { setPageIndex(i); setSelId(null); }}>
                {thumbs[i] ? <img src={thumbs[i]} alt="" /> : null}
                <span>{i + 1}</span>
              </button>
            ))}
          </div>
          <div className="pageActs">
            <button onClick={() => {
              const d = docRef.current!;
              d.pages.splice(pageIndex + 1, 0, newPage(page.w, page.h));
              setPageIndex(pageIndex + 1);
              setSelId(null);
              commit();
            }}>+ Page</button>
            <button onClick={() => {
              const d = docRef.current!;
              if (d.pages.length <= 1) { setStatus("A document needs at least one page."); return; }
              if (!window.confirm(`Delete page ${pageIndex + 1}?`)) return;
              d.pages.splice(pageIndex, 1);
              setThumbs({});
              setPageIndex((p) => clamp(p, 0, d.pages.length - 1));
              setSelId(null);
              commit();
              d.pages.forEach((pg, i) =>
                pageThumbnail(pg, assetsRef.current, 140).then((u) => setThumbs((t) => ({ ...t, [i]: u }))).catch(() => { }));
            }}>Delete</button>
          </div>
          <div className="sideTitle">Styles</div>
          <div className="stylesGrid">
            {LETTER_STYLES.map((s) => (
              <button key={s.name} className={"styleBtn" + (activeStyle === s.name ? " on" : "")} title={s.name}
                onClick={() => {
                  setActiveStyle(s.name);
                  if (selEl && (selEl.type === "text" || selEl.type === "balloon")) {
                    if (selEl.locked) { setStatus("That item is locked — unlock it to restyle."); return; }
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
            ))}
          </div>
        </aside>

        <div className="canvasArea" ref={areaRef}
          onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
          <div className="rulerRow">
            <div className="rulerCorner" />
            <Ruler length={page.w} zoom={zoom} vertical={false} offset={STAGE_MX} />
          </div>
          <div className="canvasRow">
            <Ruler length={page.h} zoom={zoom} vertical offset={STAGE_MY} />
            <div className="stage" style={{ width: page.w * zoom, height: page.h * zoom }}>
              <div
                ref={pageDivRef}
                className="page"
                style={{
                  width: page.w, height: page.h,
                  transform: `scale(${zoom})`, transformOrigin: "0 0",
                  ...fillCss(page.bg),
                }}
                onPointerDown={(e) => { if (e.target === e.currentTarget) select(null); }}
              >
                {page.els.map(renderEl)}
                {page.margin && (
                  <div className="marginGuide" style={{
                    left: page.margin.l, top: page.margin.t,
                    width: page.w - page.margin.l - page.margin.r,
                    height: page.h - page.margin.t - page.margin.b,
                  }} />
                )}
              </div>
              {renderOverlay()}
              {snapRef.current.x != null && <div className="snapLineV" style={{ left: snapRef.current.x * zoom }} />}
              {snapRef.current.y != null && <div className="snapLineH" style={{ top: snapRef.current.y * zoom }} />}
            </div>
          </div>
          <div className="zoomCtl">
            <select value={String(Math.round(zoom * 100))} onChange={(e) => {
              setUserZoomed(true);
              setZoom(clamp((+e.target.value || 100) / 100, 0.05, 4));
            }}>
              {[10, 25, 50, 75, 100, 125, 150, 200].map((z) => <option key={z} value={z}>{z}%</option>)}
              {![10, 25, 50, 75, 100, 125, 150, 200].includes(Math.round(zoom * 100)) &&
                <option value={Math.round(zoom * 100)}>{Math.round(zoom * 100)}%</option>}
            </select>
          </div>
        </div>

        <aside className="rightbar">
          <div className="tabs">
            {([["layouts", "Layouts"], ["inspector", "Inspect"], ["layers", "Layers"], ["photos", "Photos"], ["library", "Library"], ["proof", "Proof"]] as const).map(([k, label]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          {tab === "layouts" && renderLayoutsTab()}
          {tab === "inspector" && renderInspector()}
          {tab === "layers" && renderLayersTab()}
          {tab === "photos" && renderPhotosTab()}
          {tab === "library" && renderLibraryTab()}
          {tab === "proof" && renderProofTab()}
        </aside>
      </div>

      {/* ---------- balloon tray ---------- */}
      <footer className="tray">
        <TrayBtn onClick={() => addFromTray("text")} label="Text">
          <svg viewBox="0 0 40 30"><rect x="4" y="6" width="32" height="18" fill="#fff" stroke="#333" strokeWidth="1.5" /><text x="20" y="19" textAnchor="middle" fontSize="9" fill="#333">ABCDE…</text></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("sfx")} label="Lettering">
          <svg viewBox="0 0 40 30"><text x="20" y="22" textAnchor="middle" fontSize="15" fontFamily="Impact, sans-serif" fill="#fc3" stroke="#222" strokeWidth="1.2" transform="rotate(-6 20 15)">POW!</text></svg>
        </TrayBtn>
        <span className="traySep" />
        <TrayBtn onClick={() => addFromTray("speech")} label="Speech">
          <svg viewBox="0 0 40 30"><ellipse cx="20" cy="12" rx="16" ry="10" fill="#fff" stroke="#222" strokeWidth="2" /><path d="M14 20 L10 28 L21 21 Z" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("rough")} label="Rough">
          <svg viewBox="0 0 40 30"><path d="M6 12 Q5 7 10 5 Q14 2 20 3 Q27 2 31 5 Q36 8 35 12 Q36 17 31 19 Q26 22 20 21 Q13 22 9 19 Q4 17 6 12 Z" fill="#fff" stroke="#222" strokeWidth="1.8" /><path d="M14 20 L10 28 L21 21 Z" fill="#fff" stroke="#222" strokeWidth="1.8" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("buzz")} label="Buzz">
          <svg viewBox="0 0 40 30"><path d="M20 2 L23 5 L28 3 L29 7 L35 8 L33 12 L37 15 L32 17 L33 21 L27 20 L24 24 L20 21 L16 24 L13 20 L7 21 L8 17 L3 15 L7 12 L5 8 L11 7 L12 3 L17 5 Z" fill="#fff" stroke="#222" strokeWidth="1.6" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("double")} label="Radio">
          <svg viewBox="0 0 40 30"><ellipse cx="20" cy="13" rx="16" ry="10" fill="#fff" stroke="#222" strokeWidth="1.8" /><ellipse cx="20" cy="13" rx="13" ry="7.6" fill="none" stroke="#222" strokeWidth="1.4" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("thought")} label="Thought">
          <svg viewBox="0 0 40 30"><ellipse cx="20" cy="11" rx="15" ry="9" fill="#fff" stroke="#222" strokeWidth="2" /><circle cx="12" cy="23" r="3" fill="#fff" stroke="#222" strokeWidth="2" /><circle cx="8" cy="28" r="1.7" fill="#fff" stroke="#222" strokeWidth="1.5" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("shout")} label="Shout">
          <svg viewBox="0 0 40 30"><path d="M36.2 10.5 L30.5 14.1 L36.1 17.9 L28.4 18.5 L29.8 23.8 L23.1 21.1 L19.8 26.0 L16.6 21.0 L9.8 23.6 L11.4 18.3 L3.8 17.5 L9.5 13.9 L3.9 10.1 L11.6 9.5 L10.2 4.2 L16.9 6.9 L20.2 2.0 L23.4 7.0 L30.2 4.4 L28.6 9.7 Z" fill="#fff" stroke="#222" strokeWidth="1.6" strokeLinejoin="miter" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("burst2")} label="Exclaim 2">
          <svg viewBox="0 0 40 30"><path d="M36.9 15.2 L31.0 16.6 L34.5 20.3 L28.3 19.7 L29.2 24.1 L24.0 21.7 L22.1 25.9 L18.8 22.1 L14.6 25.4 L14.0 21.0 L8.1 22.6 L10.3 18.4 L4.0 18.1 L8.5 15.0 L3.1 12.8 L9.0 11.4 L5.5 7.7 L11.7 8.3 L10.8 3.9 L16.0 6.3 L17.9 2.1 L21.2 5.9 L25.4 2.6 L26.0 7.0 L31.9 5.4 L29.7 9.6 L36.0 9.9 L31.5 13.0 Z" fill="#fff" stroke="#222" strokeWidth="1.4" strokeLinejoin="miter" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("whisper")} label="Whisper">
          <svg viewBox="0 0 40 30"><ellipse cx="20" cy="12" rx="16" ry="10" fill="#fff" stroke="#222" strokeWidth="2" strokeDasharray="4 3" /><path d="M14 20 L10 28 L21 21 Z" fill="#fff" stroke="#222" strokeWidth="2" strokeDasharray="3 3" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("square")} label="Square">
          <svg viewBox="0 0 40 30"><rect x="4" y="3" width="32" height="18" fill="#fff" stroke="#222" strokeWidth="2" /><path d="M14 21 L10 28 L21 21 Z" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("tv")} label="TV">
          <svg viewBox="0 0 40 30"><rect x="4" y="3" width="32" height="17" rx="3" fill="#fff" stroke="#222" strokeWidth="2" /><path d="M15 20 L12 23 L16 24 L11 29 L20 22 L16 22 Z" fill="#fff" stroke="#222" strokeWidth="1.5" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("extend")} label="Pill">
          <svg viewBox="0 0 40 30"><rect x="4" y="5" width="32" height="15" rx="7.5" fill="#fff" stroke="#222" strokeWidth="2" /><path d="M14 19 L10 28 L20 20 Z" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("caption")} label="Caption">
          <svg viewBox="0 0 40 30"><rect x="4" y="7" width="32" height="16" fill="#ffef9e" stroke="#222" strokeWidth="2" /><line x1="8" y1="12" x2="32" y2="12" stroke="#999" strokeWidth="2" /><line x1="8" y1="17" x2="26" y2="17" stroke="#999" strokeWidth="2" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("rounded")} label="Rounded">
          <svg viewBox="0 0 40 30"><rect x="4" y="6" width="32" height="18" rx="6" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
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
        <TrayBtn onClick={() => addFromTray("panel")} label="Panel">
          <svg viewBox="0 0 40 30"><rect x="3" y="3" width="34" height="24" fill="#fff" stroke="#222" strokeWidth="3" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("image")} label="Image">
          <svg viewBox="0 0 40 30"><rect x="3" y="3" width="34" height="24" fill="#cde" /><circle cx="13" cy="11" r="4" fill="#fc3" /><path d="M6 25 L17 14 L24 21 L30 16 L36 25 Z" fill="#4a7" /></svg>
        </TrayBtn>
        <div className="tbSpacer" />
        <div className="statusbar">{status}</div>
      </footer>

      {/* context menu */}
      {ctxMenu && (() => {
        const el = page.els.find((e) => e.id === ctxMenu.id);
        if (!el) return null;
        const close = () => setCtxMenu(null);
        return (
          <>
            <div className="ctxBackdrop" onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
            <div className="ctxMenu" style={{ left: Math.min(ctxMenu.x, window.innerWidth - 230), top: Math.min(ctxMenu.y, window.innerHeight - 430) }}>
              <button disabled={el.locked} onClick={() => { reorder(1); close(); }}>Bring Forward</button>
              <button disabled={el.locked} onClick={() => { reorder(1e9); close(); }}>Bring To Front</button>
              <button disabled={el.locked} onClick={() => { reorder(-1); close(); }}>Send Backward</button>
              <button disabled={el.locked} onClick={() => { reorder(-1e9); close(); }}>Send To Back</button>
              <div className="ctxSep" />
              <div className="ctxSub">
                <button disabled={el.locked}>Align Object ▸</button>
                <div className="ctxSubMenu">
                  <button disabled={el.locked} onClick={() => { alignSel("left"); close(); }}>Left</button>
                  <button disabled={el.locked} onClick={() => { alignSel("hcenter"); close(); }}>Center</button>
                  <button disabled={el.locked} onClick={() => { alignSel("right"); close(); }}>Right</button>
                  <button disabled={el.locked} onClick={() => { alignSel("top"); close(); }}>Top</button>
                  <button disabled={el.locked} onClick={() => { alignSel("vcenter"); close(); }}>Middle</button>
                  <button disabled={el.locked} onClick={() => { alignSel("bottom"); close(); }}>Bottom</button>
                </div>
              </div>
              <div className="ctxSep" />
              <button onClick={() => { setUserZoomed(true); setZoom((z) => clamp(z * 1.2, 0.05, 4)); close(); }}>Zoom In</button>
              <button onClick={() => { setUserZoomed(true); setZoom((z) => clamp(z / 1.2, 0.05, 4)); close(); }}>Zoom Out</button>
              <div className="ctxSep" />
              <button disabled={el.locked} onClick={() => { el.locked = true; pendingLockRef.current.delete(el.id); commit(); close(); }}>Lock</button>
              <button disabled={!el.locked} onClick={() => { el.locked = false; pendingLockRef.current.delete(el.id); commit(); close(); }}>Unlock</button>
              <div className="ctxSep" />
              <button disabled={el.locked} onClick={() => { cutSel(); close(); }}>Cut</button>
              <button onClick={() => { copySel(); close(); }}>Copy</button>
              <button disabled={!clipboardRef.current} onClick={() => { pasteClip(); close(); }}>Paste</button>
              <button onClick={() => { duplicateSel(); close(); }}>Duplicate</button>
              <button disabled={el.locked} className="danger" onClick={() => { deleteSel(); close(); }}>Delete</button>
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
                  {el.img && <button disabled={el.locked} onClick={() => { resizeToActual(); close(); }}>Resize Image to Actual Size</button>}
                </>
              )}
            </div>
          </>
        );
      })()}

      {/* export dialog */}
      {showExport && (
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
            </div>
            <div className="setupFoot">
              <button onClick={() => setShowExport(false)}>Cancel</button>
              <button className="okBtn" onClick={() => runExport(exportFmt, exportScope, exportDpi)}>Export</button>
            </div>
          </div>
        </div>
      )}

      {/* page setup dialog */}
      {showSetup && (
        <PageSetupDialog
          page={page}
          onClose={() => setShowSetup(false)}
          onApply={(w, h, margin, applyAll) => {
            const d = docRef.current!;
            const targets = applyAll ? d.pages : [page];
            for (const p of targets) { p.w = w; p.h = h; p.margin = { ...margin }; }
            setShowSetup(false);
            commit();
            fitZoom(true);
            setThumbs({});
            d.pages.forEach((pg, i) =>
              pageThumbnail(pg, assetsRef.current, 140).then((u) => setThumbs((t) => ({ ...t, [i]: u }))).catch(() => { }));
          }}
        />
      )}

      {/* hidden inputs */}
      <input ref={fileImageRef} type="file" accept="image/*,application/pdf,.pdf" multiple hidden
        onChange={async (e) => {
          for (const f of Array.from(e.target.files || [])) await importImageFile(f);
          e.target.value = "";
        }} />
      <input ref={filePanelImageRef} type="file" accept="image/*" hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          const targetId = panelImageTarget.current;
          panelImageTarget.current = null;
          if (!f || !targetId) return;
          const url = await readAsDataURL(f);
          await loadImage(url);
          const aid = "a" + aidRef.current++;
          assetsRef.current[aid] = url;
          await assignImageToPanel(targetId, aid);
        }} />
      <input ref={fileOpenRef} type="file" accept=".json,application/json" hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) importJSON(f);
        }} />
    </div>
  );
}

/* ---------------- toolbar / tray buttons ---------------- */

function ToolBtn({ label, icon, onClick, disabled, accent }: {
  label: string; icon: string; onClick: () => void; disabled?: boolean; accent?: boolean;
}) {
  return (
    <button className={"toolBtn" + (accent ? " accent" : "")} onClick={onClick} disabled={disabled} title={label}>
      <span className="tIcon">{icon}</span>
      <span className="tLabel">{label}</span>
    </button>
  );
}

function TrayBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="trayBtn" onClick={onClick} title={label}>
      {children}
      <span>{label}</span>
    </button>
  );
}

/* ---------------- Page Setup dialog (paper sizes, orientation, margins) ---------------- */

const inch = (px: number) => (px / DPI).toFixed(3);

function PageSetupDialog({ page, onClose, onApply }: {
  page: Page;
  onClose: () => void;
  onApply: (w: number, h: number, margin: PageMargin, applyAll: boolean) => void;
}) {
  const def = Math.round(page.w * 0.035);
  const m0 = page.margin ?? { t: def, r: def, b: def, l: def };
  const [cat, setCat] = useState(0);
  const [wIn, setWIn] = useState(inch(page.w));
  const [hIn, setHIn] = useState(inch(page.h));
  const [mT, setMT] = useState(inch(m0.t));
  const [mR, setMR] = useState(inch(m0.r));
  const [mB, setMB] = useState(inch(m0.b));
  const [mL, setML] = useState(inch(m0.l));
  const [applyAll, setApplyAll] = useState(true);
  const [selSize, setSelSize] = useState(-1);
  const landscape = parseFloat(wIn) > parseFloat(hIn);

  const setOrientation = (land: boolean) => {
    const w = parseFloat(wIn) || 0, h = parseFloat(hIn) || 0;
    if (land !== (w > h)) { setWIn(hIn); setHIn(wIn); }
  };

  const ok = () => {
    const w = Math.round((parseFloat(wIn) || 6.625) * DPI);
    const h = Math.round((parseFloat(hIn) || 10.25) * DPI);
    const margin: PageMargin = {
      t: Math.round((parseFloat(mT) || 0) * DPI),
      r: Math.round((parseFloat(mR) || 0) * DPI),
      b: Math.round((parseFloat(mB) || 0) * DPI),
      l: Math.round((parseFloat(mL) || 0) * DPI),
    };
    onApply(clamp(w, 200, 8000), clamp(h, 200, 8000), margin, applyAll);
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
