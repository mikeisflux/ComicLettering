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
  Assets, BalloonEl, Doc, El, FillStyle, GradStop, Page, SavedLayout, TextEl,
  TextStyle, aabbOverlap, clamp, newPage, normalizeDoc, normalizeRuns,
  pageBleed, pageMargins, reseedIds, rotVec, runsToText, starterDoc,
} from "@/lib/model";
import { LETTER_STYLES } from "@/lib/presets";
import { BALLOON_STYLES, BOX_STYLES } from "@/lib/balloonStyles";
import { StyleTab, tabForSelection } from "./editor/stylesPanel";
import { GradientMaker, loadCustomGrads } from "./editor/GradientMaker";
import { FLAT } from "@/lib/warp";
import { ImageFormat, pageThumbnail, spreadNeighbor } from "@/lib/exportPng";
import { artUrl, ensureArt, holdArt, listArtIds, primeArtIds, putArt, requestPersistence } from "@/lib/assetStore";
import {
  BalloonPreset, HINT, PRESET_KEY, ProjectMeta, ProofMatch, domToRuns,
  letterStyleCss, runsToHtml,
} from "./editor/textHelpers";
import { SmartTip, pickTip } from "./editor/smartTips";
import { TuckAsk } from "./editor/tuck";
import { makeTuckHandlers } from "./editor/tuckOps";
import { makeCrossPageDrop } from "./editor/spreadOps";
import { KeyFns, useEditorKeys } from "./editor/useEditorKeys";
import { useFontsStamps } from "./editor/useFontsStamps";
import { useSketchDraw } from "./editor/useSketchDraw";
import { PenPt, ShapeBox, ShapeKind, usePenPanel } from "./editor/usePenPanel";
import { ShellProps, renderCanvasArea, renderHiddenInputs, renderPagesPanel } from "./editor/editorShell";
import { PageSetupDialog } from "./editor/chrome";
import { CollabState, EditorCtx, ExportProgress } from "./editor/ctx";
import { renderCommentComposer, renderTeamDialog } from "./editor/collab";
import {
  addFromTray, alignSel, applyQuickFill, copySel, cutSel, deleteSel,
  duplicatePage, duplicateSel, growBalloonToFit, sizeTextToContent,
  fitBalloonToText, pasteClip,
  printPage, refitLegacyLettering, refreshProjects, reorder, saveProject,
} from "./editor/ops";
import { useInstallPrompt, useOpenFileBridge, usePinchZoom } from "./editor/usePlatform";
import { useStartDrag } from "./editor/useStartDrag";
import { renderInspector } from "./editor/inspector";
import {
  renderLayersTab, renderLayoutsTab, renderLibraryTab, renderPhotosTab,
  renderProofTab,
} from "./editor/tabs";
import { renderFormatBar, renderMenuBar, renderToolbar } from "./editor/chromeBars";
import {
  renderContextMenu, renderExportDialog, renderExportProgress, renderFindDialog,
  renderInstallHelp,
  renderScriptDialog, renderTailAsk, renderTray, renderTuckDialog,
} from "./editor/dialogs";

const AUTOSAVE_KEY = "comiclettering.autosave.v2";
/* gutter between facing pages on the spread canvas, in page units */
const SPREAD_GAP = 90;


