/* CBZ (comic book archive) export: a stored (uncompressed) ZIP of page
   images — no dependencies. JPEGs are already compressed, so store is fine. */
import { Assets, Doc } from "./model";
import { download, pageJpegBytes } from "./exportPng";

const enc = new TextEncoder();

let crcTable: Uint32Array | null = null;
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export async function exportCbz(
  doc: Doc, assets: Assets, filename: string, dpi = 225,
  pages?: number[], onProgress?: (i: number, n: number) => void
) {
  const idxs = pages ?? doc.pages.map((_, i) => i);
  const files: { name: Uint8Array; data: Uint8Array; crc: number }[] = [];
  for (let i = 0; i < idxs.length; i++) {
    onProgress?.(i + 1, idxs.length);
    const data = await pageJpegBytes(doc.pages[idxs[i]], assets, dpi);
    files.push({
      name: enc.encode(`page-${String(idxs[i] + 1).padStart(3, "0")}.jpg`),
      data, crc: crc32(data),
    });
  }

  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (b: Uint8Array) => { chunks.push(b); offset += b.length; };
  const u16 = (v: number) => new Uint8Array([v & 255, (v >> 8) & 255]);
  const u32 = (v: number) => new Uint8Array([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]);

  const central: Uint8Array[] = [];
  let centralSize = 0;
  for (const f of files) {
    const localOffset = offset;
    push(u32(0x04034b50)); push(u16(20)); push(u16(0)); push(u16(0)); // local header, store
    push(u16(0)); push(u16(0));
    push(u32(f.crc)); push(u32(f.data.length)); push(u32(f.data.length));
    push(u16(f.name.length)); push(u16(0));
    push(f.name); push(f.data);
    const c: Uint8Array[] = [
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(f.crc), u32(f.data.length), u32(f.data.length),
      u16(f.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(localOffset), f.name,
    ];
    for (const b of c) { central.push(b); centralSize += b.length; }
  }
  const centralOffset = offset;
  for (const b of central) push(b);
  push(u32(0x06054b50)); push(u16(0)); push(u16(0));
  push(u16(files.length)); push(u16(files.length));
  push(u32(centralSize)); push(u32(centralOffset)); push(u16(0));

  download(new Blob(chunks as BlobPart[], { type: "application/vnd.comicbook+zip" }), filename);
}
