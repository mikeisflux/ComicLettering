/* keep saved documents and thumbnails to a sane size (they are text columns) */
export const MAX_DATA_BYTES = 25 * 1024 * 1024;   // 25 MB serialized document
export const MAX_THUMB_BYTES = 2 * 1024 * 1024;   // 2 MB thumbnail data-URL

/* refuse oversized bodies BEFORE parsing them — a huge JSON body was parsed
   in full by a worker (and could restart it) before any size check ran */
export function tooLarge(req: Request): boolean {
  const len = Number(req.headers.get("content-length") || 0);
  return len > MAX_DATA_BYTES + MAX_THUMB_BYTES;
}
