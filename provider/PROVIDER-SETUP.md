# Deployment checklist

- [ ] Choose an inference engine and implement or select an adapter satisfying [ENGINE-CONTRACT.md](ENGINE-CONTRACT.md). No specific model or vendor is required by FreeApp AI.
- [ ] Provision an always-on CPU/GPU host with adequate RAM and disk for the chosen engine.
- [ ] Configure the engine artifact/model separately from the FreeApp AI provider interface.
- [ ] Set a strong provider API key in an untracked local environment file.
- [ ] Start the adapter and confirm its readiness endpoint.
- [ ] Put the API behind HTTPS and restrict access to the FreeApp AI Worker.
- [ ] Configure Worker secrets `FREEAPP_INTERNAL_PROVIDER_URL` and `FREEAPP_INTERNAL_API_KEY`; set `FREEAPP_INTERNAL_MODEL` to the adapter's alias if needed.
- [ ] Test health, authentication, a short chat completion, and a code-generation request through `/api/generate`.
- [ ] Run the complete regression benchmark before enabling `FREEAPP_INTERNAL_ONLY=true`.
