#!/usr/bin/env sh
set -eu

# Default: compact Qwen 2.5 3B Instruct GGUF, quantized for modest hardware.
# Override MODEL_URL to choose a different compatible GGUF model.
MODEL_URL="${MODEL_URL:-https://huggingface.co/bartowski/Qwen2.5-3B-Instruct-GGUF/resolve/main/Qwen2.5-3B-Instruct-Q4_K_M.gguf}"
mkdir -p "$(dirname "$0")/models"
if [ -f "$(dirname "$0")/models/model.gguf" ]; then
  echo "models/model.gguf already exists; remove it first to download again."
  exit 0
fi
if command -v curl >/dev/null 2>&1; then
  curl -fL --retry 3 "$MODEL_URL" -o "$(dirname "$0")/models/model.gguf"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$(dirname "$0")/models/model.gguf" "$MODEL_URL"
else
  echo "Install curl or wget first." >&2
  exit 1
fi
