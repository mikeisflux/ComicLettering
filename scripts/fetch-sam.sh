#!/usr/bin/env bash
# Fetch the MobileSAM weights and the ONNX runtime WASM for Tuck Behind Art.
# The binaries are ~77MB, so they are not kept in git — run this once after
# cloning, and in the deploy step. Without them the tuck tool silently falls
# back to the old luminance-threshold cutout.
#
# The weights come from a pinned commit of the upstream repo and are checked
# against known SHA-256 sums: a moved, truncated or tampered file is never
# shipped to browsers. Downloads land in a temp file and are moved into place
# only after they verify, so a dropped connection cannot leave a bad file
# that the "already present" check then keeps forever.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/models public/ort
COMMIT=9ab69f40447402f4c677b44fae76c6e54ea288bd
BASE="https://raw.githubusercontent.com/Kazuhito00/MobileSAM-ONNX-Sample/$COMMIT/onnx_model"

fetch() {   # fetch <upstream name> <local path> <sha256>
  local src="$1" dst="$2" sum="$3"
  if [ -f "$dst" ] && echo "$sum  $dst" | sha256sum -c --quiet 2>/dev/null; then return 0; fi
  local tmp; tmp="$(mktemp "${dst}.XXXXXX")"
  curl -fL --progress-bar -o "$tmp" "$BASE/$src"
  if ! echo "$sum  $tmp" | sha256sum -c --quiet; then
    rm -f "$tmp"; echo "checksum mismatch for $src — refusing to install it" >&2; return 1
  fi
  mv -f "$tmp" "$dst"
}
fetch vit_t_encoder.onnx public/models/mobilesam-encoder.onnx c51e08124f9ec76a6033251b627dfc930d66016ec5d80a30e2e8015ac3dc517c
fetch vit_t_decoder.onnx public/models/mobilesam-decoder.onnx 2542b80880d35c8ed7ea104873b5df0ba15499c325f135eb52d616182039baf8
for f in ort-wasm-simd-threaded.wasm ort-wasm-simd-threaded.mjs \
         ort-wasm-simd-threaded.jsep.wasm ort-wasm-simd-threaded.jsep.mjs; do
  cp -f "node_modules/onnxruntime-web/dist/$f" "public/ort/$f"
done
echo "MobileSAM ready:"; du -sh public/models public/ort
