#!/bin/bash
# Package the browser add-ons. ONE source (firefox-addon/) → two zips:
#   public/lettermycomic-firefox.zip  — addons.mozilla.org upload
#   public/lettermycomic-chrome.zip   — Chrome Web Store AND Edge Add-ons
# The only difference is the manifest background section: Firefox runs an
# event page ("scripts"), Chromium requires a service worker — the Chromium
# manifest is DERIVED from the Firefox one here so the two can never drift.
# Files sit at the zip ROOT (stores reject nested zips).
set -euo pipefail
cd "$(dirname "$0")/../firefox-addon"
pub="$(cd ../public && pwd)"

rm -f "$pub/lettermycomic-firefox.zip" "$pub/lettermycomic-chrome.zip"
zip -r -X "$pub/lettermycomic-firefox.zip" manifest.json background.js icons -x "*.DS_Store"

tmp=$(mktemp -d)
cp -r background.js icons "$tmp/"
python3 - "$tmp/manifest.json" <<'PY'
import json, sys
m = json.load(open("manifest.json"))
m["background"] = {"service_worker": "background.js"}
del m["browser_specific_settings"]          # gecko-only block
json.dump(m, open(sys.argv[1], "w"), indent=2)
PY
(cd "$tmp" && zip -r -X "$pub/lettermycomic-chrome.zip" manifest.json background.js icons)
rm -rf "$tmp"
echo "wrote public/lettermycomic-firefox.zip and public/lettermycomic-chrome.zip"
