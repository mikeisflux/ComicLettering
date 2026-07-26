/* Smart contextual tips — short craft pointers that surface when the user
   first does something the tip applies to. Content is original guidance
   distilled from docs/lettering-knowledgebase.md. Each tip shows once
   (tracked in localStorage) and the whole system can be toggled off. */

export interface SmartTip { id: string; title: string; text: string }

export interface TipContext {
  selType: "balloon" | "text" | "panel" | "image" | null;
  selHasTail: boolean;
  selJoined: boolean;       // selected balloon is part of a joined pair
  selIsSfx: boolean;        // text element styled as display lettering
  selHasText: boolean;
  editing: boolean;
  exportOpen: boolean;
  balloonCount: number;     // balloons on the current page
}

const TIPS: { tip: SmartTip; when: (c: TipContext) => boolean }[] = [
  {
    tip: {
      id: "tail-aim",
      title: "Aim the tail at the head",
      text: "A tail points at the speaker's head — never the shoulder or feet — and should look like it grows from the balloon's centre. Drag the orange dot to aim it.",
    },
    when: (c) => c.selType === "balloon" && c.selHasTail && !c.editing,
  },
  {
    tip: {
      id: "joined-handles",
      title: "Shaping the connector",
      text: "Drag the connector's middle handle to bend it; the side handles tilt the curve. Push the bubbles together and they melt into one shape — pull them apart to bring the band back.",
    },
    when: (c) => c.selJoined,
  },
  {
    tip: {
      id: "crossbar-i",
      title: "The crossbar I",
      text: "In comics, the barred capital I is only for the pronoun — I, I'm, I'll. Turn on Crossbar “I” in the Inspector and it's applied automatically, never inside words like BIG.",
    },
    when: (c) => c.editing,
  },
  {
    tip: {
      id: "emphasis",
      title: "Emphasis, comic style",
      text: "Stress a word the way an actor would: select it while typing and press Ctrl+B then Ctrl+I. Comic emphasis is bold italic — one word per sentence goes a long way.",
    },
    when: (c) => c.editing,
  },
  {
    tip: {
      id: "balloon-fit",
      title: "Let the balloon hug the text",
      text: "A balloon wants about one letter's width of breathing room all around its text. After typing, use Fit to Text in the Inspector — and Balance Line Breaks (Arrange menu) for an even, oval stack.",
    },
    when: (c) => c.selType === "balloon" && c.selHasText && !c.editing,
  },
  {
    tip: {
      id: "reading-order",
      title: "Reading order is law",
      text: "Readers sweep left to right, top to bottom inside every panel. The first speaker's balloon sits higher or further left than the reply — never make the eye backtrack.",
    },
    when: (c) => c.balloonCount >= 3,
  },
  {
    tip: {
      id: "sfx-energy",
      title: "Give SFX some energy",
      text: "Sound effects shouldn't sit flat like stickers. Warp them along an arc (Inspector → SFX warp), scale letters toward the reader, and pick a color that reads against the art.",
    },
    when: (c) => c.selIsSfx,
  },
  {
    tip: {
      id: "print-safe",
      title: "Print-safe lettering",
      text: "Anything outside the trim can be cut in print. Keep balloons inside the safe area (View → Show Safe Area) and export PDFs with crop marks when your printer asks for bleed.",
    },
    when: (c) => c.exportOpen,
  },
];

/* First unseen tip whose trigger matches the current context. */
export function pickTip(c: TipContext, seen: Set<string>): SmartTip | null {
  for (const { tip, when } of TIPS) {
    if (!seen.has(tip.id) && when(c)) return tip;
  }
  return null;
}
