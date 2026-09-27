/* Dependency-free multi-page PDF export: each page rendered to JPEG and
   embedded via DCTDecode. Output sized in points from the page's DPI.

   Every object is written to the output as soon as it exists (the object
   numbering is fixed by the page count up front), and page images go in as
   Blob parts — the file is never held twice in JavaScript memory. */
import { Assets, DPI, Doc, Page, pageBleed } from "./model";
import { renderPageToCanvas } from "./exportPng";

const enc = new TextEncoder();

/* printer's crop marks at the four trim corners. They start OUTSIDE the
   bleed (a mark inked over bleed artwork is rejected by print shops) and run
   12pt out from there. x,y = a trim corner in points; sx,sy = outward
   direction (±1); b = the bleed width in points. */
function cornerMarks(x: number, y: number, sx: number, sy: number, b: number): string {
  const g = b + 3, len = 12;
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
  const parts: BlobPart[] = [];
  let offset = 0;
  const offsets: number[] = [];
  const push = (data: Uint8Array | string | Blob) => {
    if (data instanceof Blob) { parts.push(data); offset += data.size; return; }
    const bytes = typeof data === "string" ? enc.encode(data) : data;
    parts.push(bytes as BlobPart);
    offset += bytes.length;
  };
  const beginObj = (num: number) => { offsets[num] = offset; push(`${num} 0 obj\n`); };

  const n = doc.pages.length;
  const pageObj = (i: number) => 3 + i * 3;
  const contObj = (i: number) => 4 + i * 3;
  const imgObj = (i: number) => 5 + i * 3;

  push("%PDF-1.4\n%\xB5\xB5\n");
  beginObj(1);
  push(`<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  beginObj(2);
  push(`<< /Type /Pages /Count ${n} /Kids [${doc.pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] >>\nendobj\n`);

  for (let i = 0; i < n; i++) {
    await onProgress?.(i + 1, n);
    const canvas = await renderPageToCanvas(doc.pages[i], assets, dpi / DPI, false, neighbors?.[i] ?? null);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    if (!blob) throw new Error(`Page ${i + 1} could not be rendered at ${dpi} dpi (${canvas.width}×${canvas.height} px) — try a lower DPI.`);
    const W = (canvas.width * 72) / dpi;
    const H = (canvas.height * 72) / dpi;
    /* the page already carries its bleed, so the trim is INSIDE the sheet:
       marks at the sheet corners would cut on the bleed line. With crop
       marks the sheet grows by a quiet margin that holds the marks
       (bleed + 3pt gap + 12pt mark + 6pt clearance). */
    const b = cropMarks ? (pageBleed(doc.pages[i]) / DPI) * 72 : 0;
    const M = cropMarks ? Math.max(18, b + 21) : 0;
    const MW = W + 2 * M, MH = H + 2 * M;
    beginObj(pageObj(i));
    push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${MW.toFixed(2)} ${MH.toFixed(2)}] /Contents ${contObj(i)} 0 R /Resources << /XObject << /Im0 ${imgObj(i)} 0 R >> >> >>\nendobj\n`);
    let content = `q ${W.toFixed(2)} 0 0 ${H.toFixed(2)} ${M.toFixed(2)} ${M.toFixed(2)} cm /Im0 Do Q`;
    if (cropMarks) {
      const x0 = M + b, y0 = M + b, x1 = M + W - b, y1 = M + H - b;
      const marks =
        cornerMarks(x0, y0, -1, -1, b) +   // bottom-left
        cornerMarks(x1, y0, 1, -1, b) +    // bottom-right
        cornerMarks(x0, y1, -1, 1, b) +    // top-left
        cornerMarks(x1, y1, 1, 1, b);      // top-right
      content += `\n0 0 0 RG 0.5 w\n${marks}S`;
    }
    beginObj(contObj(i));
    push(`<< /Length ${enc.encode(content).length} >>\nstream\n${content}\nendstream\nendobj\n`);
    beginObj(imgObj(i));
    push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${blob.size} >>\nstream\n`);
    push(blob);
    push(`\nendstream\nendobj\n`);
  }

  const totalObjs = 2 + n * 3;
  const xrefStart = offset;
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjs; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

  const out = new Blob(parts, { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(out);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
