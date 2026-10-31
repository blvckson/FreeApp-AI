# FreeApp AI — independent, model-agnostic inference provider

FreeApp AI owns the provider interface, request routing, authentication boundary, response normalization, and provider configuration. The inference engine is a replaceable implementation behind that interface. **No named model or model vendor is mandatory.**

## Architecture

`FreeApp AI application → FreeApp AI Worker → internal provider contract → replaceable inference engine`

The internal provider speaks an OpenAI-compatible chat-completions contract at `/v1/chat/completions`. An engine can be replaced without changing FreeApp AI's application logic as long as it implements that contract directly or is wrapped by a thin adapter. The reference llama.cpp Compose service is optional—not the definition of the provider.

External model services (Kilo, LLM7, Gemini, Pollinations, and managed Workers AI) are not the independent provider. Existing compatibility integrations remain separate and can be disabled with strict internal-only mode.

## Engine contract

See [ENGINE-CONTRACT.md](ENGINE-CONTRACT.md) for request/response requirements, adapter responsibilities, health checks, and conformance tests.

## Optional reference runtime

The included `docker-compose.yml` is one replaceable adapter example using llama.cpp. It requires a model artifact selected by the operator; it does not download, select, or require a particular vendor's model.

1. Install Docker Engine and Docker Compose on a machine you control.
2. Copy `.env.example` to `.env` and set a long random API key.
3. Put a compatible model artifact in `provider/models/`, or download one using the generic script:
   `MODEL_URL='<artifact URL>' MODEL_FILENAME='model.gguf' sh download-model.sh`.
4. Set `MODEL_FILE=model.gguf` in `.env` (plus optional `MODEL_ALIAS` and `MODEL_CONTEXT_SIZE`).
5. Run `docker compose --env-file .env up -d`.
6. Put the service behind authenticated HTTPS or a private network tunnel. Do not expose port 8080 directly to the public internet.

A different inference engine can replace this Compose service if it satisfies the engine contract. The Worker only needs the protected HTTPS base URL and optional model alias; it does not need to know the engine brand.

## Connect the FreeApp AI Worker

Configure:

- `FREEAPP_INTERNAL_PROVIDER_URL`: protected HTTPS base URL of the internal provider adapter.
- `FREEAPP_INTERNAL_API_KEY`: same secret configured on the provider.
- `FREEAPP_INTERNAL_MODEL`: optional model/engine alias understood by the adapter; default is `freeapp-engine`.
- `FREEAPP_INTERNAL_TIMEOUT_MS`: optional; default 90000, maximum 180000.
- `FREEAPP_INTERNAL_ONLY=true`: make this provider the sole text-generation route. If it is unavailable, FreeApp AI returns an explicit provider error rather than silently switching to an external service.

The internal endpoint is attempted first. Without strict mode, existing external compatibility routing may still be used when the internal endpoint is not configured or fails. Strict mode is the setting that enforces independence.

## Hosting reality

This repository supplies provider software and the integration, not compute or free hosting. Live inference requires an always-on reachable host with enough RAM/CPU/GPU and disk for the chosen engine and model. Free hosting services may sleep, limit compute, or disconnect; GitHub Actions is not an always-on inference server. Do not enable strict mode until the internal endpoint is live and passes the project's reasoning, programming, app-building, research-synthesis, and reliability benchmarks.
