/* Comic-script parser: turns a pasted script into balloon/caption/SFX items
   with page + panel structure. It understands the shapes real scripts take:

     PAGE ONE / PAGE 3 - SPLASH / PAGES 19-20      page headers (digits or words)
     PANEL 2 / Panel 4 (inset) / 3.               panel headers
     JANE: We shouldn't be here.                   inline dialogue
     JANE (whispering): Too late.                  parenthetical cue
     JANE                                          screenplay style — speaker,
     (thought)                                     optional cue line,
     He's lying.                                   dialogue on the next line(s)
     1. JANE: ...  /  JANE (2): ...                numbered balloons
     CAPTION: Later…  /  CAP: / NARRATION: / TITLE: caption boxes
     SFX: KRAKKA-THOOM  /  FX:  /  KRAKOOM!        sound effects (bare caps
                                                   onomatopoeia lines too)
     JANE (CONT'D): / (LINK) / (LINKED)            joins to the previous balloon
     JANE (OFF): / (O.P.) / (OFF PANEL)            off-panel speech

   Kinds map straight onto BalloonKind (plus "sfx" for lettering). Prose
   panel descriptions are skipped; a bare line continues the previous
   balloon only when it follows it directly (no blank line between). */
import type { BalloonKind } from "./model";

export type ScriptKind = Exclude<BalloonKind, "custom" | "square" | "tv" | "extend" | "rounded"> | "sfx";

export interface ScriptItem {
  kind: ScriptKind;
  text: string;
  speaker: string;
  /* the PAGE the line was written under, and the PANEL within it. Page
     numbers are the script's own — a script that opens on PAGE 5 keeps
     that — so gaps and repeats survive to the caller. */
  page: number;
  panel: number;
  /* explicit (CONT'D)/(LINK): join onto the previous balloon in the panel */
  link?: boolean;
  /* (OFF)/(O.P.): the speaker is off-panel */
  off?: boolean;
}

const WORD_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
};
const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const t = s.trim().toLowerCase().replace(/-/g, " ");
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  const parts = t.split(/\s+/);
  let v = 0;
  for (const p of parts) { if (!(p in WORD_NUM)) return null; v += WORD_NUM[p]; }
  return v || null;
};

const NUMBER_WORDS = "one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty(?:[ -](?:one|two|three|four|five|six|seven|eight|nine))?|thirty|forty";
const pageRx = new RegExp(`^PA?GE?S?\\.?\\s*#?\\s*(\\d+|${NUMBER_WORDS})\\b`, "i");
const panelRx = new RegExp(`^(?:PANELS?|PNL|FRAME)\\.?\\s*#?\\s*(\\d+|${NUMBER_WORDS})?\\b`, "i");
/* "3." alone on a line is a panel number in a lot of scripts */
const barePanelRx = /^(\d{1,2})[.)]$/;
const transitionRx = /^(SCENE|INT\b|EXT\b|CUT TO|FADE (IN|OUT|TO)|SMASH CUT|MATCH CUT|SPLASH\b|DOUBLE[- ]PAGE|SPREAD\b|TITLE PAGE|THE END\b|END\b|CREDITS|TO BE CONTINUED|NO (DIALOGUE|COPY|BALLOONS?)|SILENT)\b/i;
/* ALL-CAPS panel description openers that would otherwise pass for a
   screenplay-style speaker line */
const shotRx = /^(ESTABLISHING|CLOSE|WIDE|MEDIUM|LONG|TWO|EXTREME|HIGH|LOW|OVERHEAD|BIRD'?S|WORM'?S|REVERSE|ANGLE|INSERT|SHOT|CU\b|ECU\b|POV\b|SAME\b|LATER\b|CONTINUOUS|MEANWHILE|MOMENTS LATER|INTERIOR|EXTERIOR|DAY\b|NIGHT\b|DAWN\b|DUSK\b|FLASHBACK|DREAM|BIG PANEL|FULL PAGE|INSET|BACKGROUND|FOREGROUND|BG|FG)\b/i;
/* a shot/transition line is ALL CAPS and either several words or ends in
   punctuation — so a lone name (DAWN, TWO-FACE) stays a speaker, and
   "Later that night…" dialogue is never mistaken for a header */
