# Issue #189: Stop hardcoding num_ctx; defer to Ollama's VRAM-based default

Tracking: <https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/189>

## Problem

`buildOllamaProviderPatch` (`ui/src/ollamaSetup.ts`) and `resolveOllamaNumCtx`
(`runtime/openclaw-extension-helper.js`) both hardcode `num_ctx: 32768` for every
model on every machine.

This defeats two upstream safety mechanisms:

1. **Ollama computes a VRAM-aware default itself.** On an M4/24GB host it logs:
   `vram-based default context  total_vram="17.8 GiB"  default_num_ctx=4096`.
   We force 8x that.
2. **OpenClaw deliberately declines to set it.** `extensions/ollama/src/stream.ts`
   (`resolveOllamaNativeNumCtx`) returns `undefined` when unset, with the comment
   that native `/api/chat` "should not force the full advertised catalog context
   for local models unless the operator opted in." Our patch opts in on the
   user's behalf, silently.

It also contradicts our own spec: `openspec/specs/hardware-profile-system.md`
prescribes `num_ctx: 16384` for the balanced profile.

## Evidence (measured, M4 24GB, Ollama 0.33.2)

Auto-selected model on a real machine, at the hardcoded context:

| Prompt | Result |
|---|---|
| 6 tokens | 52.4 s total (21.8 s load) |
| ~20k tokens (realistic OpenClaw system prompt) | **no response in 10 minutes** |

The 120 s idle watchdog (#156) fires long before the first token. Every first
message fails.

## Proposed change

Stop sending `num_ctx` unless the user explicitly sets it.

- `ui/src/ollamaSetup.ts`: omit `params.num_ctx` from the provider patch by default.
- `runtime/openclaw-extension-helper.js`: `resolveOllamaNumCtx()` returns
  `undefined` unless `OPENCLAW_OLLAMA_NUM_CTX` is set; omit the key when undefined.
- Keep `OPENCLAW_OLLAMA_NUM_CTX` as the explicit opt-in escape hatch.

## Acceptance criteria

- [ ] With no override set, the written OpenClaw config contains **no** `num_ctx`
      key for the Ollama model entry.
- [ ] With `OPENCLAW_OLLAMA_NUM_CTX=16384`, the key is written as `16384`.
- [ ] `ui/src/ollamaSetup.test.ts` and `scripts/test-runtime-helper.sh` assert both.
- [ ] `docs/local-model-tuning.md` "Context Window Tuning" section updated: Ollama
      picks the default from VRAM; the env var is the opt-in override.
- [ ] Manual note in the PR: a chat on a large local model that previously timed
      out now returns a first token.

## Out of scope

- Any per-hardware context table (see the model-selection issue).
- Changing the 120 s watchdog — that is upstream (#156).
