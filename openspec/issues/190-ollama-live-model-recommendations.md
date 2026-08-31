# Issue #190: Replace hardcoded model recommendations with Ollama's live recommendations + VRAM fit

Tracking: <https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/190>

## Problem

`chooseRecommendedOllamaModel` (`ui/src/ollamaSetup.ts`) matches against a
hardcoded list:

```js
const RECOMMENDED_MODEL_ORDER = [
  'gemma4:latest', 'gemma4', 'llama3.2:latest', 'llama3.2', 'qwen3.5:latest', 'qwen3.5',
];
```

When none match — which is now the common case, since local models turn over
weekly — it falls through to `models[0]`, i.e. whatever `/api/tags` returned
first (most recently modified). There is no size, RAM, or VRAM check anywhere
in the UI.

Verified by running the real function against a real M4/24GB host:

```
AUTO-SELECTED MODEL: muse-glimmer:30b-q4_K_M   (27.9B, 18.2 GB)
```

An 18.2 GB model auto-selected on a 24 GB machine with a 17.8 GiB VRAM budget,
while the installed 4B model that runs fine was ignored.

## Spec drift this supersedes

`openspec/specs/hardware-profile-system.md` proposes a hand-maintained
`MODEL_METADATA` table of models, RAM figures, and per-chip tok/s. Auditing it
against the current runtime, its foundations no longer hold:

| Spec assumption | Reality (Ollama 0.33.2) |
|---|---|
| "Ollama 0.19+ uses Apple MLX -> 1.7-3.4x faster than llama.cpp" | False. Logs show `using llama-server for model` (28x); the bundle ships `llama-server` + `libllama*.dylib`. Every tok/s figure derives from this premise. |
| Hand-maintained model metadata DB | Ollama serves `/api/experimental/model-recommendations` live, including `vram_bytes` (e.g. `gemma4:26b` -> 19000000000). |
| Detect hardware via `system_profiler` over Docker exec | Ollama already reports `total_vram` and a VRAM-based default context. |
| Catalog: `gemma4` = 9B / ~6GB | Ollama's live catalog lists `gemma4:26b` at 19 GB. The spec's catalog does not match the registry. |
| `qwen3.5:27b` ~16GB, 6-10 tok/s, "tight fit" | Measured on a 27.9B-q4: 18.2 GB, 52 s for a 6-token prompt, >10 min at 20k context. Unusable, not tight. |
| 4 "Success Metrics" | No telemetry exists in the codebase; none are measurable. |

A hand-maintained table cannot track weekly model releases. Delegating to
Ollama's own recommendation surface is the structural fix.

## Proposed change

1. Query `/api/experimental/model-recommendations` alongside `/api/tags`.
2. Rank **installed** models by fit: prefer the largest model whose
   `vram_bytes` (or blob `size` as fallback) fits comfortably inside the host's
   reported VRAM budget, with headroom for KV cache. Never auto-select a model
   whose weights alone exceed the budget.
3. Surface the reason inline ("picked X: 2.5 GB, fits your 17.8 GiB budget";
   "Y is 18.2 GB and will not fit").
4. Delete `RECOMMENDED_MODEL_ORDER`, the `MODEL_METADATA` proposal, and the
   tok/s tables in the spec/README. Retire
   `openspec/specs/hardware-profile-system.md` as superseded; keep a short
   pointer explaining why.
5. Rewrite the hardcoded "Recommended Models for M4 Mac 24GB" block in
   `ui/src/ollamaGuidance.ts` to reference the user's actual installed models.

## Acceptance criteria

- [ ] Auto-selection never picks a model whose weights exceed the host VRAM budget.
- [ ] Given the reproduction fixture (18.2 GB + 2.5 GB models, 17.8 GiB budget),
      selection picks the 2.5 GB model. Regression test with that fixture.
- [ ] `RECOMMENDED_MODEL_ORDER` is gone; no model name is hardcoded in `ui/src/`
      selection logic.
- [ ] Recommendations endpoint failure degrades gracefully to size-based ranking
      from `/api/tags` (never blocks setup).
- [ ] `openspec/specs/hardware-profile-system.md` marked superseded, with the
      false MLX premise corrected rather than silently deleted.
- [ ] #157 and #160 closed or rescoped against this issue.

## Out of scope

- Predicting tok/s. We rank on fit, not speed.
- Downloading models on the user's behalf.
