# FreeApp AI internal inference engine contract

This contract belongs to FreeApp AI. It deliberately does not prescribe a model, model vendor, model family, or runtime.

## Required adapter interface

The adapter exposes:

- `GET /health` — returns HTTP 200 only when the inference engine is ready to accept requests.
- `GET /v1/models` — returns the configured engine/model aliases.
- `POST /v1/chat/completions` — accepts JSON with `model`, `messages`, `max_tokens`, `temperature`, and optional `stream=false`.

The chat response must contain assistant text in `choices[0].message.content` (preferred), or one of the normalized text fields supported by the Worker. Non-2xx responses should return a JSON `error.message` with a safe diagnostic. The adapter must enforce authentication and request-size/time limits.

## Replaceable engine boundary

An adapter may call a local runtime, a self-hosted inference server, a CPU/GPU engine, or a future FreeApp-owned inference implementation. If an engine has a different native API, only its adapter changes; the FreeApp AI Worker and app-facing API remain stable.

The reference llama.cpp Compose file is optional. It is not a hard dependency. No model is bundled or selected by this contract.

## Security and reliability

- Require a strong API key or private network identity.
- Use HTTPS between the Worker and any remotely hosted adapter.
- Never expose credentials in logs or client-side application code.
- Return explicit overload, timeout, and unavailable errors; do not fabricate an answer.
- Provide readiness health checks and bounded concurrency.
- Keep external providers disabled when `FREEAPP_INTERNAL_ONLY=true`.

## Minimum conformance checks

1. Missing/invalid credentials are rejected.
2. Health reports not-ready until the engine is ready.
3. A valid chat request returns non-empty assistant text.
4. Unknown model aliases return a clear 4xx response.
5. Engine timeout/overload returns a clear error and does not return fabricated text.
6. Replacing the backend engine requires no change to FreeApp AI app-facing request/response contracts.
