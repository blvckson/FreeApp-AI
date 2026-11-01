# Isolated Hugging Face ZeroGPU model experiment

This experiment is deliberately isolated from the production Worker, provider routing, benchmark definitions, and Android app. It does not replace the SmolLM2 baseline and is not enabled by any production setting.

## Candidate under test

- Model: `Qwen/Qwen2.5-7B-Instruct`
- Upstream license: Apache-2.0 (verify the current model card before redistribution)
- Precision: BF16
- Approximate weight footprint: 14–16 GB, plus runtime/cache overhead
- Target hardware: Hugging Face ZeroGPU `large` (48 GB VRAM); `xlarge` is not assumed or required
- Runtime: Gradio + Transformers + PyTorch; ZeroGPU does not run the existing llama.cpp Docker service

The larger candidate is an experiment, not a guaranteed improvement. It must pass real inference and the exact existing FreeApp-AI regression benchmark before any integration is considered.

## Hosting constraints

A free personal Hugging Face account must be in good standing (verified email and account older than 30 days) to host up to two ZeroGPU Spaces. Current free quota is 5 GPU minutes per 24-hour reset window. ZeroGPU is on-demand shared compute, not continuous always-on hosting. It is therefore suitable for controlled experiments, not yet a production service promise.

## Create the Space

Create a Gradio Space named `freeapp-ai-qwen7b-experiment`, select ZeroGPU hardware, and connect this directory to that Space. Do not place credentials in source files.

Set Space secret `FREEAPP_SPACE_API_KEY` to a long random value. The inference endpoint requires it as a Bearer token. Do not send the secret in chat.

## Endpoint

`POST /v1/chat/completions`

Request uses an OpenAI-compatible subset:
```json
{
  "model": "freeapp-ai-qwen7b-experiment",
  "messages": [{"role": "user", "content": "Say hello"}],
  "max_tokens": 128,
  "temperature": 0.2
}
```

Send `Authorization: Bearer <FREEAPP_SPACE_API_KEY>`. This endpoint is only for isolated experiments. Do not configure production Worker secrets to point here.

## Validation gates

1. Space builds successfully on ZeroGPU.
2. Authenticated health check returns ready.
3. A real completion succeeds and returns non-empty assistant text.
4. Repeat requests, latency, token limits, queue behaviour and quota use are recorded.
5. Run the same frozen FreeApp-AI benchmark prompts against the baseline and candidate, without changing prompts, scoring, or production routing.
6. Reject the candidate if it regresses any protected category or cannot meet practical availability needs.

No production files are modified by this experiment. Do not merge it into the provider branch until the owner explicitly approves after reviewing results.
