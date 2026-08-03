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

/* One page of the SPREAD CANVAS — fully live and fully editable, whichever
   half it is. Pressing anything inside claims this page as the ops target
   (see claimPage in renderEls), so everything on both pages edits directly
   with no switching. */
function spreadHalf(ed: EditorCtx, sh: ShellProps, idx: number, off: number) {
  const doc = ed.doc!;
  const pg = doc.pages[idx];
  const isCur = idx === ed.pageIndex;
  const zoom = ed.zoom;
  const b = pageBleed(pg);
  const edH: EditorCtx = isCur ? ed : {
    ...ed, page: pg, pageIndex: idx,
    selIds: [], selId: null, selEl: null, selEls: [],
    editingId: null, warping: null,
    bleedClip: { x0: b, y0: b, x1: pg.w - b, y1: pg.h - b },
  };
  const g = pageGuides(pg);
  const bw = Math.max(2, 1.5 / zoom);
  /* print view joins the pages at their trims — each half hides its own
     spine-side bleed strip */
  const spineCrop = ed.spreadPrint
    ? (off === 0 ? `inset(0 ${b}px 0 0)` : `inset(0 0 0 ${b}px)`)
    : undefined;
  return (
    <div key={idx} data-page-index={idx}
      className={"pageHalf" + (isCur ? " cur" : "")}
      style={{
        position: "absolute", left: off, top: 0, width: pg.w, height: pg.h,
        overflow: isCur && sh.tuckMode ? "visible" : "hidden",
        clipPath: spineCrop,
        boxShadow: "0 4px 26px #00000066",
        ...fillCss(pg.bg),
      }}
      onPointerDown={(e) => {
        if (e.target !== e.currentTarget) return;
        /* empty press on either page: it becomes the ops target (tray
           inserts, paste, page setup) and the selection clears */
        if (ed.pageIndexRef.current !== idx) {
          (ed.pageIndexRef as React.RefObject<number>).current = idx;
          ed.setPageIndex(idx);
        }
        ed.select(null);
      }}
    >
      {pg.els.map((el, i) => (
        <React.Fragment key={el.id}>
          {renderEl(edH, el)}
          {renderJoinBands(edH, i)}
        </React.Fragment>
      ))}
      {renderCarriedLettering(edH)}
      {pg.margin && (
        <div className="marginGuide" style={{
          left: pg.margin.l, top: pg.margin.t,
          width: pg.w - pg.margin.l - pg.margin.r,
          height: pg.h - pg.margin.t - pg.margin.b,
          borderWidth: bw,
        }} />
      )}
      <div className="trimGuide" style={{
        left: g.trim.x, top: g.trim.y,
        width: g.trim.w, height: g.trim.h, borderWidth: bw,
      }} />
      {ed.showSafe && (
        <div className="safeGuide" style={{
          left: g.safe.x, top: g.safe.y,
          width: g.safe.w, height: g.safe.h, borderWidth: bw,
        }} />
      )}
      {ed.demo && <div className="demoWatermark" aria-hidden style={{ width: pg.w, height: pg.h }} />}
      <span className="facingNum">{idx + 1}</span>
    </div>
  );
}

/* The SPREAD CANVAS: two-up's own editing surface, separate from the
   one-page canvas. Both pages live on it at once — split without being
   split — and every tool works anywhere on it. */
