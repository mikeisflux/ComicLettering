# LetterMyComic on tablets

Store-ready tablet apps. Like the desktop wrapper in `/desktop`, both are
thin shells around the live site — the studio ships new features the moment
lettermycomic.com deploys, and the editor's pointer-based tools (drag,
resize, tails, warp, pinch-zoom) all work with touch and stylus.

No store needed at all: Android Chrome → menu → *Install app*;
iPad Safari → Share → *Add to Home Screen*.

## Android (`/tablet/droid`) — Google Play

A **Trusted Web Activity**: a Play package whose UI is Chrome rendering
lettermycomic.com full screen, no browser bar. Google Play signs the app
for users (one-time $25 developer fee, no certificate to buy).

Build it from the Actions tab: **Tablet app (Android) → Run workflow**.
Artifacts:

- `app-release-bundle.aab` — upload this to the Play Console
- `app-release-signed.apk` — sideload onto a tablet to try it today
- `assetlinks-fingerprint.txt` — see below

The workflow only runs with the signing secrets set (`ANDROID_KEYSTORE_B64`
= your upload keystore base64-encoded, `ANDROID_KEYSTORE_PASSWORD`). Make
the key on your own machine — never in CI, this repo is public:

```
keytool -genkeypair -v -keystore android.keystore -alias lettermycomic \
  -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 android.keystore      # → ANDROID_KEYSTORE_B64
```

Every build gets `versionCode` = the workflow run number (Play refuses a
re-used code) and `versionName` from a `tablet-v1.2.3` tag when built from
one.

Then remove the browser bar for released builds by proving site/app
ownership: create `public/.well-known/assetlinks.json` with the SHA-256
from `assetlinks-fingerprint.txt` (after Play processes the upload, use
the fingerprint from *Play Console → Setup → App signing* **as well** —
list BOTH fingerprints, because sideloaded/internal-test builds are signed
with the upload key and store installs with Play's key) and deploy the site:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.lettermycomic.app",
    "sha256_cert_fingerprints": ["…upload key SHA256…", "…Play app-signing key SHA256…"]
  }
}]
```

## iPad (`/tablet/apple`) — App Store

See `apple/README.md`. Short version: PWABuilder generates the Xcode
project from our manifest; building/submitting needs a Mac with Xcode and
an Apple Developer account ($99/yr), and Apple's "minimum functionality"
guideline (4.2) means a bare wrapper may get pushback — declaring the
`.lmc` document type and keeping the wrapper polished improves the odds.
Meanwhile *Add to Home Screen* gives iPads a full-screen, icon-on-the-
home-screen app today with zero approval process.
