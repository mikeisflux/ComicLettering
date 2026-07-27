/* Lettering brushes — dry-media textures that eat into the letterforms the way
   a chalk stick, a drying brush or a spatter pen does on paper.

   A brush is a MASK, not a fill: the tile is opaque where ink stays and clear
   where the paper shows through, so it works over any colour, gradient or
   outline the lettering already has. The DOM editor applies it with
   mask-image; the canvas exporter punches the same tile out of the drawn
   glyphs, so the two stay identical.

   Everything is generated at runtime from a seeded RNG — no bitmaps ship with
   the app, and a given brush always renders the same way. */

export type BrushKey =
  | "none" | "chalk" | "pastel" | "dry" | "rough" | "spatter"
  | "grain" | "ink" | "scratch" | "stipple" | "wash" | "crumble"
  | "marker" | "charcoal" | "sponge" | "woodcut" | "linocut" | "sandpaper"
  | "halftone" | "bleed" | "frayed" | "static" | "nib" | "splat";

export const BRUSHES: { k: BrushKey; label: string; hint: string }[] = [
  { k: "none",     label: "Solid",     hint: "No brush — clean, filled letterforms" },
  { k: "chalk",    label: "Chalk",     hint: "Soft chalk stick: fine tooth all over" },
  { k: "pastel",   label: "Pastel",    hint: "Heavier pastel: broken, crumbly coverage" },
  { k: "dry",      label: "Dry Brush", hint: "Brush running out of ink: long streaks" },
  { k: "rough",    label: "Rough",     hint: "Coarse paper tooth, bitten edges" },
  { k: "spatter",  label: "Spatter",   hint: "Flicked ink: scattered holes and dots" },
  { k: "grain",    label: "Grain",     hint: "Fine even grain, like newsprint" },
  { k: "ink",      label: "Ink Wash",  hint: "Uneven ink load: patchy pooling" },
  { k: "scratch",  label: "Scratch",   hint: "Scratched-off ink: thin diagonal cuts" },
  { k: "stipple",  label: "Stipple",   hint: "Dotted pen shading" },
  { k: "wash",     label: "Faded",     hint: "Worn print: soft thinning across the letters" },
  { k: "crumble",  label: "Crumble",   hint: "Flaking paint: large broken patches" },
  { k: "marker",   label: "Marker",    hint: "Chisel marker: banded streaks along the stroke" },
  { k: "charcoal", label: "Charcoal",  hint: "Charcoal stick: dense tooth with soft gaps" },
  { k: "sponge",   label: "Sponge",    hint: "Sponged ink: open cellular holes" },
  { k: "woodcut",  label: "Woodcut",   hint: "Cut block: parallel gouges" },
  { k: "linocut",  label: "Lino Cut",  hint: "Lino block: chipped edges and nicks" },
  { k: "sandpaper",label: "Sandpaper", hint: "Abraded print: dense fine scuffing" },
  { k: "halftone", label: "Halftone",  hint: "Screened dots punched through the ink" },
  { k: "bleed",    label: "Bleed",     hint: "Ink bleeding on cheap stock: soft ragged voids" },
  { k: "frayed",   label: "Frayed",    hint: "Worn brush: long thin splits" },
  { k: "static",   label: "Static",    hint: "Heavy interference: dense random dropout" },
  { k: "nib",      label: "B-Nib",     hint: "Pen nib: fine hairline breaks" },
  { k: "splat",    label: "Splat",     hint: "Wet splatter: big irregular blowouts" },
];

export const BRUSH_LABEL = (k: string) =>
  BRUSHES.find((b) => b.k === k)?.label ?? "Solid";

/* deterministic RNG so a brush looks the same every render and every export */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, HTMLCanvasElement>();

