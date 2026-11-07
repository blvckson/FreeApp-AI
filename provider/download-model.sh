#!/usr/bin/env sh
set -eu

# Model-neutral downloader. The provider runtime does not select or require
# any particular model. Supply a compatible artifact URL and destination name.
: "${MODEL_URL:?Set MODEL_URL to the model artifact you have chosen}"
MODEL_FILENAME="${MODEL_FILENAME:-model.gguf}"
case "$MODEL_FILENAME" in
  */*|.*) echo "MODEL_FILENAME must be a simple filename." >&2; exit 1 ;;
esac
MODEL_DIR="$(dirname "$0")/models"
mkdir -p "$MODEL_DIR"
TARGET="$MODEL_DIR/$MODEL_FILENAME"
if [ -e "$TARGET" ]; then
  echo "$TARGET already exists; remove it first to download again."
  exit 0
fi
if command -v curl >/dev/null 2>&1; then
  curl -fL --retry 3 "$MODEL_URL" -o "$TARGET"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$TARGET" "$MODEL_URL"
else
  echo "Install curl or wget first." >&2
  exit 1
fi
