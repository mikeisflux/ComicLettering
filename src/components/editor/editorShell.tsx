/* The editor's big JSX regions, split from Editor.tsx (1500-line cap):
   the left pages panel, the canvas area (rulers, spread facing pages, the
   page itself, guides, lasso layers) and the hidden file inputs. Plain
   render functions taking the per-render EditorCtx bag plus a small bag of
   Editor-local state/refs that don't belong in the shared ctx. */
import React from "react";
import { DPI, clamp, pageBleed, pageGuides } from "@/lib/model";
import { fillCss } from "@/lib/fills";
import { loadImage } from "@/lib/exportPng";
import { Ruler, STAGE_MX, STAGE_MY } from "./chrome";
import { EditorCtx } from "./ctx";
import { renderCarriedLettering, renderEl, renderJoinBands, renderOverlay } from "./renderEls";
import { StylesPanel } from "./stylesPanel";
import { addPageAt } from "./spreadOps";
import {
  ART_ACCEPT, ART_FORMATS_LABEL, assignImageToPanel, duplicatePage, importFontFiles,
  importImageFile, importJSON, importStampFiles, isSupportedArtFile, movePage,
  nextAid, normalizeArtFile, onDrop, readAsDataURL,
} from "./ops";

/* Editor-local state and refs the shell needs but the shared ctx doesn't
   carry (they are render-plumbing, not editing surface). */
export interface ShellProps {
  areaRef: React.RefObject<HTMLDivElement | null>;
  pageDivRef: React.RefObject<HTMLDivElement | null>;
  dragTipRef: { current: { x: number; y: number; w: number; h: number; mode: string; live: boolean; warn?: string } | null };
  snapRef: { current: { x: number | null; y: number | null } };
  thumbs: Record<number, string>;
  askAddPage: boolean;
  facingIndex: number;
  currentOnLeft: boolean;
  tuckMode: boolean;
  tuckPtsRef: { current: number[][] | null };
  tuckJustEndedRef: { current: number };
  drawPtsRef: { current: number[][] | null };
  startSketch: (e: React.PointerEvent) => void;
  startTuckDrag: (e: React.PointerEvent) => void;
}

