# LetterMyComic for iPad — App Store shell

Apple tooling only runs on macOS, so the Xcode project is generated rather
than committed here. The generator reads our web manifest, so everything
(name, icons, colors) comes out matching the site.

## Generate the project

1. Go to **pwabuilder.com**, enter `https://lettermycomic.com`, choose
   **iOS**, and download the package — it's a complete Swift/WKWebView
   Xcode project wrapped around the live site.
2. Open it in Xcode on a Mac, set your Team (Apple Developer account,
   $99/yr), and build to an iPad to try it immediately.

## Make .lmc files open in the app

In Xcode → target → *Info*, add a **Document Type** and an **Imported
Type Identifier** so iPadOS shows the app icon on `.lmc` files and offers
"Open in LetterMyComic":

- Imported UTI: identifier `com.lettermycomic.project`,
  conforms to `public.json`, extension `lmc`,
  MIME `application/x-lettermycomic`
- Document Type: name `LetterMyComic Project`, types
  `com.lettermycomic.project`, role Editor

When the app is opened with a file, read it and call the studio's bridge
(same one the desktop wrapper uses) in the WKWebView:

```swift
webView.evaluateJavaScript(
  "window.lmcOpenProject(\(jsonEncodedFileText), \(jsonEncodedFileName))")
```

## Submitting

- App Store guideline **4.2 (minimum functionality)**: Apple sometimes
  rejects apps that are "just a website". The `.lmc` document handling
  above is exactly the kind of native integration reviewers look for.
  Approval still isn't guaranteed — that's Apple's call, not a build
  problem.
- Without the store, iPad users already get a real full-screen app via
  Safari → Share → **Add to Home Screen**.

---

## No Mac? Two paths that never touch one

### A. Build it ON the iPad (free)

`LetterMyComic.swiftpm/` in this folder is a complete Swift Playgrounds
app package:

1. Put the `LetterMyComic.swiftpm` folder on the iPad (iCloud Drive,
   AirDrop, or "Download ZIP" from GitHub and extract in Files).
2. Open it with the free **Swift Playgrounds** app (4.2+). Press **Run**
   to use the studio full screen immediately.
3. To ship: enroll in the Apple Developer Program ($99/yr, in a browser),
   put your Team ID into `Package.swift` (`teamIdentifier`), then in
   Playgrounds use **App Settings → Upload to App Store Connect**.
   TestFlight and the store listing are managed from any browser.

This is the simple wrapper (no `.lmc` file-type registration — that needs
the full Xcode project described above).

### B. Build it in the cloud (pennies per build)

`.github/workflows/ios.yml` builds the same package on GitHub's cloud
Macs and uploads straight to TestFlight. Set four repository secrets
(`APPLE_TEAM_ID`, `APPSTORE_API_KEY_ID`, `APPSTORE_API_ISSUER_ID`,
`APPSTORE_API_KEY_P8` — all from App Store Connect) and run the workflow.
Without the secrets it still does an unsigned compile check.
