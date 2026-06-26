# Issue #162: Single-Model Mode + eviction guidance

**Goal:** Prevent / warn about Ollama KV-cache eviction caused by running more than one local model.
**Root cause:** Confirmed in [#156](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/156). Ollama holds one model's KV cache at a time. When a *different* model runs between two turns of the same chat (a different model per chat, or switching the Control UI dropdown), the first model's cache is evicted, so the next turn is a full ~20k-token cold re-evaluation. On a slow/CPU model this exceeds the 120s idle watchdog → timeout (the ×2/×3 resends).

## Evidence (host Ollama, identical prompt each gemma4-fast call)
```
1) gemma4-fast cold:                prompt_eval 5351 in 19.1s
2) gemma4-fast same prefix +1 tok:  prompt_eval 5351 in  0.2s   <- cache hit
3) qwen3.5 request (other model):   prompt_eval   11 in  0.5s   <- evicts gemma4-fast
4) gemma4-fast same prefix again:   prompt_eval 5351 in 20.4s   <- cache gone, full re-eval
```
Same-model back-to-back turns keep the cache (turn 2 is cheaper). The regression appears only when models interleave.

## Framing corrections (grounded)
- **Pinning per-agent models is a no-op.** `agents.defaults.model.primary` is the only model config; per-agent overrides are `{}`, so all agents already inherit one model.
- **Divergence comes from the Control UI per-session model dropdown** (OpenClaw `sessionModel`/`overrideModel`). The extension cannot stop a user picking a second model there — unless OpenClaw's `allowModelOverride` config locks it.
- **`/api/ps` snapshots can't detect thrash** — seeing two loaded models means they are coexisting fine; a single-slot thrash never shows two at once. Do not ship a snapshot-based alarm.

## Step 0 — Investigation FIRST (use `~/workspace/openclaw` clone), before any code
Confirm what `allowModelOverride` / "model override policy" actually gates (minified hits were mixed with `ttsConfig`):
- Grep the clone (non-minified) for `allowModelOverride`, `overrideModel`, `sessionModel`, and the Control UI model dropdown's request path.
- Determine: (a) exact config key + location (likely `agents.defaults` or `gateway.controlUi`), (b) whether `false` disables the **chat** model dropdown (vs TTS-only), (c) UI behavior when locked.
- **Decision gate:**
  - Locks the chat model → implement **Part A**.
  - TTS-only / doesn't lock chat → skip the config write; ship **Part B** only and record the finding in the PR.

## Part A — Single-Model Mode (only if Step 0 confirms it works)
| File | Change |
|---|---|
| `runtime/openclaw-extension-helper.js` | In `ollamaConfigWrite`, also write the verified lock key (e.g. `config.agents.defaults.allowModelOverride = false`) so every chat/agent uses the one configured model. Idempotent. |
| `scripts/test-runtime-helper.sh` | Assert the lock key is written. |

## Part B — Eviction guidance (ALWAYS ship; solid, low-risk)
| File | Change |
|---|---|
| `ui/src/ollamaGuidance.ts` *(new, pure)* | `buildLocalModelGuidance()` → static advisory: "On local Ollama, a second model (a different model per chat, or switching the dropdown) evicts the first model's cache and causes slow replies / timeouts. Use one model, or set `OLLAMA_MAX_LOADED_MODELS>=2` (RAM permitting)." Single-sourced; link to `docs/local-model-tuning.md`. |
| `ui/src/App.tsx` | Render the guidance in the Ollama setup-completion area and in settings as a static info card (not a runtime alarm). |
| `docs/local-model-tuning.md` | Add/confirm a "One model at a time / `OLLAMA_MAX_LOADED_MODELS`" section (coordinate with #158). |
| `ui/src/ollamaGuidance.test.ts` *(new)* | Pure test: guidance text present, mentions the env var + one-model rule, includes the doc link. |

## Explicitly OUT of scope
- ❌ Pinning per-agent models (already inherited — no-op).
- ❌ `/api/ps` runtime "multiple models" alarm (snapshot can't distinguish coexisting from thrashing).
- ❌ Setting `OLLAMA_MAX_LOADED_MODELS` from the extension (host env var; Ollama runs on the host — guidance only).

## Acceptance criteria
1. Step 0 written up in the PR: exact `allowModelOverride` behavior + decision taken.
2. If implemented: helper writes the lock key; manual note confirms the Control UI then uses only the configured model.
3. Guidance card renders in setup-completion + settings with the env-var advice and doc link.
4. No fragile/misleading runtime "multiple models" alarm.
5. Tests green (pure module tests + helper test); `Screenshots-Not-Needed` trailer or screenshot per the validate gate.

## Test plan
- `ollamaGuidance.test.ts`: asserts copy/contract.
- `test-runtime-helper.sh`: asserts lock key (Part A only).
- Manual (PR note, non-CI): set a second model in a chat → confirm behavior (locked, or guidance visible).

## Guardrails
- Do Step 0 **before** touching code — don't write `allowModelOverride` blind; the minified evidence was ambiguous (TTS overlap).
- Pure logic in `ollamaGuidance.ts`; `App.tsx` wires render only.
- Reuse existing `buildRuntimeHelperArgs` / `ddClient...exec` patterns; no new exec style.
