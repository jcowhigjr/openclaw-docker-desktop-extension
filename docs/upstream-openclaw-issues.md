# Upstream OpenClaw issue reports

These are ready-to-file reports for the **upstream OpenClaw project**
(`ghcr.io/openclaw/openclaw`), not this extension repo. They were produced while
debugging the Shellharbor extension against OpenClaw `v2026.6.1`. Evidence was
gathered against a local Ollama (`gemma4:latest`) backend on 2026-06-17.

The extension-side delivery gap (builds reused a stale `openclaw:latest` base, so
the streaming fix in `v2026.6.8` never reached users) is fixed separately in this
repo via `--pull` + an `OPENCLAW_VERSION` build-arg.

---

## Issue 1 — Single-character replies on native Ollama: num_ctx not sent, Ollama defaults to 4096

**Severity:** high — chat is unusable on the native Ollama provider unless the user
manually sets `params.num_ctx`.
**Affected version confirmed:** `v2026.6.1` and **still present in `v2026.6.8`**
(reproduced directly — this is NOT a streaming-aggregation bug and was not fixed by
the version bump).

### Summary
With the native Ollama provider, an assistant reply is a single token (e.g. `Hello`
/ `I`) and then stops. Every turn truncates the same way.

### Root cause (proven)
The native Ollama provider does not send an `options.num_ctx` unless
`model.params.num_ctx` is explicitly configured (`resolveOllamaNativeNumCtx` returns
only the configured value). With no `num_ctx`, **Ollama defaults to a 4096-token
context window.** OpenClaw's injected system prompt is ~4–10k tokens, which fills
the window and leaves room for ~1 token of generation.

### Evidence
Reproduced through `openclaw agent` on `v2026.6.8`:

```
# No num_ctx configured:
usage = { "input": 4095, "output": 1, "total": 4096 }   # 4095 + 1 = 4096 exactly
reply = "Hello"

# With model.params.num_ctx = 32768:
usage = { "input": 20479, "output": 29, "total": 20508 }
reply = "Hello to you this afternoon. I hope everything is going well ..."
```

Confirmed at the Ollama layer too — same prompt, `num_ctx` 4096 → `eval_count=1`;
`num_ctx` 16384 → `eval_count=211`. The model and Ollama streaming are both fine;
only the missing `num_ctx` is at fault.

### Ask
For the **native** Ollama provider, default `num_ctx` to the model's known context
window (OpenClaw already tracks `contextWindow`/`maxTokens`; `resolveOllamaNumCtx`
does exactly this for the compat path) instead of letting Ollama silently cap at
4096. Optionally warn when the system prompt approaches the resolved `num_ctx`.

### Extension-side mitigation (superseded)
`ollamaConfigWrite` previously wrote `params.num_ctx` with a hardcoded default of
32768. That default was **removed** — it overrode Ollama's own VRAM-derived choice
(4096 on a 24 GB Apple Silicon host) and made larger models unusable: a 27.9B model
at 32768 returned nothing in 10 minutes, well past OpenClaw's 120s idle watchdog.

The extension now writes `params.num_ctx` only when `OPENCLAW_OLLAMA_NUM_CTX` is
set, and otherwise leaves the choice to Ollama. That makes the ask above more
relevant, not less: a context sized from the model's own window would beat both a
wrapper-side constant and Ollama's conservative floor.

---

## Issue 2 — Workspace file panel shows "Failed to load MEMORY.md" for a not-yet-created file

**Severity:** low (cosmetic, but alarming to users).

### Summary
The workspace Files panel (`/home/node/.openclaw/workspace`) lists `MEMORY.md`
and renders **"Failed to load MEMORY.md"** in red. All other workspace files
(`AGENTS.md`, `SOUL.md`, `TOOLS.md`, `IDENTITY.md`, `USER.md`, `HEARTBEAT.md`)
load fine; an earlier render tagged `MEMORY.md` as **"Missing"**.

### Diagnosis
`MEMORY.md` is created lazily (memory consolidation) and does not exist on a fresh
workspace. The panel treats an expected-but-absent file as a **load error** rather
than an empty/uncreated file.

### Expected
A not-yet-created `MEMORY.md` should render as empty (or "not created yet"), not as
a load failure.

### Ask
Distinguish "file absent" from "file present but unreadable" in the workspace file
loader and render the absent case non-destructively.

---

## Issue 3 — Local-model latency dominated by per-turn prompt re-processing of injected context

**Severity:** medium (UX) — first token takes tens of seconds on local backends.

### Summary
On local Ollama backends, each turn stalls for tens of seconds before generating.
The cost is **prompt evaluation (context ingest)**, not generation.

### Evidence (measured, `gemma4:latest`)
| Phase | Tokens | Time | Rate |
|---|---|---|---|
| Prompt eval (context ingest) | 2,822 | 22.1 s | 127 tok/s |
| Generation | 4 | 0.2 s | 20 tok/s |

The observed chat context was ~4.1k tokens → ~32 s of prompt processing **before
the first token, every turn**. The injected system context (workspace files —
`AGENTS.md` alone is 7.7 KB — plus history) is re-evaluated each turn.

### Diagnosis / questions
- Is a **stable prompt prefix** maintained so Ollama's KV cache can skip
  re-processing? If anything volatile (timestamp, heartbeat, per-turn token) is
  injected into the system prefix, it defeats prefix caching and forces full
  re-evaluation every turn. This is the highest-leverage thing to check.
- Can the always-on workspace context be trimmed or made opt-in for local models?

### Ask
1. Ensure the injected system prefix is byte-stable across turns so prompt caching
   applies.
2. Consider a "lean context" mode for local/slow backends.

### Workarounds for users (extension side)
- Use a smaller/faster model (e.g. `gemma4-fast:latest`).
- Trim `AGENTS.md` / `SOUL.md`.
- Ensure GPU offload.
