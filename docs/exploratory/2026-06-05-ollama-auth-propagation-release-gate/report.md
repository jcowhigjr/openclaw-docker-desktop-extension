# Auth Propagation Smoke Test - 2026-06-05

## Scope

Verify that `ollama-auth-profiles-write` propagates the `ollama:manual`
profile to **all** agents, not just `main`.

## Results (CLI-verifiable, no secrets exposed)

| Check | Result |
|---|---|
| Runtime image carries patched helper (`listAgentIds` present) | PASS |
| `ollama:manual` written to `main` | PASS |
| `ollama:manual` written to `heartbeat` | PASS |
| Pre-existing `anthropic:default` preserved in `main` | PASS |
| Stray entries (non-agent dirs) skipped | PASS |
| Idempotent (second write produces identical file) | PASS |
| Single key only (no duplication after re-run) | PASS |
| Extension registered and service container healthy | PASS |

## Manual Step (GUI only)

- Open Control UI, enable `heartbeat` sub-agent, send a chat.
- Expected: heartbeat responds using Ollama (not anthropic error).

## Evidence

Raw CLI evidence (container exec outputs, inspect dumps) kept locally at
`~/.local/evidence/ollama-auth-smoke-2026-06-05/` — not committed to the repo
to respect security boundaries.
