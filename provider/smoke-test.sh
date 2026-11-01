#!/usr/bin/env sh
set -eu

BASE_URL="${FREEAPP_INTERNAL_PROVIDER_URL:-http://127.0.0.1:8080}"
API_KEY="${FREEAPP_INTERNAL_API_KEY:-}"
MODEL="${FREEAPP_INTERNAL_MODEL:-freeapp-ai-base}"

[ -n "$API_KEY" ] || { echo "Set FREEAPP_INTERNAL_API_KEY." >&2; exit 1; }
BASE_URL="${BASE_URL%/}"
AUTH_HEADER="Authorization: Bearer $API_KEY"

echo "Checking inference readiness..."
curl -fsS -H "$AUTH_HEADER" "$BASE_URL/health" >/dev/null

echo "Checking configured model..."
curl -fsS -H "$AUTH_HEADER" "$BASE_URL/v1/models" >/dev/null

echo "Checking a real model completion..."
PAYLOAD="$(MODEL="$MODEL" node -e 'process.stdout.write(JSON.stringify({model:process.env.MODEL,messages:[{role:"user",content:"Reply with exactly: FREEAPP_MODEL_READY"}],max_tokens:32,temperature:0,stream:false}))')"
RESPONSE="$(curl -fsS --connect-timeout 10 --max-time 120 -H "$AUTH_HEADER" -H "Content-Type: application/json" -d "$PAYLOAD" "$BASE_URL/v1/chat/completions")"
RESPONSE="$RESPONSE" node -e '
const body = JSON.parse(process.env.RESPONSE || "{}");
const text = body?.choices?.[0]?.message?.content ?? body?.response ?? "";
if (typeof text !== "string" || !text.trim()) {
  console.error("Inference endpoint returned no assistant text.");
  process.exit(1);
}
process.stdout.write("Inference completion received (" + text.trim().length + " characters).\n");
'
echo "Provider smoke test passed."
