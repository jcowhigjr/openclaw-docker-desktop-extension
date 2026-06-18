# Local Model Tuning Guide

This guide helps you tune OpenClaw for local Ollama models on constrained hardware. Running large language models locally requires balancing speed, memory, and context size against your hardware capabilities.

## The Core Constraint

OpenClaw has a **120-second idle timeout watchdog** that aborts requests when no tokens are received. On CPU-only hardware, evaluating a large prompt can exceed this limit, causing timeouts before the first token arrives. This guide provides practical workarounds and tuning strategies to work within this constraint.

**Key insight:** No configuration currently available can raise this 120s limit. The strategies below help you stay under it through hardware-appropriate model selection and prompt optimization.

---

## Quick Diagnostic: What Hardware Profile Are You?

| Profile | RAM | GPU | Typical Use Case |
|---------|-----|-----|------------------|
| [Light](#light-profile-cpu-only-8-16gb-ram) | 8-16 GB | None | Older laptops, budget desktops |
| [Balanced](#balanced-profile-apple-silicon-or-16-24gb-ram) | 16-24 GB | Integrated/Apple Silicon | MacBook Air/Pro M1-M4, modern laptops |
| [Performance](#performance-profile-32gb-ram-dedicated-gpu) | 32+ GB | 8GB+ VRAM | Desktop workstations, gaming PCs |

---

## Light Profile: CPU-Only, 8-16GB RAM

**Target:** Stay under 60-90s prompt evaluation to avoid the 120s timeout.

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
killall ollama
ollama serve
```

### OpenClaw Configuration

After applying your Ollama model through the extension, edit your OpenClaw config to reduce prompt pressure:

**Option 1: Minimal (most reliable)**
```json
{
  "agents": {
    "defaults": {
      "experimental": {
        "localModelLean": true
      }
    }
  },
  "models": {
    "providers": {
      "ollama": {
        "models": [
          {
            "id": "gemma4-fast:latest",
            "params": {
              "num_ctx": 8192
            },
            "compat": {
              "supportsTools": false
            }
          }
        ]
      }
    }
  }
}
```

**Option 2: Balanced (try this first)**
```json
{
  "agents": {
    "defaults": {
      "experimental": {
        "localModelLean": true
      },
      "compaction": {
        "reserveTokens": 4096,
        "reserveTokensFloor": 0,
        "keepRecentTokens": 6000
      }
    }
  },
  "models": {
    "providers": {
      "ollama": {
        "models": [
          {
            "id": "gemma4-fast:latest",
            "params": {
              "num_ctx": 12288
            }
          }
        ]
      }
    }
  }
}
```

### What These Settings Do

| Setting | Effect |
|---------|--------|
| `localModelLean: true` | Removes `browser`, `cron`, `message` tools from prompt—smaller tool schema |
| `supportsTools: false` | Disables all tool calls—smallest possible prompt |
| `num_ctx: 8192` | Smaller context window = faster prompt eval, less memory |
| `reserveTokens: 4096` | Compacts session earlier, keeping prompt smaller |
| `OLLAMA_KV_CACHE_TYPE=q4_0` | 75% memory reduction in KV cache |

### Trim Workspace Files

OpenClaw injects workspace files into every prompt. Large files slow down prompt evaluation:

```bash
# Check sizes
ls -lh ~/.openclaw/workspace/

# Trim or remove large files
truncate -s 0 ~/.openclaw/workspace/AGENTS.md  # Keep file, empty contents
rm ~/.openclaw/workspace/SOUL.md               # Remove if not needed
```

---

## Balanced Profile: Apple Silicon or 16-24GB RAM

**Target:** 30-60s prompt evaluation with moderate context.

### Recommended Models

| Model | Parameters | Unified Memory | Notes |
|-------|------------|----------------|-------|
| `gemma4:latest` | 9B | ~6 GB | Good balance on Apple Silicon |
| `llama3.2:latest` | 8B | ~5 GB | Fast, capable |
| `qwen3.5:latest` | 9.7B | ~6 GB | Larger context, slower eval |

### Ollama Host Configuration

```bash
# macOS
export OLLAMA_NUM_PARALLEL=1
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=q8_0      # Balanced: ½ memory of f16
export OLLAMA_KEEP_ALIVE=30m
```

For Apple Silicon specifically, ensure GPU layers are used:
```bash
ollama ps  # Verify model shows GPU offload
```

If running CPU-only on Apple Silicon (slow), treat as Light Profile.

### OpenClaw Configuration

```json
{
  "agents": {
    "defaults": {
      "experimental": {
        "localModelLean": true
      },
      "compaction": {
        "reserveTokens": 8192,
        "keepRecentTokens": 12000
      }
    }
  },
  "models": {
    "providers": {
      "ollama": {
        "models": [
          {
            "id": "gemma4:latest",
            "params": {
              "num_ctx": 16384
            }
          }
        ]
      }
    }
  }
}
```

### Managing Context on Medium Hardware

With 16K context, you're approaching the danger zone for CPU prompt eval. Strategies:

1. **Monitor context usage:** Watch the token counter in Control UI
2. **Manual compaction:** Type `/compact` proactively before context gets large
3. **Shorter messages:** Break long requests into smaller chunks
4. **Use Tool Search:** Let OpenClaw discover tools rather than listing them all

---

## Performance Profile: 32GB+ RAM, Dedicated GPU

**Target:** GPU handles prompt eval in <10s; 120s timeout not a constraint.

### Recommended Models

| Model | Parameters | VRAM | Notes |
|-------|------------|------|-------|
| `gemma4:latest` | 9B | ~6 GB | Fast on GPU |
| `llama3.1:latest` | 8B | ~5 GB | Good capabilities |
| `qwen3.5:latest` | 9.7B | ~6 GB | Largest context |
| `llama3.1:70b` | 70B | ~40 GB | Requires significant VRAM |

### Ollama Host Configuration

```bash
export OLLAMA_NUM_PARALLEL=1          # Increase to 2-4 if VRAM allows
export OLLAMA_FLASH_ATTENTION=1
export OLLAMA_KV_CACHE_TYPE=f16       # Full precision—VRAM available
export OLLAMA_KEEP_ALIVE=30m
```

### OpenClaw Configuration

Full capabilities—no special constraints needed:

```json
{
  "agents": {
    "defaults": {
      "compaction": {
        "reserveTokens": 16384
      }
    }
  },
  "models": {
    "providers": {
      "ollama": {
        "models": [
          {
            "id": "gemma4:latest",
            "params": {
              "num_ctx": 32768
            }
          }
        ]
      }
    }
  }
}
```

---

## Configuration Reference

### OpenClaw Config Paths

Edit via Control UI or directly in `~/.openclaw/openclaw.json`:

| Path | Type | Default | Effect |
|------|------|---------|--------|
| `agents.defaults.experimental.localModelLean` | boolean | false | Removes heavy tools (browser, cron, message) |
| `models.providers.ollama.models[].compat.supportsTools` | boolean | true | Disables all tool calls if false |
| `models.providers.ollama.models[].params.num_ctx` | number | 32768 (extension default) | Context window size for Ollama |
| `agents.defaults.compaction.reserveTokens` | number | 20000 | Trigger compaction when within this many tokens of context limit |
| `agents.defaults.compaction.reserveTokensFloor` | number | 20000 | Minimum reserve (set to 0 to disable floor) |
| `agents.defaults.compaction.keepRecentTokens` | number | — | Tokens to preserve during compaction |

### Extension Environment Variables

Set when building/running the extension runtime:

| Variable | Effect |
|----------|--------|
| `OPENCLAW_OLLAMA_NUM_CTX` | Override default context window (default: 32768) |

### Ollama Host Environment Variables

Set on your host Ollama process:

| Variable | Default | Options | Effect |
|----------|---------|---------|--------|
| `OLLAMA_NUM_PARALLEL` | 1 | 1-N | Parallel requests (multiplies memory use) |
| `OLLAMA_FLASH_ATTENTION` | 0 | 0, 1 | Reduces memory, improves speed |
| `OLLAMA_KV_CACHE_TYPE` | f16 | f16, q8_0, q4_0, q5_0, q5_1 | KV cache quantization |
| `OLLAMA_KEEP_ALIVE` | 5m | duration, -1 | How long to keep model loaded |
| `OLLAMA_CONTEXT_LENGTH` | model default | 2048, 4096, etc. | Override default context |

---

## Troubleshooting

### Symptom: "LLM idle timeout (120s)" errors

**Causes and fixes:**

1. **Prompt too large for hardware**
   - Reduce `num_ctx` in config
   - Enable `localModelLean: true`
   - Try `supportsTools: false`
   - Trim workspace files (AGENTS.md, SOUL.md)

2. **Model too large for CPU**
   - Switch to smaller model (gemma4-fast, qwen2.5:3b)
   - Add GPU if possible (10-20x speedup)

3. **Cold-start latency**
   - Set `OLLAMA_KEEP_ALIVE=30m` or `-1`
   - The extension's "warm up model" feature also helps

### Symptom: Single-character replies

**Cause:** Ollama default context (4096) filled by system prompt.

**Fix:** Extension already sets `num_ctx: 32768` by default. If you overrode it, check:
```bash
# Verify context size
curl http://localhost:11434/api/show -d '{"name": "gemma4:latest"}'
```

### Symptom: Out of memory errors

**Fixes:**

1. Reduce `num_ctx`
2. Set `OLLAMA_KV_CACHE_TYPE=q4_0`
3. Reduce `OLLAMA_NUM_PARALLEL` to 1
4. Use smaller model
5. Close other applications

### Symptom: Slow response every turn

**Cause:** Full prompt re-evaluation (no KV cache prefix sharing).

**Partial fixes:**
- Enable `OLLAMA_FLASH_ATTENTION=1`
- Reduce context window
- Compaction helps keep prompt smaller
- Use faster model

---

## Decision Flowchart

```
Start with model detection in extension
         │
         ▼
    Model selected
         │
         ▼
   First chat works?
   ┌─────────────┐
   │             │
   ▼             ▼
  Yes           No (timeout/error)
   │             │
   │             ▼
   │    Enable localModelLean: true
   │    Set num_ctx to 8192
   │             │
   │             ▼
   │    Still failing?
   │    ┌─────────────┐
   │    │             │
   │    ▼             ▼
   │   Yes            No
   │    │             │
   │    ▼             ▼
   │  SupportsTools:   Working
   │  false           configuration
   │    │
   │    ▼
   │  Still failing?
   │    │
   │    ▼
   │  Switch to smaller
   │  model (gemma4-fast,
   │  qwen2.5:3b)
   │
   ▼
Monitor context usage
Type /compact when
approaching limit
```

---

## Advanced: Editing Config Directly

The extension writes Ollama configuration to the OpenClaw volume. You can edit directly:

```bash
# Find the container
docker ps | grep openclaw

# Enter container
docker exec -it <container_id> sh

# Edit config
cat ~/.openclaw/openclaw.json
vi ~/.openclaw/openclaw.json

# Restart OpenClaw (via extension UI) to apply changes
```

Or on the host with the volume:
```bash
# Locate volume
docker volume ls | grep openclaw

# Mount and edit (macOS: volume is inside Docker Desktop VM)
# Use docker run to mount and edit:
docker run --rm -it \
  -v openclaw-docker-extension-home:/home/node \
  alpine sh
vi /home/node/.openclaw/openclaw.json
```

---

## Summary Table: Recommended Settings by Hardware

| Setting | Light (8-16GB, CPU) | Balanced (16-24GB, Apple Silicon) | Performance (32GB+, GPU) |
|---------|---------------------|----------------------------------|--------------------------|
| **Model** | gemma4-fast, qwen2.5:3b | gemma4, llama3.2 | gemma4, llama3.1, larger |
| **num_ctx** | 8192 | 16384 | 32768 |
| **localModelLean** | true | true (test false) | false |
| **supportsTools** | false (if needed) | true | true |
| **reserveTokens** | 4096 | 8192 | 16384 |
| **OLLAMA_KV_CACHE_TYPE** | q4_0 | q8_0 | f16 |
| **OLLAMA_FLASH_ATTENTION** | 1 | 1 | 1 |
| **OLLAMA_NUM_PARALLEL** | 1 | 1 | 1-4 |

---

## See Also

- [Ollama FAQ](https://docs.ollama.com/faq) — Ollama-specific tuning
- [OpenClaw Local Models](https://docs.openclaw.ai/gateway/local-models) — Official OpenClaw guidance
- [OpenClaw Compaction](https://docs.openclaw.ai/concepts/compaction) — Session management
- [README.md](../README.md) — Extension setup and basic usage
