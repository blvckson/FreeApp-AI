# FreeApp AI — self-hosted internal model provider

This is the first-party inference runtime for FreeApp AI. It runs an open-weight GGUF language model under your control using llama.cpp's server. It does **not** call Kilo, LLM7, Gemini, Pollinations, or Cloudflare Workers AI to generate text. Those existing integrations remain optional fallbacks in the Worker unless internal-only mode is enabled.

## What this delivers

- A real model process serving chat completions at `/v1/chat/completions`.
- A compact default Qwen 2.5 3B Instruct Q4_K_M model, downloaded as a separate artifact (not committed to Git).
- Bearer-token protection between the Worker and model server.
- Configurable internal-first or strict internal-only inference.

## Host requirements

Run this on a machine you control that can stay online and is reachable from the deployed Worker over HTTPS. A small 3B quantized model can run on CPU, but generation may be slow; more RAM and a supported GPU improve throughput. Allow several GB of free disk space for the model and additional memory for inference. This repository and GitHub Actions do not provide the compute host automatically.

## Start the model

1. Install Docker Engine and the Docker Compose plugin on your inference host.
2. Copy `.env.example` to `.env` and replace the example value with a long random secret. Never commit `.env`.
3. Run `sh download-model.sh` from this directory. Set `MODEL_URL` to a compatible GGUF download URL to use another open-weight model.
4. Run `docker compose --env-file .env up -d`.
5. Put the service behind a trusted HTTPS reverse proxy or private network tunnel. Do not expose port 8080 directly to the public internet. Keep the API key secret.
6. Verify locally with `curl -H "Authorization: Bearer YOUR_SECRET" http://127.0.0.1:8080/v1/models`.

The compose file binds the model port to loopback by default. Configure your reverse proxy to forward authenticated HTTPS traffic to this local port.

## Connect the FreeApp AI Worker

Set these Worker environment variables/secrets:

- `FREEAPP_INTERNAL_PROVIDER_URL`: base HTTPS URL of the protected model server (no trailing slash).
- `FREEAPP_INTERNAL_API_KEY`: same secret as `LLAMA_API_KEY` (store as a secret, not plaintext config).
- `FREEAPP_INTERNAL_MODEL`: optional model label; default `freeapp-local`.
- `FREEAPP_INTERNAL_TIMEOUT_MS`: optional; default 90000, maximum 180000.
- `FREEAPP_INTERNAL_ONLY`: set to `true` to make the internal model the sole text-generation provider. When enabled, a missing or failing internal provider returns a clear error rather than silently routing generation to an external provider.

With the URL configured, the internal model is attempted first. If it is unavailable and internal-only mode is false, the existing external compatibility chain can still serve requests.

## Important boundaries

This creates the internal model-serving software and integration, not a free hosted GPU. A reachable always-on host and a model file are required before live inference can succeed. The first model is a compact general-purpose starting point; it must be benchmarked on FreeApp AI's reasoning, programming, app-building, research synthesis, image and long-context tasks before claiming parity with larger hosted models. Image understanding remains on the existing image-analysis path until a compatible vision model is separately configured.
