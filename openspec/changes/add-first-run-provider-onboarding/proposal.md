## Why

A fresh extension install defaults to the hosted `anthropic` provider, so the first chat fails with `No API key found for provider "anthropic"`. The README promises a free, easy path (~5 minutes from install to chatting), but the supported free path (host Ollama) is entirely manual and undiscoverable, and nothing tells the user that default chat is broken until they configure a provider. New users hit a cryptic error instead of a guided choice. Fixes #141.

## What Changes

- Add a **first-run provider onboarding** step in the extension UI that makes the provider choice explicit before the user can chat:
  - A fork: **Free local (Ollama)** vs **Hosted (paste Anthropic key)**.
  - When a host Ollama model is already detected, pre-select Free local and offer one-click apply so the common case is a single action.
- **Gate first chat**: replace the silent fallback to `anthropic` with a clear "choose a provider / pick a model first" state so the user never sees the raw `No API key found` error as their first experience.
- Improve the Free-local branch when Ollama is missing or has no model: a prominent, actionable CTA (install Ollama / `ollama pull <model>`) instead of a dead-end.
- Persist the chosen provider so onboarding does not re-prompt on every open.
- **Non-goal**: bundling a local inference runtime (out of scope per README); the supported free path remains host Ollama.

## Capabilities

### New Capabilities
- `first-run-onboarding`: Defines the first-run provider-selection flow, the auto-detect/pre-select behavior, chat-gating until a provider is usable, and the guided remediation when the free path has no model available.

### Modified Capabilities
<!-- No existing specs in openspec/specs/; nothing to modify. -->

## Impact

- **UI**: `ui/src/App.tsx` (Quick Start card, chat-gating, onboarding state), `ui/src/ollamaSetup.ts` / `ui/src/ollamaDetect.ts` (reuse detection + apply), new onboarding state module + tests.
- **Persistence**: extension localStorage config (`ExtensionConfig`) gains a provider-choice field.
- **Behavior**: first-run default no longer silently lands on `anthropic`.
- **Out of scope / separate change**: Ollama auth profile is written only to the `main` agent, so sub-agents (e.g. `heartbeat`) still fail — tracked as its own change.
- **Related issues**: #141 (this), plus #139 / #140 from the same triage pass.
