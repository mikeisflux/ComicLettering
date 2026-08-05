#!/bin/bash
# Package the Firefox add-on for AMO: zip with manifest.json at the ROOT
# (not inside a folder — AMO rejects nested zips). Output lands in public/
# so the deployed site serves it at /lettermycomic-firefox.zip.
set -euo pipefail
cd "$(dirname "$0")/../firefox-addon"
out="../public/lettermycomic-firefox.zip"
rm -f "$out"
zip -r -X "$out" manifest.json background.js icons -x "*.DS_Store"
echo "wrote public/lettermycomic-firefox.zip"