export default function Editor({ demo = false }: { demo?: boolean }) {
  const [, force] = useReducer((c: number) => c + 1, 0);
  const docRef = useRef<Doc | null>(null);
  const assetsRef = useRef<Assets>({});
  const histRef = useRef<string[]>([]);
  const hIndexRef = useRef(-1);
  const pageDivRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  /* the current page's x-offset on the spread canvas — read by pagePoint at
     event time, assigned fresh every render (0 in single view) */
  const spreadOffXRef = useRef<(i: number) => number>(() => 0);
  /* the spread canvas's total extent (null in single view) — fit-to-window
     fits BOTH pages when the spread is up */
  const spreadExtentRef = useRef<{ w: number; h: number } | null>(null);
  const aidRef = useRef(1);
  /* latest keyboard-shortcut handlers — refreshed every render so the
     long-lived keydown listener never runs a stale closure */
  const keyFnsRef = useRef<KeyFns>(null as never);
  /* re-seed the asset id counter from whatever assets are loaded — MUST run
     after any wholesale assets replacement (boot, project load, JSON import)
     or new images silently overwrite existing artwork ids */
  /* Where new artwork ids start. `assetsRef` is only the artwork read back so
     far — a book's pages materialise as you visit them — so seeding from that
     alone restarts the counter low and re-issues ids other pages are already
     using. The DOCUMENT names every id it references whether or not the bytes
     are loaded, and `extra` carries what the browser has in store. */
  const reseedAids = useCallback((extra?: Iterable<string>) => {
    let maxA = 0;
    const bump = (k: string) => {
      const m = /^a(\d+)$/.exec(k);
      if (m) maxA = Math.max(maxA, +m[1]);
    };
    for (const k of Object.keys(assetsRef.current)) bump(k);
    if (extra) for (const k of extra) bump(k);
    const d = docRef.current;
    if (d) {
      for (const pg of d.pages) {
        for (const e of pg.els) {
          const id = "img" in e ? (e.img as string | null) : null;
          if (id) bump(id);
        }
      }
    }
    aidRef.current = maxA + 1;
  }, []);

  const [mounted, setMounted] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  /* Selection is a SET. `selId` is the primary — the last one touched — and
     the format bar and inspector still speak to that one, because "what font
     is this" has no answer for five things at once. Everything that can act
     on many (move, nudge, lock, delete, style) acts on the whole set. */
  const [selIds, setSelIdsState] = useState<string[]>([]);
  const selId = selIds.length ? selIds[selIds.length - 1] : null;
  const selIdsRef = useRef<string[]>([]);
  /* The ref MUST update synchronously with the click, not on the next render:
     clicking a fresh bubble select()s it and starts the drag in the SAME
     pointerdown, and the drag's convoy reads selIdsRef — with the ref one
     render behind, the previously selected bubble came along for the ride
     (the "moving two bubbles" bug). All selection writes go through here. */
  const setSelIds = useCallback((v: React.SetStateAction<string[]>) => {
    const next = typeof v === "function" ? (v as (p: string[]) => string[])(selIdsRef.current) : v;
    selIdsRef.current = next;
    setSelIdsState(next);
  }, []);
  /* keeps every existing single-selection caller working unchanged */
  const setSelId = useCallback<React.Dispatch<React.SetStateAction<string | null>>>((v) => {
    const prev = selIdsRef.current;
    const cur = prev.length ? prev[prev.length - 1] : null;
    const next = typeof v === "function" ? (v as (p: string | null) => string | null)(cur) : v;
    setSelIds(next ? [next] : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const [zoom, setZoom] = useState(0.35);
  const [userZoomed, setUserZoomed] = useState(false);
  const [tab, setTab] = useState<"layouts" | "inspector" | "layers" | "photos" | "library" | "proof">("layouts");
  const [layoutCat, setLayoutCat] = useState(0);
  /* user-saved custom page layouts ("My Layouts") — persisted per browser */
  const [myLayouts, setMyLayoutsState] = useState<SavedLayout[]>([]);
  useEffect(() => {
    try { setMyLayoutsState(JSON.parse(localStorage.getItem("lmc.mylayouts") || "[]")); } catch { /* ignore */ }
  }, []);
  const setMyLayouts = useCallback((next: SavedLayout[]) => {
    setMyLayoutsState(next);
    try { localStorage.setItem("lmc.mylayouts", JSON.stringify(next)); } catch { /* private mode */ }
  }, []);
  const [status, setStatusRaw] = useState(HINT);
  const [thumbs, setThumbs] = useState<Record<number, string>>({});
  const [projects, setProjects] = useState<ProjectMeta[] | null>(null);
  const [current, setCurrent] = useState<{ id: string; name: string } | null>(null);
  const currentRef = useRef<{ id: string; name: string } | null>(null);
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
  /* "+ Page" asks where the new page goes (before/after the current one) */
  const [askAddPage, setAskAddPage] = useState(false);
  /* Tuck Back: draw around the artwork that should sit in front of the
     selected SFX; the enclosed art becomes a transparent cutout above it */
  const [tuckMode, setTuckMode] = useState(false);
  const tuckPtsRef = useRef<number[][] | null>(null);
  const [tuckAsk, setTuckAsk] = useState<TuckAsk | null>(null);
  /* collaboration (shared books): team, pinned notes, review passes */
  const [collab, setCollab] = useState<CollabState | null>(null);
  const [collabTick, setCollabTick] = useState(0);
  const [commentMode, setCommentMode] = useState(false);
  const [showTeam, setShowTeam] = useState(false);
  const [openCommentId, setOpenCommentId] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ pageIdx: number; x: number; y: number } | null>(null);
  const reloadCollab = useCallback(() => setCollabTick((t) => t + 1), []);
  /* the dialog's async detect pass needs the live value, not the one closed
     over when the button was rendered */
  const tuckAskRef = useRef<TuckAsk | null>(null);
  useEffect(() => { tuckAskRef.current = tuckAsk; }, [tuckAsk]);
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
  /* real-time export progress — non-null while any export runs, drives the
     progress-bar overlay so users see work happening instead of re-clicking */
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
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
  /* print view: facing pages join at the spine, inner bleeds dropped */
  const [spreadPrint, setSpreadPrint] = useState(false);
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
  /* Which swatch set the STYLES panel shows. Derived from the selection
     rather than pushed by an effect, so it can never lag a click: a manual
     tab pick is remembered against the element it was made on, and stops
     applying as soon as something else is selected. */
  const [pinnedTab, setPinnedTab] = useState<{ id: string | null; tab: StyleTab } | null>(null);
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


  const [stampQuery, setStampQuery] = useState("");
  /* lettering whose envelope handles are showing (double-click a resize box) */
  const [warping, setWarping] = useState<string | null>(null);
  /* joined balloon whose connector tilt axis is showing (double-click the
     connector handle) */
  const [tiltConn, setTiltConn] = useState<string | null>(null);
  const [showGradMaker, setShowGradMaker] = useState(false);
  const [gradsVersion, bumpGrads] = useReducer((c: number) => c + 1, 0);
  const [myGrads, setMyGrads] = useState<{ name: string; stops: GradStop[] }[]>([]);
  useEffect(() => { setMyGrads(loadCustomGrads()); }, [gradsVersion]);
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
  /* the bleed line is a HARD border for balloons/text/lettering/stamps in
     every view — each renders clipped to this trim rect (art is exempt);
     whatever crosses the spine side continues on the facing page */
  const bleedClip = (() => {
    const pg = docRef.current?.pages[pageIndex];
    if (!pg) return null;
    const b = pageBleed(pg);
    return { x0: b, y0: b, x1: pg.w - b, y1: pg.h - b };
  })();
  /* Two-up: its own SPREAD CANVAS — both pages live side by side on one
     shared surface, everything on either page directly editable. Each
     entry is a page index plus its x-offset on that canvas (page units).
     Regular spread keeps both bleeds and a gutter; print view joins the
     pages at their trims. Single view = one entry at offset 0 (the plain
     one-page canvas). */
  const spreadLayout = (() => {
    const d = docRef.current;
    if (!d || !spread || facingIndex < 0) return [{ idx: pageIndex, off: 0 }];
    const li = currentOnLeft ? pageIndex : facingIndex;
    const ri = currentOnLeft ? facingIndex : pageIndex;
    const L = d.pages[li], R = d.pages[ri];
    const off = spreadPrint
      ? L.w - pageBleed(L) - pageBleed(R)
      : L.w + SPREAD_GAP;
    return [{ idx: li, off: 0 }, { idx: ri, off }];
  })();
  const spreadOffX = (i: number) => spreadLayout.find((s) => s.idx === i)?.off ?? 0;
  spreadOffXRef.current = spreadOffX;
  /* the spread canvas's full extent — what fit-to-window must fit */
  spreadExtentRef.current = spreadLayout.length === 2 && docRef.current
    ? {
      w: Math.max(...spreadLayout.map((s) => s.off + docRef.current!.pages[s.idx].w)),
      h: Math.max(...spreadLayout.map((s) => docRef.current!.pages[s.idx].h)),
    }
    : null;

  /* collaboration state rides with the CLOUD copy of the book */
  useEffect(() => {
    let alive = true;
    if (!current?.id) { setCollab(null); return; }
    fetch(`/api/projects/${current.id}/collab`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive) setCollab(j); })
      .catch(() => { /* offline — the book still edits */ });
    return () => { alive = false; };
  }, [current?.id, collabTick, showTeam]);
  /* Esc backs out of note-pinning mode */
  useEffect(() => {
    if (!commentMode) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setCommentMode(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commentMode]);

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
  const selEls: El[] = page ? page.els.filter((e) => selIds.includes(e.id)) : [];

  const styleTab: StyleTab =
    pinnedTab && pinnedTab.id === selId
      ? pinnedTab.tab
      : tabForSelection(selEl as { type: string; kind?: string } | null) ?? pinnedTab?.tab ?? "letter";
  const setStyleTab = (t: StyleTab) => setPinnedTab({ id: selId, tab: t });

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
        const url = await pageThumbnail(d.pages[pi], assetsRef.current, 220, spreadNeighbor(d, pi));
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
        try { next[i] = await pageThumbnail(d.pages[i], assetsRef.current, 220, spreadNeighbor(d, i)); } catch { /* ignore */ }
      }
      if (thumbGenRef.current !== gen) return;
      setThumbs(next);
    })();
  }, []);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autosave = useCallback(() => {
    if (autosaveTimer.current) { clearTimeout(autosaveTimer.current); autosaveTimer.current = null; }
    /* Only the document goes here — it is small, and it is the one thing that
       has to be written synchronously while the tab is closing. Artwork went
       into the local art store as a Blob when it was imported; a book of
       full-size scans is gigabytes and has no business anywhere near the ~5MB
       localStorage budget. */
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({
        doc: docRef.current,
        at: { page: pageIndexRef.current, project: currentRef.current },
      }));
    } catch { /* even the document alone will not fit — library/save still works */ }
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

  /* Is a blocking modal up? Read as a ref by the global key handler, which
     deliberately does not resubscribe on every state change. */
  const modalOpenRef = useRef(false);
  useEffect(() => {
    modalOpenRef.current =
      showSetup || showExport || showFind || showScript || showGradMaker || !!tuckAsk || !!tailAsk;
  }, [showSetup, showExport, showFind, showScript, showGradMaker, tuckAsk, tailAsk]);
  useEffect(() => { editingIdRef.current = editingId; }, [editingId]);
  useEffect(() => { currentRef.current = current; }, [current]);

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

  /* Generated artwork — tuck cutouts and the like — arrives as a data URL and
     has to be handed to the artwork store, or the element it belongs to comes
     back from a refresh with nothing to draw. */
  const keepGenerated = useCallback((aid: string, dataUrl: string) => {
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => putArt(aid, blob).then((ok) => {
        if (ok) assetsRef.current[aid] = holdArt(aid, blob);
      }))
      .catch(() => { /* stays session-only */ });
  }, []);

  /* ---------------- local artwork ---------------- */

  const artIdsOnPage = useCallback((pi: number): string[] => {
    const pg = docRef.current?.pages[pi];
    if (!pg) return [];
    const ids: string[] = [];
    for (const e of pg.els) if ("img" in e && e.img) ids.push(e.img as string);
    return ids;
  }, []);

  /* Bring in the artwork this page needs, and only this page's. Called on boot
     and on every page change, so memory tracks what is being looked at rather
     than the size of the whole book. */
  const loadPageArt = useCallback(async (pi: number) => {
    const want = artIdsOnPage(pi).filter((id) => !assetsRef.current[id]);
    if (!want.length) return;
    const got = await ensureArt(want);
    if (!got.length) return;
    /* the store can be cleared out from under this await (loading another
       project calls releaseAllArt), leaving artUrl undefined — never write
       an undefined src, and skip ids the current doc no longer references
       (checked against the REQUESTED page — this also loads the facing
       page's art for spread view, not just the page being edited) */
    const live = new Set(artIdsOnPage(pi));
    let any = false;
    for (const id of got) {
      const url = artUrl(id);
      if (url && live.has(id)) { assetsRef.current[id] = url; any = true; }
    }
    if (!any) return;
    force();
    scheduleThumb(pi);
  }, [artIdsOnPage, scheduleThumb]);

  /* ---------------- boot ---------------- */

  useEffect(() => {
    let restored = false;
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw) {
        const payload = JSON.parse(raw);
        if (payload?.doc?.app === "comiclettering" && Array.isArray(payload.doc.pages)) {
          docRef.current = normalizeDoc(payload.doc);
          assetsRef.current = payload.assets || {};
          /* come back to the page the user was looking at, and to the project
             they had open — not to page one of an untitled document */
          const at = payload.at;
          if (at) {
            if (typeof at.page === "number") {
              const pi = Math.max(0, Math.min(at.page, payload.doc.pages.length - 1));
              setPageIndex(pi);
              pageIndexRef.current = pi;
            }
            if (at.project?.id) setCurrent(at.project);
          }
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
      /* Artwork is NOT read wholesale: a full book is gigabytes. Boot learns
         which ids exist, then each page materialises its own as the reader
         arrives at it. */
      /* Always learn what the store already holds, restored session or not:
         ids belong to the browser, not to one document, and a second book
         must not be handed ids the first one is using. */
      try {
        const ids = await listArtIds();
        await primeArtIds();
        reseedAids(ids);
        if (restored && ids.length) {
          requestPersistence();
          await loadPageArt(pageIndexRef.current);
        }
      } catch { /* no artwork store — the lettering still came back */ }
      const d = docRef.current!;
      /* legacy lettering slabs refit to their ink once the real fonts are in —
         old documents behave like freshly lettered ones (see refitLegacyLettering) */
      try {
        if (restored && await refitLegacyLettering(d)) {
          if (hIndexRef.current === 0 && histRef.current.length === 1) histRef.current = [JSON.stringify(d)];
          autosave();
          force();
        }
      } catch { /* best-effort migration */ }
      const gen = thumbGenRef.current;
      for (let i = 0; i < d.pages.length; i++) {
        if (thumbGenRef.current !== gen) return; // doc replaced during boot render
        try {
          const url = await pageThumbnail(d.pages[i], assetsRef.current, 220, spreadNeighbor(d, i));
          if (thumbGenRef.current !== gen) return;
          setThumbs((t) => ({ ...t, [i]: url }));
        } catch { /* ignore */ }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (mounted) loadPageArt(pageIndex); }, [pageIndex, mounted, loadPageArt]);
  /* The facing page's artwork loads in EVERY view, not just spread: the
     facing preview needs it, and so do carried stamps (autoclipping
     self-replication renders the partner's spine-crossing lettering on
     the current page, whatever the view). */
  useEffect(() => {
    if (!mounted) return;
    const d = docRef.current;
    if (!d) return;
    const pn = pageIndex + 1;
    const fi = pn === 1 ? -1 : pn % 2 === 0 ? pageIndex + 1 : pageIndex - 1;
    if (fi >= 0 && fi < d.pages.length) loadPageArt(fi);
  }, [pageIndex, mounted, loadPageArt]);

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
    /* on the spread canvas, fit BOTH pages */
    const ext = spreadExtentRef.current;
    const w = ext?.w ?? p.w, h = ext?.h ?? p.h;
    const z = Math.min((area.clientWidth - 110) / w, (area.clientHeight - 90) / h);
    setZoom(clamp(z, 0.05, 2));
  }, []);

  /* Re-fit on page change ONLY when the page size actually changes. On the
     spread canvas the ops target flips silently whenever something on the
     other half is pressed — force-fitting there threw away the user's zoom
     the moment they dropped a drag. */
  const lastFitDimsRef = useRef<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!mounted) return;
    const d = docRef.current;
    const p = d?.pages[Math.min(pageIndex, (d?.pages.length ?? 1) - 1)];
    const prev = lastFitDimsRef.current;
    const sameSize = !!p && !!prev && prev.w === p.w && prev.h === p.h;
    if (p) lastFitDimsRef.current = { w: p.w, h: p.h };
    fitZoom(!sameSize);
  }, [mounted, pageIndex, fitZoom]);
  /* switching between single, spread and print views changes the canvas
     extent — refit so both pages (or the one page) come into view */
  useEffect(() => {
    if (mounted) fitZoom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spread, spreadPrint]);
  useEffect(() => {
    const onR = () => fitZoom(false);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, [fitZoom]);

  /* ---------------- selection / editing ---------------- */

  const select = useCallback((id: string | null, additive = false) => {
    setCtxMenu(null);
    settlePendingLock(id);
    if (editingId && editingId !== id) finishEditing();
    if (!id) { setSelIds([]); return; }
    setSelIds((prev) => {
      if (!additive) return [id];
      /* ctrl-clicking something already picked takes it back out again */
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId, settlePendingLock]);

  const selectAllOnPage = useCallback(() => {
    const p = docRef.current?.pages[pageIndexRef.current];
    if (!p) return;
    setCtxMenu(null);
    if (editingIdRef.current) keyFnsRef.current.finishEditing?.();
    setSelIds(p.els.map((e) => e.id));
    setStatus(p.els.length
      ? `${p.els.length} item${p.els.length > 1 ? "s" : ""} selected — right-click to lock, or drag to move them together.`
      : "Nothing on this page yet.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStatus]);

  /* Pull whatever is currently in the editable node into the model. Shared by
     the blur/Escape commit and by the as-you-type autosave, so an unfinished
     line is never the thing a refresh loses. */
  const captureEditing = useCallback((eid: string): boolean => {
    const d = docRef.current;
    if (!d) return false;
    const p = d.pages[pageIndexRef.current];
    const el = p.els.find((e) => e.id === eid) as BalloonEl | TextEl | undefined;
    const dom = pageDivRef.current?.querySelector(`.el[data-id="${eid}"] .txt`) as HTMLElement | null;
    if (!el || !dom) return false;
    const rawRuns = domToRuns(dom);
    /* contentEditable leaves a trailing <div><br></div> behind, which
       became a phantom blank line that padded the balloon out */
    const rtxt = runsToText(rawRuns).replace(/ /g, " ").replace(/\s+$/, "");
    const runs = normalizeRuns(rawRuns);
    if (rtxt === el.text && JSON.stringify(runs) === JSON.stringify(el.runs)) return false;
    el.text = rtxt; el.runs = runs;
    if (el.type === "balloon") growBalloonToFit(p, el as BalloonEl);
    else sizeTextToContent(el as TextEl, p.w);
    return true;
  }, []);

  const finishEditing = useCallback(() => {
    /* Capture the editable DOM into the model SYNCHRONOUSLY, before clearing
       editingId. A caller that finishes editing and then commits in the same
       tick (e.g. Add Bubble) must see the just-typed words, not the stale
       ones — the model isn't updated as you type, only here. Doing the
       capture inside the setEditingId updater deferred it past that commit. */
    const eid = editingIdRef.current;
    if (eid && captureEditing(eid)) setTimeout(commit, 0);
    setEditingId(null);
  }, [commit, captureEditing]);

  /* Write through now, taking any half-typed line with it. Saving the model
     alone is not enough: while a balloon is being edited its text lives in the
     DOM and does not reach the model until the caret leaves, so an unflushed
     save would store the previous wording. */
  const flushAutosave = useCallback(() => {
    const eid = editingIdRef.current;
    if (eid) captureEditing(eid);
    autosave();
  }, [autosave, captureEditing]);

  /* As-you-type saving: cheap enough to run often, but debounced so a burst of
     keystrokes is one write rather than one per character. */
  const autosaveSoon = useCallback(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => { autosaveTimer.current = null; flushAutosave(); }, 500);
  }, [flushAutosave]);

  /* A refresh, a closed tab or a backgrounded tab must not lose the last few
     characters: write through immediately instead of waiting on the debounce.
     pagehide and visibilitychange cover the mobile cases where beforeunload
     never fires. */
  useEffect(() => {
    const onOut = () => flushAutosave();
    const onHide = () => { if (document.visibilityState === "hidden") flushAutosave(); };
    window.addEventListener("beforeunload", onOut);
    window.addEventListener("pagehide", onOut);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onOut);
      window.removeEventListener("pagehide", onOut);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flushAutosave]);

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

  /* On the SPREAD canvas, pageDivRef spans BOTH pages — pagePoint returns
     coordinates local to the page currently being operated on by
     subtracting that page's offset on the canvas (0 in single view), so
     every op keeps thinking in one page's coordinates. */
  const pagePoint = useCallback((e: { clientX: number; clientY: number }) => {
    const r = pageDivRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / zoom - spreadOffXRef.current(pageIndexRef.current),
      y: (e.clientY - r.top) / zoom,
    };
  }, [zoom]);

  /* move/resize/rotate + balloon levers + envelope drags — extracted verbatim
     to ./editor/useStartDrag (the 1500-line rule) */
  /* spread view cross-page drop — assigned before render when spread is on */
  const crossPageDropRef = useRef<((mainId: string, clientX: number, clientY: number) => boolean) | null>(null);
  /* single-page mode: warn while dragging lettering across the spine-side
     bleed line that the piece will continue on the facing page (in spread
     view the split is visible live, so no warning needed there) */
  const spineWarnRef = useRef<{ side: 1 | -1; trimX: number; facing: number } | null>(null);
  const startDrag = useStartDrag({
    pagePoint, commit, force, zoom,
    docRef, pageIndexRef, selIdsRef, snapRef, dragTipRef, setSelIds, crossPageDropRef, spineWarnRef,
  });
  spineWarnRef.current = (() => {
    const d = docRef.current;
    if (!d || spread) return null;
    const pn = pageIndex + 1;
    const fi = pn === 1 ? -1 : pn % 2 === 0 ? pageIndex + 1 : pageIndex - 1;
    if (fi < 0 || fi >= d.pages.length) return null;
    const pg = d.pages[pageIndex];
    return pn % 2 === 0
      ? { side: 1, trimX: pg.w - pageBleed(pg), facing: fi + 1 }
      : { side: -1, trimX: pageBleed(pg), facing: fi + 1 };
  })();


  /* ---------------- hand-drawn balloon sketching ---------------- */

  /* spread canvas: map a current-page-local x to the page it falls on
     (shared by the balloon sketcher and the panel pen tool) */
  const resolveSpreadTarget = (cx: number) => {
    const d = docRef.current;
    if (!d) return { idx: pageIndex, shift: 0 };
    const curOff = spreadOffX(pageIndex);
    for (const s of spreadLayout) {
      const local = cx + curOff - s.off;
      if (local >= 0 && local <= d.pages[s.idx].w) return { idx: s.idx, shift: curOff - s.off };
    }
    return { idx: pageIndex, shift: 0 };
  };

  const startSketch = useSketchDraw({
    docRef, pageIndexRef, drawPtsRef, pendingLockRef,
    pagePoint, force, commit, setDrawMode, setStatus, setSelId, setTailAsk,
    setPageIndex,
    resolveTarget: resolveSpreadTarget,
  });

  /* ---------------- "Draw Your Own" panel pen tool ---------------- */

  const [penMode, setPenMode] = useState(false);
  const [shapeMode, setShapeMode] = useState<ShapeKind | null>(null);
  const penPtsRef = useRef<PenPt[] | null>(null);
  const penBoxRef = useRef<ShapeBox | null>(null);
  const { startPenDown, startShapeDown, penUndoPoint, penClose, penCancel } = usePenPanel({
    docRef, pageIndexRef, penMode, penPtsRef, shapeMode, penBoxRef, zoom, pendingLockRef,
    pagePoint, force, commit, setPenMode, setShapeMode, setStatus, setSelId,
    resolveTarget: resolveSpreadTarget, setPageIndex,
  });

  /* ---------------- keyboard (see useEditorKeys) ---------------- */

  useEditorKeys({
    demo, selId, editingId, docRef, pageIndexRef, selIdsRef, keyFnsRef,
    modalOpenRef, drawPtsRef, tuckPtsRef, dragTipRef, thumbTimer,
    setDrawMode, setTuckMode, setTuckAsk, setSelId, setPageIndex,
    setUserZoomed, setZoom, setShowFind, setShowExport, setStatus,
    select, selectAllOnPage, finishEditing, undo, redo, fitZoom, force, commit,
  });

  /* ---------------- Tuck Back (traced clipping mask) ---------------- */
  /* plain per-render closures — they travel in the EditorCtx bag, so
     callback identity doesn't matter (see tuckOps.ts) */
  const { startTuck, startTuckDrag, retuneTuck, runTuckAuto, applyTuck } = makeTuckHandlers({
    docRef, assetsRef, pageIndexRef, pageDivRef,
    tuckPtsRef, tuckAskRef,
    selId, zoom, pagePoint, force, commit, rebuildThumbs,
    setStatus, setTuckMode, setTuckAsk, keepGenerated,
    getEd: () => ed,
  });

  /* ---------------- element ops ---------------- */

  /* Applies to every selected element, so one edit reaches the whole set.
     Callers that only make sense for lettering guard on `el.ts` themselves —
     a selection can hold a panel and a balloon at once. */
  const mutateSel = useCallback(<T extends El>(fn: (el: T) => void, final = true) => {
    const d = docRef.current!;
    const p = d.pages[pageIndexRef.current];
    const ids = selIdsRef.current;
    let hit = 0;
    for (const id of ids) {
      const el = p.els.find((x) => x.id === id) as T | undefined;
      if (!el) continue;
      fn(el);
      hit++;
    }
    if (!hit) return;
    if (final) commit(); else force();
  }, [commit]);

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
  /* custom fonts & stamps — see useFontsStamps */
  const { customStamps, setCustomStamps, bumpFonts, customFontIdsRef, registerRuntimeFont } = useFontsStamps();

  /* Tablet pinch-zoom and the PWA install prompt — see usePlatform.ts */
  usePinchZoom(areaRef, zoom, setZoom, setUserZoomed, mounted && !!doc && !!page);
  /* no native prompt available → a visible how-to-install dialog opens */
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  /* Window menu: per-panel visibility, remembered on this browser.
     PHONES start with the format bar and both side rails hidden — the
     canvas gets the screen; saved choices still win. */
  const [winHide, setWinHide] = useState<{ left: boolean; right: boolean; tray: boolean; format: boolean }>(() => {
    const phone = typeof window !== "undefined" && window.innerWidth < 700;
    const base = { left: phone, right: phone, tray: false, format: phone };
    try {
      return { ...base, ...JSON.parse(localStorage.getItem("lmc-window") || "{}") };
    } catch { return base; }
  });
  const toggleWindow = useCallback((k: "left" | "right" | "tray" | "format" | "all") => {
    setWinHide((w) => {
      const next = k === "all"
        ? { left: false, right: false, tray: false, format: false }
        : { ...w, [k]: !w[k] };
      try { localStorage.setItem("lmc-window", JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  }, []);
  const installApp = useInstallPrompt(setStatus, () => setShowInstallHelp(true));
  /* is LetterMyComic ALREADY installed on this machine? The menu-bar
     install button hides then, even in a plain browser tab. Chromium
     reports it via getInstalledRelatedApps (the manifest lists itself as
     a related webapp); the appinstalled event hides it the moment the
     user installs without waiting for a reload. */
  const [appInstalled, setAppInstalled] = useState(false);
  useEffect(() => {
    (navigator as unknown as {
      getInstalledRelatedApps?: () => Promise<{ platform: string }[]>;
    }).getInstalledRelatedApps?.()
      .then((apps) => { if (apps?.some((a) => a.platform === "webapp")) setAppInstalled(true); })
      .catch(() => { /* unsupported — the display-mode check still applies */ });
    const onInstalled = () => setAppInstalled(true);
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  /* ---------------- shared context bag ---------------- */
  /* One plain object per render; extracted modules receive it as `ed`.
     These are plain function calls (not component boundaries), so React
     reconciliation output is byte-for-byte what the inline closures made. */
  const ed: EditorCtx = {
    demo, doc, page, selId, selIds, selEl, selEls, editingId, zoom, status, pageIndex,
    docRef, assetsRef, histRef, hIndexRef, pageIndexRef, pendingLockRef,
    panelImageTarget, aidRef, activeStyleRef, styleClipRef, clipboardRef,
    customFontIdsRef, fileImageRef, filePanelImageRef, fileOpenRef,
    fileFontRef, fileStampRef,
    force, commit, autosave, undo, redo, setStatus, select, setSelId,
    setEditingId, finishEditing, mutateSel, startDrag, pagePoint, fitZoom, startTuck,
    selectAllOnPage, installApp, appInstalled, showInstallHelp, setShowInstallHelp, winHide, toggleWindow, setAskAddPage,
    tuckAsk, setTuckAsk, retuneTuck, runTuckAuto, applyTuck,
    autosaveSoon,
    rebuildThumbs, reseedAids, setThumbs, setPageIndex, setUserZoomed,
    setZoom, bumpFonts, registerRuntimeFont, savePresets,
    tab, setTab, layoutCat, setLayoutCat, myLayouts, setMyLayouts, autoLock, setAutoLock,
    projects, setProjects, current, setCurrent, dbError, setDbError,
    presets, proof, setProof, drawMode, setDrawMode, penMode, setPenMode,
    shapeMode, setShapeMode, tailAsk, setTailAsk,
    ctxMenu, setCtxMenu, setShowSetup, showExport, setShowExport,
    exportProgress, setExportProgress,
    exportFmt, setExportFmt, exportScope, setExportScope, exportDpi,
    styleTab, setStyleTab, activeStyle, setActiveStyle, activeShape,
    setActiveShape, activeShapeRef,
    setExportDpi, letteringOnly, setLetteringOnly, exportCropMarks,
    setExportCropMarks, exportFrom, setExportFrom, exportTo, setExportTo,
    showFind, setShowFind, findText, setFindText, replaceText,
    setReplaceText, findCase, setFindCase, showSafe, setShowSafe, spread,
    setSpread, spreadPrint, setSpreadPrint, bleedClip, spreadLayout, spreadOffX, showScript, setShowScript, scriptText, setScriptText,
    warping, setWarping,
    collab, reloadCollab, commentMode, setCommentMode, showTeam, setShowTeam,
    openCommentId, setOpenCommentId, composer, setComposer,
    tiltConn, setTiltConn,
    stampOpen, setStampOpen, stampQuery, setStampQuery, showGradMaker,
    setShowGradMaker, myGrads, bumpGrads, showFill, setShowFill, showStroke,
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
    setLocked: (v) => mutateSel((x) => { x.locked = v; }),
    finishEditing: () => finishEditing(),
    reorder: (dir) => reorder(ed, dir),
    fitBalloonToText: () => fitBalloonToText(ed),
    printPage: () => printPage(ed),
    duplicatePage: () => duplicatePage(ed),
  };

  /* Editor-local render plumbing handed to the shell (see editorShell) */
  const sh: ShellProps = {
    areaRef, pageDivRef, dragTipRef, snapRef, thumbs, askAddPage,
    tuckMode, tuckPtsRef,
    drawPtsRef, startSketch, startTuckDrag,
    penPtsRef, startPenDown, penBoxRef, startShapeDown,
    penUndoPoint, penClose, penCancel,
  };

  useEffect(() => {
    if (tab === "library" && projects === null) refreshProjects(ed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, projects]);

  /* .lmc file-open bridge (installed app + desktop wrapper) — usePlatform.ts */
  useOpenFileBridge(ed);

  /* Two-up: drop-on-facing-page transfer — see spreadOps.ts */
  crossPageDropRef.current = !spread || facingIndex < 0 ? null : makeCrossPageDrop({
    docRef, pageIndexRef, selIdsRef, pageDivRef, zoom, spreadPrint,
    setSelIds, commit, rebuildThumbs, setStatus,
  });

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
      {!winHide.format && renderFormatBar(ed)}

      {/* ---------- main ---------- */}
      <div className="main">
        {!winHide.left && renderPagesPanel(ed, sh)}

        {renderCanvasArea(ed, sh)}

        {!winHide.right && <aside className="rightbar">
          {/* phone drawer: the rail floats over the canvas and needs a way out */}
          <button className="railClose" onClick={() => toggleWindow("right")}>✕ Close</button>
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
        </aside>}
      </div>
      {!winHide.tray && renderTray(ed)}
      {renderContextMenu(ed)}
      {renderTailAsk(ed)}
      {renderExportDialog(ed)}
      {renderExportProgress(ed)}
      {renderFindDialog(ed)}
      {renderInstallHelp(ed)}
      {renderScriptDialog(ed)}

      {showGradMaker && (
        <GradientMaker
          initial={selEl && (selEl.type === "balloon" || selEl.type === "panel") && selEl.fill.kind === "gradient"
            ? (selEl.fill.stops as GradStop[] | undefined) ?? [[selEl.fill.a, 0], [selEl.fill.b, 1]]
            : undefined}
          onClose={() => setShowGradMaker(false)}
          onSaved={bumpGrads}
          onApply={(stops) => applyQuickFill(ed, { stops })}
        />
      )}

      {/* page setup dialog */}
      {showSetup && (
        <PageSetupDialog
          page={page}
          onClose={() => setShowSetup(false)}
          onApply={(w, h, margin, bleed, applyAll) => {
            const d = docRef.current!;
            const targets = applyAll ? d.pages : [page];
            for (const p of targets) {
              p.w = w; p.h = h; p.bleed = bleed;
              if (margin) p.margin = { ...margin }; else delete p.margin;
            }
            setShowSetup(false);
            commit();
            fitZoom(true);
            setThumbs({});
            d.pages.forEach((pg, i) =>
              pageThumbnail(pg, assetsRef.current, 220).then((u) => setThumbs((t) => ({ ...t, [i]: u }))).catch(() => { }));
          }}
        />
      )}
      {renderHiddenInputs(ed)}

      {/* Tuck Back: traced cutout with live preview */}
      {renderTuckDialog(ed)}
      {renderTeamDialog(ed)}
      {renderCommentComposer(ed)}

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
