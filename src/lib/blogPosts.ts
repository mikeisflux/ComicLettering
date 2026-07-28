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
  {
    slug: "balloon-tails-done-right",
    title: "Balloon Tails Done Right: The Small Detail That Makes or Breaks a Page",
    description:
      "Tails are the most-fumbled element in amateur lettering. Learn where they aim, where they emanate from, how they taper, and why consistency matters more than style.",
    date: "2026-07-26",
    minutes: 7,
    blocks: [
      { p: "Ask a professional letterer to spot amateur work in three seconds and they won't look at the fonts — they'll look at the tails. Tails are tiny, they're everywhere, and every one of them is a chance to get four things wrong: where it points, where it comes from, how it tapers, and whether it matches its neighbors. Get those four right and your balloons instantly look like they belong on the page." },
      { h: "Aim at the head" },
      { p: "A tail has exactly one job: identifying the speaker without a moment's doubt. That means it aims at the speaker's head — the face, the mouth area — never the shoulder, the chest, or the feet. Readers subconsciously trace the tail's line, and if that line lands on a torso in a crowded panel, they'll attribute the dialogue to whoever's head is nearest the endpoint, which may not be who you meant." },
      { p: "The tail doesn't need to touch the speaker. Extending roughly two-thirds of the distance from balloon to head is plenty; the reader's eye completes the line. Go closer only when you need to single one speaker out of a tight group. The same aiming rule applies to thought balloons — the chain of shrinking circles arcs toward the thinker's head, not their body." },
      { ul: [
        "One quirky exception worth knowing: reflections don't speak. If a character appears only in a mirror, aim the tail at the actual person (or use an off-panel tail) — unless the mirror itself is genuinely talking.",
        "Off-panel speakers get a tail run toward the panel border nearest to where they'd be, trimmed cleanly at the edge.",
        "Speech from inside or behind an object — a car, a door, a helmet — ends the tail in a small starburst against the surface, a device letterers call a squink.",
      ] },
      { h: "Emanate from the center" },
      { p: "Here's the rule that separates people who've studied lettering from people who haven't: whatever its direction, length, or curve, a tail must appear to emanate from the balloon's center. Extend the tail's two edges backward in your mind — they should converge somewhere near the middle of the balloon. A tail glued onto the rim at a sideways angle looks broken immediately, even to readers who couldn't tell you why." },
      { p: "This is why dragging a tail around a balloon in LetterMyComic re-anchors it as it moves: the geometry keeps pointing through the center no matter where the tail exits. If you're drawing tails by hand, check every one by extending its lines inward before you move on." },
      { h: "Taper, don't stab" },
      { p: "A good tail starts wide where it meets the balloon and tapers steadily to its tip. The base width has a classic rule of thumb: about as wide as the capital O of your dialogue font — and that width stays constant whether the balloon is huge or tiny, whether the tail is short or long. What you must avoid is the needle: a tail so thin it collapses into a single hairline. Needle tails vanish against inked artwork, and a tail the reader can't see is a tail that isn't doing its job." },
      { p: "Curved or straight is a real choice, not a coin flip. Curved tails read as human and conversational; straight tails carry urgency and suit shouts or tight spaces. Both are correct — but a page that mixes them at random, or mixes fat tails with skinny ones, telegraphs inexperience faster than any other single mistake." },
      { h: "Never cross, never graze" },
      { p: "Two tails must never cross — not literally, not even by implication. If the art placed your speakers in the wrong order for the dialogue, that's a layout puzzle, not a license to cross: cascade the balloons vertically in speaking order, tuck a balloon between the speakers, or stagger the stack. There is almost always an in-panel solution. And watch for tangents: a tail tip that just barely kisses an inked line in the art creates a visual buzz. Clearly overlap the line or clearly stay off it — never almost-touch." },
      { h: "Consistency is the style" },
      { p: "Pick your tail vocabulary per project — base width, taper, curve character, how electric tails zigzag, how thought trails shrink — and then hold it for the whole book. Readers never consciously admire consistent tails, and that's the point: the moment tails vary arbitrarily, lettering stops being invisible and starts being noise. Nail the four fundamentals on every balloon and your pages will read like they were lettered by someone who's done it a thousand times. Because visually, they will have been." },
    ],
  },
  {
    slug: "stacking-dialogue-and-balloon-shapes",
    title: "Stacking Dialogue: How Line Breaks Shape Great Word Balloons",
    description:
      "The balloon is only as good as the text stack inside it. Learn the ovoid stack, how to hunt orphans and widows, and why negative space is the real judge of your line breaks.",
    date: "2026-07-26",
    minutes: 7,
    blocks: [
      { p: "New letterers obsess over balloon shapes. Veterans obsess over what's inside them — because the silhouette of your stacked dialogue lines is the foundation the balloon gets built on. Get the stack right and the balloon almost draws itself; get it wrong and no amount of outline-fiddling will save it. This is why professionals finalize every line break on a page before drawing a single balloon." },
      { h: "The ovoid stack" },
      { p: "A floating speech balloon is an oval, so the text inside should stack like one: a shorter top line, the longest lines through the middle, a shorter bottom line. Aim to park the longest words mid-stack where the oval is widest. When a balloon will butt flat against a panel border, the target changes: the top lines run wide, then the stack sweeps back in toward the bottom, echoing the flat-topped shape. Captions flip the logic entirely — they want the most rectangular block you can manage, with minimal ragged line ends." },
      { ul: [
        "Round balloon: short, long, longest, long, short — a gentle diamond of text.",
        "Butted balloon: wide at the flat top, tapering toward the bottom.",
        "Caption box: even, block-like lines. (The exact stack that's wrong inside an oval.)",
      ] },
      { h: "Orphans, widows, and the three-letter rule" },
      { p: "Comics letterers borrowed the words orphan and widow from typesetting and gave them their own meaning: a lone short word stranded on the top line of a stack (orphan) or on the bottom (widow). A stranded 'A' or 'SO' floating above three full lines creates a lopsided pocket of emptiness that drags the eye. The working rule: if the lone word is three letters or fewer, rebreak the lines to absorb it. Four letters or more can usually stand. And sometimes you leave the offense alone — when the dialogue is too short to rebalance, or when fixing it would force an uglier balloon than the orphan ever was." },
      { h: "Negative space is the judge" },
      { p: "How do you know a stack is right? Don't stare at the words — stare at the emptiness around them. The gap between the text block and the balloon wall should feel even all the way around; the classic yardstick is that you could fit one capital letter of your dialogue font anywhere in that channel. If the space pools in one corner and pinches in another, the problem is almost never the balloon. It's the breaks. Rebreak, reshape, and the balloon relaxes around the text naturally." },
      { p: "Two practical notes. First, style your bold-italic emphasis before you finalize breaks — bolded words are wider, and adding emphasis after the fact can push a balanced line over the edge. Second, know the honest limits of squeezing: condensing a single stubborn line to about 94% of its width is invisible; beyond that, readers start to sense the text is being crushed. Squeeze per line, never a whole balloon." },
      { h: "To hyphenate or not" },
      { p: "Hand letterers of earlier eras hyphenated constantly; digital lettering has mostly abandoned it, and some publishers ban it outright. A sane middle path: never hyphenate when a decent ovoid stack is achievable without it — but when the only alternative is torturing your line breaks, and the word splits cleanly and unambiguously, take the hyphen. What should never happen is automatic hyphenation. A hyphen is an editorial decision, and software shouldn't be making it for you mid-balloon." },
      { h: "Many right answers" },
      { p: "Here's the liberating part: most sentences have several acceptable stacks. The same line can break into a tall narrow stack for a slim gap between two characters, or a wide shallow one for the strip of sky above them. Professional lettering isn't about finding the one true break — it's about generating options fast and picking the one that best fits the negative space the artist left you. Tools that rebalance rag automatically get you a strong first candidate in one click; your eye, judging the stack's silhouette and the space around it, makes the final call." },
      { p: "Practice this deliberately: take one page of dialogue and stack every balloon three different ways, then squint at each version until the words dissolve and only the silhouettes remain. You'll quickly develop the reflex that makes veterans fast — seeing the stack's shape before the balloon exists, and knowing which shape the panel is asking for." },
    ],
  },
  {
    slug: "captions-that-read-instantly",
    title: "Captions That Read Instantly: Types, Quote Rules, and Color-Coding",
    description:
      "Voice-over, inner monologue, place-and-time, narrator, editorial — five caption jobs that must never be confused. Here are the conventions that keep them sorted at a glance.",
    date: "2026-07-26",
    minutes: 7,
    blocks: [
      { p: "A caption is a box of text with no tail — which means the reader gets no pointer telling them whose voice it is or what kind of information it carries. Everything a tail would have communicated has to come from the caption's design and grammar instead. That's the entire craft of captions: making each kind identifiable in a quarter of a second, before the reader has processed a single word." },
      { h: "The five jobs a caption does" },
      { ul: [
        "Voice-over (spoken): a character we can hear but who is genuinely elsewhere — not just off-camera. Carried by quotation marks.",
        "Internal monologue: private thoughts, the modern successor to the thought balloon. No quotes, usually italic.",
        "Place and time: 'The docks. Tuesday.' — a scene-change signpost, often free-floating styled text with no box at all.",
        "Omniscient narrator: the disembodied storyteller's voice, boxed and set apart from every character's captions.",
        "Editorial: the asterisked aside pointing back to an earlier issue — the editor's voice, small and plain.",
      ] },
      { h: "The voice-over quote rules" },
      { p: "Spoken captions follow a quotation system that trips up almost everyone at first. Every spoken caption opens with double quotes. A lone caption closes with them too. But when one speaker runs across a series of captions uninterrupted, only the final caption in the run gets closing quotes — the intermediate ones just open and stop. Closing quotes are a signal that means 'this speaker is done for now,' so they also appear the moment a speaker is interrupted or the voice-over hands off to someone else. And when the scene finally cuts back to the speaker in person, the dialogue returns to balloons. One typographic detail: use real curly quotes, not straight ones — straight quotes are a word-processor artifact, not lettering." },
      { h: "Keeping thoughts and speech apart" },
      { p: "Internal monologue captions never take quotation marks — that absence is exactly what distinguishes a private thought from an overheard voice. Most letterers reinforce the difference with italics, and many add a third differentiator by left-aligning monologue while keeping spoken captions centered. Stack up small distinctions like this and the reader sorts the two instantly without ever being told the system exists." },
      { h: "Color is the fastest identifier" },
      { p: "When several characters narrate, color-coding is the cheapest, clearest way to tag ownership: tint each character's caption boxes with a palette drawn from their costume or signature look. A pale wash of the character's color, or a dark box with contrasting text, both work; some mainstream books go further and drop a simplified emblem into the box corner. Two cautions. First, make sure narrator and editorial captions can't be mistaken for any character's scheme. Second, design for frequency — an ornate box treatment that looks gorgeous once becomes a production burden when issue twelve opens with three pages of that character's monologue. Simple systems survive a series; elaborate ones get abandoned." },
      { h: "Place-and-time captions: the free spirits" },
      { p: "Locator captions have drifted out of their boxes in modern books — free-floating styled text is now common, and the styling itself is wide open. A typewriter face for crime noir, weathered plank lettering for a western, crisp pixel text for a cyber scene: the treatment can carry as much scene-setting as the words. The only real rules are legibility and consistency — decide the treatment once, write it into your series style guide, and use it every time, because readers learn your signposts and rely on them." },
      { h: "Mechanics that keep captions clean" },
      { p: "Break caption text into the most rectangular block you can — captions want even lines, not the diamond stack a balloon wants. Give the text the same interior breathing room you'd give a balloon: roughly one capital-O of clearance between text and box edge on all sides. Keep box outlines consistent with your balloon strokes so the page reads as one system. Editorial captions run smaller — around three-quarters of dialogue size — italicized, tucked at the bottom of the panel or page where they inform without intruding." },
      { p: "Captions reward system-building more than any other lettering element. Design the full set once — quotes, italics, alignment, colors, the locator treatment — and write it down where you'll actually consult it. Every page after that letters itself a little faster, every issue stays consistent with the last, and the reader sorts every voice on the page without a moment's conscious thought. That instant, invisible sorting is the whole job." },
    ],
  },
  {
    slug: "sound-effects-that-dont-look-like-stickers",
    title: "Sound Effects That Don't Look Like Stickers",
    description:
      "The worst SFX crime is type floating over the art like a decal. Learn to aim the energy, choose colors that read, escalate repeats, and tuck effects behind the artwork.",
    date: "2026-07-26",
    minutes: 7,
    blocks: [
      { p: "Every letterer knows the failure mode: a perfectly nice display font, typed flat and horizontal, hovering over the artwork like a sticker slapped on a fridge. It says the right word. It even looks bold. And it's dead on arrival, because it has no relationship to the drawing underneath it. Sound effects earn their place on the page by behaving like part of the scene — and that comes down to a handful of learnable habits." },
      { h: "Find the energy and obey it" },
      { p: "Before you place a single letter, answer two questions: where does this sound originate, and which direction does its energy travel? An explosion pushes outward from an epicenter — so the letters should radiate, tilt, and scale away from that point. A car roaring toward the reader gets letters that grow along its path. A siren swells and fades, so its letters rise and fall in a wave. Once the energy direction is chosen, every decision — arc, shear, per-letter scaling, perspective — follows from it. A flat horizontal SFX 'gets the job done' the way a sticker does; in display lettering, boring is a worse sin than ugly." },
      { p: "Typing a word in a heavy font is not a design — it's a starting point. The energy comes from working the letterforms: scale each letter a little differently, shear them into the direction of motion, let a few overlap, stretch a leg or sharpen a terminal. Warp tools that bend a whole word along an arc are useful in moderation, but a little goes a long way — over-warped SFX look tortured rather than loud." },
      { h: "Color that survives any background" },
      { p: "There's a reason comics are full of yellow sound effects: letterers traditionally work over black-and-white inks before the colorist finishes, and yellow reads against almost anything. When you do know the palette, sample from it — an SFX colored with hues pulled from the panel belongs to the scene automatically. Then give the letters an outline contour so they stay legible crossing inked lines, and remember the escalation trick for energy sounds: stack two or three contours moving light-to-dark from the core outward — a pale heart, a warm middle, a hot rim — and the word reads as fire or voltage without a single special effect." },
      { h: "Repeats escalate, never clone" },
      { p: "A ringing phone, dripping water, footsteps in a stairwell: repeated sounds are where sticker-thinking really shows, because the lazy path is copy-paste. Identical clones read as wallpaper. Instead, vary each instance a little — nudge the letterforms, rotate a few degrees, resize — and if the sound is building, let the size grow across successive panels so the reader hears it getting closer. Repetition with variation is rhythm; repetition without it is a pattern swatch." },
      { h: "Tuck it behind the art" },
      { p: "The single most convincing integration move is partially hiding the SFX behind something drawn. Slide the bottom of a KROOOM behind the skyline, let a character's arm cross in front of the lettering, sink half a splash effect behind the wave. The moment art overlaps type, the type stops floating — it acquires a position in the scene's depth. The craft caveat: the boundary matters. Trace the art's inked edge precisely where the lettering disappears behind it; a sloppy edge breaks the illusion you just built. In detail-packed panels, consider hollow SFX — outline-only letters with transparent interiors — so a big sound can sit over busy art without erasing it." },
      { h: "Restraint, consistency, punctuation" },
      { p: "SFX styling is a series-level decision. Choose your approach — brush-drawn and organic for painterly art, hard and geometric for slick sci-fi — and keep it consistent; one lone calligraphic effect in a book of clean strokes looks like a visitor. Size honestly: a mouse's squeak should not shout louder than a building collapse, and background sounds behind a conversation should be present without competing with the dialogue. As for exclamation points, letterers genuinely disagree — one camp says a noise isn't a sentence and the design alone should carry the intensity, the other keeps the script's punctuation. Either position is defensible; flip-flopping isn't. Pick one, and never stack multiple exclamation points either way." },
      { p: "The test at the end is simple: squint at the page. If the sound effect reads as something happening in the panel, you've done it. If it reads as something stuck onto the panel, find the energy and start again." },
    ],
  },
  {
    slug: "preparing-comic-pages-for-print",
    title: "Preparing Comic Pages for Print: Bleed, Trim, Overprint, and Clean Files",
    description:
      "Print is unforgiving of lettering mistakes that screens hide. A practical walkthrough of page geometry, black-ink discipline, resolution rules, and what files to deliver.",
    date: "2026-07-26",
    minutes: 8,
    blocks: [
      { p: "Everything about your lettering can be perfect on screen and still fail on paper. Print introduces physical realities — cutting blades that wander, ink plates that shift a hair out of alignment, resolution that can't be faked — and the conventions of print prep exist to absorb those realities before they reach the reader. Here's what a letterer needs to know, whether you're sending files to a publisher or straight to a print-on-demand service." },
      { h: "The three rectangles: bleed, trim, safe" },
      { p: "Every print-ready comic page is governed by three nested rectangles. The trim line is where the blade is supposed to cut. The bleed extends beyond it — for a standard US comic, an extra eighth of an inch on each side — and exists because blades never cut with perfect precision; art must run past the trim so a slightly-off cut never leaves a white sliver at the edge. The safe area sits well inside the trim, and it's the letterer's home turf: every balloon, caption, and sound effect you care about stays inside it, guaranteed to survive the worst-case cut." },
      { ul: [
        "US standard full bleed: 6.88 × 10.5 inches — the size you set up your page at.",
        "Trim: 6.63 × 10.25 inches — the intended final page size, an eighth of an inch inside every edge.",
        "Safe area: 6.13 × 9.75 inches — a further quarter inch in; all lettering lives here.",
        "Facing-page spreads bleed on the top, bottom, and outer edges only — never into the fold between pages.",
      ] },
      { h: "Black ink discipline: K:100 and overprint" },
      { p: "Print color is CMYK — four separate ink plates laid onto the page in sequence. For lettering, that mechanism dictates two iron rules. First, all everyday lettering black is flat 100% black (C0 M0 Y0 K100), never a 'rich black' mixed from all four inks: text and thin strokes built from four plates blur the instant registration drifts. Second, set that pure black to overprint, meaning it prints on top of the colors beneath instead of knocking a white hole out of them. If the plates shift slightly — and on a fast press they will — overprinted black lettering still sits clean on the art, with no pale halo tracing every letter." },
      { p: "The corollary matters just as much: only black overprints. A bright color set to overprint mixes with whatever's underneath and turns muddy; white set to overprint disappears completely, because white in print is the absence of ink. Auditing overprint settings on every finished page — black on, everything else off — is one of the least glamorous and most professional habits in lettering." },
      { h: "Resolution: real pixels only" },
      { p: "Print-resolution comic art runs 400 to 600 pixels per inch at final size; 300 is the accepted floor for clean results. The rule that saves beginners real grief: you can scale art down, but you can never scale it up. Upscaling invents pixels without adding detail — a low-resolution page enlarged to print size is still a low-resolution page, just bigger and blurrier. If the art you've been handed is too small, the fix is requesting proper files, not resampling. Lettering has an advantage here worth protecting: balloons and type built as vectors are resolution-independent and stay razor sharp at any size. Keep them vector as long as your pipeline allows, and when you must rasterize, match the art's resolution and use lossless compression." },
      { h: "What files to deliver" },
      { p: "Ask one question before lettering a single page: does the client want finished pages, or lettering-only files? Publishers with production departments usually want the latter — your balloons, captions, and SFX on a transparent background, which their team composites over the high-resolution art. Two hygiene rules govern those files. Convert all text to outlines (or flatten it) before delivery: font files are licensed to you, not to everyone downstream, and shipping live fonts both violates most licenses and invites someone else to edit your credited work. And never save the outlined version over your working file — corrections are coming, and outlined text can't be edited." },
      { p: "One more question worth asking early: will the book be translated? Flattened pages are hostile to translation — the next letterer has to manually paint your lettering out of every balloon. Lettering kept on its own layer or delivered as separate files makes a foreign edition a drop-in job, and editors remember letterers who think that far ahead." },
      { h: "The pre-flight checklist" },
      { ul: [
        "All lettering inside the safe area; deliberate bleed elements run fully past the bleed line.",
        "Blacks are flat K:100 and overprinting; no colors or whites overprint.",
        "Resolution at or above 300 ppi at final size — never upscaled.",
        "Text outlined in deliverables; live working files archived separately.",
        "Proof exported and actually opened — check edges, overprints, and one page at 100% zoom before you hit send.",
      ] },
      { p: "None of this is creative work, and that's the point: print prep is the part of the craft that protects the creative work. Build the checklist into your routine and the printed book will look exactly like the page you lettered." },
    ],
  },
];

export const getPost = (slug: string) => BLOG_POSTS.find((p) => p.slug === slug) || null;
