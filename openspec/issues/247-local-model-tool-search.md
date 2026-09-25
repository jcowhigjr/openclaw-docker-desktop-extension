**Delivery order:** 2 of 2 in the local-model tool-use batch (blocked by: #246 — with direct tool schemas the prompt is ~19.5K tokens, so the first call needs the relay to be reliable)
**Minimum agent tier:** T2 — two config keys in `ollama-config-write`, tests, and a docs/demo-prompt update; the decision and its latency cost are measured below

## Problem

On `v0.5.0` (OpenClaw `2026.9.3`) with `qwen3:8b-opencode`, tool-using chats in the Control UI fail. For example, "use the exec tool to run …" never runs the command. The cause is how OpenClaw exposes tools to local models.

When `tools.toolSearch` is unset, local inference routes **automatically** get Tool Search in structured `tools` mode (from `/app/docs/tools/tool-search.md`: "Local inference defaults to structured `tools` mode"). The model only sees `tool_search`, `tool_describe`, and `tool_call`, plus a few direct-only tools. `exec` and 45 others are catalogued behind them (`tool-search: cataloged 46 tools behind compact prompt surface`). The 8B model can't drive that indirection. It calls the `tool_call` wrapper with exec-shaped arguments (`{"command":"echo ok > …","title":"Write to file"}`) and no target tool, gets an error back, and repeats the same call until the run times out. In one trajectory export there were 25 identical calls in 330s.

`agents.defaults.experimental.localModelLean` (which the helper already sets to `true`) doesn't change this. It only trims optional tools.

A separate wording issue: the shell tool is named `exec` in `2026.9.3`, not `bash`. The demo prompt in #221 says "Use the bash tool …".

## Evidence (2026-09-24, M4/24GB, Ollama 0.34.3, `qwen3:8b-opencode`, `num_ctx` 24576, `localModelLean: true`)

Task: `Use the exec tool to run this exact shell command: echo ok > /tmp/ab-<id>.txt`. It passes only if the file exists in the container afterwards.

| `tools.toolSearch` | Model-visible surface | Prompt | Result |
|---|---|---|---|
| unset (local default → `tools` mode) | search/describe/call wrappers + direct-only | ~9.0K tokens | **0/2**: `tool_call` misuse loop, run timeout at ~330s |
| `{"enabled":true,"mode":"directory"}` | directory + core primitives | ~10.1K tokens | **0/2**: model says "we need to use the `exec` tool directly" and then ends the turn; second trial: tool call blocked, run timeout |
| `false` (direct schemas) | all schemas | ~19.5K tokens | **0/2 in the A/B** (killed by the ~70s network cut, see #246); **3/3 PASS** once that cut is avoided or retried through |

The three `false` passes:
- With `timeoutSeconds: 300`: completed via retries in 216s.
- Through the keepalive relay, cold: 220s, first call 3m29s.
- Through the relay, new session: 248s, first call 2m49s.

In every pass the model called `exec` directly on its first tool call.

Cost of `false` on this machine: a **new session** pays the whole ~19.5K-token prefill (≈2.5–3.5 min at ~95–130 tok/s under normal memory pressure). The prefix cache doesn't carry across sessions. Follow-up turns in the same session take 10–25s.

## Proposed fix

1. `ollama-config-write` sets `tools.toolSearch = false`. Use a presence check like the existing `localModelLean` one, so an explicit user value survives re-apply. If `2026.9.3` supports scoping it to the Ollama model or agent instead of globally, prefer that; confirm in the docs before choosing.
2. Raise the helper's hard-coded `agents.defaults.timeoutSeconds = 300`. A cold multi-step demo (first call ~3.5 min, then several 10–25s steps) exceeds 300s. Use 900, or derive it from measured first-call latency.
3. The UI tells the user the first reply in a new chat can take a few minutes on local models. That's a one-line note near Local Model Setup.
4. Fix the #221 demo prompt: `bash` → `exec`. Re-verify the full demo (ls, read, write INDEX.md) with this setting and the relay.

## Acceptance criteria

- [ ] After Apply, `openclaw config get tools.toolSearch` returns `false` (or the scoped equivalent), and an explicit user value is preserved on re-apply (helper test).
- [ ] With #246 landed: the exec task above passes 3/3 in fresh sessions via `openclaw agent`, and 1/1 through the Control UI.
- [ ] The #221 demo prompt completes end to end inside the configured run timeout.
- [ ] README / Local Model Setup copy mentions the slow first reply and why.

Related: #221 (demo), #156, #241, #245.