function renderSpreadCanvas(ed: EditorCtx, sh: ShellProps) {
  const { zoom, drawMode } = ed;
  const doc = ed.doc!;
  const lay = ed.spreadLayout;
  const totalW = Math.max(...lay.map((s) => s.off + doc.pages[s.idx].w));
  const totalH = Math.max(...lay.map((s) => doc.pages[s.idx].h));
  const curOff = ed.spreadOffX(ed.pageIndex);
  const page = ed.page!;
  const { dragTipRef, snapRef, tuckMode } = sh;
  return (
    <div className="stage" style={{ width: totalW * zoom, height: totalH * zoom }}>
      <div ref={sh.pageDivRef} className="page spreadCanvas"
        style={{
          width: totalW, height: totalH,
          transform: `scale(${zoom})`, transformOrigin: "0 0",
          background: "transparent", boxShadow: "none", overflow: "visible",
        }}>
        {lay.map(({ idx, off }) => spreadHalf(ed, sh, idx, off))}
      </div>
      {/* tool layers ride at the CURRENT page's offset so their coordinates
          stay page-local, exactly like the one-page canvas */}
      {!tuckMode && (
        <div style={{ position: "absolute", left: curOff * zoom, top: 0 }}>
          {renderOverlay(ed)}
        </div>
      )}
      {snapRef.current.x != null && <div className="snapLineV" style={{ left: (snapRef.current.x + curOff) * zoom }} />}
      {snapRef.current.y != null && <div className="snapLineH" style={{ top: snapRef.current.y * zoom }} />}
      {tuckMode && (
        /* Tuck's spread version: the lasso layer covers BOTH pages, so a
           trace can start and end anywhere on the spread. Trace points are
           kept in current-page units (like every op), so the drawn path
           rides at the current page's canvas offset. */
        <div className="drawLayer tuckLayer" onPointerDown={sh.startTuckDrag}
          style={{ left: 0, top: 0, width: totalW * zoom, height: totalH * zoom }}>
          {sh.tuckPtsRef.current && sh.tuckPtsRef.current.length > 1 && (
            <svg style={{ width: "100%", height: "100%" }}>
              <g transform={`translate(${curOff * zoom} 0)`}>
                <path className="tuckTrace"
                  d={"M " + sh.tuckPtsRef.current.map(([qx, qy]) => `${Math.round(qx * zoom)} ${Math.round(qy * zoom)}`).join(" L ") + " Z"} />
              </g>
            </svg>
          )}
        </div>
      )}
      {drawMode && (
        <div className="drawLayer" onPointerDown={sh.startSketch}
          style={{ left: curOff * zoom, top: 0, width: page.w * zoom, height: page.h * zoom }}>
          {sh.drawPtsRef.current && sh.drawPtsRef.current.length > 1 && (
            <svg>
              <path d={"M " + sh.drawPtsRef.current.map(([qx, qy]) => `${Math.round(qx * zoom)} ${Math.round(qy * zoom)}`).join(" L ")} />
            </svg>
          )}
        </div>
      )}
      {dragTipRef.current && (
        <div className="dragTip" style={{
          left: (dragTipRef.current.x + dragTipRef.current.w + curOff) * zoom + 6,
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
  );
}

export function renderCanvasArea(ed: EditorCtx, sh: ShellProps) {
  const {
    demo, zoom, spread, spreadPrint, showSafe, drawMode, select,
    setUserZoomed, setZoom,
  } = ed;
  const page = ed.page!;
  const { dragTipRef, snapRef, tuckMode } = sh;
  /* two-up: its own canvas — both pages live on one shared surface */
  const twoUp = spread && ed.spreadLayout.length === 2;
  const curOff = twoUp ? ed.spreadOffX(ed.pageIndex) : 0;
  const rulerW = twoUp
    ? Math.max(...ed.spreadLayout.map((s) => s.off + ed.doc!.pages[s.idx].w))
    : page.w;
  return (
    <div className="canvasArea" ref={sh.areaRef}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDrop(ed, e)}>
      <div className="rulerRow">
        <div className="rulerCorner" />
        <Ruler length={rulerW} zoom={zoom} vertical={false} offset={STAGE_MX}
          hi={dragTipRef.current?.live ? [dragTipRef.current.x + curOff, dragTipRef.current.x + dragTipRef.current.w + curOff] : null} />
      </div>
      <div className="canvasRow">
        <Ruler length={page.h} zoom={zoom} vertical offset={STAGE_MY}
          hi={dragTipRef.current?.live ? [dragTipRef.current.y, dragTipRef.current.y + dragTipRef.current.h] : null} />
        {twoUp ? renderSpreadCanvas(ed, sh) : (
        <div className="stage" style={{ width: page.w * zoom, height: page.h * zoom }}>
          <div
            ref={sh.pageDivRef}
            className="page"
            style={{
              width: page.w, height: page.h,
              transform: `scale(${zoom})`, transformOrigin: "0 0",
              /* print view: this page's INNER bleed is clipped by the stage;
                 when the spine is on our left, shift so the cropped strip is
                 the left bleed */
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
