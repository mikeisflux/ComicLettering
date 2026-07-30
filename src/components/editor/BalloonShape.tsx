"use client";
/* ComicLettering Studio — balloon SVG renderer
   split out of Editor.tsx (module-level code, unchanged). */
import { BalloonEl } from "@/lib/model";
import { balloonGeom } from "@/lib/geometry";
import { fillOverlayTile, fillOverlayURL, isRepeating } from "@/lib/fills";

/* ---------------- balloon SVG ---------------- */

export interface MergeBaseInfo { d: string; bodyD?: string; color: string; tf: string; stroke?: string; strokeW?: number }

export function BalloonShape({ el, mergeBase, imgSrc, joinRect }: {
  el: BalloonEl; mergeBase?: MergeBaseInfo | null; imgSrc?: string | null;
  /* bounding box of this balloon's JOIN GROUP in el-local coords — gradients
     span it (and pattern tiles anchor to it) so the fill flows continuously
     across joined bubbles instead of restarting in each one */
  joinRect?: { x: number; y: number; w: number; h: number } | null;
}) {
  const g = balloonGeom(el);
  const f = el.fill;
  const gid = `grad-${el.id}`, cid = `clip-${el.id}`, pid = `pat-${el.id}`, mid = `melt-${el.id}`;
  /* melt (overlapping join): the two same-colour bodies union on their own —
     we must NOT fill the partner over this SVG (that painted over the
     partner's own text). Instead mask THIS balloon's outline so its seam
     inside the partner vanishes; the partner's seam inside us is already
     hidden by our fill. */
  const melt = !!mergeBase && !mergeBase.strokeW;
  /* apart + the partner has a speaker tail: redraw its tail WEDGE on top of
     the band so the band falls BEHIND the tail (the wedge excludes the body,
     so the band's opening into the body stays open) */
  const wedge = !!mergeBase && !!mergeBase.strokeW && !!mergeBase.bodyD && mergeBase.bodyD !== mergeBase.d;
  const wid = `wedge-${el.id}`;
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
        {f.kind === "gradient" && (() => {
          const stops = f.stops?.length
            ? f.stops.map(([c, p], i) => <stop key={i} offset={p} stopColor={c} />)
            : <><stop offset="0" stopColor={f.a} /><stop offset="1" stopColor={f.b} /></>;
          if (joinRect) {
            /* joined balloons: ONE gradient across the whole group, in user
               space (same axis formula as export's paintFill) — a per-bubble
               gradient restarts at the join and draws a seam line there */
            const rad = ((f.angle - 90) * Math.PI) / 180;
            const cx = joinRect.x + joinRect.w / 2, cy = joinRect.y + joinRect.h / 2;
            const len = (Math.abs(Math.cos(rad)) * joinRect.w + Math.abs(Math.sin(rad)) * joinRect.h) / 2;
            return (
              <linearGradient id={gid} gradientUnits="userSpaceOnUse"
                x1={cx - Math.cos(rad) * len} y1={cy - Math.sin(rad) * len}
                x2={cx + Math.cos(rad) * len} y2={cy + Math.sin(rad) * len}>
                {stops}
              </linearGradient>
            );
          }
          return (
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1" gradientTransform={`rotate(${f.angle - 180}, 0.5, 0.5)`}>
              {stops}
            </linearGradient>
          );
        })()}
        {needClip && <clipPath id={cid}><path d={g.d} /></clipPath>}
        {tileURL && repeating && tile && (
          /* joined balloons anchor the tiling to the group box so the pattern
             phase matches across both bubbles */
          <pattern id={pid} patternUnits="userSpaceOnUse" width={tile.width} height={tile.height}
            x={joinRect ? joinRect.x : 0} y={joinRect ? joinRect.y : 0}>
            <image href={tileURL} width={tile.width} height={tile.height} />
          </pattern>
        )}
        {melt && mergeBase && (
          /* white = keep, black = drop: hide this balloon's outline where it
             crosses INTO the partner, so the melted blob has no inner seam */
          <mask id={mid} maskUnits="userSpaceOnUse" x={-el.w} y={-el.h} width={el.w * 3} height={el.h * 3}>
            <rect x={-el.w} y={-el.h} width={el.w * 3} height={el.h * 3} fill="white" />
            <path d={mergeBase.d} transform={mergeBase.tf} fill="black" />
          </mask>
        )}
        {wedge && mergeBase && (
          /* wedge = partner's full tailed shape XOR its plain body = the tail
             only (evenodd), in this balloon's coordinate space */
          <clipPath id={wid} clipPathUnits="userSpaceOnUse">
            <path d={`${mergeBase.bodyD} ${mergeBase.d}`} transform={mergeBase.tf} clipRule="evenodd" />
          </clipPath>
        )}
      </defs>
      {mergeBase && el.strokeW > 0 && !g.noStroke && (
        /* joined balloons: stroke under, fills over → outlines union */
        <path d={g.d} fill="none" stroke={el.stroke} strokeWidth={el.strokeW * 2}
          strokeLinejoin="round" strokeDasharray={g.dash ? g.dash.join(" ") : undefined}
          mask={melt ? `url(#${mid})` : undefined} />
      )}
      <path d={g.d} fill={fillRef} />
      {tileURL && (repeating
        ? <rect x={-el.w} y={-el.h} width={el.w * 3} height={el.h * 3} fill={`url(#${pid})`} clipPath={`url(#${cid})`} />
        : <image href={tileURL} x={0} y={0} width={el.w} height={el.h} preserveAspectRatio="none" clipPath={`url(#${cid})`} />)}
      {imgSrc && (
        <image href={imgSrc} x={0} y={0} width={el.w} height={el.h}
          preserveAspectRatio="xMidYMid slice" clipPath={`url(#${cid})`} />
      )}
      {mergeBase && !!mergeBase.strokeW && (
        /* APART: redraw the partner's OUTLINE over the band so the band tucks
           under it — but do NOT re-fill the partner (that painted over the
           partner's text). OVERLAPPING (melt) fills nothing here: the two
           same-colour bodies union on their own and this balloon's outline is
           masked instead — see the melt mask above. */
        <g transform={mergeBase.tf}>
          <path d={mergeBase.d} fill="none" stroke={mergeBase.stroke} strokeWidth={mergeBase.strokeW} strokeLinejoin="round" />
        </g>
      )}
      {/* open connector band: fill covers both outlines at the junctions,
          only the two sides get inked — both openings stay clear */}
      {g.bandFill && <path d={g.bandFill} fill={fillRef} stroke="none" />}
      {g.bandEdges && el.strokeW > 0 && (
        <path d={g.bandEdges} fill="none" stroke={el.stroke} strokeWidth={el.strokeW}
          strokeLinejoin="round" strokeLinecap="round" />
      )}
      {wedge && mergeBase && (
        /* partner's speaker-tail wedge, ON TOP of the band: fill (covers the
           band in the wedge with the partner's colour) + stroke (the tail's
           two inked sides sit over the band). Clipped to the wedge, so the
           band's opening into the partner body is untouched. */
        <g clipPath={`url(#${wid})`}>
          {/* on a gradient join the wedge carries the SHARED user-space
              gradient — a flat colour there would draw its own seam */}
          <path d={mergeBase.d} transform={mergeBase.tf}
            fill={f.kind === "gradient" && joinRect ? fillRef : mergeBase.color} />
          <path d={mergeBase.d} transform={mergeBase.tf} fill="none"
            stroke={mergeBase.stroke} strokeWidth={mergeBase.strokeW} strokeLinejoin="round" />
        </g>
      )}
      {!mergeBase && el.strokeW > 0 && !g.noStroke && (
        <path d={g.d} fill="none" stroke={el.stroke} strokeWidth={el.strokeW}
          strokeLinejoin="round" strokeDasharray={g.dash ? g.dash.join(" ") : undefined} />
      )}
      {!mergeBase && el.strokeW > 0 && g.d2 && (
        <path d={g.d2} fill="none" stroke={el.stroke} strokeWidth={el.strokeW}
          strokeLinejoin="round" strokeDasharray={g.dash ? g.dash.join(" ") : undefined} />
      )}
      {g.deco && el.strokeW > 0 && <path d={g.deco} fill={el.stroke} />}
    </svg>
  );
}
