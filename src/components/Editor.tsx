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
  TAILLESS_KINDS, TEXTURE_VARIANTS, TextEl, TextStyle, applyLayout, clamp,
  makeBalloon, makeImage, makePanel, makeText, newPage, reseedIds, rotVec,
  solid, starterDoc, uid,
} from "@/lib/model";
import { balloonGeom } from "@/lib/geometry";
import { LETTER_STYLES, LetterStyle, applyLetterStyle } from "@/lib/presets";
import { defaultFillFor, fillCss, fillOverlayTile, fillOverlayURL, isRepeating } from "@/lib/fills";
import { docThumbnail, exportPagePNG, loadImage, pageThumbnail } from "@/lib/exportPng";

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
    textTransform: ts.caps ? "uppercase" : "none",
    lineHeight: 1.25,
  };
  if (ts.fillB) {
    st.backgroundImage = `linear-gradient(180deg, ${ts.fillA}, ${ts.fillB})`;
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

/* ---------------- rulers ---------------- */

function Ruler({ length, zoom, vertical }: { length: number; zoom: number; vertical: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const px = Math.max(1, Math.round(length * zoom));
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
    const inch = 225; // page px per inch
    const minor = inch / 8;
    ctx.beginPath();
    for (let v = 0; v <= length; v += minor) {
      const p = v * zoom;
      const idx = Math.round(v / minor);
      const size = idx % 8 === 0 ? T * 0.85 : idx % 4 === 0 ? T * 0.5 : T * 0.3;
      if (vertical) { ctx.moveTo(T, p); ctx.lineTo(T - size, p); }
      else { ctx.moveTo(p, T); ctx.lineTo(p, T - size); }
      if (idx % 8 === 0 && idx > 0) {
        const label = String(idx / 8);
        if (vertical) ctx.fillText(label, 2, p + 9);
        else ctx.fillText(label, p + 3, 9);
      }
    }
    ctx.stroke();
    ctx.strokeStyle = "#70767f";
    ctx.strokeRect(0.5, 0.5, c.width - 1, c.height - 1);
  }, [px, zoom, length, vertical]);
  return <canvas ref={ref} className={vertical ? "rulerV" : "rulerH"} />;
}

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

function BalloonShape({ el }: { el: BalloonEl }) {
  const g = balloonGeom(el);
  const f = el.fill;
  const gid = `grad-${el.id}`, cid = `clip-${el.id}`, pid = `pat-${el.id}`;
  const tile = f.kind !== "solid" && f.kind !== "gradient" ? fillOverlayTile(f) : null;
  const tileURL = tile ? fillOverlayURL(f) : null;
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
        {tileURL && <clipPath id={cid}><path d={g.d} /></clipPath>}
        {tileURL && repeating && tile && (
          <pattern id={pid} patternUnits="userSpaceOnUse" width={tile.width} height={tile.height}>
            <image href={tileURL} width={tile.width} height={tile.height} />
          </pattern>
        )}
      </defs>
      <path d={g.d} fill={fillRef} />
      {tileURL && (repeating
        ? <rect x={-el.w} y={-el.h} width={el.w * 3} height={el.h * 3} fill={`url(#${pid})`} clipPath={`url(#${cid})`} />
        : <image href={tileURL} x={0} y={0} width={el.w} height={el.h} preserveAspectRatio="none" clipPath={`url(#${cid})`} />)}
      {el.strokeW > 0 && (
        <path d={g.d} fill="none" stroke={el.stroke} strokeWidth={el.strokeW}
          strokeLinejoin="round" strokeDasharray={g.dash ? g.dash.join(" ") : undefined} />
      )}
      {el.strokeW > 0 && g.d2 && (
        <path d={g.d2} fill="none" stroke={el.stroke} strokeWidth={el.strokeW}
          strokeLinejoin="round" strokeDasharray={g.dash ? g.dash.join(" ") : undefined} />
      )}
    </svg>
  );
}

/* ==================================================================== */

