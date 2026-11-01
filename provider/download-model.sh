#!/usr/bin/env sh
set -eu

# FreeApp AI's initial open-weight model profile. Override MODEL_URL,
# MODEL_FILENAME and MODEL_SHA256 to replace the model without changing code.
MODEL_URL="${MODEL_URL:-https://huggingface.co/bartowski/SmolLM2-1.7B-Instruct-GGUF/resolve/main/SmolLM2-1.7B-Instruct-Q4_K_M.gguf}"
MODEL_FILENAME="${MODEL_FILENAME:-SmolLM2-1.7B-Instruct-Q4_K_M.gguf}"
MODEL_SHA256="${MODEL_SHA256:-77665ea4815999596525c636fbeb56ba8b080b46ae85efef4f0d986a139834d7}"

case "$MODEL_FILENAME" in
  ""|*/*|.*) echo "MODEL_FILENAME must be a simple filename." >&2; exit 1 ;;
esac
case "$MODEL_SHA256" in
  *[!0-9a-fA-F]*|"") echo "MODEL_SHA256 must be a 64-character hexadecimal SHA-256." >&2; exit 1 ;;
esac
[ "${#MODEL_SHA256}" -eq 64 ] || { echo "MODEL_SHA256 must contain 64 characters." >&2; exit 1; }

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
MODEL_DIR="$SCRIPT_DIR/models"
mkdir -p "$MODEL_DIR"
TARGET="$MODEL_DIR/$MODEL_FILENAME"
PART="$TARGET.part"

if [ -f "$TARGET" ]; then
  echo "$TARGET already exists; verify it with sha256sum before reuse."
  exit 0
fi

cleanup() { rm -f "$PART"; }
trap cleanup EXIT HUP INT TERM

if command -v curl >/dev/null 2>&1; then
  curl -fL --retry 3 --connect-timeout 20 "$MODEL_URL" -o "$PART"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$PART" "$MODEL_URL"
else
  echo "Install curl or wget first." >&2
  exit 1
fi

if command -v sha256sum >/dev/null 2>&1; then
  ACTUAL_SHA256="$(sha256sum "$PART" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  ACTUAL_SHA256="$(shasum -a 256 "$PART" | awk '{print $1}')"
else
  echo "A SHA-256 utility (sha256sum or shasum) is required." >&2
  exit 1
fi

if [ "$(printf '%s' "$ACTUAL_SHA256" | tr 'A-F' 'a-f')" != "$(printf '%s' "$MODEL_SHA256" | tr 'A-F' 'a-f')" ]; then
  echo "Model checksum mismatch; refusing to install the downloaded artifact." >&2
  exit 1
fi

mv "$PART" "$TARGET"
trap - EXIT HUP INT TERM
echo "Verified model installed: $TARGET"
