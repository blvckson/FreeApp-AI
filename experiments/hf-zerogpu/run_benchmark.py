#!/usr/bin/env python3
"""Run the frozen 50-case FreeApp-AI experiment benchmark against an OpenAI-compatible endpoint.

Required env:
  FREEAPP_BENCHMARK_URL  e.g. https://<space-host>/v1/chat/completions
  FREEAPP_BENCHMARK_KEY  API key (never commit it)
Optional:
  FREEAPP_MODEL_NAME    defaults to freeapp-ai-qwen7b-experiment
  FREEAPP_OUTPUT        defaults to benchmark-results.json
"""
import json, os, sys, time, urllib.request, urllib.error
from pathlib import Path

DATA = Path(__file__).with_name("benchmark-50.json")
URL = os.getenv("FREEAPP_BENCHMARK_URL", "").strip()
KEY = os.getenv("FREEAPP_BENCHMARK_KEY", "")
MODEL = os.getenv("FREEAPP_MODEL_NAME", "freeapp-ai-qwen7b-experiment")
OUTPUT = Path(os.getenv("FREEAPP_OUTPUT", "benchmark-results.json"))

def main():
    if not URL or not KEY:
        print("NOT RUN: set FREEAPP_BENCHMARK_URL and FREEAPP_BENCHMARK_KEY after the Space is deployed.")
        return 2
    dataset = json.loads(DATA.read_text(encoding="utf-8"))
    results = []
    for case in dataset["cases"]:
        payload = json.dumps({
            "model": MODEL,
            "messages": [{"role": "user", "content": case["prompt"]}],
            "max_tokens": 900,
            "temperature": 0
        }).encode()
        req = urllib.request.Request(URL, data=payload, headers={
            "Authorization": "Bearer " + KEY,
            "Content-Type": "application/json"
        })
        started = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=180) as response:
                body = json.loads(response.read().decode())
            answer = body["choices"][0]["message"]["content"]
            status, error = "completed", None
        except Exception as exc:
            answer, status, error = "", "error", type(exc).__name__ + ": " + str(exc)
        results.append({
            "id": case["id"], "category": case["category"], "title": case["title"],
            "status": status, "latency_seconds": round(time.monotonic()-started, 2),
            "answer": answer, "error": error,
            "rubric_scores": {item: None for item in case["rubric"]}
        })
        print(f'{case["id"]}: {status}')
    report = {
        "benchmark": dataset["name"], "version": dataset["version"],
        "model": MODEL, "endpoint": URL, "completed": sum(r["status"]=="completed" for r in results),
        "total": len(results), "results": results,
        "scoring_note": "Rubric scores remain null until independently reviewed. Do not report completion rate as quality."
    }
    OUTPUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Saved raw outputs to {OUTPUT}. Grade rubric items before calculating quality percentages.")
    return 0 if report["completed"] == report["total"] else 1

if __name__ == "__main__":
    sys.exit(main())
