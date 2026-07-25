/* Dependency-free multi-page PDF export: each page rendered to JPEG and
   embedded via DCTDecode. Output sized in points from the page's DPI. */
import { Assets, DPI, Doc } from "./model";
import { renderPageToCanvas } from "./exportPng";

const enc = new TextEncoder();

export async function exportPdf(
  doc: Doc, assets: Assets, filename: string,
  onProgress?: (i: number, n: number) => void, dpi = 225
) {
  const images: { bytes: Uint8Array; w: number; h: number }[] = [];
  for (let i = 0; i < doc.pages.length; i++) {
    onProgress?.(i + 1, doc.pages.length);
    const canvas = await renderPageToCanvas(doc.pages[i], assets, dpi / DPI);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    if (!blob) throw new Error("page render failed");
    images.push({ bytes: new Uint8Array(await blob.arrayBuffer()), w: canvas.width, h: canvas.height });
  }
  const outDpi = dpi;

  const chunks: Uint8Array[] = [];
  let offset = 0;
  const offsets: number[] = [];
  const push = (data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    chunks.push(bytes);
    offset += bytes.length;
  };
  const beginObj = (num: number) => { offsets[num] = offset; push(`${num} 0 obj\n`); };

  push("%PDF-1.4\n%\xB5\xB5\n");

  const n = images.length;
  const pageObj = (i: number) => 3 + i * 3;
  const contObj = (i: number) => 4 + i * 3;
  const imgObj = (i: number) => 5 + i * 3;

  beginObj(1);
  push(`<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  beginObj(2);
  push(`<< /Type /Pages /Count ${n} /Kids [${images.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] >>\nendobj\n`);

  images.forEach((img, i) => {
    const W = (img.w * 72) / outDpi;
    const H = (img.h * 72) / outDpi;
    beginObj(pageObj(i));
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W.toFixed(2)} ${H.toFixed(2)}] /Contents ${contObj(i)} 0 R /Resources << /XObject << /Im0 ${imgObj(i)} 0 R >> >> >>\nendobj\n`);
    const content = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} 0 0 cm /Im0 Do Q`;
    beginObj(contObj(i));
    push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    beginObj(imgObj(i));
    push(`<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`);
    push(img.bytes);
    push(`\nendstream\nendobj\n`);
  });

  const totalObjs = 2 + n * 3;
  const xrefStart = offset;
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjs; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const blob = new Blob(chunks as BlobPart[], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
