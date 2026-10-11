/* The Instaction control panel — ONE component for the Inspector section
   and the toolbar button's press-and-hold flyout, so the two can never
   offer different controls. Everything edits the selected ActionEl live
   (no history entry per slider tick) and commits on release. */
import { ActionEl } from "@/lib/model";
import { Slider } from "./chrome";
import { Fld } from "./textHelpers";
import { EditorCtx } from "./ctx";

export function ActionControls({ ed, a, compact }: { ed: EditorCtx; a: ActionEl; compact?: boolean }) {
  const { mutateSel, commit } = ed;
  const live = (f: (x: ActionEl) => void) => mutateSel<ActionEl>(f, false);
  const row = (label: string, key: "count" | "len" | "gap" | "weight" | "jitter", min: number, max: number, step: number, title?: string) => (
    <Fld label={label}>
      <Slider min={min} max={max} step={step} value={a[key]} title={title}
        onChange={(e) => live((x) => { x[key] = +e.target.value; })} onCommit={() => commit()} />
    </Fld>
  );
  const spread = a.spread ?? 360;
  return (
    <>
      <Fld label="Style">
        <select value={a.style} onChange={(e) => mutateSel<ActionEl>((x) => { x.style = e.target.value as ActionEl["style"]; })}>
          <option value="burst">Burst — out from the object</option>
          <option value="focus">Focus — in from the edges</option>
        </select>
      </Fld>
      {row("Lines", "count", 6, 160, 1, "How many strokes")}
      {a.style === "burst" && row("Length", "len", 0.1, 2.5, 0.05, "How far the strokes reach, relative to the object")}
      {row("Gap", "gap", 0, 0.6, 0.01, "Breathing room between the object and the strokes")}
      {row("Weight", "weight", 0.01, 0.25, 0.005, "Thickness of the strokes at their base")}
      {row("Jitter", "jitter", 0, 1, 0.05, "Hand-drawn unevenness in angle, length and weight")}
      <Fld label="Spread">
        <Slider min={20} max={360} step={5} value={spread} title="How much of the way round the strokes go — 360 is all the way"
          onChange={(e) => live((x) => { x.spread = +e.target.value; })} onCommit={() => commit()} />
      </Fld>
      {spread < 360 && (
        <Fld label="Direction">
          <Slider min={0} max={359} step={1} value={a.dir ?? 90} title="Which way the fan points (0 = right, 90 = down, 180 = left, 270 = up)"
            onChange={(e) => live((x) => { x.dir = +e.target.value; })} onCommit={() => commit()} />
        </Fld>
      )}
      <Fld label="Ink">
        <input type="color" value={a.color} onChange={(e) => mutateSel<ActionEl>((x) => { x.color = e.target.value; })} />
      </Fld>
      <div className="btnRow">
        <button title="Re-roll the hand jitter for a different set of strokes"
          onClick={() => mutateSel<ActionEl>((x) => { x.seed = Math.floor(Math.random() * 1e9) + 1; })}>Shuffle</button>
        <button title="Draw a loop over the lines you don't want — they're removed. Loop again for more; Esc when done."
          onClick={() => ed.startTrimUp()}>Trim up…</button>
        {!!a.cuts?.length && (
          <button title="Bring back every trimmed line"
            onClick={() => mutateSel<ActionEl>((x) => { x.cuts = undefined; })}>Restore all</button>
        )}
      </div>
      {!compact && <div className="tips">Drag the box handles to grow the burst; the lines scale with it. Spread and Direction turn the ring into a fan; Trim up removes the strokes you loop.</div>}
    </>
  );
}
