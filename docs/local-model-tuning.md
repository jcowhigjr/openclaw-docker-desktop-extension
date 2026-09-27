# Local Model Tuning Guide

This guide helps you tune OpenClaw for local Ollama models on constrained hardware. Running large language models locally requires balancing speed, memory, and context size against your hardware capabilities.

## The Core Constraint

The first reply in a new chat is slow. The model has to read its whole prompt first (the system prompt, workspace files, and tool definitions) before it writes a single token. On an M4 MacBook Air (24 GB) with `qwen3:8b`, that prompt is about 10,000 tokens and takes roughly 1–1.5 minutes. Later replies in the same chat reuse that work and take 10–25 seconds.

Earlier versions of this guide blamed a "120-second idle timeout" for failed local chats. That was wrong. Measured on 2026-09-24, the real causes were:

- **A network cut at ~70 seconds.** Node's TCP keepalive through `host.docker.internal` is not answered by Docker Desktop, so any request that waited ~70s for its first byte was dropped. The extension now routes Ollama traffic through a relay inside the container, which removes the cut ([#246](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/246)).
- **The tool surface.** OpenClaw hides tools behind a search step for local models, and 8B models can't use it; they loop instead of running a command. The extension now exposes a trimmed set of tools directly ([#247](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/247)).

OpenClaw's own idle timeout for self-hosted models is 300s, and the extension sets a 900s budget for a whole agent run. What remains is the prompt-reading time itself. The strategies below reduce it.

---

## One Model at a Time (Critical for Avoiding Timeouts)

The most important optimization for avoiding timeouts is to **use one model consistently**. When you switch models in the Control UI dropdown:

1. The previous model's KV cache is evicted from Ollama memory
2. The new model must load and re-evaluate the entire system prompt (~20,000 tokens)
3. This can take 8-40 seconds depending on the model and hardware
4. If you switch back, the cycle repeats

**Symptoms of cache eviction:**
- First chat with a model works fine
- Second chat with a different model is slow
- Switching back to the first model is slow again

### Solution: Use One Model Consistently

Pick one model for your workflow and stick with it. If you need multiple models, see below for the `OLLAMA_MAX_LOADED_MODELS` option.

### Solution: OLLAMA_MAX_LOADED_MODELS (If You Have RAM)

If you have sufficient RAM, you can configure Ollama to keep multiple models loaded simultaneously:

```bash
# macOS (add to ~/.zshrc or ~/.bash_profile)
export OLLAMA_MAX_LOADED_MODELS=2    # Allow 2 models in memory

# Linux (add to ~/.bashrc)
export OLLAMA_MAX_LOADED_MODELS=2
```

**Requirements:**
- gemma4-fast (8B) + qwen3.5 (9.7B): ~16GB RAM recommended
- Two gemma4 models: ~12GB RAM recommended

Default is `1`, which causes cache eviction when switching models.

---

## Quick Diagnostic: What Hardware Profile Are You?

