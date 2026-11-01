import os
import secrets
import time
from typing import Any

import gradio as gr
import spaces
import torch
from fastapi import FastAPI, Header, HTTPException, Request
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL_ID = os.getenv("FREEAPP_MODEL_ID", "Qwen/Qwen2.5-7B-Instruct")
MODEL_ALIAS = "freeapp-ai-qwen7b-experiment"
API_KEY = os.getenv("FREEAPP_SPACE_API_KEY", "")

# ZeroGPU's documented Transformers pattern loads weights at module scope.
# The model is isolated to this experiment and is never bundled in the Android app.
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID, trust_remote_code=False)
model = AutoModelForCausalLM.from_pretrained(
    MODEL_ID,
    torch_dtype=torch.bfloat16,
    device_map="cuda",
    low_cpu_mem_usage=True,
    trust_remote_code=False,
)
model.eval()


def _messages_to_prompt(messages: Any) -> str:
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must be a non-empty array")
    normalized = []
    for item in messages:
        if not isinstance(item, dict) or item.get("role") not in {"system", "user", "assistant"}:
            raise ValueError("each message must have a supported role and text content")
        content = item.get("content")
        if not isinstance(content, str):
            raise ValueError("only text message content is supported in this experiment")
        normalized.append({"role": item["role"], "content": content})
    return tokenizer.apply_chat_template(
        normalized, tokenize=False, add_generation_prompt=True
    )


@spaces.GPU(duration=120)
def generate_completion(messages: Any, max_tokens: int, temperature: float) -> str:
    prompt = _messages_to_prompt(messages)
    inputs = tokenizer(prompt, return_tensors="pt").to(model.device)
    input_length = inputs["input_ids"].shape[1]
    max_tokens = max(1, min(int(max_tokens), 2048))
    temperature = max(0.0, min(float(temperature), 1.5))
    generation_args = {
        "max_new_tokens": max_tokens,
        "do_sample": temperature > 0,
        "pad_token_id": tokenizer.eos_token_id,
        "eos_token_id": tokenizer.eos_token_id,
    }
    if temperature > 0:
        generation_args["temperature"] = temperature
        generation_args["top_p"] = 0.9
    with torch.inference_mode():
        output = model.generate(**inputs, **generation_args)
    return tokenizer.decode(output[0][input_length:], skip_special_tokens=True).strip()


api = FastAPI(title="FreeApp AI isolated Qwen 7B experiment")


def _authorize(authorization: str | None) -> None:
    if not API_KEY:
        raise HTTPException(status_code=503, detail="Experiment API key is not configured")
    supplied = (authorization or "").removeprefix("Bearer ").strip()
    if not secrets.compare_digest(supplied, API_KEY):
        raise HTTPException(status_code=401, detail="Unauthorized")


@api.get("/health")
async def health(authorization: str | None = Header(default=None)):
    _authorize(authorization)
    return {"status": "ready", "model": MODEL_ID, "experiment_only": True}


@api.get("/v1/models")
async def list_models(authorization: str | None = Header(default=None)):
    _authorize(authorization)
    return {"object": "list", "data": [{"id": MODEL_ALIAS, "object": "model", "owned_by": "freeapp-ai-experiment"}]}


@api.post("/v1/chat/completions")
async def chat_completions(request: Request, authorization: str | None = Header(default=None)):
    _authorize(authorization)
    body = await request.json()
    requested_model = body.get("model", MODEL_ALIAS)
    if requested_model not in {MODEL_ALIAS, MODEL_ID}:
        raise HTTPException(status_code=400, detail="Unknown experiment model")
    try:
        messages = body.get("messages")
        max_tokens = int(body.get("max_tokens", 512))
        temperature = float(body.get("temperature", 0.2))
        answer = generate_completion(messages, max_tokens, temperature)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Inference failed: {type(exc).__name__}") from exc
    if not answer:
        raise HTTPException(status_code=502, detail="Model returned an empty completion")
    return {
        "id": f"chatcmpl-freeapp-{int(time.time() * 1000)}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": MODEL_ALIAS,
        "choices": [{"index": 0, "message": {"role": "assistant", "content": answer}, "finish_reason": "stop"}],
    }


demo = gr.Blocks(title="FreeApp AI — isolated Qwen 7B experiment")
with demo:
    gr.Markdown("# FreeApp AI — isolated Qwen 7B experiment")
    gr.Markdown("Research-only endpoint. This does not alter or replace production FreeApp AI.")
    gr.Markdown("Use the authenticated OpenAI-compatible API endpoint for controlled tests.")

app = gr.mount_gradio_app(api, demo, path="/")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "7860")))
