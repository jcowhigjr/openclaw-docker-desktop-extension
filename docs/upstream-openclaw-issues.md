# Upstream OpenClaw issue reports

These are ready-to-file reports for the **upstream OpenClaw project**
(`ghcr.io/openclaw/openclaw`), not this extension repo. They were produced while
debugging the Shellharbor extension against OpenClaw `v2026.6.1`. Evidence was
gathered against a local Ollama (`gemma4:latest`) backend on 2026-06-17.

The extension-side delivery gap (builds reused a stale `openclaw:latest` base, so
the streaming fix in `v2026.6.8` never reached users) is fixed separately in this
repo via `--pull` + an `OPENCLAW_VERSION` build-arg.

---

## Issue 1 — Chat renders only the first streamed token (single character)

**Severity:** high — chat is unusable on the Ollama provider.
**Affected version observed:** `v2026.6.1`. Likely fixed in `v2026.6.8` (needs confirmation).

### Summary
With the Ollama provider, an assistant reply renders as a single character/token
(e.g. `I`) and then stops. Every turn truncates the same way.

### Evidence the model and Ollama are NOT at fault
Calling the same model directly returns full responses, and Ollama streams proper
incremental deltas:

```
# Non-streaming /api/chat → full ~569-token answer, done_reason=stop.
# First token happens to be "I" (from "I apologize...") — exactly the single
# character surfaced in the OpenClaw UI.

# Streaming /api/chat deltas are well-formed:
{"message":{"role":"assistant","content":"Hello"},"done":false}
{"message":{"role":"assistant","content":"!"},"done":false}
{"message":{"role":"assistant","content":" How"},"done":false}
{"message":{"role":"assistant","content":" can"},"done":false}
{"message":{"role":"assistant","content":" I"},"done":false}
```

### Diagnosis
OpenClaw's Ollama provider appears to read the **first** stream delta, render it,
and then stop accumulating the remaining `message.content` deltas. The consistency
(always exactly one token) rules out random truncation — it points to the
streaming-aggregation loop terminating after the first chunk.

### Repro
1. Configure Ollama provider (`baseUrl: http://host.docker.internal:11434`), model `gemma4:latest`.
2. Send any prompt in chat.
3. Observe a one-character reply.

### Ask
Confirm whether this is the streaming regression fixed between `v2026.6.1` and
`v2026.6.8`; if not, fix the Ollama stream accumulator to append all deltas until
`done: true`.

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
