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

export interface ZipEntry { name: string; size: number; dataOffset: number; method: number }

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
    const size = dv.getUint32(p + 20, true);
    const nLen = dv.getUint16(p + 28, true), xLen = dv.getUint16(p + 30, true), cLen = dv.getUint16(p + 32, true);
    const localOffset = dv.getUint32(p + 42, true);
    const name = dec.decode(cd.subarray(p + 46, p + 46 + nLen));
    /* the local header's own name/extra lengths decide where the data starts */
    const lh = new DataView(await file.slice(localOffset, localOffset + 30).arrayBuffer());
    const dataOffset = localOffset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    out.set(name, { name, size, dataOffset, method });
    p += 46 + nLen + xLen + cLen;
  }
  return out;
}

/* an entry's bytes as a slice of the file — nothing is read until used */
export function zipEntryBlob(file: Blob, e: ZipEntry, type = ""): Blob {
  if (e.method !== 0) throw new Error(`compressed entry "${e.name}" is not supported`);
  return file.slice(e.dataOffset, e.dataOffset + e.size, type);
}

export async function zipEntryText(file: Blob, e: ZipEntry): Promise<string> {
  return dec.decode(new Uint8Array(await zipEntryBlob(file, e).arrayBuffer()));
}
