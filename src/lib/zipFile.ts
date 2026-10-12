/* A STORE-only ZIP writer and reader built on Blobs.

   Why this exists: the .lmc project file and the multi-page image export
   are mostly already-compressed images, so a stored (uncompressed) archive
   costs nothing in size and — crucially — can be BUILT and READ without
   ever holding the whole file in JavaScript memory:

   - writing: every entry's bytes go in as a Blob part, which the browser
     keeps off the JS heap; only one entry at a time is read (for its CRC).
   - reading: the central directory at the tail is parsed, and each entry
     is handed back as `file.slice(...)`, a view onto the file on disk.

   No compression, no zip64: entries and the archive itself must stay under
   4 GB (the writer throws past that rather than emit a corrupt file). */

const enc = new TextEncoder();
const dec = new TextDecoder();

let crcTable: Uint32Array | null = null;
function table() {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}
export function crc32(data: Uint8Array, seed = 0xffffffff): number {
  const t = table();
  let crc = seed;
  for (let i = 0; i < data.length; i++) crc = t[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return crc >>> 0;   // NOT finalised — callers xor at the end
}

/* CRC of a blob read in 8 MB slices, so a 40 MB scan never sits in memory twice */
async function crcOfBlob(b: Blob): Promise<number> {
  let crc = 0xffffffff;
  const step = 8 * 1024 * 1024;
  for (let at = 0; at < b.size; at += step) {
    const buf = new Uint8Array(await b.slice(at, Math.min(b.size, at + step)).arrayBuffer());
    crc = crc32(buf, crc);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const u16 = (v: number) => new Uint8Array([v & 255, (v >> 8) & 255]);
const u32 = (v: number) => new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]);
const LIMIT = 0xfffffffe;

export class ZipWriter {
  private parts: BlobPart[] = [];
  private central: Uint8Array[] = [];
  private offset = 0;
  private count = 0;

  /** append one entry; `data` may be a Blob (preferred for anything big) */
  async add(name: string, data: Blob | Uint8Array | string): Promise<void> {
    const blob = data instanceof Blob ? data : new Blob([(typeof data === "string" ? enc.encode(data) : data) as BlobPart]);
    if (blob.size > LIMIT || this.offset + blob.size > LIMIT) {
      throw new Error("This book is too large for a single file (4 GB limit) — export it in parts.");
    }
    const nameB = enc.encode(name);
    const crc = await crcOfBlob(blob);
    const localOffset = this.offset;
    const head = [u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(blob.size), u32(blob.size), u16(nameB.length), u16(0), nameB];
    for (const h of head) { this.parts.push(h as BlobPart); this.offset += h.length; }
    this.parts.push(blob);
    this.offset += blob.size;
    this.central.push(u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(blob.size), u32(blob.size), u16(nameB.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(localOffset), nameB);
    this.count++;
  }

  finish(type = "application/zip"): Blob {
    const centralOffset = this.offset;
    let centralSize = 0;
    for (const c of this.central) { this.parts.push(c as BlobPart); centralSize += c.length; }
    const tail = [u32(0x06054b50), u16(0), u16(0), u16(this.count), u16(this.count),
      u32(centralSize), u32(centralOffset), u16(0)];
    for (const t of tail) this.parts.push(t as BlobPart);
    return new Blob(this.parts, { type });
  }
}

export interface ZipEntry { name: string; size: number; dataOffset: number; method: number; csize: number }

/* true when the first bytes are a local-file-header signature */
export async function isZip(file: Blob): Promise<boolean> {
  if (file.size < 22) return false;
  const b = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  return b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4;
}

/* the directory of a stored zip — reads only the tail and the headers */
export async function readZipDirectory(file: Blob): Promise<Map<string, ZipEntry>> {
  const tailLen = Math.min(file.size, 65_557);
  const tail = new Uint8Array(await file.slice(file.size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip archive");
  const tv = new DataView(tail.buffer, tail.byteOffset + eocd);
  const count = tv.getUint16(10, true);
  const cdSize = tv.getUint32(12, true);
  const cdOffset = tv.getUint32(16, true);
  const cd = new Uint8Array(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
  const dv = new DataView(cd.buffer, cd.byteOffset);
  const out = new Map<string, ZipEntry>();
  let p = 0;
  for (let i = 0; i < count && p + 46 <= cd.length; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    /* central-directory layout: crc @16, COMPRESSED size @20, uncompressed
       size @24 — (stored entries have the two equal, which is why reading
       @20 as "the size" never showed until a deflated .docx came along) */
    const csize = dv.getUint32(p + 20, true);
    const size = dv.getUint32(p + 24, true);
    const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = dec.decode(cd.subarray(p + 46, p + 46 + nLen));
    /* the local header's own name/extra lengths decide where the data starts */
    const lh = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
    const dataOffset = localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    out.set(name, { name, size, dataOffset, method, csize });
    p += 46 + nLen + xLen + cLen;
  }
  return out;
}

/* an entry's bytes as a slice of the file — nothing is read until used */
export function zipEntryBlob(file: Blob, e: ZipEntry, type = ""): Blob {
  if (e.method !== 0) throw new Error(`compressed entry "${e.name}" is not supported`);
  return file.slice(e.dataOffset, e.dataOffset + e.size, type);
}

/* an entry's bytes, inflating a DEFLATED entry (method 8) through the
   browser's DecompressionStream — what a Word .docx or any ordinary zip
   uses; our own .lmc archives are stored and skip it */
export async function zipEntryBytes(file: Blob, e: ZipEntry): Promise<Uint8Array> {
  if (e.method === 0) return new Uint8Array(await file.slice(e.dataOffset, e.dataOffset + e.size).arrayBuffer());
  if (e.method !== 8) throw new Error(`compressed entry "${e.name}" is not supported`);
  const raw = new Uint8Array(await file.slice(e.dataOffset, e.dataOffset + e.csize).arrayBuffer());
  if (typeof DecompressionStream !== "undefined") {
    try {
      const ds = new DecompressionStream("deflate-raw");
      const out = new Response(new Blob([raw as BlobPart]).stream().pipeThrough(ds));
      return new Uint8Array(await out.arrayBuffer());
    } catch { /* fall through to the JS inflater */ }
  }
  return inflateRaw(raw, e.size);
}

/* A plain-JS raw DEFLATE decoder (RFC 1951) for browsers without
   DecompressionStream — older Safari and the iOS wrapper. Small inputs
   only (a script's document.xml), so clarity over speed. */
export function inflateRaw(src: Uint8Array, sizeHint = 0): Uint8Array {
  let out = new Uint8Array(Math.max(1024, sizeHint || src.length * 4)), op = 0;
  let pos = 0, bitBuf = 0, bitCnt = 0;
  const bits = (n: number) => {
    while (bitCnt < n) { if (pos >= src.length) throw new Error("truncated deflate data"); bitBuf |= src[pos++] << bitCnt; bitCnt += 8; }
    const v = bitBuf & ((1 << n) - 1); bitBuf >>>= n; bitCnt -= n; return v;
  };
  const put = (b: number) => {
    if (op >= out.length) { const n = new Uint8Array(out.length * 2); n.set(out); out = n; }
    out[op++] = b;
  };
  /* canonical Huffman table: counts per length + symbols in order */
  const build = (lengths: number[]) => {
    const count = new Array(16).fill(0);
    for (const l of lengths) count[l]++;
    count[0] = 0;
    const offs = new Array(16).fill(0);
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    const symbol = new Array(lengths.length).fill(0);
    lengths.forEach((l, sym) => { if (l) symbol[offs[l]++] = sym; });
    return { count, symbol };
  };
  const decode = (h: { count: number[]; symbol: number[] }) => {
    let code = 0, first = 0, index = 0;
    for (let len = 1; len < 16; len++) {
      code |= bits(1);
      const c = h.count[len];
      if (code - c < first) return h.symbol[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error("bad huffman code");
  };
  const LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  const DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  const DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  const codes = (lit: { count: number[]; symbol: number[] }, dist: { count: number[]; symbol: number[] }) => {
    for (;;) {
      const sym = decode(lit);
      if (sym < 256) { put(sym); continue; }
      if (sym === 256) return;
      const li = sym - 257;
      if (li >= 29) throw new Error("bad length code");
      const len = LBASE[li] + bits(LEXT[li]);
      const di = decode(dist);
      if (di >= 30) throw new Error("bad distance code");
      const d = DBASE[di] + bits(DEXT[di]);
      if (d > op) throw new Error("distance too far back");
      for (let i = 0; i < len; i++) put(out[op - d]);
    }
  };
  let fixedLit: { count: number[]; symbol: number[] } | null = null, fixedDist: { count: number[]; symbol: number[] } | null = null;
  const ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
  let last = 0;
  do {
    last = bits(1);
    const type = bits(2);
    if (type === 0) {
      bitBuf = 0; bitCnt = 0;
      if (pos + 4 > src.length) throw new Error("truncated deflate data");
      const len = src[pos] | (src[pos + 1] << 8); pos += 4;
      for (let i = 0; i < len; i++) put(src[pos++]);
    } else if (type === 1) {
      if (!fixedLit) {
        const l: number[] = [];
        for (let i = 0; i < 288; i++) l.push(i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8);
        fixedLit = build(l); fixedDist = build(new Array(30).fill(5));
      }
      codes(fixedLit, fixedDist!);
    } else if (type === 2) {
      const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
      const lengths = new Array(19).fill(0);
      for (let i = 0; i < ncode; i++) lengths[ORDER[i]] = bits(3);
      const lencode = build(lengths);
      const all: number[] = [];
      while (all.length < nlen + ndist) {
        const sym = decode(lencode);
        if (sym < 16) all.push(sym);
        else if (sym === 16) { const prev = all[all.length - 1] ?? 0; for (let r = 3 + bits(2); r > 0; r--) all.push(prev); }
        else if (sym === 17) { for (let r = 3 + bits(3); r > 0; r--) all.push(0); }
        else { for (let r = 11 + bits(7); r > 0; r--) all.push(0); }
      }
      codes(build(all.slice(0, nlen)), build(all.slice(nlen)));
    } else throw new Error("bad deflate block type");
  } while (!last);
  return out.subarray(0, op);
}

export async function zipEntryText(file: Blob, e: ZipEntry): Promise<string> {
  return dec.decode(await zipEntryBytes(file, e));
}