interface ProjectMeta { id: string; name: string; updatedAt: string; thumbnail: string | null }

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
  const [tab, setTab] = useState<"layouts" | "inspector" | "photos" | "library">("layouts");
  const [layoutCat, setLayoutCat] = useState(0);
  const [status, setStatusRaw] = useState(HINT);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [current, setCurrent] = useState<{ id: string; name: string } | null>(null);
  const [dbError, setDbError] = useState<string | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelImageTarget = useRef<string | null>(null);

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
    if (editingId && editingId !== id) finishEditing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId]);

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
    mode: "move" | "resize" | "rotate" | "tail", handle = ""
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
        cur.x = Math.round(orig.x + dx);
        cur.y = Math.round(orig.y + dy);
      } else if (mode === "resize") {
        const [ldx, ldy] = rotVec(dx, dy, -orig.rot);
        if (handle.includes("e")) cur.w = Math.max(MIN_SIZE, Math.round(orig.w + ldx));
        if (handle.includes("s")) cur.h = Math.max(MIN_SIZE, Math.round(orig.h + ldy));
        if (handle.includes("w")) { cur.w = Math.max(MIN_SIZE, Math.round(orig.w - ldx)); cur.x = orig.x + (orig.w - cur.w); }
        if (handle.includes("n")) { cur.h = Math.max(MIN_SIZE, Math.round(orig.h - ldy)); cur.y = orig.y + (orig.h - cur.h); }
      } else if (mode === "rotate") {
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        let ang = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI + 90;
        if (ev.shiftKey) ang = Math.round(ang / 15) * 15;
        const norm = ((ang % 360) + 360) % 360;
        if (norm < 3 || norm > 357) ang = 0;
        cur.rot = Math.round(ang * 10) / 10;
      } else if (mode === "tail" && cur.type === "balloon") {
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        const [ldx, ldy] = rotVec(pt.x - cx, pt.y - cy, -orig.rot);
        cur.tail = { dx: Math.round(ldx), dy: Math.round(ldy) };
      }
      force();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) commit();
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
      const d = docRef.current!;
      const p = d.pages[pageIndexRef.current];
      const el = p.els.find((x) => x.id === selId);
      if (!el) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSel(); return; }
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
    p.els.push(copy);
    commit();
    setSelId(copy.id);
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
    } else {
      const caption = TAILLESS_KINDS.includes(kind as BalloonKind);
      const w = Math.round(p.w * (caption ? 0.36 : 0.34));
      const h = caption ? Math.round(w * 0.32) : Math.round(w * 0.62);
      const s = spawn(w, h);
      el = makeBalloon(kind as BalloonKind, s.x, s.y, w, h);
    }
    if (el) {
      p.els.push(el);
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

  async function importImageFile(f: File, x?: number, y?: number) {
    const url = await readAsDataURL(f);
    const img = await loadImage(url);
    const aid = "a" + aidRef.current++;
    assetsRef.current[aid] = url;
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const w = Math.min(Math.round(p.w * 0.45), img.naturalWidth);
    const h = Math.round(w * (img.naturalHeight / img.naturalWidth));
    const el = makeImage(Math.round((x ?? p.w / 2) - w / 2), Math.round((y ?? p.h / 2) - h / 2), w, h, aid);
    p.els.push(el);
    commit();
    setSelId(el.id);
  }

  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = [...(e.dataTransfer?.files || [])].filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    const pt = pagePoint(e);
    let off = 0;
    for (const f of files) { await importImageFile(f, pt.x + off, pt.y + off); off += 60; }
  }

  async function assignImageToPanel(elId: string, aid: string) {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const el = p.els.find((x) => x.id === elId);
    if (!el || (el.type !== "panel" && el.type !== "image")) return;
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

  async function doExportPNG() {
    const d = docRef.current!;
    setStatus("Rendering page…");
    try {
      await exportPagePNG(d.pages[pageIndexRef.current], assetsRef.current, `comic-page-${pageIndexRef.current + 1}.png`);
      setStatus(`Exported comic-page-${pageIndexRef.current + 1}.png`);
    } catch (err) {
      setStatus("Export failed: " + String(err).slice(0, 120));
    }
  }

  /* ---------------- render helpers ---------------- */

  function renderEl(el: El) {
    const style: CSSProperties = {
      left: el.x, top: el.y, width: el.w, height: el.h,
      transform: el.rot ? `rotate(${el.rot}deg)` : undefined,
    };
    const common = {
      key: el.id,
      "data-id": el.id,
      onPointerDown: (e: React.PointerEvent) => {
        if (editingId === el.id) return;
        select(el.id);
        startDrag(e, el, "move");
      },
      onDoubleClick: () => {
        if (el.type === "balloon" || el.type === "text") { select(el.id); setEditingId(el.id); }
        else if (el.type === "panel" || el.type === "image") { panelImageTarget.current = el.id; filePanelImageRef.current?.click(); }
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
      const g = balloonGeom(el);
      const [tx, ty, tw, th] = g.textRect;
      const editing = editingId === el.id;
      return (
        <div {...common} className="el balloon" style={style}>
          <BalloonShape el={el} />
          <div
            key={editing ? "edit" : "static"}
            className="txt"
            style={{ ...textCss(el.ts), left: tx, top: ty, width: tw, height: th }}
            contentEditable={editing}
            suppressContentEditableWarning
            spellCheck={false}
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
          spellCheck={false}
          onBlur={() => editing && finishEditing()}
        >{el.text}</div>
      </div>
    );
  }

  function renderOverlay() {
    if (!selEl || !page) return null;
    const el = selEl;
    const z = zoom;
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
          <div className="handle tail" title="Drag to aim the tail"
            style={{ left: (el.w / 2 + el.tail.dx) * z - 7, top: (el.h / 2 + el.tail.dy) * z - 7 }}
            onPointerDown={(e) => startDrag(e, el, "tail")} />
        )}
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
          <select value={ts.font} onChange={(e) => set({ font: e.target.value })}>
            {FONT_GROUPS.map((gr) => (
              <optgroup key={gr} label={gr}>
                {Object.entries(FONTS).filter(([, f]) => f.group === gr).map(([k, f]) =>
                  <option key={k} value={k}>{f.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Fld>
        <Fld label="Size"><input type="number" min={8} max={800} value={ts.size}
          onChange={(e) => set({ size: clamp(+e.target.value || 8, 8, 800) })} /></Fld>
        <Fld label="Bold"><input type="checkbox" checked={ts.bold} onChange={(e) => set({ bold: e.target.checked })} /></Fld>
        <Fld label="Italic"><input type="checkbox" checked={ts.italic} onChange={(e) => set({ italic: e.target.checked })} /></Fld>
        <Fld label="ALL CAPS"><input type="checkbox" checked={ts.caps} onChange={(e) => set({ caps: e.target.checked })} /></Fld>
        <Fld label="Align">
          <select value={ts.align} onChange={(e) => set({ align: e.target.value as TextStyle["align"] })}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
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
          <Fld label="Rotation °"><input type="number" min={-180} max={180} value={Math.round(el.rot)}
            onChange={(e) => mutateSel((b) => { b.rot = clamp(+e.target.value || 0, -180, 180); })} /></Fld>
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
                if (selEl && (selEl.type === "panel" || selEl.type === "image")) assignImageToPanel(selEl.id, aid);
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
      {/* ---------- toolbar ---------- */}
      <header className="toolbar">
        <div className="brand">Comic<span>Lettering</span></div>
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
        <ToolBtn label="Export" icon="🖼⇩" accent onClick={doExportPNG} />
        <ToolBtn label="Inspector" icon="ⓘ" onClick={() => setTab("inspector")} />
        <div className="tbSpacer" />
        <div className="tbHint">Runs entirely in your browser — nothing is uploaded.</div>
      </header>

      {/* ---------- format bar ---------- */}
      <div className="formatBar">
        <span className="fbLabel">Stroke:</span>
        <input type="number" min={0} max={40} disabled={!selEl || selEl.type === "text"}
          value={selEl?.type === "balloon" ? selEl.strokeW : selEl?.type === "panel" || selEl?.type === "image" ? selEl.borderW : 0}
          onChange={(e) => mutateSel((x) => {
            const v = clamp(+e.target.value || 0, 0, 40);
            if (x.type === "balloon") x.strokeW = v;
            else if (x.type === "panel" || x.type === "image") x.borderW = v;
          })} style={{ width: 48 }} />
        <input type="color" disabled={!selEl || selEl.type === "text"}
          value={selEl?.type === "balloon" ? selEl.stroke : selEl?.type === "panel" || selEl?.type === "image" ? selEl.borderC : "#111111"}
          onChange={(e) => mutateSel((x) => {
            if (x.type === "balloon") x.stroke = e.target.value;
            else if (x.type === "panel" || x.type === "image") x.borderC = e.target.value;
          })} />
        <span className="fbLabel">Fill:</span>
        <input type="color" disabled={!selEl || (selEl.type !== "balloon" && selEl.type !== "panel")}
          value={(selEl?.type === "balloon" || selEl?.type === "panel") ? selEl.fill.a : "#ffffff"}
          onChange={(e) => mutateSel((x) => {
            if (x.type === "balloon" || x.type === "panel") x.fill = solid(e.target.value);
          })} />
        <label className="fbCheck">
          <input type="checkbox" disabled={!selEl} checked={!!selEl?.shadow}
            onChange={(e) => mutateSel((x) => { x.shadow = e.target.checked; })} /> Shadow
        </label>
        <span className="tbSep" />
        <select disabled={!selTs} value={selTs?.font || "comicneue"}
          onChange={(e) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.font = e.target.value; })}>
          {FONT_GROUPS.map((gr) => (
            <optgroup key={gr} label={gr}>
              {Object.entries(FONTS).filter(([, f]) => f.group === gr).map(([k, f]) =>
                <option key={k} value={k}>{f.label}</option>)}
            </optgroup>
          ))}
        </select>
        <input type="number" min={8} max={800} disabled={!selTs} value={selTs?.size || 42} style={{ width: 56 }}
          onChange={(e) => mutateSel<BalloonEl | TextEl>((x) => { x.ts.size = clamp(+e.target.value || 8, 8, 800); })} />
        <button className={"fbTog" + (selTs?.bold ? " on" : "")} disabled={!selTs}
          onClick={() => mutateSel<BalloonEl | TextEl>((x) => { x.ts.bold = !x.ts.bold; })}><b>B</b></button>
        <button className={"fbTog" + (selTs?.italic ? " on" : "")} disabled={!selTs}
          onClick={() => mutateSel<BalloonEl | TextEl>((x) => { x.ts.italic = !x.ts.italic; })}><i>I</i></button>
        {(["left", "center", "right"] as const).map((a) => (
          <button key={a} className={"fbTog" + (selTs?.align === a ? " on" : "")} disabled={!selTs}
            onClick={() => mutateSel<BalloonEl | TextEl>((x) => { x.ts.align = a; })}>
            {a === "left" ? "⯇" : a === "center" ? "≡" : "⯈"}
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
              <button key={s.name} className="styleBtn" title={s.name}
                onClick={() => {
                  if (selEl && (selEl.type === "text" || selEl.type === "balloon")) {
                    mutateSel<BalloonEl | TextEl>((x) => { x.ts = applyLetterStyle(x.ts, s); });
                  } else {
                    const p = page;
                    const w = Math.round(p.w * 0.44), h = Math.round(p.w * 0.18);
                    const el = makeText(Math.round(p.w / 2 - w / 2), Math.round(p.h * 0.35), w, h, true);
                    el.ts = applyLetterStyle(el.ts, s);
                    el.ts.size = 140;
                    el.ts.outlineW = Math.round(140 * s.outlineF);
                    p.els.push(el);
                    commit();
                    setSelId(el.id);
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
            <Ruler length={page.w} zoom={zoom} vertical={false} />
          </div>
          <div className="canvasRow">
            <Ruler length={page.h} zoom={zoom} vertical />
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
              </div>
              {renderOverlay()}
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
            {([["layouts", "Panel Layouts"], ["inspector", "Inspector"], ["photos", "Photos"], ["library", "Library"]] as const).map(([k, label]) => (
              <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
            ))}
          </div>
          {tab === "layouts" && renderLayoutsTab()}
          {tab === "inspector" && renderInspector()}
          {tab === "photos" && renderPhotosTab()}
          {tab === "library" && renderLibraryTab()}
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
          <svg viewBox="0 0 40 30"><path d="M20 2 L24 8 L31 5 L29 12 L37 14 L30 18 L34 25 L26 22 L24 29 L20 23 L15 28 L14 21 L5 23 L11 16 L3 12 L12 10 L9 3 L17 8 Z" fill="#fff" stroke="#222" strokeWidth="2" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("burst2")} label="Exclaim 2">
          <svg viewBox="0 0 40 30"><path d="M20 1 L22 6 L26 2 L27 7 L32 5 L31 10 L37 10 L33 14 L38 17 L32 18 L35 23 L29 21 L29 27 L24 23 L21 29 L18 23 L14 28 L13 22 L7 24 L10 19 L3 18 L8 14 L2 11 L9 10 L7 4 L13 7 L14 1 L17 6 Z" fill="#fff" stroke="#222" strokeWidth="1.5" /></svg>
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
        <TrayBtn onClick={() => addFromTray("panel")} label="Panel">
          <svg viewBox="0 0 40 30"><rect x="3" y="3" width="34" height="24" fill="#fff" stroke="#222" strokeWidth="3" /></svg>
        </TrayBtn>
        <TrayBtn onClick={() => addFromTray("image")} label="Image">
          <svg viewBox="0 0 40 30"><rect x="3" y="3" width="34" height="24" fill="#cde" /><circle cx="13" cy="11" r="4" fill="#fc3" /><path d="M6 25 L17 14 L24 21 L30 16 L36 25 Z" fill="#4a7" /></svg>
        </TrayBtn>
        <div className="tbSpacer" />
        <div className="statusbar">{status}</div>
      </footer>

      {/* hidden inputs */}
      <input ref={fileImageRef} type="file" accept="image/*" multiple hidden
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