/** The mask tile: black = ink kept, transparent = paper. */
export function brushTile(kind: BrushKey): HTMLCanvasElement | null {
  if (kind === "none" || typeof document === "undefined") return null;
  const hit = cache.get(kind);
  if (hit) return hit;

  const S = 512;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const r = rng(kind.split("").reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));

  /* start solid, then knock holes out of it */
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = "destination-out";

  const speck = (density: number, maxR: number, alpha = 1) => {
    for (let i = 0; i < density; i++) {
      ctx.globalAlpha = alpha * (0.35 + r() * 0.65);
      ctx.beginPath();
      ctx.arc(r() * S, r() * S, 0.4 + r() * maxR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  const streaks = (count: number, len: number, w: number, ang: number, alpha = 1) => {
    ctx.lineCap = "round";
    for (let i = 0; i < count; i++) {
      const x = r() * S, y = r() * S;
      const a = ang + (r() - 0.5) * 0.5;
      const l = len * (0.3 + r() * 0.7);
      ctx.globalAlpha = alpha * (0.3 + r() * 0.7);
      ctx.lineWidth = w * (0.4 + r() * 0.9);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const patches = (count: number, rMin: number, rMax: number, blur: number, alpha: number) => {
    ctx.filter = `blur(${blur}px)`;
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = alpha * (0.3 + r() * 0.7);
      ctx.beginPath();
      ctx.arc(r() * S, r() * S, rMin + r() * (rMax - rMin), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  };

  switch (kind) {
    case "chalk":   speck(9000, 2.2, 0.85); patches(30, 8, 26, 6, 0.25); break;
    case "pastel":  speck(7000, 3.6, 1); patches(70, 10, 42, 5, 0.5); streaks(160, 40, 3, 0.5, 0.5); break;
    case "dry":     streaks(900, 150, 3.2, 0.12, 0.9); speck(1800, 2, 0.5); break;
    case "rough":   speck(5200, 3.2, 0.9); patches(45, 12, 34, 3, 0.45); break;
    case "spatter": speck(1500, 7, 1); patches(18, 6, 20, 2, 0.6); break;
    case "grain":   speck(14000, 1.3, 0.7); break;
    case "ink":     patches(120, 14, 60, 12, 0.45); speck(2200, 2, 0.4); break;
    case "scratch": streaks(1300, 90, 1.7, -0.75, 0.95); break;
    case "stipple": speck(4200, 4.2, 1); break;
    case "wash":    patches(90, 30, 120, 26, 0.4); speck(3000, 1.8, 0.35); break;
    case "crumble": patches(150, 16, 56, 2, 0.75); speck(3000, 3, 0.6); break;

    case "marker":  streaks(420, 220, 5, 0.02, 0.55); speck(900, 1.6, 0.35); break;
    case "charcoal":speck(11000, 2.6, 0.8); patches(55, 14, 40, 9, 0.3); break;
    case "sponge":  patches(260, 7, 22, 1, 0.9); speck(1200, 2, 0.3); break;
    case "woodcut": streaks(700, 260, 3.6, 1.5708, 0.85); break;
    case "linocut": streaks(380, 120, 4.4, 0.0, 0.7); speck(1600, 4, 0.7); break;
    case "sandpaper": speck(20000, 1.15, 0.6); break;
    case "halftone": {
      const step = 13;
      for (let gy = 0; gy < S; gy += step) {
        for (let gx = 0; gx < S; gx += step) {
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(gx + (gy / step % 2) * step / 2, gy, 2.3 + r() * 1.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      break;
    }
    case "bleed":   patches(190, 10, 44, 7, 0.6); speck(2000, 2.4, 0.35); break;
    case "frayed":  streaks(1500, 200, 1.5, 0.05, 0.8); break;
    case "static":  speck(24000, 2.1, 0.85); break;
    case "nib":     streaks(2000, 40, 1.1, 0.35, 0.7); speck(2500, 1.2, 0.4); break;
    case "splat":   patches(70, 20, 78, 1, 0.95); speck(900, 6, 0.8); break;
  }

  ctx.globalCompositeOperation = "source-over";
  cache.set(kind, c);
  return c;
}

let urlCache = new Map<string, string>();

/** data URL of the mask tile, for CSS mask-image in the DOM editor */
export function brushURL(kind: BrushKey): string | null {
  if (kind === "none") return null;
  const hit = urlCache.get(kind);
  if (hit) return hit;
  const tile = brushTile(kind);
  if (!tile) return null;
  const url = tile.toDataURL("image/png");
  urlCache.set(kind, url);
  return url;
}

/** How big the tile is drawn, in px, for a given lettering size. Tying it to
    the type size keeps the grain in proportion instead of shrink-wrapping. */
export const brushScale = (size: number) => Math.max(90, Math.round(size * 3.2));
