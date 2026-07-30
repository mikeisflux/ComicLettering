/* Segment-anything cutouts for Tuck Back.

   The old cutout separated foreground from background by luminance threshold,
   which only works when the subject happens to be lighter or darker than
   everything around it. On busy or mid-tone art it has nothing to go on.

   MobileSAM splits into two pieces, and that split is what makes it usable in
   a browser: a heavy image encoder that runs ONCE per artwork and produces an
   embedding, then a small decoder that turns a box or a click into a mask in
   milliseconds. So the wait is paid once and every retry after that is
   instant.

   Everything runs locally — no pixels leave the machine, which is the promise
   the rest of the app makes. Models are MobileSAM (Apache 2.0).            */

import type { InferenceSession, Tensor } from "onnxruntime-web";

const ENCODER_URL = "/models/mobilesam-encoder.onnx";
const DECODER_URL = "/models/mobilesam-decoder.onnx";
const SIDE = 1024;                                  // what the encoder expects
/* SAM's own normalisation constants — the model was trained with these */
const MEAN = [123.675, 116.28, 103.53];
const STD = [58.395, 57.12, 57.375];

type Ort = typeof import("onnxruntime-web");
let ortPromise: Promise<Ort | null> | null = null;
let encoder: InferenceSession | null = null;
let decoder: InferenceSession | null = null;
let loading: Promise<boolean> | null = null;

export type SamProgress = (stage: "download" | "encode", note: string) => void;

async function getOrt(): Promise<Ort | null> {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web")
      .then((ort) => {
        /* served from public/ort so nothing is pulled off a CDN at runtime */
        ort.env.wasm.wasmPaths = "/ort/";
        ort.env.wasm.numThreads = 1;   // no cross-origin isolation to rely on
        return ort;
      })
      .catch(() => null);
  }
  return ortPromise;
}

/** Load the two models. Returns false if they are not deployed. */
export async function loadSam(onProgress?: SamProgress): Promise<boolean> {
  if (encoder && decoder) return true;
  if (loading) return loading;
  loading = (async () => {
    const ort = await getOrt();
    if (!ort) return false;
    try {
      onProgress?.("download", "Loading the segmentation model…");
      const opts: InferenceSession.SessionOptions = {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      };
      const [e, d] = await Promise.all([
        ort.InferenceSession.create(ENCODER_URL, opts),
        ort.InferenceSession.create(DECODER_URL, opts),
      ]);
      encoder = e; decoder = d;
      return true;
    } catch (err) {
      /* Say WHY. Swallowing this made a broken runtime look exactly like
         "no models installed", which cost real debugging time. */
      lastError = String(err);
      console.warn("[tuck] segmentation model unavailable:", err);
      return false;
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export const samReady = () => !!(encoder && decoder);
let lastError = "";
export const samError = () => lastError;

export interface Embedding {
  data: Tensor;            // [1,256,64,64]
  scale: number;           // original px → encoder px
  origW: number;
  origH: number;
}

/* one embedding per artwork; re-encoding the same page is the slow part */
const embeddings = new Map<string, Embedding>();
export const forgetEmbedding = (key: string) => embeddings.delete(key);

/** Encode an image once. Slow (seconds); cached by key thereafter. */
export async function encodeImage(
  key: string, img: HTMLImageElement, onProgress?: SamProgress,
): Promise<Embedding | null> {
  const hit = embeddings.get(key);
  if (hit) return hit;
  if (!(await loadSam(onProgress))) return null;
  const ort = await getOrt();
  if (!ort || !encoder) return null;

  const W = img.naturalWidth, H = img.naturalHeight;
  const scale = SIDE / Math.max(W, H);
  const nw = Math.round(W * scale), nh = Math.round(H * scale);

  /* longest side to 1024, then pad out to a square — SAM's own convention */
  const c = document.createElement("canvas");
  c.width = SIDE; c.height = SIDE;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, nw, nh);
  const px = ctx.getImageData(0, 0, SIDE, SIDE).data;

  const chw = new Float32Array(3 * SIDE * SIDE);
  const plane = SIDE * SIDE;
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    chw[i] = (px[p] - MEAN[0]) / STD[0];
    chw[plane + i] = (px[p + 1] - MEAN[1]) / STD[1];
    chw[2 * plane + i] = (px[p + 2] - MEAN[2]) / STD[2];
  }

  onProgress?.("encode", "Reading the artwork…");
  try {
    const input = new ort.Tensor("float32", chw, [1, 3, SIDE, SIDE]);
    const out = await encoder.run({ image: input });
    const emb: Embedding = { data: out.embedding as Tensor, scale, origW: W, origH: H };
    embeddings.set(key, emb);
    /* one page's embedding is ~4MB; a long book would add up */
    if (embeddings.size > 6) embeddings.delete(embeddings.keys().next().value as string);
    return emb;
  } catch { return null; }
}

export interface SamMask {
  data: Uint8Array;      // 1 = foreground, at origW × origH
  w: number;
  h: number;
  score: number;
}

/** Turn a box (in original image pixels) into a mask. Fast — milliseconds. */
export async function segmentBox(
  emb: Embedding, x0: number, y0: number, x1: number, y1: number,
): Promise<SamMask | null> {
  const ort = await getOrt();
  if (!ort || !decoder) return null;
  /* labels 2 and 3 are SAM's "this is a box corner" markers, and the points
     are given in the encoder's 1024-space, not the original image's */
  const coords = Float32Array.from([
    x0 * emb.scale, y0 * emb.scale,
    x1 * emb.scale, y1 * emb.scale,
  ]);
  try {
    const out = await decoder.run({
      image_embedding: emb.data,
      point_coords: new ort.Tensor("float32", coords, [1, 2, 2]),
      point_labels: new ort.Tensor("float32", Float32Array.from([2, 3]), [1, 2]),
      mask_input: new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]),
      has_mask_input: new ort.Tensor("float32", Float32Array.from([0]), [1]),
      orig_im_size: new ort.Tensor("float32", Float32Array.from([emb.origH, emb.origW]), [2]),
    });
    const masks = out.masks as Tensor;
    const dims = masks.dims as number[];
    const h = dims[dims.length - 2], w = dims[dims.length - 1];
    const raw = masks.data as Float32Array;
    /* the decoder emits logits: positive is inside the mask */
    const bits = new Uint8Array(w * h);
    for (let i = 0; i < bits.length; i++) bits[i] = raw[i] > 0 ? 1 : 0;
    const scores = out.scores?.data as Float32Array | undefined;
    return { data: bits, w, h, score: scores ? scores[0] : 1 };
  } catch { return null; }
}