| Profile | RAM | GPU | Typical Use Case |
|---------|-----|-----|------------------|
| [Light](#light-profile-cpu-only-8-16gb-ram) | 8-16 GB | None | Older laptops, budget desktops |
| [Balanced](#balanced-profile-apple-silicon-or-16-24gb-ram) | 16-24 GB | Integrated/Apple Silicon | MacBook Air/Pro M1-M4, modern laptops |
| [Performance](#performance-profile-32gb-ram-dedicated-gpu) | 32+ GB | 8GB+ VRAM | Desktop workstations, gaming PCs |

---

## Light Profile: CPU-Only, 8-16GB RAM

**Target:** Keep the first reply in a new chat to a few minutes. CPU-only prompt reading is several times slower than Apple Silicon, so prefer the smallest capable model.

### Recommended Models

| Model | Parameters | VRAM/RAM | Speed | Notes |
|-------|------------|----------|-------|-------|
| `gemma4-fast:latest` | 4B | ~3 GB | Fast | Best choice for light hardware |
| `qwen2.5:3b` | 3B | ~2 GB | Fast | Good alternative if gemma4 unavailable |
| `llama3.2:1b` | 1B | ~1 GB | Very fast | Minimal capability, but reliable |

**Avoid:** Models >7B parameters on CPU-only—they're too slow for practical use.

### Ollama Host Configuration

Set these environment variables on your **host Ollama** (not the extension container):

```bash
# macOS (add to ~/.zshrc or ~/.bash_profile)
export OLLAMA_NUM_PARALLEL=1          # Keep at 1—parallelism multiplies memory use
export OLLAMA_FLASH_ATTENTION=1       # Reduces memory, improves speed
export OLLAMA_KV_CACHE_TYPE=q4_0     # Aggressive quantization: ¼ memory of f16
export OLLAMA_KEEP_ALIVE=30m          # Keep model loaded, skip cold-start delay
```

Restart Ollama after setting:
```bash
# macOS
pkill ollama
open -a Ollama

# Linux
sudo systemctl restart ollama
```

### OpenClaw Extension Configuration

The extension applies this automatically whenever you apply a model through
Local Model Setup:

```json5
{
  agents: {
    defaults: {
      timeoutSeconds: 900,
      experimental: { localModelLean: true },
    },
  },
  tools: {
    // Local routes otherwise default to Tool Search, which 8B models cannot drive.
    toolSearch: false,
    byProvider: {
      // Only Ollama models get the trimmed set; cloud providers keep every tool.
      ollama: {
        profile: "coding",
        deny: ["group:sessions", "cron", "get_goal", "create_goal", "update_goal",
               "progress_card", "skill_workshop", "image_generate", "music_generate",
               "video_generate", "web_search", "x_search", "view_image", "code_execution"],
      },
    },
  },
}
```

The trimmed tool set keeps `exec`, `read`, `write`, `edit`, `apply_patch`,
`process`, `web_fetch`, and memory tools. It cuts the prompt from ~20,700 to
~9,900 tokens, which halves the first reply (3m19s → 1m22s measured). It also
keeps turns clear of OpenClaw's budget compaction, whose extra model calls
otherwise compete for Ollama's single slot. The denied tools cannot work in
this setup anyway: web/X search need provider keys, `view_image` needs a vision
model, and `code_execution` needs a separate sandbox.

`localModelLean` also trims optional tools such as browser and message. If you
set it yourself, including explicitly to `false`, the extension preserves your
value on every re-apply.

---

## Balanced Profile: Apple Silicon or 16-24GB RAM

**Target:** First reply in a new chat in about 1–1.5 minutes, follow-ups in 10–25 seconds (measured: M4 Air / 24 GB, `qwen3:8b`).

### Recommended Models

| Model | Parameters | VRAM/RAM | Speed | Notes |
|-------|------------|----------|-------|-------|
| `gemma4:latest` | 8B | ~6 GB | Medium | Good balance for M-series Macs |
| `qwen3.5:latest` | 9.7B | ~7 GB | Medium-Slow | Better reasoning, slower |
| `gemma4-long:latest` | 8B | ~6 GB | Medium | Optimized for longer context |

**M-series Mac tip:** Ollama uses Apple Silicon Neural Engine automatically—no extra config needed.

### Ollama Host Configuration

```bash
# macOS
export OLLAMA_NUM_PARALLEL=1          # Keep at 1 unless you have 32GB+
export OLLAMA_FLASH_ATTENTION=1       # ~20% speedup on Apple Silicon
export OLLAMA_KV_CACHE_TYPE=q8_0     # Good balance: ½ memory of f16
export OLLAMA_KEEP_ALIVE=30m
```

### Context Window Tuning

The extension writes `num_ctx: 24576` by default, with a matching `contextTokens` so
OpenClaw's input budget tracks the window Ollama will actually serve. Override in either
direction with `OPENCLAW_OLLAMA_NUM_CTX`.

**Do not set this back to unset.** Ollama does not size the context window from available
VRAM. It applies a small fixed default — measured at **4096** for `qwen3:8b` on an
M4/24 GB host, against an advertised context of 40960 — and 4096 cannot carry an agent
turn. At 4096 the workspace bootstrap is truncated, the model invents filenames instead
of reading them, and the run ends in `empty response detected` followed by a timeout.

Measured on an M4 Air / 24 GB, `qwen3:8b` at ~20 tok/s, on the task *"list a folder, read
the files, write an INDEX.md"*:

| `num_ctx` | Result |
|-----------|--------|
| 4096 (Ollama's own default) | fails — hallucinated filenames, `empty response detected`, run timeout |
| 16384 | fails — model wanders off the task, no file written |
| **24576** | **passes** — correct listing, all files read, accurate `INDEX.md`, reproduced twice |

**Trade-off, still real:** larger context costs memory and slows prompt evaluation, and on
a VRAM-constrained host a *large* model at a *large* context can run out the whole turn
budget and return nothing — a 27.9B model at a forced 32768 returned nothing in 10 minutes. That
is the reason the default is 24576 rather than higher. If you run a model in the 27B+
range on 24 GB, lower `OPENCLAW_OLLAMA_NUM_CTX` rather than raising it.

### Disabling Ollama Native Thinking (Qwen3-Style Models)

Qwen3-style and similar "thinking" models emit extended reasoning traces by default in Ollama. In the Control UI, this reasoning trace appears as the model's reply, sometimes ending in a literal `</think>` tag, which can look like a stuck or broken chat.

OpenClaw's `reasoning: false` flag alone does **not** disable Ollama thinking. The extension configures `params.thinking: false` on the Ollama model entry, which OpenClaw forwards to Ollama's native `think` request parameter.

**Critical technical detail:** `thinking` must be a model **parameter** (`params.thinking`), not an Ollama `option`. Placing `thinking` under Ollama's `options` object has no effect—Ollama silently ignores unknown option keys.

**Re-enabling native thinking:**

Set the `OPENCLAW_OLLAMA_THINKING` environment variable on the extension runtime:

```bash
OPENCLAW_OLLAMA_THINKING=true   # or 1, yes, on
```

Then re-write the Ollama model config with the environment variable set, and restart
the service so it picks up the change. The extension UI's Apply button cannot do this
for you here—it disables itself once the selected model already matches the configured
model, which is exactly the state an already-configured install is in:

```bash
docker exec -e OPENCLAW_OLLAMA_THINKING=true openclaw-docker-extension-service \
  node /usr/local/bin/openclaw-extension-helper.js ollama-config-write <model>
docker restart openclaw-docker-extension-service
```

Replace `<model>` with your configured Ollama model id.

**This requires a runtime image that already contains this behaviour.** On an
older runtime the helper writes no `thinking` key at all, so the command appears
to succeed while the verification below prints nothing. Update the extension
first if that happens.

Verify what is actually configured by reading the written OpenClaw config in the
runtime container:

```bash
docker exec openclaw-docker-extension-service \
  grep -o '"thinking":[^,}]*' /home/node/.openclaw/openclaw.json
```

On success this prints `"thinking": false` (the default) or `"thinking": true`
(after the rollback above) — the config is written with two-space indentation, so
there is a space after the colon.

No output means no `thinking` key is configured. That is expected on installs
predating this behaviour, and a signal to run the command above.

---

## Performance Profile: 32GB+ RAM, Dedicated GPU

**Target:** Maximize capability without worrying about timeouts.

### Recommended Models

| Model | Parameters | VRAM | Speed | Notes |
|-------|------------|------|-------|-------|
| `qwen3.6:latest` | 36B | ~22 GB | Medium | Excellent reasoning |
| `gemma4:27b` | 27B | ~18 GB | Medium-Fast | Good balance |
| `mixtral:latest` | 47B (MoE) | ~26 GB | Medium | State-of-the-art |

### Ollama Host Configuration

```bash
export OLLAMA_NUM_PARALLEL=2          # Can increase with ample VRAM
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=f16      # Full precision with enough VRAM
export OLLAMA_KEEP_ALIVE=30m
export OLLAMA_MAX_LOADED_MODELS=2    # Keep multiple models loaded
```

---

## Troubleshooting Timeouts

### Symptom: "network connection error" after about 70 seconds

**Cause:** The request went straight to `host.docker.internal:11434` and was cut by
Docker Desktop's forwarder, which does not answer Node's TCP keepalive probes. Ollama's
log shows `500 | 1m10s–1m14s | POST "/api/chat"` ([#246](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/246)).

**Fix:** Re-apply your model in Local Model Setup. Current versions point OpenClaw at
the in-container relay (`http://127.0.0.1:11434`). Check with:

```bash
docker exec openclaw-docker-extension-service openclaw config get models.providers.ollama.baseUrl
```

### Symptom: The model says it will run a command, but nothing runs

**Cause:** Tool Search is on. The model calls the `tool_call` wrapper with a
command's arguments instead of running `exec`, and repeats until the turn times out
([#247](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/247)).

**Fix:** Re-apply your model in Local Model Setup, which sets `tools.toolSearch: false`.
In prompts, name the shell tool `exec`; it is not called `bash` in current OpenClaw.

### Symptom: "Turn 1 works, turn 2 times out"

**Cause:** Model switching evicted the KV cache.

**Fix:** 
1. Use the same model consistently, OR
2. Set `OLLAMA_MAX_LOADED_MODELS=2` if you have RAM

### Symptom: Long delays before first token (but no timeout)

**Cause:** Large prompt evaluation on slower model.

**Fix:**
1. Switch to a faster model (gemma4-fast)
2. Enable `OLLAMA_FLASH_ATTENTION=1`
3. Reduce prompt size (trim AGENTS.md, SOUL.md)
4. Confirm `localModelLean: true` is still in effect — the extension sets it
   automatically on every applied Ollama model, but preserves an explicit
   `false` you (or something else) may have set, so check it hasn't been
   turned off

### Symptom: Single-character replies

**Cause:** A context window too small for the prompt. The extension writes
`num_ctx: 24576` (see Context Window Tuning above) because Ollama's own default is a
fixed 4096, not a VRAM-derived size. If you see single-character replies, confirm the
configured value with
`docker exec openclaw-docker-extension-service grep -o '"num_ctx":[^,}]*' /home/node/.openclaw/openclaw.json`
and re-apply your model if it is missing.

---

## Environment Variable Reference

Set these on your **host Ollama** before starting the service:

| Variable | Values | Effect |
|----------|--------|--------|
| `OLLAMA_FLASH_ATTENTION` | `1` or unset | Enables flash attention (~20-40% speedup) |
| `OLLAMA_KV_CACHE_TYPE` | `f16`, `q8_0`, `q4_0` | KV cache quantization level |
| `OLLAMA_NUM_PARALLEL` | `1`, `2`, `4` | Parallel request handling (multiplies memory) |
| `OLLAMA_MAX_LOADED_MODELS` | `1`, `2`, `3+` | Models kept in memory simultaneously |
| `OLLAMA_KEEP_ALIVE` | `30m`, `1h`, etc. | Time to keep model loaded after last use |

---

## See Also

- [GitHub Issue #246](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/246) - the ~70s network cut and the in-container relay
- [GitHub Issue #247](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/247) - Tool Search and the trimmed Ollama tool set
- [GitHub Issue #156](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/156) - earlier timeout discussion (attributed to a 120s watchdog; see #246)
- [GitHub Issue #158](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/158) - Ollama environment variable guidance
- [GitHub Issue #159](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/159) - Workspace file size optimization

---

*Last updated: 2026-09-24*