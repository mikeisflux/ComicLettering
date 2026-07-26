"use client";
/* ComicLettering Studio — main editor. Original implementation of a
   Comic Life-style comic lettering workflow: pages, panels, balloons,
   lettering styles, fills, SQL project library and PNG export.
   State, refs, effects and pointer machinery live here; command handlers
   and large render sections live in ./editor/* as plain functions taking
   the per-render EditorCtx bag (see ./editor/ctx.ts). */
import React, {
  useCallback, useEffect, useReducer, useRef, useState,
} from "react";
import {
  Assets, BalloonEl, DPI, Doc, El, FONTS, FillStyle, Page, TextEl,
  TextStyle, aabbOverlap, clamp, makeBalloon, makeImage, newPage, normalizeRuns,
  registerFont, reseedIds, rotVec, runsToText, starterDoc,
} from "@/lib/model";
import { LETTER_STYLES } from "@/lib/presets";
import { BALLOON_STYLES, BOX_STYLES } from "@/lib/balloonStyles";
import { StylesPanel, StyleTab, tabForSelection } from "./editor/stylesPanel";
import { fillCss } from "@/lib/fills";
import { ImageFormat, loadImage, pageThumbnail } from "@/lib/exportPng";
import {
  BalloonPreset, HINT, PRESET_KEY, ProjectMeta, ProofMatch, domToRuns,
  letterStyleCss, runsToHtml, toggleEmphasis,
} from "./editor/textHelpers";
import { closeSketchLoop, detectSketchTail, resampleRing, smoothSketchRing } from "./editor/sketch";
import { SmartTip, pickTip } from "./editor/smartTips";
import { TuckSource, makeCutout } from "./editor/tuck";
import { PageSetupDialog, Ruler, STAGE_MX, STAGE_MY } from "./editor/chrome";
import { EditorCtx } from "./editor/ctx";
import {
  addFromTray, alignSel, assignImageToPanel, copySel, cutSel, deleteSel,
  duplicatePage, duplicateSel, growBalloonToFit, importFontFiles, importImageFile, importJSON,
  importStampFiles, movePage, onDrop, pasteClip, readAsDataURL,
  refreshProjects, saveProject,
} from "./editor/ops";
import { renderEl, renderOverlay } from "./editor/renderEls";
import { renderInspector } from "./editor/inspector";
import {
  renderLayersTab, renderLayoutsTab, renderLibraryTab, renderPhotosTab,
  renderProofTab,
} from "./editor/tabs";
import { renderFormatBar, renderMenuBar, renderToolbar } from "./editor/chromeBars";
import {
  renderContextMenu, renderExportDialog, renderFindDialog,
  renderScriptDialog, renderTailAsk, renderTray,
} from "./editor/dialogs";

const AUTOSAVE_KEY = "comiclettering.autosave.v2";
const MIN_SIZE = 24;


