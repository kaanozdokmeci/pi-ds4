---
name: pi-ds4-config
description: Reconfigure pi-ds4 for local DeepSeek V4 Flash, DeepSeek V4.1 Flash, DeepSeek V4 Pro, GLM 5.2, GLM 5.3, and Qwen3.8 Flash Next models. Use when the user asks how to configure, download models, change protocol/runtime settings, or debug pi-ds4.
---

# pi-ds4 configuration

To reconfigure pi-ds4/ds4, edit `~/.pi/ds4/settings.json` (create it if missing). Do not edit other runtime state files in `~/.pi/ds4` unless explicitly debugging.

The file is a JSON object. Environment variables override it. Keys can be env names (`DS4_READY_TIMEOUT_MS`), camelCase without `DS4_` (`readyTimeoutMs`), or lower snake_case (`ready_timeout_ms`). Use `settings.schema.json` / `settings.example.json` from the pi-ds4 package for validation/examples.

Minimal example:

```json
{
  "$schema": "https://raw.githubusercontent.com/kaanozdokmeci/pi-ds4/main/settings.schema.json",
  "protocol": "openai-responses",
  "contextTokens": 393216,
  "readyTimeoutMs": 900000
}
```

Common settings:

- `protocol`: `openai`, `openai-responses` (default), or `anthropic`
- `contextTokens`: ds4/Pi context ceiling (default `393216`). GLM 5.2 caps it at `202752` and Qwen3.8 at its native `262144`. GLM 5.3 Flash Q2 starts at `131072` unless `contextTokens` is set explicitly; ds4's GLM memory guard refuses contexts that do not fit and logs why.
- `power`: DeepSeek V4 Flash and Pro GPU duty-cycle target from `1` to `100` (default `100`). Lower values reduce heat and fan noise. DeepSeek V4.1, GLM and Qwen3.8 always run at `100` because upstream does not throttle them.
- `ssdStreaming`: `auto` (default), `true`, or `false`. In `auto` the server gets `--ssd-streaming` when a model's resident weights exceed 90% of system RAM. DeepSeek V4.1 (152 GiB for Q2, 294 GiB for Q4, with Engram tables staying on disk) and GLM 5.3 (90 GiB Flash Q2, 178 GiB Flash Q4, 197 GiB full Q2) declare such a footprint. Streaming lowers the context to 131072 tokens for V4.1 and 65536 for GLM 5.3 unless `contextTokens` is set explicitly. Qwen3.8 never streams because upstream has no streaming path for it.
- `speculativeDecoding`: `false` (default) or `true`. When on, GLM 5.3 Flash and Qwen3.8 start with `--mtp`, and resident DeepSeek V4 Flash models start with `--dspark --mtp-model FILE` once the matching DSpark support file is downloaded from `/ds4`. Gains depend on the workload and can be negative.
- `autoUpdate`: fast-forward the package-managed ds4 checkout before use (default `true`; local/external checkouts are untouched)
- `readyTimeoutMs`: server startup timeout in ms
- `runtimeDir`: existing antirez/ds4 checkout instead of `~/.pi/ds4/support`
- `supportRepo` / `supportBranch`: runtime checkout source
- `serverBinary` / `watchdogScript`: custom executable/script paths
- `apiKey`: token Pi sends to the local provider (default `dsv4-local`)

`DS4_GGUF_DIR` is an environment-only upstream ds4 option for storing downloaded GGUF files outside the runtime checkout. It is not a `settings.json` key.

Downloads started from `/ds4` run in the background, several at once, each with its own status line; a lock under `~/.pi/ds4/downloads/<target>` keeps a second Pi process from downloading the same target. Quitting Pi or `/reload` stops them, and selecting the model again resumes. Download progress is measured from the requested growing files in the download directory (including their matching hashed files under the Hugging Face downloader's `.cache/huggingface/download` directory, which print nothing when piped) and compared against the exact sizes in `download_model.sh`'s `artifact_identity()` where upstream declares them. If progress looks stuck, check `~/.pi/ds4/log` for the raw downloader output.

After editing, run `/reload` or restart Pi. Models are never downloaded automatically. Use `/ds4` to download an explicit DeepSeek V4 Flash, DeepSeek V4.1 Flash, DeepSeek V4 Pro, GLM 5.2, GLM 5.3, or Qwen3.8 Flash Next variant or add-on and to view the log or control the server. Existing and completed downloads are discovered and registered automatically in Pi's model catalogue.

DeepSeek V4.1 Flash (`dsv41-flash-q2`, `dsv41-flash-q4`) needs 341 GiB and 483 GiB of disk respectively; the Q4 download arrives in two parts that are joined automatically and needs another 37 GiB free while joining. It runs on Metal, and on CUDA for text only. V4 Flash vision encoders and DSpark files are not compatible with it.

Qwen3.8 Flash Next (`qwen38-flash-q2`, `qwen38-flash-q4`) downloads 137 GiB and 165 GiB but keeps only 42 GiB and 70 GiB resident; its n-gram table stays on disk, so keep it on a fast local SSD.

Images: download a vision encoder from the same `/ds4` menu. DeepSeek V4.1 Flash uses `ds41f-vision` (Metal only, so the entry only appears on macOS), GLM 5.3 Flash uses `glm53-vision`, and Qwen3.8 uses `qwen38-vision`. The DeepSeek V4 Flash Vision Experimental downloads include their encoder (`ds4f-vision-encoder`); it does not work with the Flash 0731 models. When a model's encoder is present, ds4-server is started with `--vision` and the model advertises image input. Changing the encoder, DSpark or speculative decoding state restarts the server on the next request.
