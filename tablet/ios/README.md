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
