## Context

The extension never writes `anthropic` config — that default is baked into the OpenClaw runtime image. The extension only writes provider config when the user manually completes Local Model Setup (`ui/src/ollamaSetup.ts`). So a fresh container starts with OpenClaw's hosted-`anthropic` default, and the first chat fails with `No API key found for provider "anthropic"`.

Current UI relevant code:
- Quick Start card: `ui/src/App.tsx:928-947` (static steps, no gating).
- Ollama detection + apply already exist: `detectOllamaModels()` (`ui/src/App.tsx:641`), `runDetect()` (`ui/src/ollamaDetect.ts`), `applyOllamaSetup()` / `buildOllamaProviderPatch()` (`ui/src/ollamaSetup.ts`).
- Config persistence: `ExtensionConfig` + `loadConfig()`/`persistConfig()` in `ui/src/App.tsx:100`.

Constraint (README): bundling a local inference runtime is out of scope; the supported free path is host Ollama. The detection/apply plumbing already exists and is reused — this change is mostly UI/state orchestration, not new infra.

## Goals / Non-Goals

**Goals:**
- Make the provider choice explicit on first run (fork: Free local vs Hosted).
- Auto-detect host Ollama and pre-select/one-click the free path when a model exists.
- Replace the silent hosted-`anthropic` fallback with a clear gated state.
- Give actionable remediation when the free path has no usable model.
- Persist the choice so onboarding doesn't re-prompt.

**Non-Goals:**
- Bundling a local model/inference runtime.
- Writing or validating an Anthropic key beyond capturing it / pointing at OpenClaw's `.env` path (hosted path stays thin).
- Propagating the Ollama auth profile to non-`main` agents (tracked as a separate change).

## Decisions

**1. Onboarding as a gated UI step driven by persisted state, not a new backend.**
Add a `providerChoice` field to `ExtensionConfig` (`'unset' | 'ollama' | 'anthropic'`). `loadConfig()` defaults to `'unset'`. The onboarding card renders while `providerChoice === 'unset'` (or when free-local chosen but no model applied). Rationale: reuses existing detect/apply paths; no runtime image changes; reversible via a "change provider" reset.
- Alternative considered: write a free default automatically with no prompt. Rejected — hides the hosted option and can apply a model the user didn't want; the chosen "fork + auto-detect" keeps the common case one click while staying explicit.

**2. Auto-detect drives pre-selection, not silent apply.**
On first-run mount, run the existing Ollama detection. If ≥1 model, pre-select Free local and show a one-click "Use <model>" (apply = existing `applyOllamaSetup`). Apply is still an explicit click. Rationale: "Both: fork + auto-detect" decision — one action in the common case, no surprise writes.

**3. Chat gating via UI state, not by inspecting OpenClaw's resolved provider.**
Gate the "Open Control UI / chat" affordance on `providerChoice !== 'unset'` AND (for ollama) a model applied. We do not try to read OpenClaw's effective provider to decide the gate. Rationale: simpler, deterministic, avoids race with gateway config caching. Trade-off: a user who configures a provider entirely outside the extension still sees the gate until they dismiss it — mitigated by a "I've configured this elsewhere / skip" escape.

**4. Hosted path stays thin.**
Hosted selection captures the key and points the user at OpenClaw's `.env` (`/home/node/.openclaw/.env`) per README, or defers to OpenClaw's own onboarding. We do not build full anthropic auth management here. Rationale: scope control; the free path is the focus of #141.

**5. New state module for testability.**
Add `ui/src/firstRunOnboarding.ts` (pure helpers: derive onboarding phase from config + detection result, button labels, gating predicate) with unit tests, mirroring existing `ollamaUiState.ts` / `runtimeUpdate.ts` pattern. Keeps `App.tsx` wiring thin and the logic tested.

## Risks / Trade-offs

- **Existing users get re-prompted** (no `providerChoice` persisted yet) → migrate in `loadConfig()`: if an Ollama default or other provider config already exists, treat `providerChoice` as resolved so upgraders aren't re-onboarded.
- **Detection latency on first mount** could delay pre-selection → run detection async; render the fork immediately, fill in pre-selection when detection returns.
- **Gating could block a legitimately-configured user** → always provide a visible "skip / I configured this elsewhere" action that sets `providerChoice` resolved.
- **Pre-selecting Ollama picks the wrong model** → use existing `chooseRecommendedOllamaModel()` and show the model name in the action so the choice is visible before apply.

## Migration Plan

- Additive config field with a safe default; `loadConfig()` infers resolved state for existing installs (no forced re-onboarding).
- No runtime image change, no branch-protection/CI impact.
- Rollback: remove the onboarding gate render and the config field reverts to unused; prior behavior (silent anthropic default) returns.

## Open Questions

- Exact copy/links for the hosted path (do we link OpenClaw onboarding docs vs inline `.env` instructions?).
- Should "skip" be prominent or tucked away to avoid users bypassing the free path by accident?
