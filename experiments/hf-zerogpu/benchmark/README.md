# Frozen 50-task benchmark

This benchmark is isolated from production and contains 10 tasks in each of five categories: reasoning, research, programming, debugging, and app building.

## Fair scoring

Each task has four observable rubric items. A reviewer assigns 1 only when the response demonstrably meets that item, otherwise 0. Category percentage = earned points / available points × 100. Overall percentage = all earned points / all available points × 100. Also report task completion separately; transport errors/timeouts are not silently counted as quality failures.

The prompts and rubrics must remain unchanged when comparing the existing baseline and the larger-model candidate. Record model ID/revision, quantization/precision, runtime, date, endpoint, latency, raw responses and scorer notes. Prefer blinded scoring where possible.

## Running

After the isolated Hugging Face Space is deployed, set `FREEAPP_BENCHMARK_URL` and `FREEAPP_BENCHMARK_KEY` in the shell environment and run:

```sh
python run_benchmark.py
```

The runner saves raw responses and leaves rubric scores null. It does not invent quality scores. Grade all rubric items before producing category and overall percentages.

## Current state

Dataset and runner are prepared. No model quality results exist until the Space is live and the 50 prompts have been executed and scored. This benchmark does not touch production routing, benchmark history, or Android app code.
