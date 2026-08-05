/* LetterMyComic launcher for Firefox.

   Firefox has no desktop PWA install, so this add-on is the Firefox way to
   run the studio like an app: the toolbar button opens lettermycomic.com/app
   in a POPUP-type window — its own window with no tab strip or address bar.
   If a studio window is already open, clicking the button focuses it
   instead of opening a second copy. */

const APP_URL = "https://lettermycomic.com/app";
const api = typeof browser !== "undefined" ? browser : chrome;

api.action.onClicked.addListener(async () => {
  try {
    const wins = await api.windows.getAll({ populate: true });
    for (const w of wins) {
      if (w.type !== "popup") continue;
      const hit = (w.tabs || []).some(
        (t) => t.url && t.url.startsWith("https://lettermycomic.com/")
      );
      if (hit) {
        await api.windows.update(w.id, { focused: true });
        return;
      }
    }
  } catch {
    /* window enumeration unavailable — just open a fresh one */
  }
  await api.windows.create({ url: APP_URL, type: "popup", width: 1440, height: 900 });
});
