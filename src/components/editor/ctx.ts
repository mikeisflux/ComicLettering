/* Shared per-render context bag for the editor modules.
   Editor.tsx assembles one plain `ed` object per render; extracted plain
   functions (NOT components — reconciliation output is identical) receive
   it as their first argument. */
import type React from "react";
import type { Assets, Doc, El, FillStyle, GradStop, Page, TextStyle } from "@/lib/model";
import type { ImageFormat } from "@/lib/exportPng";
import type { BalloonPreset, ProjectMeta, ProofMatch } from "./textHelpers";
import type { TuckAsk } from "./tuck";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export type TabKey = "layouts" | "inspector" | "layers" | "photos" | "library" | "proof";
export type ExportFmt = ImageFormat | "pdf" | "cbz";
export type ExportScope = "current" | "all" | "range";
export type StyleClip = Partial<TextStyle> & { fill?: FillStyle; stroke?: string; strokeW?: number };

export interface EditorCtx {
  demo: boolean;
  /* current document / selection (per render) */
  doc: Doc | null;
  page: Page | null;
  selId: string | null;      // the primary — what the format bar speaks to
  selIds: string[];          // everything picked, primary last
  selEl: El | null;
  selEls: El[];
  editingId: string | null;
  zoom: number;
  status: string;
  pageIndex: number;

  /* long-lived refs */
  docRef: React.RefObject<Doc | null>;
  assetsRef: React.RefObject<Assets>;
  histRef: React.RefObject<string[]>;
  hIndexRef: React.RefObject<number>;
  pageIndexRef: React.RefObject<number>;
  pendingLockRef: React.RefObject<Set<string>>;
  panelImageTarget: React.RefObject<string | null>;
  aidRef: React.RefObject<number>;
  activeStyleRef: React.RefObject<string>;
  /* balloon / caption-box colourway names for newly created shapes */
  activeShapeRef: React.RefObject<{ balloon: string; box: string }>;
  styleClipRef: React.RefObject<StyleClip | null>;
  clipboardRef: React.RefObject<El | null>;
  customFontIdsRef: React.RefObject<Record<string, string>>;
  fileImageRef: React.RefObject<HTMLInputElement | null>;
  filePanelImageRef: React.RefObject<HTMLInputElement | null>;
  fileOpenRef: React.RefObject<HTMLInputElement | null>;
  fileFontRef: React.RefObject<HTMLInputElement | null>;
  fileStampRef: React.RefObject<HTMLInputElement | null>;

  /* core callbacks living in Editor.tsx */
  force: () => void;
  commit: () => void;
  autosave: () => void;
  autosaveSoon: () => void;
  showGradMaker: boolean;
  setShowGradMaker: SetState<boolean>;
  /* the reader's saved gradients — read in the component, since the render
     helpers below are plain functions and cannot hold hooks */
  myGrads: { name: string; stops: GradStop[] }[];
  bumpGrads: () => void;
  /* id of the lettering whose envelope handles are showing */
  warping: string | null;
  setWarping: SetState<string | null>;
  /* id of the joined balloon whose connector tilt axis is showing
     (revealed by double-clicking the connector handle) */
  tiltConn: string | null;
  setTiltConn: SetState<string | null>;
  stampQuery: string;
  setStampQuery: SetState<string>;
  undo: () => void;
  redo: () => void;
  setStatus: (msg: string) => void;
  /* STYLES sidebar */
  styleTab: "letter" | "balloon" | "box";
  setStyleTab: (t: "letter" | "balloon" | "box") => void;
  activeStyle: string;
  setActiveStyle: (name: string) => void;
  activeShape: { balloon: string; box: string };
  setActiveShape: (tab: "balloon" | "box", name: string) => void;
  select: (id: string | null, additive?: boolean) => void;
  selectAllOnPage: () => void;
  /* prompt the browser's PWA install (or explain how, per platform) */
  installApp: () => void;
  /* open the "+ Page" chooser (before/after the current page) — every
     add-page affordance (sidebar button, toolbar, Insert menu) uses it */
  setAskAddPage: (v: boolean) => void;
  setSelId: SetState<string | null>;
  setEditingId: SetState<string | null>;
  finishEditing: () => void;
  mutateSel: <T extends El>(mut: (el: T) => void, final?: boolean) => void;
  startDrag: (
    e: React.PointerEvent, el: El,
    mode: "move" | "resize" | "rotate" | "tail" | "bow" | "tilt" | "envelope", handle?: string,
  ) => void;
  pagePoint: (e: { clientX: number; clientY: number }) => { x: number; y: number };
  fitZoom: (forceFit: boolean) => void;
  /* enter Tuck Back lasso mode (requires SFX selected) */
  startTuck: () => void;
  /* the traced cutout awaiting confirmation, and its controls */
  tuckAsk: TuckAsk | null;
  setTuckAsk: SetState<TuckAsk | null>;
  retuneTuck: (patch: Partial<TuckAsk>) => void;
  runTuckAuto: () => void;
  applyTuck: (t: TuckAsk) => void;
  rebuildThumbs: () => void;
  reseedAids: () => void;
  setThumbs: SetState<Record<number, string>>;
  setPageIndex: SetState<number>;
  setUserZoomed: SetState<boolean>;
  setZoom: SetState<number>;
  bumpFonts: () => void;
  registerRuntimeFont: (rec: { key: string; label: string; family: string; data: string }) => Promise<void>;
  savePresets: (next: BalloonPreset[]) => void;

