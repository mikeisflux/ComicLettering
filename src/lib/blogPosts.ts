/* Blog post registry — original tutorial articles on comic-lettering craft.
   Body blocks: h = section heading, p = paragraph, ul = bullet list.
   All articles are original writing on industry-standard techniques. */

export interface PostBlock { h?: string; p?: string; ul?: string[] }
export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;      // ISO
  minutes: number;
  blocks: PostBlock[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "word-balloon-placement-basics",
    title: "Word Balloon Placement: The Rules That Make Pages Read Themselves",
    description:
      "How to place speech balloons so readers glide through your page: reading order, panel flow, breathing room, and the mistakes that break immersion.",
    date: "2026-07-26",
    minutes: 7,
    blocks: [
      { p: "Great lettering is invisible. When balloons are placed well, nobody notices them — the story just flows. When they're placed badly, readers feel lost without knowing why. Placement is the single highest-leverage skill in lettering, and it comes down to a few dependable rules." },
      { h: "Reading order is law" },
      { p: "In Western comics, readers sweep left-to-right, top-to-bottom — inside every panel, not just across the page. The first speaker's balloon must sit higher or further left than the reply. If your art puts the first speaker on the right, you have three honest options: stack the balloons vertically so height carries the order, run a connected balloon pair across the panel, or flag the layout problem before the art is final. Never force readers to read down-then-back-up." },
      { ul: [
        "Balloon 1 sits above or left of balloon 2 — always.",
        "A reply should never sit higher than the line it answers.",
        "When speakers face the 'wrong' way, use stacked or joined balloons to preserve order.",
      ] },
      { h: "Respect the art, but respect the read more" },
      { p: "Cover dead space first: skies, walls, floors, blur. Never cover faces, hands mid-gesture, or the focal action. But when a panel gives you nowhere clean to go, remember the hierarchy: story clarity beats art preservation. A slightly covered background element is a smaller sin than a confusing read." },
      { h: "Give balloons breathing room" },
      { p: "Keep a consistent margin between a balloon and the panel border — cramming a balloon against the edge reads as an accident. Where a balloon must touch a panel edge, let it butt cleanly through rather than hover a few pixels away. Nearly-touching looks like a mistake; decisively touching looks like a choice." },
      { h: "Tails point, they don't stab" },
      { p: "A tail aims at the speaker's head or mouth area — it doesn't need to touch it. Keep tails short and confident. Never cross two tails, and avoid tails that travel across half the panel; move the balloon closer to its speaker instead." },
      { h: "The squint test" },
      { p: "Zoom out until the text is unreadable and look at the page as shapes. The balloons should form a gentle path that leads the eye through each panel in order, panel to panel, toward the page turn. If the path zigzags or doubles back, move balloons — not text — until it flows." },
    ],
  },
  {
    slug: "crossbar-i-and-comic-grammar",
    title: "The Crossbar I, Double Dashes, and Other Comic Lettering Grammar",
    description:
      "Comics have their own typographic grammar. Learn when the crossbar I is correct, how comics handle emphasis, and the punctuation conventions pros never break.",
    date: "2026-07-26",
    minutes: 6,
    blocks: [
      { p: "Comics inherited typewriter habits, hand-lettering traditions, and a few pure inventions. The result is a grammar all its own — and using it correctly is one of the fastest ways to make lettering look professional." },
      { h: "The crossbar I rule" },
      { p: "The capital I with bars top and bottom (the 'crossbar I') is reserved for the personal pronoun — I, I'm, I'll, I've, I'd — and for that use only. Every other capital I, including the I in BIG or IT'S, uses the plain sans-serif stroke. Comic fonts ship both forms precisely so you can follow the rule; software that applies it automatically (as LetterMyComic does) saves you from the most commonly-spotted amateur tell in lettering." },
      { h: "Emphasis: bold italic, used sparingly" },
      { p: "Dialogue emphasis in comics is bold italic on the stressed word — not underlines, not ALL-CAPS-in-caps-text, not color. One emphasized word per sentence is plenty; when everything is stressed, nothing is. Emphasis should land where an actor would punch the line." },
      { h: "Dashes, ellipses, and interruptions" },
      { ul: [
        "A trailing ellipsis (…) means a thought fades or continues into the next balloon.",
        "A double dash (--) means the speech is cut off or interrupted. Comics traditionally use the double hyphen rather than an em dash.",
        "A balloon that continues a sentence from a previous balloon opens with an ellipsis to signal the pickup.",
      ] },
      { h: "Breath pacing with balloon breaks" },
      { p: "Splitting one speech into two or three linked balloons isn't decoration — it's pacing. Each balloon is a breath. Break where the actor would pause, and let the pause carry weight: a beat before the punchline, a hesitation before the confession. If a balloon holds more than two sentences, it almost always reads better split." },
      { h: "Numbers, caps, and the small stuff" },
      { p: "Most comic dialogue is set in all-caps faces, so 'capitalization' lives in the font. Watch the details that still show: spell out small numbers in dialogue, keep punctuation inside the balloon's text block, and never let a line of dialogue end with a lonely orphan word if a line-break rebalance can save it." },
    ],
  },
  {
    slug: "choosing-comic-fonts",
    title: "Choosing Comic Fonts: Dialogue, Display, and When to Break Character",
    description:
      "A practical guide to picking lettering fonts: what makes a good dialogue face, when to reach for display fonts, and how many fonts one book can carry.",
    date: "2026-07-26",
    minutes: 6,
    blocks: [
      { p: "Font choice sets your book's voice before anyone reads a word. The trick is knowing which decisions matter enormously (your dialogue face) and which are seasoning (that one demon-speech display font you use twice)." },
      { h: "The dialogue face carries the book" },
      { p: "Your main dialogue font appears in nearly every panel of every page, so pick for readability first: open letterforms, consistent stroke weight, and a true bold-italic for emphasis. It should feel hand-lettered without being distractingly quirky. Test it at actual print size — a face that charms at 72pt can turn to gravel at 8pt." },
      { h: "One voice, one font" },
      { ul: [
        "Keep a single dialogue face for all ordinary human speech in a book.",
        "Give non-human or altered voices (robots, demons, broadcasts, whispers curling in from off-panel) their own face or styling — that contrast is meaningful because the baseline is consistent.",
        "Captions can share the dialogue face (often italicized) or take a complementary face — but pick once and hold it.",
      ] },
      { h: "Display faces are spice" },
      { p: "Titles, sound effects, signage, and shouts earn display fonts — heavier, rougher, more stylized. Two or three display faces are enough for most books. Every added font is another voice in the room; too many and the book reads like a crowd talking over itself." },
      { h: "Mind the license" },
      { p: "Comic work is commercial work. Use fonts licensed for commercial use — the open-licensed families bundled with your lettering tool, faces you've purchased, or fonts you've commissioned. 'It was free to download' is not a license." },
      { h: "When to break character" },
      { p: "Breaking your own system is a tool: a sudden font change signals possession, broadcast, translation, or something very wrong. Because it's a signal, spend it deliberately — once per effect, established early, used consistently after that." },
    ],
  },
];

export const getPost = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug) || null;
