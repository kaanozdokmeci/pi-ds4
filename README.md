# pi-ds4

Run [antirez/ds4](https://github.com/antirez/ds4) models locally in Pi. The
extension supports DeepSeek V4 Flash (including Vision Experimental), DeepSeek
V4.1 Flash, DeepSeek V4 Pro, GLM 5.3 Flash, GLM 5.3, GLM 5.2, and Qwen3.8 Flash
Next.

This is a fork of [mitsuhiko/pi-ds4](https://github.com/mitsuhiko/pi-ds4) that
tracks the newer ds4 models, vision encoders and speculative decoding.

## Install

```sh
pi install https://github.com/kaanozdokmeci/pi-ds4
```

Restart Pi or run `/reload`.

## Get started

1. Run `/ds4` and choose **Download model**.
2. Pick a model. Qwen3.8 Flash Next Q2 is the smallest option and keeps about
   42 GiB resident. On a 96 or 128 GB machine, start with DeepSeek V4 Flash Q2
   or GLM 5.3 Flash Q2.
3. After the download finishes, run `/model` and select the new `ds4/...`
   model.
4. Start chatting.

Downloads run in the background, so you can keep working in Pi and start more
downloads from `/ds4` while one runs. The status line sums them up, for example
`ds4: downloading 2 models, 37% done`. While downloads run, `/ds4` also offers
**Download progress**, a pop-up with a progress bar, transfer rate and ETA for
each one. Progress is counted from the bytes on disk.
Only one Pi process downloads a given model at a time. Quitting Pi or running
`/reload` stops running downloads; selecting the model again resumes where it
left off. Full output stays in `~/.pi/ds4/log`.

Models are never downloaded automatically. Once installed, they are discovered
on future Pi starts and shown in `/model`. Selecting one starts `ds4-server` on
demand; it stops automatically when no Pi processes are using it.

Use `/ds4` at any time to download another model or add-on, view the log, or
start and stop the server manually. When the active model is not a ds4 model,
**Start server** lists the downloaded models. Each entry shows the model's RAM
requirement and how this machine would start it: resident or with SSD
streaming, the context size, and whether vision, speculative decoding or
reduced power apply. It also warns when a resident model needs more RAM than
the machine has.

Most large downloads use the Hugging Face CLI (`hf`). ds4's download script
prints installation instructions when it is missing.

## Models

| Pi model | Model | Recommended RAM |
|---|---|---:|
| `ds4/qwen38-flash-q2` | Qwen3.8 Flash Next Q2 | 64 GB |
| `ds4/qwen38-flash-q4` | Qwen3.8 Flash Next Q4 | 128 GB |
| `ds4/dsv4-flash-q2` | DeepSeek V4 Flash Q2 imatrix | 96 GB |
| `ds4/dsv4-flash-vision-q2` | DeepSeek V4 Flash Vision Experimental Q2 | 96 GB |
| `ds4/dsv4-flash-q2q4` | DeepSeek V4 Flash mixed Q2/Q4 imatrix | 128 GB |
| `ds4/dsv4-flash-vision-q2q4` | DeepSeek V4 Flash Vision Experimental mixed Q2/Q4 | 128 GB |
| `ds4/glm53-flash-q2` | GLM 5.3 Flash Q2 | 128 GB |
| `ds4/dsv4-flash-q4` | DeepSeek V4 Flash Q4 imatrix | 256 GB |
| `ds4/glm53-flash-q4` | GLM 5.3 Flash Q4 | 256 GB, or SSD streaming |
| `ds4/glm53-full-q2` | GLM 5.3 IQ2 XXS | 256 GB, or SSD streaming |
| `ds4/dsv41-flash-q2` | DeepSeek V4.1 Flash Q2 | 192 GB, or SSD streaming |
| `ds4/dsv41-flash-q4` | DeepSeek V4.1 Flash Q4 | 512 GB, or SSD streaming |
| `ds4/dsv4-pro-q2` | DeepSeek V4 Pro Q2 imatrix | 512 GB |
| `ds4/glm52-iq2xxs` | GLM 5.2 IQ2 XXS | 256 GB |
| `ds4/glm52-q2` | GLM 5.2 Q2 | 384 GB |
| `ds4/glm52-q4` | GLM 5.2 Q4 | 512 GB |
| `ds4/glm52-q4-xl` | GLM 5.2 Unsloth Q4 XL | 512 GB |

These are conservative full-residency recommendations. ds4 can also stream
from SSD or run across multiple machines, with different performance tradeoffs.
Signing in to Hugging Face before downloading may improve download speed.

Qwen3.8 Flash Next keeps its 95 GiB n-gram table on disk and reads rows as
needed, so its downloads (137 GiB for Q2, 165 GiB for Q4) are much larger than
its resident weights (42 GiB and 70 GiB). Keep the GGUF on a fast local SSD.
Its context is capped at the native 262144 tokens, and upstream has no SSD
streaming path for it.

GLM 5.3 Flash Q2 is close to a 128 GB machine's memory budget, so it starts
with a 131072-token context. Set `contextTokens` to change that; ds4 refuses to
start when the context does not fit, and the reason is in the log.

DeepSeek V4.1 Flash needs much more disk than RAM: 341 GiB on disk for Q2 and
483 GiB for Q4, because its Engram tables stay on disk and are read as needed.
Only 152 GiB (Q2) and 294 GiB (Q4) of weights are resident. Keep the GGUF on a
fast local SSD; the Q4 download arrives in two parts that are joined
automatically and needs another 37 GiB of free space while joining. V4.1 runs
on Metal, and on CUDA for text inference. Q2 is the 1017 checkpoint; a Q2 file
downloaded before ds4 switched to it is no longer detected.

The DeepSeek V4 Flash Vision Experimental models are a different checkpoint
from Flash 0731. Their downloads include the matching vision encoder.

## Thinking levels

Pi's thinking levels map to ds4's reasoning effort per model family:

| Family | Levels |
|---|---|
| DeepSeek V4, GLM | off, high, max |
| DeepSeek V4.1 | off, low (effort 25), medium (50), high (75), max (100) |
| Qwen3.8 | off, low, medium, high |

## Images

Vision encoders are optional add-ons in `/ds4` → **Download model**:

| Encoder | Models | Size |
|---|---|---:|
| DeepSeek V4.1 Flash | `dsv41-flash-*`, Metal only | 0.9 GiB |
| DeepSeek V4 Flash Vision Experimental | `dsv4-flash-vision-*` (included in their download) | 0.9 GiB |
| GLM 5.3 Flash | `glm53-flash-*` | 1.1 GB |
| Qwen3.8 Flash Next | `qwen38-flash-*` | 0.6 GB |

When the encoder for a model is present, the next server start adds `--vision`
and the model accepts image input in Pi. ds4-server accepts up to 256 inline
images per request.

## Speculative decoding

Set `speculativeDecoding` to `true` to let ds4 draft several tokens ahead and
verify them in one pass:

- GLM 5.3 Flash and Qwen3.8 use the MTP block built into their GGUF (`--mtp`).
- DeepSeek V4 Flash uses DSpark (`--dspark`). Download its support file from
  `/ds4`: one for the Flash 0731 models (about 6 GB), and another for the
  Vision Experimental models (about 5.6 GiB). DSpark needs a resident model,
  so it stays off while the model streams from SSD.

It is off by default because gains depend on the prompt and the draft can make
generation slower. Measure your workload.

## SSD streaming

When a model's resident weights do not fit in system RAM, the extension starts
`ds4-server` with `--ssd-streaming` and lowers the context unless
`contextTokens` is set explicitly: to 131072 tokens for DeepSeek V4.1 and 65536
for GLM 5.3. The V4.1 and GLM 5.3 models declare a resident footprint, so this
affects them alone. Set `ssdStreaming` to `true` or `false` to decide it
yourself. Qwen3.8 never streams.

## Configuration

Most users do not need any configuration. Optional settings live in
`~/.pi/ds4/settings.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/kaanozdokmeci/pi-ds4/main/settings.schema.json",
  "protocol": "openai-responses",
  "readyTimeoutMs": 900000
}
```

See [`settings.example.json`](settings.example.json) for all options. Each
setting also has a `DS4_*` environment variable; environment variables take
precedence. Restart Pi or run `/reload` after changing settings.

Set `power` to an integer from 1 to 100 to limit the GPU duty cycle for
DeepSeek V4 Flash and Pro, reducing heat and fan noise. It defaults to 100.
DeepSeek V4.1, GLM and Qwen3.8 always run at full power because upstream does
not throttle them.

Runtime files, downloaded models, caches, and logs are stored in `~/.pi/ds4`.
Package-managed ds4 checkouts update automatically; explicitly configured or
local development checkouts are left untouched.

## Local development

To use this extension checkout with an existing ds4 checkout:

```sh
./install-pi-extension-local.sh /path/to/antirez-ds4-checkout
```

If `~/.pi/ds4/support` already points elsewhere, rerun with `--force`. Existing
model downloads are preserved when possible.

Run the tests with `npm test`. Set `DS4_DOWNLOAD_SCRIPT` to a ds4 checkout's
`download_model.sh` to also check the model catalogue against it; otherwise
that check uses `~/.pi/ds4/support` when it exists.
