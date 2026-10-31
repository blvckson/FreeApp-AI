# Deployment checklist

- [ ] Provision an always-on CPU/GPU host with adequate RAM and disk.
- [ ] Download a compatible GGUF model into `provider/models/model.gguf`.
- [ ] Set a strong `LLAMA_API_KEY` in an untracked `provider/.env` file.
- [ ] Start the llama.cpp container and confirm its health endpoint.
- [ ] Put the API behind HTTPS and restrict access to the FreeApp AI Worker.
- [ ] Configure Worker secrets `FREEAPP_INTERNAL_PROVIDER_URL` and `FREEAPP_INTERNAL_API_KEY`.
- [ ] Test a short chat completion and a code-generation request through `/api/generate`.
- [ ] Run the complete regression benchmark before enabling `FREEAPP_INTERNAL_ONLY=true`.
