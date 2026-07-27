/* Lettering glows — a coloured halo thrown off the letterforms.

   Each glow is a small ramp rather than one colour: a hot core close to the
   ink, cooling as it spreads. That is what reads as a glow rather than as a
   flat coloured shadow, and it is built by stacking passes from widest and
   coolest to tightest and hottest.

   The DOM editor stacks drop-shadow() filters; the canvas exporter stamps the
   same passes with shadowColor/shadowBlur, so the two match. */

export interface Glow {
  k: string;
  label: string;
  /** ramp from the outer edge inwards */
  ramp: string[];
  /** spread as a fraction of the type size */
  spread: number;
}

export const GLOWS: Glow[] = [
  { k: "none",    label: "No glow",    ramp: [], spread: 0 },
  { k: "hotpink", label: "Hot Pink",   ramp: ["#8a0046", "#e00c7a", "#ff8ad0"], spread: 0.30 },
  { k: "electric",label: "Electric",   ramp: ["#00307a", "#0d7cff", "#a8f0ff"], spread: 0.30 },
  { k: "radio",   label: "Radioactive",ramp: ["#1f5c00", "#7fd400", "#f4ff8a"], spread: 0.32 },
  { k: "inferno", label: "Inferno",    ramp: ["#7a0b00", "#ff5a00", "#ffe14d"], spread: 0.30 },
  { k: "violet",  label: "Arcane",     ramp: ["#33006b", "#8a2be2", "#e6c8ff"], spread: 0.30 },
  { k: "ghost",   label: "Ghost",      ramp: ["#1f4a6b", "#5fbce8", "#ffffff"], spread: 0.34 },
  { k: "ember",   label: "Ember",      ramp: ["#5c1000", "#d1400a", "#ffb36e"], spread: 0.26 },
  { k: "toxic",   label: "Toxic",      ramp: ["#0a3320", "#2fa855", "#d8ff8a"], spread: 0.30 },
  { k: "ice",     label: "Ice",        ramp: ["#0e3a6b", "#3fa8e8", "#ffffff"], spread: 0.28 },
  { k: "gold",    label: "Gold",       ramp: ["#6b4400", "#e0a800", "#fff3b8"], spread: 0.26 },
  { k: "acid",    label: "Acid",       ramp: ["#2a5c00", "#a8e000", "#f7ffb0"], spread: 0.34 },
  { k: "blood",   label: "Blood",      ramp: ["#3a0004", "#a80010", "#ff6a72"], spread: 0.28 },
  { k: "cyan",    label: "Cyan Burn",  ramp: ["#00464a", "#00c8c8", "#c8ffff"], spread: 0.30 },
  { k: "sodium",  label: "Street Lamp",ramp: ["#5c2e00", "#e08a00", "#ffe0a8"], spread: 0.24 },
  { k: "shadow",  label: "Dark Aura",  ramp: ["#000000", "#1a1a2e", "#4a4a72"], spread: 0.30 },
];

export const glowByKey = (k?: string) => GLOWS.find((g) => g.k === k) ?? GLOWS[0];

/** passes from widest/coolest to tightest/hottest */
export function glowPasses(key: string | undefined, size: number, strength = 1): { color: string; blur: number }[] {
  const g = glowByKey(key);
  if (!g.ramp.length || strength <= 0) return [];
  const base = size * g.spread * strength;
  return g.ramp.map((color, i) => ({
    color,
    /* the ramp runs outer → inner, so the radius shrinks as it heats up */
    blur: Math.max(1, base * (1 - (i / g.ramp.length) * 0.72)),
  }));
}

/** CSS filter chain for the DOM editor */
export function glowFilter(key: string | undefined, size: number, strength = 1): string {
  return glowPasses(key, size, strength)
    .map((p) => `drop-shadow(0 0 ${p.blur.toFixed(1)}px ${p.color})`)
    .join(" ");
}
