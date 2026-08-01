# LetterMyComic Desktop

A thin desktop wrapper around **lettermycomic.com/app**. Its job is the OS
integration a website cannot do by itself:

- registers the **`.lmc`** project-file extension with Windows / macOS /
  Linux, so project files carry the LetterMyComic icon;
- **double-clicking a `.lmc` file** opens it straight into the studio
  (the wrapper reads the file and hands it to the web app via
  `window.lmcOpenProject` — see `src/components/Editor.tsx`);
- the studio itself always loads the live site, so the wrapper never needs
  updating when the app ships new features.

## Building installers

The easy way: run the **“Desktop installers”** GitHub Actions workflow
(`.github/workflows/desktop.yml`) — *Actions → Desktop installers → Run
workflow*. It builds on real Windows/macOS/Linux runners and uploads:

- `LetterMyComic Setup x.y.z.exe` (Windows, NSIS)
- `LetterMyComic-x.y.z.dmg` + `.zip` (macOS)
- `LetterMyComic-x.y.z.AppImage` (Linux)

To build locally instead (on the OS you're targeting):

```bash
cd desktop
npm install
npm run dist        # installers land in desktop/dist/
npm start           # or just run it unpackaged
```

## Microsoft Store (MSIX) — no certificate needed

The Windows build also produces an **`.appx` (MSIX) package**, which is the
recommended way to distribute on Windows: submit it to the Microsoft Store
and **Microsoft re-signs it for you** — users never see a SmartScreen
warning and you never buy a certificate. The Store package carries the same
`.lmc` file association and icon.

1. Create a free developer account at storedeveloper.microsoft.com, then in
   **Partner Center** reserve the app name "LetterMyComic".
2. In Partner Center open *Product management → Product identity* and copy
   the three values into the `appx` block of `desktop/package.json`:
   - `Package/Identity/Name` → `identityName`
   - `Package/Identity/Publisher` (the `CN=…GUID`) → `publisher`
   - `Package/Properties/PublisherDisplayName` → `publisherDisplayName`
3. Run the *Desktop installers* workflow and download the `.appx` from the
   Windows artifact.
4. In Partner Center, create a submission and upload the `.appx`.

The `.appx` is for the Store: sideloading it directly won't install, since
it's unsigned until Microsoft signs it. Keep handing out the NSIS `.exe`
for direct downloads from the website.

## Notes

- **Code signing (direct downloads):** the NSIS/DMG installers build
  unsigned. Windows SmartScreen and macOS Gatekeeper will warn until you
  sign — a Windows code-signing cert and an Apple Developer ID
  respectively. electron-builder picks certificates up from the standard
  `CSC_*` environment variables when you have them. The Microsoft Store
  path above avoids the Windows certificate entirely; the macOS equivalent
  is the Mac App Store or a notarized Developer ID build.
- **Icon:** `build/icon.png` (1024×1024) is generated from
  `src/app/icon.svg`; electron-builder derives the platform formats
  (`.ico`, `.icns`) from it at build time.
- `LMC_URL=http://localhost:3000/app npm start` points the wrapper at a
  dev server.
