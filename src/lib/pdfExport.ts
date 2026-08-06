/* Dependency-free multi-page PDF export: each page rendered to JPEG and
   embedded via DCTDecode. Output sized in points from the page's DPI. */
import { Assets, DPI, Doc, Page, pageBleed } from "./model";
import { renderPageToCanvas } from "./exportPng";

const enc = new TextEncoder();

/* printer's crop marks at the four trim corners, drawn in the bleed margin.
   x,y = a trim corner in points; sx,sy = outward direction (±1). */
function cornerMarks(x: number, y: number, sx: number, sy: number): string {
  const g = 3, len = 12;
  const h = `${(x + sx * g).toFixed(2)} ${y.toFixed(2)} m ${(x + sx * (g + len)).toFixed(2)} ${y.toFixed(2)} l\n`;
  const v = `${x.toFixed(2)} ${(y + sy * g).toFixed(2)} m ${x.toFixed(2)} ${(y + sy * (g + len)).toFixed(2)} l\n`;
  return h + v;
}

export async function exportPdf(
  doc: Doc, assets: Assets, filename: string,
  /* awaited between pages — a caller driving a progress bar can return a
     promise that resolves after the browser has painted the update */
  onProgress?: (i: number, n: number) => void | Promise<void>, dpi = 225, cropMarks = false,
  /* spread partners aligned with doc.pages — callers exporting a page RANGE
     compute these against the FULL document so pairing stays correct */
  neighbors?: ({ page: Page; dx: number } | null)[],
) {
  const images: { bytes: Uint8Array; w: number; h: number }[] = [];
  for (let i = 0; i < doc.pages.length; i++) {
    await onProgress?.(i + 1, doc.pages.length);
    const canvas = await renderPageToCanvas(doc.pages[i], assets, dpi / DPI, false, neighbors?.[i] ?? null);
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

  const M = cropMarks ? 18 : 0; // 0.25in quiet margin around the sheet, in points
  images.forEach((img, i) => {
    const W = (img.w * 72) / outDpi;
    const H = (img.h * 72) / outDpi;
    const MW = W + 2 * M, MH = H + 2 * M;
    beginObj(pageObj(i));
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${MW.toFixed(2)} ${MH.toFixed(2)}] /Contents ${contObj(i)} 0 R /Resources << /XObject << /Im0 ${imgObj(i)} 0 R >> >> >>\nendobj\n`);
    let content = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} ${M} ${M} cm /Im0 Do Q`;
    if (cropMarks) {
      /* The page already carries its bleed, so the trim is INSIDE the sheet.
         Marks drawn at the sheet corners would tell the printer to cut on the
         bleed line and hand back a book an eighth of an inch too big on
         every edge. */
      const b = (pageBleed(doc.pages[i]) / DPI) * 72;
      const x0 = M + b, y0 = M + b, x1 = M + W - b, y1 = M + H - b;
      const marks =
        cornerMarks(x0, y0, -1, -1) +   // bottom-left
        cornerMarks(x1, y0, 1, -1) +    // bottom-right
        cornerMarks(x0, y1, -1, 1) +    // top-left
        cornerMarks(x1, y1, 1, 1);      // top-right
      content += `\n0 0 0 RG 0.5 w\n${marks}S`;
    }
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
