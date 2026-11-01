# FreeApp AI — independent inference provider and model

FreeApp AI owns its provider interface, request routing, authentication boundary, response normalization, prompt orchestration, and model/runtime configuration. The inference engine and model artifact are replaceable behind that interface.

**Important distinction:** this project does not claim to have trained a new foundation model from scratch. It uses an open-weight upstream model as the initial inference model while FreeApp AI owns the surrounding inference system and can replace or fine-tune the weights later. The model runs on the external compute host; it is not bundled into the Android APK.

## Architecture

`FreeApp AI app → FreeApp AI Worker → authenticated FreeApp AI inference endpoint → llama.cpp runtime → selected model weights`

The internal provider speaks an OpenAI-compatible chat-completions contract at `/v1/chat/completions`. External AI APIs remain optional compatibility fallbacks; they are not the internal model. The Worker can run internal-first, or internal-only after live validation.

## Initial model profile

The first reproducible baseline is defined in [model-profile.json](model-profile.json):

- Model: HuggingFaceTB/SmolLM2-1.7B-Instruct
- Format/quantization: GGUF Q4_K_M
- Approximate artifact size: 1.06 GB
- Runtime: llama.cpp
- Context configured for first test: 4,096 tokens
- Host memory: at least 4 GB recommended for initial single-request testing; more is needed for concurrency.
- License: Apache-2.0 for the upstream model; retain its notices and check the model card before redistribution.

This is a small bootstrap model. It must be benchmarked against FreeApp AI's reasoning, programming, debugging, app-building, and research tasks. It is not represented as ChatGPT-equivalent. A stronger model can replace it without changing the app-facing API.

## Deploy the inference runtime

1. Use a Linux host with Docker Engine/Compose, persistent disk of at least 3 GB, and at least 4 GB RAM for the first smoke test. A free host may sleep, impose quotas, or lack sufficient memory; GitHub Actions is not an always-on inference server.
2. Copy `.env.example` to `.env` and set a long random `LLAMA_API_KEY`. Keep `.env` private.
3. Download and verify the default open-weight model:

   `sh download-model.sh`

   The script verifies the pinned SHA-256 before installing the file. Override `MODEL_URL`, `MODEL_FILENAME`, and `MODEL_SHA256` to use another compatible GGUF model.
4. Start the runtime:

   `docker compose --env-file .env up -d`

5. Check readiness and a real completion:

   `FREEAPP_INTERNAL_PROVIDER_URL=http://127.0.0.1:8080 FREEAPP_INTERNAL_API_KEY='<same-key>' sh smoke-test.sh`

6. Put the endpoint behind authenticated HTTPS or a private network tunnel before connecting a remote Worker. Do not expose port 8080 directly to the public internet.

## Connect the FreeApp AI Worker

Configure Worker secrets/variables:

- `FREEAPP_INTERNAL_PROVIDER_URL`: protected HTTPS base URL of this inference endpoint.
- `FREEAPP_INTERNAL_API_KEY`: same secret configured on the inference host.
- `FREEAPP_INTERNAL_MODEL=freeapp-ai-base`: configured model alias.
- `FREEAPP_INTERNAL_TIMEOUT_MS`: bounded request timeout (default 90 seconds, maximum 180 seconds).
- `FREEAPP_INTERNAL_ONLY=true`: optional strict mode; enable only after the internal endpoint is live and all required benchmarks pass.

The internal model is attempted first when configured. Existing external provider integrations remain separate compatibility fallbacks unless strict internal-only mode is enabled. Do not enable strict mode while the internal host is unavailable.

## Validation status

Repository CI validates syntax, manifest integrity, deployment files, and existing regression tests. That does **not** prove live model inference. A live endpoint smoke test and task benchmark are still required after deployment. No benchmark score, APK integration, or successful live hosting is claimed until those tests actually run.
