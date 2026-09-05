# Spec: Ollama Health Contract

**Status:** proposed
**Relates to:** #191 (load preflight), #204 (probe skipped for stale model), #213 (num_ctx default), #219 (timeout reported as network error)

## Problem this spec exists to prevent

The extension has repeatedly reported a healthy Ollama while inference was completely
non-functional. The reason is that the cheapest available probe answers correctly under
conditions where nothing else works.

Observed: `GET /api/tags` returned the full model list continuously while **every** model
load failed with `llama-server process has terminated: error: failed to create library`.
A user following the UI would conclude Ollama was fine.

## The contract

> **A successful `/api/tags` is not evidence that Ollama can serve a request.**

`/api/tags` enumerates model metadata from disk. It does not load a model, allocate GPU
memory, or open the inference backend libraries. It therefore stays green across the most
common real failure — a serving process whose backend libraries no longer match it.

Health must be asserted only from a probe that exercises the path the agent will use.

## Four coherence checks

Each catches a distinct failure observed in practice. A claim of "Ollama is ready" should
rest on all four, not on reachability alone.

### 1. Version coherence

The process answering on the port must be the same build as the binary on disk.

- `ollama --version` (binary on disk) vs `GET /api/version` (process serving)
- **Disagreement means the serving process is stale** and will fail at load time while
  continuing to answer metadata requests.
- Observed: disk 0.33.3, server 0.33.2, every load failing.

### 2. Model store coherence

The store the server reads must be the store the user populated.

- The macOS app sets `OLLAMA_MODELS` (observed `/Users/Shared/ollama-models`); a shell
  `ollama serve` defaults to `~/.ollama/models`.
- Symptom when they diverge: a plausible but *wrong* model list, and a configured model
  reported as not found.
- Recoverable from the server's own startup log (`server config` line).

### 3. Load coherence

A model must actually load. This is the check `/api/tags` cannot substitute for.

- Minimal sufficient probe: a one-token generation against the configured model.
- **This must not be skipped when the configured model looks stale or absent** — that
  narrowing is exactly the gap #204 reopened. An unknown model is a reason to probe, not a
  reason to skip probing.

### 4. Context coherence

The window actually being served must be large enough for an agent turn.

- After a load, `GET /api/ps` reports `context_length`.
- Ollama's own default is small (measured 4096) and **cannot carry an agent turn**; see
  #213. A load that succeeds at 4096 is not a healthy state for this product.
- The served value must be compared against the configured `num_ctx`, not assumed to match
  it — a request-level `num_ctx` is not guaranteed to be honoured for an already-resident
  model.

## Reporting rules

- Never report "ready" from reachability alone.
- When a check fails, name **which** check failed and what the two disagreeing values were.
  "Ollama is not ready" is not actionable; "server 0.33.2, binary 0.33.3 — restart Ollama"
  is.
- Distinguish *cannot reach* from *reached and unhealthy*. Conflating them sent one
  investigation into Docker networking for an hour when the fault was a timeout (#219).
- Do not repair silently. This repo's posture is declare-do-not-repair (#192): say what is
  wrong and what command fixes it.

## Explicit non-goals

- Auto-restarting Ollama. It is a user-owned desktop application.
- Managing `OLLAMA_MODELS`. Detect and report divergence; do not rewrite it.
- Continuous polling. These are start-up and on-demand checks, not a background monitor.

## Acceptance criteria

- [ ] No code path reports Ollama healthy on the strength of `/api/tags` alone
- [ ] All four checks are implemented, and each failure names the disagreeing values
- [ ] The load probe runs even when the configured model is stale or missing (closes #204)
- [ ] The context check fails loudly when the served window is below the agent minimum
- [ ] A stale-serving-process condition is detected and reported with the restart command
