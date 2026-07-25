/* Lettering style presets — the STYLES panel "ABC" swatches.
   Original preset library in the spirit of classic comic lettering styles:
   gradient fills, heavy outlines and drop shadows. outlineF is the outline
   width as a fraction of the font size. */
import { TextStyle } from "./model";

export interface LetterStyle {
  name: string;
  font: string;
  fillA: string;
  fillB: string | null;
  outlineC: string;
  outlineF: number;
  shadow: boolean;
}

export const LETTER_STYLES: LetterStyle[] = [
  { name: "Sunburst",   font: "bangers",  fillA: "#ffe14d", fillB: "#ff7a00", outlineC: "#d42a00", outlineF: 0.10, shadow: true },
  { name: "Blaze",      font: "luckiest", fillA: "#ff9d2e", fillB: "#e03000", outlineC: "#7a1400", outlineF: 0.10, shadow: true },
  { name: "Crimson",    font: "bangers",  fillA: "#e01018", fillB: "#8f0007", outlineC: "#20000a", outlineF: 0.10, shadow: true },
  { name: "Bubblegum",  font: "chewy",    fillA: "#ff9de0", fillB: "#ff45a4", outlineC: "#ffffff", outlineF: 0.10, shadow: true },
  { name: "Banana",     font: "boogaloo", fillA: "#fff06a", fillB: "#ffcc00", outlineC: "#8a5a00", outlineF: 0.09, shadow: true },
  { name: "Fireball",   font: "creepster", fillA: "#ff5a00", fillB: "#b40000", outlineC: "#3d0000", outlineF: 0.07, shadow: true },
  { name: "Chrome",     font: "bungee",   fillA: "#ffffff", fillB: "#9aa0a8", outlineC: "#555b64", outlineF: 0.08, shadow: true },
  { name: "Stone",      font: "alfa",     fillA: "#d8c9a3", fillB: "#a8946a", outlineC: "#6d5a35", outlineF: 0.09, shadow: true },
  { name: "Tangerine",  font: "luckiest", fillA: "#ffb020", fillB: null,      outlineC: "#b45800", outlineF: 0.10, shadow: true },
  { name: "Slime",      font: "creepster", fillA: "#a5ec3a", fillB: "#2e8f00", outlineC: "#143f0a", outlineF: 0.07, shadow: false },
  { name: "Ice",        font: "chewy",    fillA: "#e6faff", fillB: "#59c8f2", outlineC: "#ffffff", outlineF: 0.10, shadow: true },
  { name: "Hazard",     font: "bangers",  fillA: "#ffe600", fillB: null,      outlineC: "#e00000", outlineF: 0.11, shadow: false },
  { name: "Toxic",      font: "nosifer",  fillA: "#8fe000", fillB: "#4f9a00", outlineC: "#223b00", outlineF: 0.05, shadow: false },
  { name: "Grape",      font: "boogaloo", fillA: "#c77dff", fillB: "#7b2fbf", outlineC: "#3a0f66", outlineF: 0.09, shadow: true },
  { name: "Silver",     font: "league",   fillA: "#ffffff", fillB: "#b9c0c9", outlineC: "#6a7078", outlineF: 0.07, shadow: true },
  { name: "Gold",       font: "alfa",     fillA: "#ffd75e", fillB: "#c8901a", outlineC: "#7a5405", outlineF: 0.08, shadow: true },
  { name: "Classic",    font: "bangers",  fillA: "#ffffff", fillB: null,      outlineC: "#111111", outlineF: 0.10, shadow: true },
  { name: "Ocean",      font: "audiowide", fillA: "#7fd4ff", fillB: "#1a6fd4", outlineC: "#0c3a72", outlineF: 0.08, shadow: false },
  { name: "Marker",     font: "marker",   fillA: "#ff6a00", fillB: null,      outlineC: "#000000", outlineF: 0,    shadow: true },
  { name: "Blood",      font: "nosifer",  fillA: "#c80000", fillB: "#6e0000", outlineC: "#2b0000", outlineF: 0.045, shadow: false },
  { name: "Mint",       font: "patrick",  fillA: "#7fe8b0", fillB: "#28a06a", outlineC: "#0c4a2c", outlineF: 0.08, shadow: false },
  { name: "Retro",      font: "bungee",   fillA: "#ffb84f", fillB: "#ff4f79", outlineC: "#5c1030", outlineF: 0.08, shadow: true },
  { name: "Midnight",   font: "audiowide", fillA: "#b9c6ff", fillB: "#3446a0", outlineC: "#0a1030", outlineF: 0.08, shadow: true },
  { name: "Sunshine",   font: "kalam",    fillA: "#ffdd55", fillB: "#ff9900", outlineC: "#874c00", outlineF: 0.08, shadow: false },
  { name: "Panic",      font: "luckiest", fillA: "#ffffff", fillB: "#ffd0d0", outlineC: "#d40000", outlineF: 0.11, shadow: true },
  { name: "Emerald",    font: "bangers",  fillA: "#5ad46a", fillB: "#0f7a2a", outlineC: "#063a12", outlineF: 0.10, shadow: true },
  { name: "Royal",      font: "alfa",     fillA: "#ffd21f", fillB: null,      outlineC: "#4020a0", outlineF: 0.10, shadow: true },
  { name: "Ghost",      font: "creepster", fillA: "#f2f6ff", fillB: "#aab6d0", outlineC: "#3c465c", outlineF: 0.06, shadow: true },
];

/* Apply a preset onto an existing TextStyle (keeps size/align/caps etc.) */
export function applyLetterStyle(ts: TextStyle, s: LetterStyle): TextStyle {
  return {
    ...ts,
    font: s.font,
    fillA: s.fillA,
    fillB: s.fillB,
    outlineC: s.outlineC,
    outlineW: Math.max(0, Math.round(ts.size * s.outlineF)),
    shadow: s.shadow,
  };
}