export default function Editor({ demo = false }: { demo?: boolean }) {
  const [, force] = useReducer((c: number) => c + 1, 0);
  const docRef = useRef<Doc | null>(null);
  const assetsRef = useRef<Assets>({});
  const histRef = useRef<string[]>([]);
  const hIndexRef = useRef(-1);
  const pageDivRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const aidRef = useRef(1);
  /* latest keyboard-shortcut handlers — refreshed every render so the
     long-lived keydown listener never runs a stale closure */
  const keyFnsRef = useRef<{
    duplicateSel: () => void; saveProject: (b: boolean) => void;
    copySel: () => void; cutSel: () => void; pasteClip: () => void;
    alignSel: (m: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => void;
    addFromTray: (k: string) => void; deleteSel: () => void;
  }>(null as never);
  /* re-seed the asset id counter from whatever assets are loaded — MUST run
     after any wholesale assets replacement (boot, project load, JSON import)
     or new images silently overwrite existing artwork ids */
  const reseedAids = useCallback(() => {
    let maxA = 0;
    for (const k of Object.keys(assetsRef.current)) {
      const n = parseInt(k.replace(/\D/g, ""), 10);
      if (!isNaN(n)) maxA = Math.max(maxA, n);
    }
    aidRef.current = maxA + 1;
  }, []);

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
  /* live position readout while dragging: ruler span highlight + inch tooltip */
  const dragTipRef = useRef<{ x: number; y: number; w: number; h: number; mode: string; live: boolean } | null>(null);
  /* hand-drawn balloon sketching */
  const [drawMode, setDrawMode] = useState(false);
  const drawPtsRef = useRef<number[][] | null>(null);
  /* id of a freshly sketched balloon awaiting a tail choice */
  const [tailAsk, setTailAsk] = useState<string | null>(null);
  /* "tuck behind art": drag a region over a panel, extract its foreground as
     a transparent cutout placed above the selected SFX */
  const [tuckMode, setTuckMode] = useState(false);
  const tuckRectRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [tuckAsk, setTuckAsk] = useState<{
    src: TuckSource; pageX: number; pageY: number; pageW: number; pageH: number;
    threshold: number; invert: boolean; preview: string | null;
  } | null>(null);
  /* smart contextual tips: one at a time, each shows once (localStorage) */
  const [tip, setTip] = useState<SmartTip | null>(null);
  const tipsSeenRef = useRef<Set<string>>(new Set());
  const tipsOnRef = useRef(true);
  useEffect(() => {
    try {
      tipsSeenRef.current = new Set(JSON.parse(localStorage.getItem("lmc.tips.seen") || "[]"));
      tipsOnRef.current = localStorage.getItem("lmc.tips.on") !== "0";
    } catch { /* ignore */ }
  }, []);
  const dismissTip = useCallback(() => {
    setTip((t) => {
      if (t) {
        tipsSeenRef.current.add(t.id);
        try { localStorage.setItem("lmc.tips.seen", JSON.stringify([...tipsSeenRef.current])); } catch { /* ignore */ }
      }
      return null;
    });
  }, []);
  const disableTips = useCallback(() => {
    tipsOnRef.current = false;
    try { localStorage.setItem("lmc.tips.on", "0"); } catch { /* ignore */ }
    setTip(null);
  }, []);
  const autoLockRef = useRef(false);
  const [autoLock, setAutoLockState] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFmt, setExportFmt] = useState<ImageFormat | "pdf" | "cbz">("png");
  const [exportScope, setExportScope] = useState<"current" | "all" | "range">("all");
  const [exportDpi, setExportDpi] = useState(225);
  const [letteringOnly, setLetteringOnly] = useState(false);
  const [exportCropMarks, setExportCropMarks] = useState(false);
  const styleClipRef = useRef<Partial<TextStyle> & { fill?: FillStyle; stroke?: string; strokeW?: number } | null>(null);
  const [presets, setPresets] = useState<BalloonPreset[]>([]);
  const [showFind, setShowFind] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findCase, setFindCase] = useState(false);
  const [showSafe, setShowSafe] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [scriptText, setScriptText] = useState("");
  const [spread, setSpread] = useState(false);
  const [spreadUrl, setSpreadUrl] = useState<string | null>(null);
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
  /* balloons and caption boxes carry their own colourway lists, and the
     STYLES panel shows whichever set matches the selection */
  const [styleTab, setStyleTabState] = useState<StyleTab>("letter");
  const [activeShape, setActiveShapeState] = useState({ balloon: BALLOON_STYLES[0].name, box: BOX_STYLES[0].name });
  const activeShapeRef = useRef(activeShape);
  useEffect(() => {
    try {
      const b = localStorage.getItem("lmc.balloonStyle");
      const x = localStorage.getItem("lmc.boxStyle");
      const next = {
        balloon: b && BALLOON_STYLES.some((s) => s.name === b) ? b : activeShapeRef.current.balloon,
        box: x && BOX_STYLES.some((s) => s.name === x) ? x : activeShapeRef.current.box,
      };
      activeShapeRef.current = next;
      setActiveShapeState(next);
    } catch { /* ignore */ }
  }, []);
  const setActiveShape = (tab: "balloon" | "box", name: string) => {
    const next = { ...activeShapeRef.current, [tab]: name };
    activeShapeRef.current = next;
    setActiveShapeState(next);
    try { localStorage.setItem(tab === "box" ? "lmc.boxStyle" : "lmc.balloonStyle", name); } catch { /* ignore */ }
  };
  const setStyleTab = (t: StyleTab) => setStyleTabState(t);

  const [proof, setProof] = useState<{ busy: boolean; error: string | null; matches: ProofMatch[] } | null>(null);

  useEffect(() => {
    try { autoLockRef.current = localStorage.getItem("lmc.autolock") === "1"; } catch { /* ignore */ }
    setAutoLockState(autoLockRef.current);
  }, []);
  const setAutoLock = (v: boolean) => {
    autoLockRef.current = v;
    setAutoLockState(v);
    try { localStorage.setItem("lmc.autolock", v ? "1" : "0"); } catch { /* ignore */ }
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRESET_KEY);
      if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr)) setPresets(arr); }
    } catch { /* ignore */ }
  }, []);

  /* facing-page preview for spread view */
  const facingIndex = (() => {
    const d = docRef.current;
    if (!spread || !d) return -1;
    const pn = pageIndex + 1;
    const fi = pn === 1 ? -1 : (pn % 2 === 0 ? pageIndex + 1 : pageIndex - 1);
    return fi >= 0 && fi < d.pages.length ? fi : -1;
  })();
  const currentOnLeft = spread && (pageIndex + 1) % 2 === 0;
  useEffect(() => {
    let alive = true;
    const d = docRef.current;
    if (!spread || facingIndex < 0 || !d) { setSpreadUrl(null); return; }
    const fp = d.pages[facingIndex];
    pageThumbnail(fp, assetsRef.current, Math.min(fp.w, 800))
      .then((u) => { if (alive) setSpreadUrl(u); }).catch(() => { });
    return () => { alive = false; };
  }, [spread, facingIndex, thumbs]);

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

  /* the STYLES panel follows the selection: picking up a balloon shows the
     balloon colourways, a caption shows the box ones. A manual tab choice
     holds until a different element is selected. */
  const styleTabSelRef = useRef<string | null>(null);
  useEffect(() => {
    if (selId === styleTabSelRef.current) return;
    styleTabSelRef.current = selId;
    const t = tabForSelection(selEl as { type: string; kind?: string } | null);
    if (t) setStyleTabState(t);
  }, [selId, selEl]);

  /* surface the first unseen tip whose situation matches what the user is
     doing right now */
  useEffect(() => {
    if (!mounted || !tipsOnRef.current || tip) return;
    const s = selEl;
    const joined = !!(s && s.type === "balloon" &&
      ((s as BalloonEl).attachTo ||
        page?.els.some((e) => e.type === "balloon" && (e as BalloonEl).attachTo === s.id)));
    const next = pickTip({
      selType: s ? (s.type as "balloon" | "text" | "panel" | "image") : null,
      selHasTail: !!(s && s.type === "balloon" && (s as BalloonEl).tail),
      selJoined: joined,
      selIsSfx: !!(s && s.type === "text" && s.ts.outlineW >= 4),
      selHasText: !!(s && (s.type === "balloon" || s.type === "text") && s.text.trim()),
      editing: !!editingId,
      exportOpen: showExport,
      balloonCount: page ? page.els.filter((e) => e.type === "balloon").length : 0,
    }, tipsSeenRef.current);
    if (next) setTip(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, selId, editingId, showExport, pageIndex]);

  const setStatus = useCallback((msg: string) => {
    setStatusRaw(msg);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatusRaw(HINT), 4500);
  }, []);

  /* ---------------- history / persistence ---------------- */

  /* thumbnail generation counter: bumped whenever the page LIST changes shape
     (rebuild, reorder, doc replacement). In-flight async thumbnail renders
     compare their captured generation before writing, so a stale render can
     never stamp the wrong page's image onto the rail. */
  const thumbGenRef = useRef(0);

  const scheduleThumb = useCallback((pi: number) => {
    if (thumbTimer.current) clearTimeout(thumbTimer.current);
    thumbTimer.current = setTimeout(async () => {
      const d = docRef.current;
      if (!d || !d.pages[pi]) return;
      const gen = thumbGenRef.current;
      try {
        const url = await pageThumbnail(d.pages[pi], assetsRef.current, 140);
        if (thumbGenRef.current !== gen) return; // pages changed mid-render
        setThumbs((t) => ({ ...t, [pi]: url }));
      } catch { /* ignore */ }
    }, 700);
  }, []);

  /* refresh every page thumbnail (after multi-page edits: find/replace,
     duplicate, reorder) */
  const rebuildThumbs = useCallback(() => {
    const d = docRef.current;
    if (!d) return;
    const gen = ++thumbGenRef.current; // invalidate all in-flight renders
    (async () => {
      const next: Record<number, string> = {};
      for (let i = 0; i < d.pages.length; i++) {
        if (thumbGenRef.current !== gen) return; // superseded by a newer rebuild
        try { next[i] = await pageThumbnail(d.pages[i], assetsRef.current, 140); } catch { /* ignore */ }
      }
      if (thumbGenRef.current !== gen) return;
      setThumbs(next);
    })();
  }, []);

  const autosave = useCallback(() => {
    const full = JSON.stringify({ doc: docRef.current, assets: assetsRef.current });
    try {
      /* localStorage quota is ~5MB; past it setItem throws and (before this
         guard) the autosave silently stopped working entirely. Over budget,
         store the document WITHOUT assets — lettering survives a reload even
         when the artwork is too big to cache locally. */
      if (full.length > 4_500_000) throw new Error("too large");
      localStorage.setItem(AUTOSAVE_KEY, full);
    } catch {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ doc: docRef.current, assets: {} }));
      } catch { /* even doc alone won't fit — library/save still works */ }
    }
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
    reseedAids();
    histRef.current = [JSON.stringify(docRef.current)];
    hIndexRef.current = 0;
    setMounted(true);
    if (restored) setStatus("Restored your last session from this browser.");
    (async () => {
      const d = docRef.current!;
      const gen = thumbGenRef.current;
      for (let i = 0; i < d.pages.length; i++) {
        if (thumbGenRef.current !== gen) return; // doc replaced during boot render
        try {
          const url = await pageThumbnail(d.pages[i], assetsRef.current, 140);
          if (thumbGenRef.current !== gen) return;
          setThumbs((t) => ({ ...t, [i]: url }));
        } catch { /* ignore */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* fit zoom — read userZoomed through a ref so fitZoom's identity is stable;
     otherwise the page-change effect below re-fires on every zoom toggle and
     silently reverts the user's first Zoom In/Out click */
  const userZoomedRef = useRef(false);
  useEffect(() => { userZoomedRef.current = userZoomed; }, [userZoomed]);
  const fitZoom = useCallback((forceFit: boolean) => {
    const d = docRef.current;
    const area = areaRef.current;
    if (!d || !area) return;
    if (userZoomedRef.current && !forceFit) return;
    const p = d.pages[Math.min(pageIndexRef.current, d.pages.length - 1)];
    const z = Math.min((area.clientWidth - 110) / p.w, (area.clientHeight - 90) / p.h);
    setZoom(clamp(z, 0.05, 2));
  }, []);

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
        const rawRuns = domToRuns(dom);
        /* contentEditable leaves a trailing <div><br></div> behind, which
           became a phantom blank line that padded the balloon out */
        const rtxt = runsToText(rawRuns).replace(/ /g, " ").replace(/\s+$/, "");
        const runs = normalizeRuns(rawRuns);
        const changed = rtxt !== el.text || JSON.stringify(runs) !== JSON.stringify(el.runs);
        if (changed) {
          el.text = rtxt; el.runs = runs;
          if (el.type === "balloon") growBalloonToFit(p, el as BalloonEl);
          setTimeout(commit, 0);
        }
      }
      return null;
    });
  }, [commit]);

  useEffect(() => {
    if (!editingId) return;
    const dom = pageDivRef.current?.querySelector(`.el[data-id="${editingId}"] .txt`) as HTMLElement | null;
    if (!dom) return;
    /* Seed the editable node. React renders no children while editing so that
       re-renders (balloon auto-grow) can never disturb the caret — which means
       the initial content has to be put here, emphasis and all. */
    const eel = docRef.current?.pages[pageIndexRef.current].els.find((e) => e.id === editingId) as BalloonEl | TextEl | undefined;
    if (eel && eel.runs && eel.runs.length) dom.innerHTML = runsToHtml(eel.runs);
    else if (eel) dom.textContent = eel.text;
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
    mode: "move" | "resize" | "rotate" | "tail" | "bow" | "tilt", handle = ""
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
        /* joined balloons that melt together drop their connector bend, so
           separating again starts with a clean straight band */
        if (cur.type === "balloon") {
          const partner = (cur.attachTo
            ? p.els.find((o) => o.id === cur.attachTo)
            : p.els.find((o) => o.type === "balloon" && (o as BalloonEl).attachTo === cur.id)) as BalloonEl | undefined;
          if (partner && aabbOverlap(cur, partner)) {
            const owner = cur.attachTo ? (cur as BalloonEl) : partner; // the child owns the connector
            if (owner.tail) {
              delete owner.tail.bx; delete owner.tail.by;
              delete owner.tail.tx; delete owner.tail.ty;
            }
          }
        }
      } else if (mode === "resize") {
        const [ldx, ldy] = rotVec(dx, dy, -orig.rot);
        if (handle.includes("e")) cur.w = Math.max(MIN_SIZE, Math.round(orig.w + ldx));
        if (handle.includes("s")) cur.h = Math.max(MIN_SIZE, Math.round(orig.h + ldy));
        if (handle.includes("w")) { cur.w = Math.max(MIN_SIZE, Math.round(orig.w - ldx)); cur.x = orig.x + (orig.w - cur.w); }
        if (handle.includes("n")) { cur.h = Math.max(MIN_SIZE, Math.round(orig.h - ldy)); cur.y = orig.y + (orig.h - cur.h); }
        /* images keep their proportions on every handle (Shift stretches
           freely); other elements lock with Shift on a corner */
        const lockAspect = cur.type === "image" ? !ev.shiftKey : ev.shiftKey && handle.length === 2;
        if (lockAspect) {
          const s = handle.length === 2
            ? Math.max(cur.w / orig.w, cur.h / orig.h)
            : handle === "e" || handle === "w" ? cur.w / orig.w : cur.h / orig.h;
          cur.w = Math.max(MIN_SIZE, Math.round(orig.w * s));
          cur.h = Math.max(MIN_SIZE, Math.round(orig.h * s));
          if (handle.includes("w")) cur.x = orig.x + (orig.w - cur.w);
          if (handle.includes("n")) cur.y = orig.y + (orig.h - cur.h);
          /* an edge drag grows the cross axis out from the middle */
          if (handle === "e" || handle === "w") cur.y = orig.y + Math.round((orig.h - cur.h) / 2);
          if (handle === "n" || handle === "s") cur.x = orig.x + Math.round((orig.w - cur.w) / 2);
        }
        /* dragged edges snap to the page border, margins, centre and other
           elements' edges (Alt disables) */
        snapRef.current = { x: null, y: null };
        if (!ev.altKey) {
          const tol = Math.max(4, 8 / zoom);
          const def = Math.round(p.w * 0.035);
          const m = p.margin ?? { t: def, r: def, b: def, l: def };
          const others = p.els.filter((o) => o.id !== cur.id);
          const vT = [0, p.w, m.l, p.w - m.r, p.w / 2, ...others.flatMap((o) => [o.x, o.x + o.w])];
          const hT = [0, p.h, m.t, p.h - m.b, p.h / 2, ...others.flatMap((o) => [o.y, o.y + o.h])];
          const near = (val: number, ts: number[]) => {
            let best: number | null = null, bd = tol + 1;
            for (const t of ts) { const dd = Math.abs(t - val); if (dd < bd) { bd = dd; best = t; } }
            return best;
          };
          let sx: number | null = null, sy: number | null = null;
          if (handle.includes("e")) { const t = near(cur.x + cur.w, vT); if (t != null) { cur.w = Math.max(MIN_SIZE, t - cur.x); sx = t; } }
          else if (handle.includes("w")) { const t = near(cur.x, vT); if (t != null) { cur.w = Math.max(MIN_SIZE, cur.x + cur.w - t); cur.x = t; sx = t; } }
          if (handle.includes("s")) { const t = near(cur.y + cur.h, hT); if (t != null) { cur.h = Math.max(MIN_SIZE, t - cur.y); sy = t; } }
          else if (handle.includes("n")) { const t = near(cur.y, hT); if (t != null) { cur.h = Math.max(MIN_SIZE, cur.y + cur.h - t); cur.y = t; sy = t; } }
          if (lockAspect && (sx != null || sy != null)) {
            /* keep proportions: the snapped axis wins, the other follows */
            if (sx != null) {
              const s2 = cur.w / orig.w;
              cur.h = Math.max(MIN_SIZE, Math.round(orig.h * s2));
              if (handle.includes("n")) cur.y = orig.y + (orig.h - cur.h);
              if (handle === "e" || handle === "w") cur.y = orig.y + Math.round((orig.h - cur.h) / 2);
              sy = null;
            } else if (sy != null) {
              const s2 = cur.h / orig.h;
              cur.w = Math.max(MIN_SIZE, Math.round(orig.w * s2));
              if (handle.includes("w")) cur.x = orig.x + (orig.w - cur.w);
              if (handle === "n" || handle === "s") cur.x = orig.x + Math.round((orig.w - cur.w) / 2);
            }
          }
          snapRef.current = { x: sx, y: sy };
        }
        /* lettering scales with its box, like Comic Life */
        if (cur.type === "text" && orig.type === "text") {
          const ratio = Math.min(cur.w / orig.w, cur.h / orig.h);
          cur.ts.size = clamp(Math.round(orig.ts.size * ratio), 8, 800);
          cur.ts.outlineW = Math.max(0, Math.round(orig.ts.outlineW * ratio));
          if (orig.ts.tracking) cur.ts.tracking = Math.round(orig.ts.tracking * ratio * 10) / 10;
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
      } else if (mode === "tilt" && cur.type === "balloon" && cur.tail) {
        /* the two satellite dots tilt the connector's tangent at the bend */
        const cx = orig.x + orig.w / 2, cy = orig.y + orig.h / 2;
        const [lx, ly] = rotVec(pt.x - cx, pt.y - cy, -orig.rot);
        const bx = cur.tail.bx ?? cur.tail.dx / 2, by = cur.tail.by ?? cur.tail.dy / 2;
        let vx = lx - bx, vy = ly - by;
        if (handle === "t2") { vx = -vx; vy = -vy; }
        const L = Math.hypot(vx, vy) || 1;
        cur.tail = { ...cur.tail, tx: Math.round((vx / L) * 1000) / 1000, ty: Math.round((vy / L) * 1000) / 1000 };
      }
      if (mode === "move" || mode === "resize")
        dragTipRef.current = { x: cur.x, y: cur.y, w: cur.w, h: cur.h, mode, live: true };
      force();
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      snapRef.current = { x: null, y: null };
      /* keep the coordinates tooltip up briefly after release, like Comic Life */
      if (dragTipRef.current) {
        const tip = dragTipRef.current;
        tip.live = false;
        setTimeout(() => {
          if (dragTipRef.current === tip) { dragTipRef.current = null; force(); }
        }, 900);
      }
      if (moved) commit();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    /* touch/pen gestures can be cancelled by the browser (scroll takeover,
       palm rejection) — without this the listeners leak and the element keeps
       tracking a phantom pointer */
    window.addEventListener("pointercancel", onUp);
  }, [pagePoint, commit]);


  /* ---------------- hand-drawn balloon sketching ---------------- */

  const startSketch = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const pt = pagePoint(e);
    drawPtsRef.current = [[pt.x, pt.y]];
    force();
    const onMove = (ev: PointerEvent) => {
      const arr = drawPtsRef.current;
      if (!arr) return;
      const p = pagePoint(ev);
      const last = arr[arr.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) > 6) { arr.push([p.x, p.y]); force(); }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const arr = drawPtsRef.current;
      drawPtsRef.current = null;
      setDrawMode(false);
      if (!arr || arr.length < 8) { setStatus("Sketch cancelled — drag a full outline in one stroke."); force(); return; }
      /* clean seam → even spacing → pull out a drawn tail → round out */
      let ring = closeSketchLoop(arr);
      if (ring.length < 8) { setStatus("Sketch cancelled — drag a full outline in one stroke."); force(); return; }
      ring = resampleRing(ring, 96);
      const tailInfo = detectSketchTail(ring);
      const body = smoothSketchRing(tailInfo ? resampleRing(tailInfo.body, 80) : ring);
      const xs = body.map((q) => q[0]), ys = body.map((q) => q[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 40 || bh < 40) { setStatus("Sketch cancelled — draw a bigger outline."); force(); return; }
      const pts = body.map(([qx, qy]) => [(qx - x0) / bw, (qy - y0) / bh] as [number, number]);
      const d = docRef.current!;
      const pg = d.pages[pageIndexRef.current];
      const el = makeBalloon("custom", Math.round(x0), Math.round(y0), Math.round(bw), Math.round(bh));
      el.pts = pts;
      if (tailInfo) {
        /* they drew the tail — aim the real one at its tip */
        el.tail = {
          dx: Math.round(tailInfo.tip[0] - (x0 + bw / 2)),
          dy: Math.round(tailInfo.tip[1] - (y0 + bh / 2)),
        };
        el.tailStyle = "speech";
      } else {
        el.tail = null;
      }
      pg.els.push(el);
      pendingLockRef.current.add(el.id);
      commit();
      setSelId(el.id);
      if (tailInfo) setStatus("Custom balloon created with your drawn tail — double-click to type.");
      else setTailAsk(el.id);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [pagePoint, commit]);

  /* ---------------- keyboard ---------------- */

  /* ---------------- tuck-behind-art (magic-wand style) ---------------- */

  const startTuck = useCallback(() => {
    const s = docRef.current?.pages[pageIndexRef.current].els.find((x) => x.id === selId);
    if (!s || s.type !== "text") {
      setStatus("Select your SFX lettering first, then Tuck Behind Art.");
      return;
    }
    setTuckMode(true);
    setStatus("Drag a box over the artwork the SFX should hide behind — Esc cancels.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, setStatus]);

  const startTuckDrag = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const p0 = pagePoint(e);
    tuckRectRef.current = { x: p0.x, y: p0.y, w: 0, h: 0 };
    force();
    const onMove = (ev: PointerEvent) => {
      const p = pagePoint(ev);
      const r = tuckRectRef.current;
      if (!r) return;
      r.w = p.x - p0.x; r.h = p.y - p0.y;
      force();
    };
    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const r = tuckRectRef.current;
      tuckRectRef.current = null;
      setTuckMode(false);
      if (!r) return;
      const rect = {
        x: Math.min(r.x, r.x + r.w), y: Math.min(r.y, r.y + r.h),
        w: Math.abs(r.w), h: Math.abs(r.h),
      };
      if (rect.w < 20 || rect.h < 20) { setStatus("Drag a bigger region over the artwork."); force(); return; }
      /* topmost unrotated panel/image with artwork under the region */
      const pg = docRef.current!.pages[pageIndexRef.current];
      const target = [...pg.els].reverse().find((el) =>
        (el.type === "panel" || el.type === "image") && el.img && !el.rot &&
        rect.x < el.x + el.w && rect.x + rect.w > el.x &&
        rect.y < el.y + el.h && rect.y + rect.h > el.y);
      if (!target || target.type === "balloon" || target.type === "text" || !target.img) {
        setStatus("No artwork there — drag the box over a panel or image (unrotated).");
        force(); return;
      }
      const url = assetsRef.current[target.img];
      if (!url) { setStatus("That panel's artwork isn't loaded."); force(); return; }
      const img = await loadImage(url);
      /* clamp the region to the artwork element */
      const x0 = Math.max(rect.x, target.x), y0 = Math.max(rect.y, target.y);
      const x1 = Math.min(rect.x + rect.w, target.x + target.w);
      const y1 = Math.min(rect.y + rect.h, target.y + target.h);
      if (x1 - x0 < 10 || y1 - y0 < 10) { setStatus("The region barely touches the artwork — try again."); force(); return; }
      const src: TuckSource = {
        img, elW: target.w, elH: target.h,
        regionX: x0 - target.x, regionY: y0 - target.y,
        regionW: x1 - x0, regionH: y1 - y0,
      };
      const cut = makeCutout(src, 45);
      setTuckAsk({
        src, pageX: x0, pageY: y0, pageW: x1 - x0, pageH: y1 - y0,
        threshold: 45, invert: false, preview: cut?.url ?? null,
      });
      force();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [pagePoint]);

  const retuneTuck = useCallback((threshold: number, invert: boolean) => {
    setTuckAsk((t) => {
      if (!t) return t;
      const cut = makeCutout(t.src, threshold, invert);
      return { ...t, threshold, invert, preview: cut?.url ?? t.preview };
    });
  }, []);

  /* side effects OUTSIDE the state updater — React StrictMode double-invokes
     updaters, which would place the cutout twice */
  const applyTuck = useCallback((t: typeof tuckAsk) => {
    setTuckAsk(null);
    if (!t || !t.preview) return;
    const aid = "a" + aidRef.current++;
    assetsRef.current[aid] = t.preview;
    const el = makeImage(t.pageX, t.pageY, t.pageW, t.pageH, aid);
    el.borderW = 0;
    docRef.current!.pages[pageIndexRef.current].els.push(el); // topmost → art in front
    commit();
    setStatus("Foreground cutout placed — your SFX now sits behind the art. Delete the cutout to undo.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit, setStatus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField = t.closest?.("input, select, textarea") || t.isContentEditable;
      if (e.key === "Escape") {
        setDrawMode(false);
        drawPtsRef.current = null;
        setTuckMode(false);
        tuckRectRef.current = null;
        setTuckAsk(null);
        if (editingId) finishEditing();
        else setSelId(null);
        return;
      }
      /* take Ctrl+B / Ctrl+I over from the browser while lettering is being
         edited — its own handling strands the caret inside the run it just
         closed (see toggleEmphasis) */
      if ((e.ctrlKey || e.metaKey) && !e.altKey && t.isContentEditable &&
          (e.key.toLowerCase() === "b" || e.key.toLowerCase() === "i")) {
        if (toggleEmphasis(t, e.key.toLowerCase() === "b" ? "bold" : "italic")) e.preventDefault();
        return;
      }
      if (inField) return;
      /* call through keyFnsRef so shortcuts always see the CURRENT render's
         closures — the effect deliberately doesn't resubscribe every render,
         and stale closures here caused Ctrl+S to re-create projects and
         Ctrl+V to paste onto a previously viewed page */
      const fns = keyFnsRef.current;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); redo(); return; }
      if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); fns.duplicateSel(); return; }
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); fns.saveProject(false); return; }
      if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); fns.copySel(); return; }
      if (mod && e.key.toLowerCase() === "x") { e.preventDefault(); fns.cutSel(); return; }
      if (mod && e.key.toLowerCase() === "v") { e.preventDefault(); fns.pasteClip(); return; }
      if (mod && e.key === "[") { e.preventDefault(); fns.alignSel("hcenter"); return; }
      if (mod && e.key === "]") { e.preventDefault(); fns.alignSel("vcenter"); return; }
      /* letterer hotkeys: B balloon, T text, L lettering, P panel */
      if (!mod && !e.altKey) {
        const k = e.key.toLowerCase();
        if (k === "b") { e.preventDefault(); fns.addFromTray("speech"); return; }
        if (k === "t") { e.preventDefault(); fns.addFromTray("text"); return; }
        if (k === "l") { e.preventDefault(); fns.addFromTray("sfx"); return; }
        if (k === "p") { e.preventDefault(); fns.addFromTray("panel"); return; }
      }
      const d = docRef.current!;
      const p = d.pages[pageIndexRef.current];
      const el = p.els.find((x) => x.id === selId);
      if (!el) return;
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); fns.deleteSel(); return; }
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

  const clipboardRef = useRef<El | null>(null);

  /* format painter: copy the look of the selected balloon/lettering and stamp
     it onto other elements */
  const savePresets = useCallback((next: BalloonPreset[]) => {
    setPresets(next);
    try { localStorage.setItem(PRESET_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  /* ---------------- images ---------------- */

  const fileImageRef = useRef<HTMLInputElement>(null);
  const filePanelImageRef = useRef<HTMLInputElement>(null);
  const fileOpenRef = useRef<HTMLInputElement>(null);
  const fileFontRef = useRef<HTMLInputElement>(null);
  const fileStampRef = useRef<HTMLInputElement>(null);
  const [customStamps, setCustomStamps] = useState<{ id: string; url: string; serverId?: string }[]>([]);
  const [, bumpFonts] = useReducer((c: number) => c + 1, 0);
  const customFontIdsRef = useRef<Record<string, string>>({}); // font key -> server asset id

  /* ---------------- custom fonts & stamps (persisted in this browser) ---------------- */

  const registerRuntimeFont = useCallback(async (rec: { key: string; label: string; family: string; data: string }) => {
    try {
      const face = new FontFace(rec.family, `url(${rec.data})`);
      await face.load();
      document.fonts.add(face);
      registerFont(rec.key, rec.label, rec.family);
      bumpFonts();
    } catch { /* corrupt font file — skip */ }
  }, []);

  useEffect(() => {
    /* local cache first (instant), then the account library from SQL */
    try {
      const stamps = JSON.parse(localStorage.getItem("lmc.stamps") || "[]");
      if (Array.isArray(stamps)) setCustomStamps(stamps);
    } catch { /* ignore */ }
    try {
      const fonts = JSON.parse(localStorage.getItem("lmc.fonts") || "[]");
      if (Array.isArray(fonts)) fonts.forEach((f) => registerRuntimeFont(f));
    } catch { /* ignore */ }
    /* site-wide fonts installed by the site owner on the server */
    (async () => {
      try {
        const res = await fetch("/api/site-fonts");
        if (!res.ok) return;
        const fonts: { name: string; url: string }[] = await res.json();
        for (const f of fonts) {
          const key = "site_" + f.name.toLowerCase().replace(/\W+/g, "");
          if (FONTS[key]) continue;
          try {
            const face = new FontFace("Site " + f.name, `url(${f.url})`);
            await face.load();
            document.fonts.add(face);
            registerFont(key, f.name, "Site " + f.name, "Site Fonts");
          } catch { /* bad font file — skip */ }
        }
        bumpFonts();
      } catch { /* none */ }
    })();
    (async () => {
      try {
        const res = await fetch("/api/assets");
        if (!res.ok) return;
        const assets: { id: string; kind: string; name: string; data: string }[] = await res.json();
        const stamps = assets.filter((a) => a.kind === "stamp")
          .map((a) => ({ id: a.id, url: a.data, serverId: a.id }));
        setCustomStamps((prev) => [
          ...stamps,
          ...prev.filter((p) => !p.serverId && !stamps.some((s) => s.url === p.url)),
        ]);
        for (const a of assets.filter((x) => x.kind === "font")) {
          const key = "custom_" + a.name.toLowerCase().replace(/\W+/g, "");
          customFontIdsRef.current[key] = a.id;
          if (!FONTS[key]) {
            await registerRuntimeFont({ key, label: a.name, family: "LMC " + a.name, data: a.data });
          }
        }
      } catch { /* offline — local cache still works */ }
    })();
  }, [registerRuntimeFont]);

  /* ---------------- shared context bag ---------------- */
  /* One plain object per render; extracted modules receive it as `ed`.
     These are plain function calls (not component boundaries), so React
     reconciliation output is byte-for-byte what the inline closures made. */
  const ed: EditorCtx = {
    demo, doc, page, selId, selEl, editingId, zoom, status, pageIndex,
    docRef, assetsRef, histRef, hIndexRef, pageIndexRef, pendingLockRef,
    panelImageTarget, aidRef, activeStyleRef, styleClipRef, clipboardRef,
    customFontIdsRef, fileImageRef, filePanelImageRef, fileOpenRef,
    fileFontRef, fileStampRef,
    force, commit, autosave, undo, redo, setStatus, select, setSelId,
    setEditingId, finishEditing, mutateSel, startDrag, pagePoint, fitZoom, startTuck,
    rebuildThumbs, reseedAids, setThumbs, setPageIndex, setUserZoomed,
    setZoom, bumpFonts, registerRuntimeFont, savePresets,
    tab, setTab, layoutCat, setLayoutCat, autoLock, setAutoLock,
    projects, setProjects, current, setCurrent, dbError, setDbError,
    presets, proof, setProof, drawMode, setDrawMode, tailAsk, setTailAsk,
    ctxMenu, setCtxMenu, setShowSetup, showExport, setShowExport,
    exportFmt, setExportFmt, exportScope, setExportScope, exportDpi,
    styleTab, setStyleTab, activeStyle, setActiveStyle, activeShape,
    setActiveShape, activeShapeRef,
    setExportDpi, letteringOnly, setLetteringOnly, exportCropMarks,
    setExportCropMarks, exportFrom, setExportFrom, exportTo, setExportTo,
    showFind, setShowFind, findText, setFindText, replaceText,
    setReplaceText, findCase, setFindCase, showSafe, setShowSafe, spread,
    setSpread, showScript, setShowScript, scriptText, setScriptText,
    stampOpen, setStampOpen, showFill, setShowFill, showStroke,
    setShowStroke, showTextColor, setShowTextColor, openMenu, setOpenMenu,
    customStamps, setCustomStamps,
  };

  /* keep the shortcut handlers fresh (see keyFnsRef above) */
  keyFnsRef.current = {
    duplicateSel: () => duplicateSel(ed),
    saveProject: (b: boolean) => { saveProject(ed, b); },
    copySel: () => copySel(ed),
    cutSel: () => cutSel(ed),
    pasteClip: () => pasteClip(ed),
    alignSel: (m) => alignSel(ed, m),
    addFromTray: (k) => addFromTray(ed, k),
    deleteSel: () => deleteSel(ed),
  };

  useEffect(() => {
    if (tab === "library" && projects === null) refreshProjects(ed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, projects]);

  /* ---------------- top-level render ---------------- */

  if (!mounted || !doc || !page) {
    return <div className="booting">Loading ComicLettering Studio…</div>;
  }

  return (
    <div className={"app" + (demo ? " demo" : "")}>
      {demo && (
        <div className="demoBar">
          <span><b>DEMO MODE</b> — try everything, but saving, export and printing are off, and pages carry a watermark.</span>
          <a href="/pricing">Subscribe to unlock full access →</a>
        </div>
      )}
      {renderMenuBar(ed)}
      {renderToolbar(ed)}
      {renderFormatBar(ed)}

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
          <div className="pageActs">
            <button onClick={() => duplicatePage(ed)} title="Duplicate this page">Duplicate</button>
            <button onClick={() => movePage(ed, -1)} disabled={pageIndex === 0} title="Move page up">↑</button>
            <button onClick={() => movePage(ed, 1)} disabled={pageIndex >= doc.pages.length - 1} title="Move page down">↓</button>
          </div>
          <StylesPanel ed={ed} />
        </aside>

        <div className="canvasArea" ref={areaRef}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(ed, e)}>
          <div className="rulerRow">
            <div className="rulerCorner" />
            <Ruler length={page.w} zoom={zoom} vertical={false} offset={STAGE_MX}
              hi={dragTipRef.current?.live ? [dragTipRef.current.x, dragTipRef.current.x + dragTipRef.current.w] : null} />
          </div>
          <div className="canvasRow">
            <Ruler length={page.h} zoom={zoom} vertical offset={STAGE_MY}
              hi={dragTipRef.current?.live ? [dragTipRef.current.y, dragTipRef.current.y + dragTipRef.current.h] : null} />
            {spread && facingIndex >= 0 && !currentOnLeft && (
              <div className="facingPage" title={`Facing page ${facingIndex + 1}`}
                style={{ width: doc.pages[facingIndex].w * zoom, height: doc.pages[facingIndex].h * zoom }}
                onClick={() => { setPageIndex(facingIndex); setSelId(null); }}>
                {spreadUrl && <img src={spreadUrl} alt="" />}
                <span className="facingNum">{facingIndex + 1}</span>
              </div>
            )}
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
                {page.els.map((el) => renderEl(ed, el))}
                {page.margin && (
                  <div className="marginGuide" style={{
                    left: page.margin.l, top: page.margin.t,
                    width: page.w - page.margin.l - page.margin.r,
                    height: page.h - page.margin.t - page.margin.b,
                    borderWidth: Math.max(2, 1.5 / zoom),
                  }} />
                )}
                {showSafe && (() => {
                  const inset = Math.round(Math.min(page.w, page.h) * 0.06);
                  return (
                    <div className="safeGuide" style={{
                      left: inset, top: inset,
                      width: page.w - inset * 2, height: page.h - inset * 2,
                      borderWidth: Math.max(2, 1.5 / zoom),
                    }} />
                  );
                })()}
                {demo && <div className="demoWatermark" aria-hidden style={{ width: page.w, height: page.h }} />}
              </div>
              {!tuckMode && renderOverlay(ed)}
              {snapRef.current.x != null && <div className="snapLineV" style={{ left: snapRef.current.x * zoom }} />}
              {snapRef.current.y != null && <div className="snapLineH" style={{ top: snapRef.current.y * zoom }} />}
              {tuckMode && (
                <div className="drawLayer tuckLayer" onPointerDown={startTuckDrag}>
                  {tuckRectRef.current && (
                    <div className="tuckRect" style={{
                      left: Math.min(tuckRectRef.current.x, tuckRectRef.current.x + tuckRectRef.current.w) * zoom,
                      top: Math.min(tuckRectRef.current.y, tuckRectRef.current.y + tuckRectRef.current.h) * zoom,
                      width: Math.abs(tuckRectRef.current.w) * zoom,
                      height: Math.abs(tuckRectRef.current.h) * zoom,
                    }} />
                  )}
                </div>
              )}
              {drawMode && (
                <div className="drawLayer" onPointerDown={startSketch}>
                  {drawPtsRef.current && drawPtsRef.current.length > 1 && (
                    <svg>
                      <path d={"M " + drawPtsRef.current.map(([qx, qy]) => `${Math.round(qx * zoom)} ${Math.round(qy * zoom)}`).join(" L ")} />
                    </svg>
                  )}
                </div>
              )}
              {dragTipRef.current && (
                <div className="dragTip" style={{
                  left: (dragTipRef.current.x + dragTipRef.current.w) * zoom + 6,
                  top: dragTipRef.current.y * zoom - 4,
                }}>
                  {dragTipRef.current.mode === "resize"
                    ? `${(dragTipRef.current.w / DPI).toFixed(2)}×${(dragTipRef.current.h / DPI).toFixed(2)}"`
                    : `${(dragTipRef.current.x / DPI).toFixed(2)}, ${(dragTipRef.current.y / DPI).toFixed(2)}"`}
                </div>
              )}
            </div>
            {spread && facingIndex >= 0 && currentOnLeft && (
              <div className="facingPage" title={`Facing page ${facingIndex + 1}`}
                style={{ width: doc.pages[facingIndex].w * zoom, height: doc.pages[facingIndex].h * zoom }}
                onClick={() => { setPageIndex(facingIndex); setSelId(null); }}>
                {spreadUrl && <img src={spreadUrl} alt="" />}
                <span className="facingNum">{facingIndex + 1}</span>
              </div>
            )}
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
          {tab === "layouts" && renderLayoutsTab(ed)}
          {tab === "inspector" && renderInspector(ed)}
          {tab === "layers" && renderLayersTab(ed)}
          {tab === "photos" && renderPhotosTab(ed)}
          {tab === "library" && renderLibraryTab(ed)}
          {tab === "proof" && renderProofTab(ed)}
        </aside>
      </div>
      {renderTray(ed)}
      {renderContextMenu(ed)}
      {renderTailAsk(ed)}
      {renderExportDialog(ed)}
      {renderFindDialog(ed)}
      {renderScriptDialog(ed)}

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
          for (const f of Array.from(e.target.files || [])) await importImageFile(ed, f);
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
          await assignImageToPanel(ed, targetId, aid);
        }} />
      <input ref={fileFontRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple hidden
        onChange={async (e) => { await importFontFiles(ed, Array.from(e.target.files || [])); e.target.value = ""; }} />
      <input ref={fileStampRef} type="file" accept="image/*" multiple hidden
        onChange={async (e) => { await importStampFiles(ed, Array.from(e.target.files || [])); e.target.value = ""; }} />
      <input ref={fileOpenRef} type="file" accept=".json,application/json" hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) importJSON(ed, f);
        }} />

      {/* tuck-behind-art: threshold dialog with live cutout preview */}
      {tuckAsk && (
        <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setTuckAsk(null); }}>
          <div className="setupDlg" style={{ width: 460 }}>
            <div className="setupTitle">Tuck Behind Art</div>
            <div className="setupBody" style={{ flexDirection: "column" }}>
              <div className="tuckPreview">
                {tuckAsk.preview
                  ? <img src={tuckAsk.preview} alt="Foreground cutout preview" />
                  : <span>Could not read this artwork's pixels.</span>}
              </div>
              <fieldset className="setupGroup">
                <legend>Selection strength</legend>
                <div className="setupRow">
                  <input type="range" min={5} max={95} step={1} value={tuckAsk.threshold}
                    style={{ width: 220 }}
                    onChange={(e) => retuneTuck(+e.target.value, tuckAsk.invert)} />
                  <span style={{ width: 34, textAlign: "right" }}>{tuckAsk.threshold}</span>
                  <label style={{ marginLeft: 12 }}>
                    <input type="checkbox" checked={tuckAsk.invert}
                      onChange={(e) => retuneTuck(tuckAsk.threshold, e.target.checked)} /> Light foreground
                  </label>
                </div>
              </fieldset>
              <div className="tips" style={{ fontSize: 12 }}>
                Like a magic wand: the preview shows what will sit IN FRONT of your
                lettering. Raise the strength to grab more of the art; check “Light
                foreground” when the art is light shapes on a dark background.
              </div>
            </div>
            <div className="setupFoot">
              <button onClick={() => setTuckAsk(null)}>Cancel</button>
              <button className="okBtn" disabled={!tuckAsk.preview} onClick={() => applyTuck(tuckAsk)}>Place cutout</button>
            </div>
          </div>
        </div>
      )}

      {/* smart contextual tip — one at a time, each shows once */}
      {tip && (
        <div className="smartTip" role="status">
          <div className="smartTipTitle">💡 {tip.title}</div>
          <div className="smartTipText">{tip.text}</div>
          <div className="smartTipActs">
            <button className="smartTipOk" onClick={dismissTip}>Got it</button>
            <button className="smartTipOff" onClick={disableTips}>Turn off tips</button>
          </div>
        </div>
      )}
    </div>
  );
}
