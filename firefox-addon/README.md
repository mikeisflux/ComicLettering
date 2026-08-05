# LetterMyComic browser add-on (Firefox + Chrome + Edge)

Firefox has no desktop PWA install, so this add-on is the Firefox way to run
the studio like an app: a toolbar button that opens lettermycomic.com/app in
its own popup window (no tab strip, no address bar). Clicking the button
again focuses the existing studio window instead of opening a second one.

What it deliberately does NOT do (only real OS installs can): desktop /
Start-menu icons and `.lmc` double-click file association — Chrome/Edge
installs and the Play Store app cover those.

## Build

    ./scripts/build-addons.sh

writes BOTH store packages (files at the zip root, per WebExtension
packaging rules), served by the deployed site too:

* `public/lettermycomic-firefox.zip` — addons.mozilla.org upload
* `public/lettermycomic-chrome.zip` — Chrome Web Store AND Edge Add-ons
  upload (Chromium needs a service-worker background instead of Firefox's
  event page; the build derives that manifest from this one)

## Test locally in Firefox

about:debugging → This Firefox → Load Temporary Add-on… → pick
`firefox-addon/manifest.json`. The button appears in the toolbar
immediately (temporary add-ons vanish when Firefox closes).

## Publish (Mozilla Add-ons / AMO)

1. addons.mozilla.org → Developer Hub → Submit a New Add-on.
2. "On this site" (listed) → upload the zip.
3. Fill the listing (name, summary, icon 128px, category
   Photos/Music/Videos or Productivity, support site lettermycomic.com).
4. Review is mostly automated for an extension this small; the listing URL
   becomes `https://addons.mozilla.org/firefox/addon/<slug>/` — link it
   from /get-the-app and the editor's Firefox install dialog once live.

Version bumps: raise `version` in manifest.json, rebuild, upload the new
zip as a Version on the same listing.

## Publish (Chrome Web Store)

1. chrome.google.com/webstore/devconsole — one-time $5 developer fee.
2. New item → upload `lettermycomic-chrome.zip`.
3. Listing: same name/summary/description as AMO; category Photos;
   privacy tab → declare NO data collected; single purpose: "opens
   lettermycomic.com in an app window". Screenshots: reuse docs/playstore.
4. Review typically 1–3 days.

## Publish (Edge Add-ons)

1. partner.microsoft.com/dashboard/microsoftedge — free account.
2. New extension → upload the SAME `lettermycomic-chrome.zip`.
3. Same listing copy; review typically a few days.
