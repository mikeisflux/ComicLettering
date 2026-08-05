# Microsoft Store (Windows) — packaging & listing kit

The Windows app is the PWA packaged as an MSIX via PWABuilder — no code
changes; the web manifest already carries everything (icons, standalone
display, .lmc file_handlers). Installing from the Store gives users a
Start-menu entry, taskbar pinning, and .lmc files with the app icon.

## 1. Register the Windows developer account

Partner Center → Other programs → Windows → Get started.
- Account type: **Company** (you are registered as an organization for
  Play — matching keeps the publisher name consistent: "Divinity Comics").
  One-time fee ~$99 (individual is ~$19 but lists a personal name).
- Publisher display name: **Divinity Comics**.
- Company verification can take a few days (they may email for documents).

## 2. Reserve the app name

Partner Center → Apps and games → **New product → App** → reserve
**LetterMyComic**. Then open Product management → **Product identity** and
copy three values (PWABuilder asks for them verbatim):
- **Package/Identity/Name**       (like `12345DivinityComics.LetterMyComic`)
- **Package/Identity/Publisher**  (like `CN=XXXXXXXX-XXXX-...`)
- **Publisher display name**      (`Divinity Comics`)

## 3. Package with PWABuilder

1. Go to **pwabuilder.com**, enter `https://lettermycomic.com`, Start.
2. Ignore any scorecard nitpicks — click **Package for Stores → Windows**.
3. Fill in the three Product-identity values from step 2; version `1.0.0`.
4. Download — you get a `.msixbundle` (+ a classic `.appinstaller`/sideload
   package you can ignore).

## 4. Submission

Apps and games → LetterMyComic → **Start your submission**.
- **Packages**: upload the `.msixbundle`.
- **Pricing**: Free (subscriptions are bought on the website — do NOT use
  Microsoft's in-app purchases; a web login is allowed).
- **Properties**: Category **Photo & video** (or Productivity);
  privacy policy URL `https://lettermycomic.com/privacy`;
  website `https://lettermycomic.com`;
  support contact your email.
- **Age ratings**: IARC questionnaire — same answers as Google Play
  (no violence, no user-generated content shared publicly, no data
  collection beyond account email; result should be Everyone/3+).
- **Store listing** (reuse docs/playstore/LISTING.md copy):
  - Description: the Play full description works verbatim.
  - Screenshots: `docs/playstore/` desktop/Chromebook shots (Store wants
    at least one; 1366×768 or larger preferred).
  - Short description: "Professional comic lettering — word balloons, SFX
    and print-ready pages."
- **Submit** — review is typically 24–72 hours.

## Notes

- Updates: the MSIX points at the live site, so normal deploys update the
  app content instantly; you only re-package/re-submit when the manifest
  identity or icons change.
- The editor's "already installed" detection (getInstalledRelatedApps)
  covers Chromium PWA installs; the Store MSIX is separate — the red
  button still hides inside the installed app via standalone display mode.
