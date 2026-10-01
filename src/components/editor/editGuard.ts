/* "Is a clipboard read in flight?" — shared between the menu paste op and
   the editable's onBlur.

   navigator.clipboard.readText() is async and, the first time on an origin,
   Chrome pops a permission sheet that takes focus off the page. The
   contentEditable then fires blur → finishEditing, the edit node is torn
   down, and when the text finally arrives there is no caret to put it in:
   right-click → Paste Text silently did nothing (Ctrl+V, a native paste,
   never left the editable). While a read is in flight, blur must not end
   the edit. */
let reads = 0;
export const clipboardReadInFlight = () => reads > 0;
export function beginClipboardRead() { reads++; }
export function endClipboardRead() { reads = Math.max(0, reads - 1); }
