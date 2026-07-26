/* Lettering style presets — the STYLES panel "ABC" swatches.
   Original preset library in the spirit of classic comic lettering styles:
   glossy two-tone gradient fills, thin outlines, drop shadows, and a font
   matched to each look. outlineF is the outline width as a fraction of the
   font size — kept small so the letterforms stay readable. */
import { TextStyle } from "./model";

export interface LetterStyle {
  name: string;
  font: string;
  fillA: string;
  fillB: string | null;
  outlineC: string;
  outlineF: number;
  shadow: boolean;
  italic?: boolean;
  lower?: boolean;
}

export const LETTER_STYLES: LetterStyle[] = [
  /* --- SFX colourways: each pairs one of the LMC display faces with the
     punchy fill/outline/shadow treatment that genre is normally inked in --- */
  { name: "Buzz Yellow",   font: "lmcfeedback", fillA: "#f5e838", fillB: "#e0c800", outlineC: "#000000", outlineF: 0.038, shadow: true },
  { name: "Bleed Red",     font: "lmcfullbleed",fillA: "#e83030", fillB: "#b81010", outlineC: "#1a0808", outlineF: 0.04,  shadow: true },
  { name: "Gamma Green",   font: "lmcgamma",    fillA: "#e8f5a0", fillB: "#4fa83c", outlineC: "#0f2a14", outlineF: 0.035, shadow: true },
  { name: "Jawbreaker",    font: "lmcglassjaw", fillA: "#f8c58a", fillB: "#e8a060", outlineC: "#000000", outlineF: 0.035, shadow: true },
  { name: "Skrunch White", font: "lmcskrunch",  fillA: "#ffffff", fillB: "#e8e8e8", outlineC: "#d01818", outlineF: 0.04,  shadow: true },
  { name: "Crash Cream",   font: "lmccrashland",fillA: "#fff2c4", fillB: "#f0c020", outlineC: "#5b1a6b", outlineF: 0.03,  shadow: true },
  { name: "Rowdy Orange",  font: "lmcrowdy",    fillA: "#f5a03c", fillB: "#e07818", outlineC: "#000000", outlineF: 0.04,  shadow: true },
  { name: "Deco Gold",     font: "lmcdeco",     fillA: "#f5c542", fillB: "#e0a820", outlineC: "#12385c", outlineF: 0.014, shadow: true },
  { name: "Screech Amber", font: "lmcscreech",  fillA: "#fff0b8", fillB: "#f5a623", outlineC: "#000000", outlineF: 0.038, shadow: true },
  { name: "Gut Flesh",     font: "lmcgutspill", fillA: "#f8b89c", fillB: "#e08060", outlineC: "#000000", outlineF: 0.04,  shadow: true },
  { name: "Booger Green",  font: "lmcblob",     fillA: "#9cec2e", fillB: "#5aab08", outlineC: "#000000", outlineF: 0.035, shadow: true },
  { name: "Deep Freeze",   font: "lmcfrost",    fillA: "#5a7cbc", fillB: "#2d4676", outlineC: "#dce5f2", outlineF: 0.018, shadow: true },
  { name: "Brush Venom",   font: "lmcberserk",  fillA: "#d6f5a0", fillB: "#3f9c46", outlineC: "#0f2a14", outlineF: 0.03,  shadow: true },
  { name: "Rust Saw",      font: "lmcsawtooth", fillA: "#e8d8c8", fillB: "#6b4a38", outlineC: "#3a1e14", outlineF: 0.028, shadow: true },
  { name: "Scorched",      font: "lmccharflame",fillA: "#f8541e", fillB: "#c01800", outlineC: "#000000", outlineF: 0.035, shadow: true },
  { name: "Gold Ordnance", font: "lmcarmory",   fillA: "#ffd21f", fillB: "#e0a400", outlineC: "#000000", outlineF: 0.022, shadow: true },
  { name: "Breach Gold",   font: "lmcbreach",   fillA: "#ffc91a", fillB: "#d99400", outlineC: "#000000", outlineF: 0.024, shadow: true },
  { name: "Boom Yellow",   font: "lmckaboom",   fillA: "#ffec5e", fillB: "#ffd21f", outlineC: "#000000", outlineF: 0.05,  shadow: true },
  { name: "Brawl Teal",    font: "lmcbrawl",    fillA: "#6fdcdc", fillB: "#35b0b0", outlineC: "#000000", outlineF: 0.055, shadow: true },
  { name: "Brimstone Red", font: "lmcbrimstone",fillA: "#ef3b2c", fillB: "#a5150c", outlineC: "#12080a", outlineF: 0.03,  shadow: true },
  { name: "Sky Bold",      font: "lmcbigbold",  fillA: "#eaf3ff", fillB: "#7ba7d8", outlineC: "#14335c", outlineF: 0.06,  shadow: true },
  { name: "Blitz Orange",  font: "lmcblitz",    fillA: "#ff5a2e", fillB: "#e02a00", outlineC: "#000000", outlineF: 0.03,  shadow: true },
  { name: "Impact Red",    font: "lmcslam",     fillA: "#f5432a", fillB: "#c01c08", outlineC: "#000000", outlineF: 0.055, shadow: true },
  { name: "Butcher Pink",  font: "lmcbutcher",  fillA: "#d9548c", fillB: "#a32c5e", outlineC: "#000000", outlineF: 0.032, shadow: true },
  { name: "Splash Blue",   font: "lmcsplash",   fillA: "#ddeeff", fillB: "#7ec4ee", outlineC: "#0d2b45", outlineF: 0.06,  shadow: true },

  /* hot & glossy */
  { name: "Sunburst",     font: "luckiest",    fillA: "#ffd21f", fillB: "#ff7a00", outlineC: "#7a3400", outlineF: 0.035, shadow: true },
  { name: "Tango",        font: "chango",      fillA: "#ff9d3c", fillB: "#e8540a", outlineC: "#7a2600", outlineF: 0.03,  shadow: true },
  { name: "Big Red",      font: "sigmar",      fillA: "#ff4b3a", fillB: "#a80f00", outlineC: "#440b06", outlineF: 0.025, shadow: true },
  { name: "Crimson",      font: "bangers",     fillA: "#e01018", fillB: "#8f0007", outlineC: "#2b0004", outlineF: 0.04,  shadow: true },
  { name: "Blaze",        font: "boogaloo",    fillA: "#ff9d2e", fillB: "#e03000", outlineC: "#7a1400", outlineF: 0.035, shadow: true },
  { name: "Flame Italic", font: "bangers",     fillA: "#ffe14d", fillB: "#ff8a00", outlineC: "#ffffff", outlineF: 0.05,  shadow: true, italic: true },
  { name: "Citrus",       font: "fugaz",       fillA: "#ffe600", fillB: "#ff9000", outlineC: "#a84e00", outlineF: 0.03,  shadow: true },
  { name: "Goldenrod",    font: "paytone",     fillA: "#ffd75e", fillB: "#e8940a", outlineC: "#7a5405", outlineF: 0.035, shadow: true },
  { name: "Amber Slab",   font: "alfa",        fillA: "#ffb84f", fillB: "#e07a10", outlineC: "#7a4005", outlineF: 0.03,  shadow: true },
  { name: "Vermilion",    font: "bungee",      fillA: "#ff6a3a", fillB: "#d42000", outlineC: "#57120a", outlineF: 0.025, shadow: true },
  { name: "Cherry Bold",  font: "lilita",      fillA: "#ff3b30", fillB: "#b80f10", outlineC: "#500608", outlineF: 0.035, shadow: true },
  { name: "Ketchup",      font: "titan",       fillA: "#e01018", fillB: "#a80005", outlineC: "#ffd21f", outlineF: 0.05,  shadow: true },
  { name: "Spice",        font: "spicyrice",   fillA: "#ff9d2e", fillB: "#e05a00", outlineC: "#7a2e00", outlineF: 0.03,  shadow: false },
  { name: "Orange Soda",  font: "chewy",       fillA: "#ffc07a", fillB: "#ff7a2a", outlineC: "#9a4008", outlineF: 0.035, shadow: true },
  /* cool & bright */
  { name: "Sky Pop",      font: "fredoka",     fillA: "#7fd4ff", fillB: "#1a8ae0", outlineC: "#0c4a86", outlineF: 0.035, shadow: true },
  { name: "Bubble Blue",  font: "bubblegum",   fillA: "#8ad4ff", fillB: "#2a8ae8", outlineC: "#ffffff", outlineF: 0.045, shadow: true },
  { name: "Ocean",        font: "racing",      fillA: "#4ad4e8", fillB: "#0f8aae", outlineC: "#06405c", outlineF: 0.03,  shadow: true },
  { name: "Speedster",    font: "fasterone",   fillA: "#4ad4ff", fillB: "#0f6ae0", outlineC: "#06305c", outlineF: 0.02,  shadow: true },
  { name: "Deep Teal",    font: "bowlby",      fillA: "#5ad4c2", fillB: "#0f7a8a", outlineC: "#06353e", outlineF: 0.035, shadow: true },
  { name: "Frostbite",    font: "griffy",      fillA: "#eef6ff", fillB: "#9ac2e8", outlineC: "#4a6a92", outlineF: 0.03,  shadow: true },
  { name: "Midnight",     font: "audiowide",   fillA: "#b9c6ff", fillB: "#3446a0", outlineC: "#0a1030", outlineF: 0.03,  shadow: true },
  /* greens */
  { name: "Lime Bubble",  font: "baloo",       fillA: "#a5e83a", fillB: "#4fae12", outlineC: "#1d5406", outlineF: 0.035, shadow: true },
  { name: "Spring Green", font: "sniglet",     fillA: "#8fe05a", fillB: "#2e9a1a", outlineC: "#0f4a0a", outlineF: 0.035, shadow: false },
  { name: "Slime Drip",   font: "creepster",   fillA: "#b8f04a", fillB: "#4f9a00", outlineC: "#1d4a05", outlineF: 0.03,  shadow: false },
  { name: "Swamp Ooze",   font: "nosifer",     fillA: "#8fe000", fillB: "#3f7a00", outlineC: "#1d3a05", outlineF: 0.02,  shadow: false },
  { name: "Kranky",       font: "kranky",      fillA: "#ffffff", fillB: null,      outlineC: "#2e9a1a", outlineF: 0.04,  shadow: true },
  { name: "Emerald",      font: "carter",      fillA: "#5ad46a", fillB: "#0f7a2a", outlineC: "#063a12", outlineF: 0.035, shadow: true },
  /* purples & pinks */
  { name: "Grape Jam",    font: "shrikhand",   fillA: "#c77dff", fillB: "#7b2fbf", outlineC: "#38105e", outlineF: 0.03,  shadow: true },
  { name: "Royal",        font: "luckiest",    fillA: "#8a4ae0", fillB: "#5a1aa8", outlineC: "#ffd21f", outlineF: 0.045, shadow: true },
  { name: "Lilac Gloss",  font: "chango",      fillA: "#d8b8ff", fillB: "#9a6ae8", outlineC: "#4a2a7a", outlineF: 0.03,  shadow: true },
  { name: "Lavender",     font: "baloo",       fillA: "#d0b0ff", fillB: "#9a6ae0", outlineC: "#4a2a7a", outlineF: 0.03,  shadow: false, lower: true },
  { name: "Witchy",       font: "hennypenny",  fillA: "#c9a0f2", fillB: "#8a4ae0", outlineC: "#3a1a66", outlineF: 0.03,  shadow: true },
  { name: "Bubblegum",    font: "modak",       fillA: "#ff9de0", fillB: "#ff45a4", outlineC: "#ffffff", outlineF: 0.04,  shadow: true },
  { name: "Rose Quartz",  font: "ceviche",     fillA: "#ffe6ee", fillB: "#ffb0cc", outlineC: "#d06a92", outlineF: 0.035, shadow: false, italic: true },
  /* metallic & stone */
  { name: "Silver 3D",    font: "anton",       fillA: "#ffffff", fillB: "#c2c8d2", outlineC: "#7a828e", outlineF: 0.035, shadow: true },
  { name: "Chrome",       font: "archivoblack", fillA: "#f2f6fa", fillB: "#9aa0a8", outlineC: "#555b64", outlineF: 0.03, shadow: true },
  { name: "Honey Gold",   font: "lemon",       fillA: "#ffd75e", fillB: "#c8901a", outlineC: "#6d4a05", outlineF: 0.03,  shadow: true },
  { name: "Garnet",       font: "erica",       fillA: "#d46a6a", fillB: "#7a1620", outlineC: "#3a060c", outlineF: 0.03,  shadow: true },
  { name: "Granite",      font: "blackops",    fillA: "#b0b6be", fillB: "#5c646e", outlineC: "#23282e", outlineF: 0.03,  shadow: true },
  { name: "Stone",        font: "slackey",     fillA: "#e0cfa0", fillB: "#b09364", outlineC: "#6d5a35", outlineF: 0.035, shadow: true },
  { name: "Charcoal",     font: "londrina",    fillA: "#c2c6cc", fillB: "#6a7078", outlineC: "#2e3238", outlineF: 0.035, shadow: true },
  { name: "Sketch",       font: "cabinsketch", fillA: "#e8eaee", fillB: null,      outlineC: "#3a4048", outlineF: 0.02,  shadow: true },
  /* rough, cracked & horror */
  { name: "Cracked Earth", font: "frijole",    fillA: "#d9b98a", fillB: "#a8845a", outlineC: "#5c4526", outlineF: 0.02,  shadow: true },
  { name: "Lava Crack",   font: "eater",       fillA: "#ff5a3a", fillB: "#a80f00", outlineC: "#3d0500", outlineF: 0.02,  shadow: false },
  { name: "Rough Red",    font: "freckle",     fillA: "#d42a1a", fillB: null,      outlineC: "#5c0f08", outlineF: 0.03,  shadow: false },
  { name: "Scarlet Horror", font: "butcherman", fillA: "#d42a1a", fillB: "#7a0f06", outlineC: "#2b0000", outlineF: 0.02, shadow: false },
  { name: "Blood",        font: "nosifer",     fillA: "#c80000", fillB: "#6e0000", outlineC: "#2b0000", outlineF: 0.02,  shadow: false },
  /* script & brush */
  { name: "Red Brush",    font: "knewave",     fillA: "#e02a1a", fillB: null,      outlineC: "#7a0f06", outlineF: 0.02,  shadow: true, italic: true },
  { name: "Parchment",    font: "ceviche",     fillA: "#f2e3c2", fillB: "#d9b98a", outlineC: "#8a6a3a", outlineF: 0.03,  shadow: false, italic: true },
  { name: "Cream Serif",  font: "serif",       fillA: "#f2e8d0", fillB: "#d9c9a0", outlineC: "#8a7a50", outlineF: 0.02,  shadow: false, italic: true },
  { name: "Marker",       font: "marker",      fillA: "#ff6a00", fillB: null,      outlineC: "#000000", outlineF: 0,     shadow: true },
  /* classics */
  { name: "Classic",      font: "bangers",     fillA: "#ffffff", fillB: null,      outlineC: "#111111", outlineF: 0.05,  shadow: true },
  { name: "Hazard",       font: "bangers",     fillA: "#ffe600", fillB: null,      outlineC: "#e00000", outlineF: 0.045, shadow: false },
  { name: "Panic",        font: "luckiest",    fillA: "#ffffff", fillB: "#ffd0d0", outlineC: "#d40000", outlineF: 0.045, shadow: true },
  { name: "Shade Box",    font: "bungeeshade", fillA: "#ff9d2e", fillB: null,      outlineC: "#000000", outlineF: 0,     shadow: false },
  { name: "Outliner",     font: "londrinaoutline", fillA: "#222222", fillB: null,  outlineC: "#000000", outlineF: 0,     shadow: false },
];

/* Apply a preset onto an existing TextStyle (keeps size/align etc.) */
export function applyLetterStyle(ts: TextStyle, s: LetterStyle): TextStyle {
  return {
    ...ts,
    font: s.font,
    fillA: s.fillA,
    fillB: s.fillB,
    outlineC: s.outlineC,
    outlineW: Math.max(0, Math.round(ts.size * s.outlineF)),
    shadow: s.shadow,
    italic: s.italic ?? ts.italic,
    caps: s.lower ? false : ts.caps,
  };
}
