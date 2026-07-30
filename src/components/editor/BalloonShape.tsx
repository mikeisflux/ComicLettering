"use client";
/* ComicLettering Studio — balloon SVG renderer
   split out of Editor.tsx (module-level code, unchanged). */
import { BalloonEl } from "@/lib/model";
import { balloonGeom } from "@/lib/geometry";
import { fillOverlayTile, fillOverlayURL, isRepeating } from "@/lib/fills";

/* ---------------- balloon SVG ---------------- */

export interface MergeBaseInfo { d: string; color: string; tf: string; stroke?: string; strokeW?: number }

export function BalloonShape({ el, mergeBase, imgSrc }: { el: BalloonEl; mergeBase?: MergeBaseInfo | null; imgSrc?: string | null }) {
  const g = balloonGeom(el);
  const f = el.fill;
  const gid = `grad-${el.id}`, cid = `clip-${el.id}`, pid = `pat-${el.id}`, mid = `melt-${el.id}`;
  /* melt (overlapping join): the two same-colour bodies union on their own —
     we must NOT fill the partner over this SVG (that painted over the
     partner's own text). Instead mask THIS balloon's outline so its seam
     inside the partner vanishes; the partner's seam inside us is already
     hidden by our fill. */
  const melt = !!mergeBase && !mergeBase.strokeW;
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
            {f.stops?.length
              ? f.stops.map(([c, p], i) => <stop key={i} offset={p} stopColor={c} />)
              : <><stop offset="0" stopColor={f.a} /><stop offset="1" stopColor={f.b} /></>}
          </linearGradient>
        )}
        {needClip && <clipPath id={cid}><path d={g.d} /></clipPath>}
        {tileURL && repeating && tile && (
          <pattern id={pid} patternUnits="userSpaceOnUse" width={tile.width} height={tile.height}>
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
      {mergeBase && mergeBase.strokeW && (
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