const isShotLine = (line: string) => {
  if (!(transitionRx.test(line) || shotRx.test(line))) return false;
  if (line !== line.toUpperCase()) return false;
  const words = line.split(/\s+/).length;
  return words >= 2 || /[.:\-—]$/.test(line);
};
/* a stage direction on its own line — "(no balloons)", "(beat)" */
const asideRx = /^\(.*\)$/;
/* CHARACTER (cue): dialogue — speaker may carry a leading balloon number */
const lineRx = /^\s*(?:\d{1,3}[.)]?\s+)?((?:[A-Z0-9 .,'’&\-/]{1,28}?|[A-Z][a-z'’]+(?: [A-Z][a-z'’]+){0,2}))\s*(?:\((\d{1,3})\))?\s*(?:\(([^)]*)\))?\s*(?:\((\d{1,3})\))?\s*:\s*(.*)$/;
/* screenplay style: the speaker alone on a line, dialogue below */
const speakerLineRx = /^\s*(?:\d{1,3}[.)]?\s+)?([A-Z][A-Z0-9 .'’&\-/]{0,27}?)\s*(?:\((\d{1,3})\))?\s*(?:\(([^)]*)\))?\s*:?\s*$/;
const SFX_SPEAKER = /^(SFX|S\.?F\.?X\.?|SOUND(?: ?FX| EFFECTS?)?|FX|EFX|SND|ONOMATOPOEIA)$/;
const CAPTION_SPEAKER = /^(CAPTION|CAPTIONS|CAP|CAPT|NARRATION|NARR|NARRATOR|BOX|TITLE|TITLES|LOCATION|LOC|TIME|CREDIT|CREDITS|VOICE ?OVER|V\.?O\.?|TEXT BOX)(?:\s*[-/].*)?$/;

/* onomatopoeia on its own line: all caps, short, shouty or stuttery */
function looksLikeSfx(line: string): boolean {
  if (line !== line.toUpperCase()) return false;
  if (!/[A-Z]/.test(line)) return false;
  const words = line.split(/\s+/);
  if (words.length > 5) return false;
  if (/!/.test(line)) return true;
  if (/([A-Z])\1{2,}/.test(line)) return true;            // KRAAAK, BOOOM
  if (/[A-Z]{2,}-[A-Z]{2,}/.test(line)) return true;        // KRAKKA-THOOM
  if (/^[A-Z]{2,}[*#@%$]+$/.test(line)) return true;         // #$@%!
  return false;
}

/* the parenthetical / speaker cue → balloon kind (+ flags) */
function resolveKind(speaker: string, cue: string, text: string): { kind: ScriptKind; link: boolean; off: boolean; text: string } {
  const c = cue.toLowerCase();
  let kind: ScriptKind = "speech";
  let link = /\b(link(ed)?|cont'?d|continued|continuing|cont)\b/.test(c);
  let off = /\b(off|o\.?p\.?|o\.?s\.?|off[- ]?panel|off[- ]?screen|from off)\b/.test(c);
  let body = text;

  /* an inline cue at the START of the dialogue — "(thinking) He's lying." */
  const inline = body.match(/^\(([^)]{1,40})\)\s*(.*)$/);
  if (inline) {
    const ic = inline[1].toLowerCase();
    if (/thought|think|internal|inner|whisper|quiet|soft|small|mutter|shout|yell|scream|loud|burst|radio|phone|electronic|tv\b|weak|sick|link|cont|off|o\.p\./.test(ic)) {
      body = inline[2];
      return resolveKind(speaker, (cue ? cue + " " : "") + inline[1], body);
    }
  }

  if (SFX_SPEAKER.test(speaker) || /\b(sfx|sound ?fx|sound effect)\b/.test(c)) kind = "sfx";
  else if (CAPTION_SPEAKER.test(speaker) || /\b(caption|cap|narration|narrat|v\.?o\.?|voice ?over|box|title)\b/.test(c)) kind = "caption";
  else if (/\b(thought|thinks?|thinking|internal|inner|to (him|her|them)self)\b/.test(c)) kind = "thought";
  else if (/\b(whisper(s|ing|ed)?|quiet(ly)?|soft(ly)?|small|mutter(s|ing|ed)?|hush(ed)?|under (his|her|their) breath|low|sotto)\b/.test(c)) kind = "whisper";
  else if (/\b(electronic|radio|phone|telephone|television|tv|speaker|intercom|comms?|static|broadcast|transmission|robot(ic)?|computer|filtered|p\.a\.|pa)\b/.test(c)) kind = "double";
  else if (/\b(burst|roar(s|ing)?|bellow(s|ing)?|shriek(s|ing)?|scream(s|ing)?|yell(s|ing)?|shout(s|ing)?|loud(ly)?|angry|furious|big|huge|explosive)\b/.test(c)) kind = "shout";
  else if (/\b(weak(ly)?|sick|dying|shaky|scared|nervous(ly)?|trembling|frightened|terrified|strained|pained)\b/.test(c)) kind = "rough";
  else if (/\b(buzz(ing)?|electric|vibrat(e|es|ing)|jagged|distort(ed)?)\b/.test(c)) kind = "buzz";

  /* text cues when the writer didn't use a parenthetical */
  if (kind === "speech") {
    if (/!{2,}/.test(body)) kind = "shout";
  }
  return { kind, link, off, text: body };
}

function cleanSpeaker(raw: string): string {
  return raw.replace(/^\d{1,3}[.)]?\s+/, "").replace(/\s+/g, " ").trim().toUpperCase();
}

export function parseScript(src: string): ScriptItem[] {
  const items: ScriptItem[] = [];
  const lines = src.split(/\r?\n/).map((l) => l.replace(/\t/g, " ").trim());
  let page = 1, panel = 1, seenPage = false;
  /* screenplay-style state: a speaker line waiting for its dialogue */
  let pending: { speaker: string; cue: string } | null = null;
  /* the last line produced or extended an item and no blank line has
     passed since — only then does a bare line continue the balloon */
  let continuing = false;

  const nextNonBlank = (i: number) => { for (let j = i + 1; j < lines.length; j++) if (lines[j]) return lines[j]; return ""; };
  const isHeader = (line: string) => pageRx.test(line) || panelRx.test(line) || barePanelRx.test(line) || isShotLine(line);

  const push = (speaker: string, cue: string, rawText: string) => {
    const r = resolveKind(speaker, cue, rawText.trim());
    if (!r.text) return;
    items.push({ kind: r.kind, text: r.text, speaker, page: seenPage ? page : 1, panel,
      ...(r.link ? { link: true } : {}), ...(r.off ? { off: true } : {}) });
    continuing = true;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) { continuing = false; if (pending && !pending.speaker) pending = null; continue; }

    /* headers come first — "PANEL 2: Jane walks in." has a colon too */
    const pm = line.match(pageRx);
    if (pm) {
      const n = num(pm[1]); if (n != null) { page = n; panel = 1; seenPage = true; }
      pending = null; continuing = false; continue;
    }
    const nm = line.match(panelRx);
    if (nm) {
      const n = num(nm[1]); panel = n != null ? n : panel + 1;
      pending = null; continuing = false; continue;
    }
    const bp = line.match(barePanelRx);
    if (bp) { panel = parseInt(bp[1], 10); pending = null; continuing = false; continue; }
    if (isShotLine(line)) { pending = null; continuing = false; continue; }
    if (asideRx.test(line) && !pending) { continuing = false; continue; }

    /* dialogue waiting for a screenplay-style speaker */
    if (pending) {
      const cueLine = line.match(/^\(([^)]*)\)$/);
      if (cueLine) { pending.cue = (pending.cue ? pending.cue + " " : "") + cueLine[1]; continue; }
      /* a header or a fresh "NAME:" line means the pending speaker never
         got any words — drop it rather than eat the next character's line */
      if (isHeader(line) || lineRx.test(line)) { pending = null; i--; continue; }
      push(pending.speaker, pending.cue, line);
      pending = null;
      continue;
    }

    const m = line.match(lineRx);
    if (m) {
      const speaker = cleanSpeaker(m[1]);
      /* "PANEL 2: description" never reaches here (headers above); a
         lone number speaker is a numbering artefact, not a character */
      if (!speaker || /^\d+$/.test(speaker)) { continuing = false; continue; }
      if (!(m[5] || "").trim()) {
        /* "JANE:" alone — the words are on the next line(s) */
        if (!isShotLine(line)) pending = { speaker, cue: m[3] || "" };
        continue;
      }
      push(speaker, m[3] || "", m[5] || "");
      continue;
    }

    /* bare SFX line — KRAKOOM! */
    if (looksLikeSfx(line)) { push("SFX", "", line); continue; }

    /* screenplay-style speaker on its own line, dialogue underneath */
    const sm = line.match(speakerLineRx);
    if (sm) {
      const nxt = nextNonBlank(i);
      if (nxt && !isHeader(nxt) && !lineRx.test(nxt)) {
        pending = { speaker: cleanSpeaker(sm[1]), cue: sm[3] || "" };
        continue;
      }
    }

    /* a bare line directly under a balloon continues it (multi-line
       dialogue); anything else is panel description — skipped */
    if (continuing && items.length) {
      const last = items[items.length - 1];
      if (last.page === (seenPage ? page : 1) && last.panel === panel) { last.text += " " + line; continue; }
    }
    continuing = false;
  }
  return items;
}

/* one-line recap for the import dialog: "3 pages · 8 panels · 12 speech…" */
export function describeScript(items: ScriptItem[]): string {
  if (!items.length) return "";
  const pages = new Set(items.map((i) => i.page)).size;
  const panels = new Set(items.map((i) => `${i.page}/${i.panel}`)).size;
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.kind, (counts.get(it.kind) || 0) + 1);
  const label: Record<string, string> = {
    speech: "speech", thought: "thought", whisper: "whisper", shout: "shout", double: "radio",
    rough: "rough", buzz: "buzz", caption: "caption", sfx: "SFX", burst2: "burst",
  };
  const kinds = [...counts.entries()].sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${n} ${label[k] ?? k}`).join(" · ");
  return `${pages} page${pages > 1 ? "s" : ""} · ${panels} panel${panels > 1 ? "s" : ""} · ${kinds}`;
}
