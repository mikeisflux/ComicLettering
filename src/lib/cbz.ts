/* CBZ (comic book archive) export: a stored (uncompressed) ZIP of page
   images. JPEGs are already compressed, so store is fine — and the blob
   based writer means the archive is assembled from off-heap parts instead
   of every page's bytes sitting in JavaScript arrays at once. */
import { Assets, Doc } from "./model";
import { download, pageJpegBlob, spreadNeighbor } from "./exportPng";
import { ZipWriter } from "./zipFile";

export async function exportCbz(
  doc: Doc, assets: Assets, filename: string, dpi = 225,
  /* awaited between pages — a caller driving a progress bar can return a
     promise that resolves after the browser has painted the update */
  pages?: number[], onProgress?: (i: number, n: number) => void | Promise<void>
) {
  const idxs = pages ?? doc.pages.map((_, i) => i);
  const zw = new ZipWriter();
  for (let i = 0; i < idxs.length; i++) {
    await onProgress?.(i + 1, idxs.length);
    const blob = await pageJpegBlob(doc.pages[idxs[i]], assets, dpi, spreadNeighbor(doc, idxs[i]));
    await zw.add(`page-${String(idxs[i] + 1).padStart(3, "0")}.jpg`, blob);
  }
  download(zw.finish("application/vnd.comicbook+zip"), filename);
}