  /* UI state + setters */
  tab: TabKey;
  setTab: SetState<TabKey>;
  layoutCat: number;
  setLayoutCat: SetState<number>;
  autoLock: boolean;
  setAutoLock: (v: boolean) => void;
  projects: ProjectMeta[] | null;
  setProjects: SetState<ProjectMeta[] | null>;
  current: { id: string; name: string } | null;
  setCurrent: SetState<{ id: string; name: string } | null>;
  dbError: string | null;
  setDbError: SetState<string | null>;
  presets: BalloonPreset[];
  proof: { busy: boolean; error: string | null; matches: ProofMatch[] } | null;
  setProof: SetState<{ busy: boolean; error: string | null; matches: ProofMatch[] } | null>;
  drawMode: boolean;
  setDrawMode: SetState<boolean>;
  tailAsk: string | null;
  setTailAsk: SetState<string | null>;
  ctxMenu: { x: number; y: number; id: string } | null;
  setCtxMenu: SetState<{ x: number; y: number; id: string } | null>;
  setShowSetup: SetState<boolean>;
  showExport: boolean;
  setShowExport: SetState<boolean>;
  exportFmt: ExportFmt;
  setExportFmt: SetState<ExportFmt>;
  exportScope: ExportScope;
  setExportScope: SetState<ExportScope>;
  exportDpi: number;
  setExportDpi: SetState<number>;
  letteringOnly: boolean;
  setLetteringOnly: SetState<boolean>;
  exportCropMarks: boolean;
  setExportCropMarks: SetState<boolean>;
  exportFrom: number;
  setExportFrom: SetState<number>;
  exportTo: number;
  setExportTo: SetState<number>;
  showFind: boolean;
  setShowFind: SetState<boolean>;
  findText: string;
  setFindText: SetState<string>;
  replaceText: string;
  setReplaceText: SetState<string>;
  findCase: boolean;
  setFindCase: SetState<boolean>;
  showSafe: boolean;
  setShowSafe: SetState<boolean>;
  spread: boolean;
  setSpread: SetState<boolean>;
  /* print view: facing pages join at the spine, inner bleeds dropped */
  spreadPrint: boolean;
  setSpreadPrint: SetState<boolean>;
  showScript: boolean;
  setShowScript: SetState<boolean>;
  scriptText: string;
  setScriptText: SetState<string>;
  stampOpen: boolean;
  setStampOpen: SetState<boolean>;
  showFill: boolean;
  setShowFill: SetState<boolean>;
  showStroke: boolean;
  setShowStroke: SetState<boolean>;
  showTextColor: boolean;
  setShowTextColor: SetState<boolean>;
  openMenu: string | null;
  setOpenMenu: SetState<string | null>;
  customStamps: { id: string; url: string; serverId?: string }[];
  setCustomStamps: SetState<{ id: string; url: string; serverId?: string }[]>;
}