export function renderPagesPanel(ed: EditorCtx, sh: ShellProps) {
  const { setPageIndex, setSelId, setStatus, commit, rebuildThumbs, setAskAddPage, docRef, pageIndex } = ed;
  const doc = ed.doc!;
  return (
    <aside className="leftbar">
      <div className="sideTitle">Pages</div>
      <div className="pageList">
        {doc.pages.map((p, i) => (
          <button key={i} className={"pageThumb" + (i === pageIndex ? " on" : "")}
            style={{ aspectRatio: `${p.w} / ${p.h}` }}
            onClick={() => { setPageIndex(i); setSelId(null); }}>
            {sh.thumbs[i] ? <img src={sh.thumbs[i]} alt="" /> : null}
            <span>{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="pageActs">
        <button onClick={() => setAskAddPage(true)}>+ Page</button>
        <button onClick={() => {
          const d = docRef.current!;
          if (d.pages.length <= 1) { setStatus("A document needs at least one page."); return; }
          if (!window.confirm(`Delete page ${pageIndex + 1}?`)) return;
          d.pages.splice(pageIndex, 1);
          setPageIndex((p) => clamp(p, 0, d.pages.length - 1));
          setSelId(null);
          commit();
          rebuildThumbs();
        }}>Delete</button>
      </div>
      {sh.askAddPage && (
        /* where should the new page go? Inserting shifts every later
           page, so ask rather than guess. */
        <div className="setupOverlay" onPointerDown={(e) => { if (e.target === e.currentTarget) setAskAddPage(false); }}>
          <div className="setupDlg" style={{ width: 330 }}>
            <div className="setupTitle">Add a new page</div>
            <div className="setupBody" style={{ flexDirection: "column", gap: 8 }}>
              <div className="tailChoices">
                <button onClick={() => { addPageAt(ed, pageIndex); }}>
                  Before page {pageIndex + 1}
                </button>
                <button onClick={() => { addPageAt(ed, pageIndex + 1); }}>
                  After page {pageIndex + 1}
                </button>
              </div>
              <div className="tips">The new page uses this page&apos;s size and margins.</div>
            </div>
          </div>
        </div>
      )}
      <div className="pageActs">
        <button onClick={() => duplicatePage(ed)} title="Duplicate this page">Duplicate</button>
        <button onClick={() => movePage(ed, -1)} disabled={pageIndex === 0} title="Move page up">↑</button>
        <button onClick={() => movePage(ed, 1)} disabled={pageIndex >= doc.pages.length - 1} title="Move page down">↓</button>
      </div>
      <StylesPanel ed={ed} />
    </aside>
  );
}

/* One facing-page preview (either side of the stage in spread view). */
function facingPage(ed: EditorCtx, sh: ShellProps, innerCropSide: "left" | "right") {
  const { setPageIndex, setSelId, spreadPrint, zoom } = ed;
  const fp = ed.doc!.pages[sh.facingIndex];
  const crop = spreadPrint ? pageBleed(fp) * zoom : 0;
  /* The facing page is a LIVE page, not a rendered preview: both pages of
     the spread load at once and share the editing canvas, drawn by the SAME
     DOM renderer — so they always match, and anything spanning the spine
     (lettering, warp edits mid-drag) updates on both pages in the same
     frame. It stays one click from editable: clicking it makes it the
     current page, exactly where you left off. */
  const edF: EditorCtx = {
    ...ed, page: fp, pageIndex: sh.facingIndex,
    selIds: [], selId: null, editingId: null, warping: null,
  };
  return (
    <div className="facingPage" data-page-index={sh.facingIndex}
      title={spreadPrint
        ? `Facing page ${sh.facingIndex + 1} — print view joins the pages at the spine; the bleed between them is dropped`
        : `Facing page ${sh.facingIndex + 1}`}
      style={{ width: fp.w * zoom - crop, height: fp.h * zoom, overflow: "hidden" }}
      onClick={() => {
        /* not while tucking — a trace that ends over this page must not
           switch pages under the dialog */
        if (sh.tuckMode || Date.now() - sh.tuckJustEndedRef.current < 500) return;
        setPageIndex(sh.facingIndex); setSelId(null);
      }}>
      <div className="facingLive" style={{
        position: "absolute", left: innerCropSide === "left" ? -crop : 0, top: 0,
        width: fp.w, height: fp.h,
        transform: `scale(${zoom})`, transformOrigin: "0 0",
        pointerEvents: "none",
        ...fillCss(fp.bg),
      }}>
        {fp.els.map((el, i) => (
          <React.Fragment key={el.id}>
            {renderEl(edF, el)}
            {renderJoinBands(edF, i)}
          </React.Fragment>
        ))}
        {renderCarriedLettering(edF)}
      </div>
      <span className="facingNum">{sh.facingIndex + 1}</span>
    </div>
  );
}

export function renderCanvasArea(ed: EditorCtx, sh: ShellProps) {
  const {
    demo, zoom, spread, spreadPrint, showSafe, drawMode, select,
    setUserZoomed, setZoom,
  } = ed;
  const page = ed.page!;
  const { dragTipRef, snapRef, facingIndex, currentOnLeft, tuckMode } = sh;
  return (
    <div className="canvasArea" ref={sh.areaRef}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(ed, e)}>
      <div className="rulerRow">
        <div className="rulerCorner" />
        <Ruler length={page.w} zoom={zoom} vertical={false} offset={STAGE_MX}
          hi={dragTipRef.current?.live ? [dragTipRef.current.x, dragTipRef.current.x + dragTipRef.current.w] : null} />
      </div>
      <div className="canvasRow">
        <Ruler length={page.h} zoom={zoom} vertical offset={STAGE_MY}
          hi={dragTipRef.current?.live ? [dragTipRef.current.y, dragTipRef.current.y + dragTipRef.current.h] : null} />
        {/* facing page on the LEFT; print view crops its inner (right) bleed
            so the two pages join at the spine */}
        {spread && facingIndex >= 0 && !currentOnLeft && facingPage(ed, sh, "right")}
        <div className="stage" style={(() => {
          const bl = pageBleed(page) * zoom;
          const cropL = spreadPrint && facingIndex >= 0 && !currentOnLeft;
          const cropR = spreadPrint && facingIndex >= 0 && currentOnLeft;
          return {
            width: page.w * zoom - (cropL || cropR ? bl : 0),
            height: page.h * zoom,
            overflow: cropL || cropR ? ("hidden" as const) : undefined,
            marginLeft: cropL ? 0 : undefined,
            marginRight: cropR ? 0 : undefined,
          };
        })()}>
          <div
            ref={sh.pageDivRef}
            className="page"
            style={{
              width: page.w, height: page.h,
              transform: `scale(${zoom})`, transformOrigin: "0 0",
              /* print view: this page's INNER bleed is clipped by the stage;
                 when the spine is on our left, shift so the cropped strip is
                 the left bleed */
              left: spreadPrint && facingIndex >= 0 && !currentOnLeft ? -pageBleed(page) * zoom : undefined,
              /* while the tuck lasso is armed the page unclips, so a trace
                 sweeping across the spine stays visible */
              overflow: tuckMode ? "visible" : undefined,
              ...fillCss(page.bg),
            }}
            onPointerDown={(e) => { if (e.target === e.currentTarget) select(null); }}
          >
            {/* each join link's connector band paints right after the later
                of its two partners — links stay independent */}
            {page.els.map((el, i) => (
              <React.Fragment key={el.id}>
                {renderEl(ed, el)}
                {renderJoinBands(ed, i)}
              </React.Fragment>
            ))}
            {/* autoclipping self-replication: lettering the facing page cut
                off at its bleed line reappears here from ours */}
            {renderCarriedLettering(ed)}
            {page.margin && (
              <div className="marginGuide" style={{
                left: page.margin.l, top: page.margin.t,
                width: page.w - page.margin.l - page.margin.r,
                height: page.h - page.margin.t - page.margin.b,
                borderWidth: Math.max(2, 1.5 / zoom),
              }} />
            )}
            {(() => {
              /* Comic page sizes are quoted WITH bleed, so the page edge is
                 not where the book ends — the blade lands on the trim, an
                 eighth of an inch in. That line is always on: it is a real
                 edge of the printed book, not an optional overlay, and every
                 crop decision on the page depends on it. Show Safe Area adds
                 the lettering line inside it. */
              const g = pageGuides(page);
              const bw = Math.max(2, 1.5 / zoom);
              return (
                <>
                  <div className="trimGuide" style={{
                    left: g.trim.x, top: g.trim.y,
                    width: g.trim.w, height: g.trim.h, borderWidth: bw,
                  }} />
                  {showSafe && (
                    <div className="safeGuide" style={{
                      left: g.safe.x, top: g.safe.y,
                      width: g.safe.w, height: g.safe.h, borderWidth: bw,
                    }} />
                  )}
                </>
              );
            })()}
            {demo && <div className="demoWatermark" aria-hidden style={{ width: page.w, height: page.h }} />}
          </div>
          {!tuckMode && renderOverlay(ed)}
          {snapRef.current.x != null && <div className="snapLineV" style={{ left: snapRef.current.x * zoom }} />}
          {snapRef.current.y != null && <div className="snapLineH" style={{ top: snapRef.current.y * zoom }} />}
          {tuckMode && (
            <div className="drawLayer tuckLayer" onPointerDown={sh.startTuckDrag}>
              {sh.tuckPtsRef.current && sh.tuckPtsRef.current.length > 1 && (
                <svg>
                  <path className="tuckTrace"
                    d={"M " + sh.tuckPtsRef.current.map(([qx, qy]) => `${Math.round(qx * zoom)} ${Math.round(qy * zoom)}`).join(" L ") + " Z"} />
                </svg>
              )}
            </div>
          )}
          {drawMode && (
            <div className="drawLayer" onPointerDown={sh.startSketch}>
              {sh.drawPtsRef.current && sh.drawPtsRef.current.length > 1 && (
                <svg>
                  <path d={"M " + sh.drawPtsRef.current.map(([qx, qy]) => `${Math.round(qx * zoom)} ${Math.round(qy * zoom)}`).join(" L ")} />
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
              {dragTipRef.current.warn && (
                <div style={{ color: "#ffb020", maxWidth: 230, whiteSpace: "normal" }}>
                  {dragTipRef.current.warn}
                </div>
              )}
            </div>
          )}
        </div>
        {/* facing page on the RIGHT; print view crops its inner (left) bleed */}
        {spread && facingIndex >= 0 && currentOnLeft && facingPage(ed, sh, "left")}
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
  );
}

export function renderHiddenInputs(ed: EditorCtx) {
  const {
    fileImageRef, filePanelImageRef, fileFontRef, fileStampRef, fileOpenRef,
    panelImageTarget, assetsRef, setStatus,
  } = ed;
  return (
    <>
      <input ref={fileImageRef} type="file" accept={ART_ACCEPT} multiple hidden
        onChange={async (e) => {
          for (const f of Array.from(e.target.files || [])) await importImageFile(ed, f);
          e.target.value = "";
        }} />
      <input ref={filePanelImageRef} type="file" accept={ART_ACCEPT.replace(/,?application\/pdf|,?\.pdf/g, "")} hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          const targetId = panelImageTarget.current;
          panelImageTarget.current = null;
          if (!f || !targetId) return;
          if (!isSupportedArtFile(f) || f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
            setStatus(`"${f.name}" isn't a supported image — use ${ART_FORMATS_LABEL.replace(" or PDF", "")}.`);
            return;
          }
          let blob: Blob = f;
          try { blob = await normalizeArtFile(f); }
          catch { setStatus(`Could not read "${f.name}" — save that TIFF as PNG first.`); return; }
          const url = await readAsDataURL(blob);
          await loadImage(url);
          const aid = nextAid(ed);
          assetsRef.current[aid] = url;
          await assignImageToPanel(ed, targetId, aid);
        }} />
      <input ref={fileFontRef} type="file" accept=".ttf,.otf,.woff,.woff2" multiple hidden
        onChange={async (e) => { await importFontFiles(ed, Array.from(e.target.files || [])); e.target.value = ""; }} />
      <input ref={fileStampRef} type="file" accept="image/*" multiple hidden
        onChange={async (e) => { await importStampFiles(ed, Array.from(e.target.files || [])); e.target.value = ""; }} />
      <input ref={fileOpenRef} type="file" accept=".lmc,.json,application/json,application/x-lettermycomic" hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) importJSON(ed, f);
        }} />
    </>
  );
}
