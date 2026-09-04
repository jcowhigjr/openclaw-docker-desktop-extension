**Delivery order:** 1 of 1 (independent; unblocks any local-model use)
**Minimum agent tier:** T2 — one helper function plus test updates, but it reverses a shipped decision and needs the rationale carried in code comments

## Problem

`ollama-config-write` omits `params.num_ctx` unless `OPENCLAW_OLLAMA_NUM_CTX` is set,
deliberately, so "Ollama picks its own default from available VRAM"
(`runtime/openclaw-extension-helper.js`, introduced by #189).

On real hardware Ollama does not pick a usable default. It picks **4096**.

Measured on a 24 GB M4 Air, host Ollama 0.33.3, `qwen3:8b` (advertised context 40960):

```
$ curl -s http://127.0.0.1:11434/api/ps
qwen3:8b  context_length = 4096
```

OpenClaw's own Ollama provider documentation states agents need **16K–24K minimum**,
and recommends 64K. A single agent turn spends 8–12k tokens on system prompt, tool
definitions and history before reasoning about the task at all.

## Observed failure

With num_ctx unset (4096 effective), the agent could not complete a simple three-step
task ("list a folder, read the files, write an INDEX.md"):

- `[agent/embedded] empty response detected: provider=ollama/qwen3:8b — retrying`
- the model hallucinated filenames (`file1.txt`…`file4.txt`) rather than listing
- `[agent/embedded] embedded run timeout: timeoutMs=300000`
- workspace bootstrap truncated: `AGENTS.md is 7926 chars (limit 5000); truncating`

After setting `params.num_ctx: 24576` and `contextTokens: 24576` by hand, the **same
task on the same model completed correctly on the first attempt**, listing the
directory, reading all four files and writing an accurate `INDEX.md`.

## Why #189's reasoning does not hold

#189 removed a hardcoded `num_ctx: 32768` because it was forced blindly regardless of
hardware. That was right. But the conclusion — omit the key and let Ollama decide —
assumed Ollama sizes context from available VRAM. It does not; it applies a small
fixed default. The result is that the extension's guided Ollama path produces a
configuration that cannot run an agent turn.

## Proposed change

- Default `params.num_ctx` to **24576** instead of omitting it.
- Also emit `contextTokens` aligned to the same value, per the provider docs
  ("Keep them aligned when hardware cannot run the model's full advertised context").
- Keep `OPENCLAW_OLLAMA_NUM_CTX` as the override, including the ability to lower it.
- Carry the measurement in a comment so this is not re-reverted on the old reasoning.

## Acceptance criteria

- [ ] With `OPENCLAW_OLLAMA_NUM_CTX` unset, the written config contains
      `params.num_ctx: 24576` and a matching `contextTokens`.
- [ ] With `OPENCLAW_OLLAMA_NUM_CTX=8192`, both values are 8192 (override still wins,
      including downward).
- [ ] Invalid/blank values fall back to the 24576 default rather than omitting.
- [ ] `scripts/test-runtime-helper.sh` assertions updated from "must omit" to the new
      contract, with the old opt-in case retained as the override case.
- [ ] `make test-pre-push` green.

## Evidence

Verified end to end on the maintainer host: OpenClaw 2026.9.1 in the extension
container, host Ollama 0.33.3, `qwen3:8b` at 20.2 tok/s. Full failing-then-passing
transcript captured in the PR.

## Measurement that set the default

The first implementation used 16384 — the bottom of the documented band, chosen to
stay furthest from the known large-model hang. It was tested and **rejected**:

| num_ctx | Agent turn ("list folder, read files, write INDEX.md") |
|---|---|
| 4096 (Ollama default, no key written) | fails — hallucinated filenames, `empty response detected`, run timeout |
| 16384 | fails — model wandered off task, no `INDEX.md` written |
| 24576 | **passes, 2 consecutive runs** — correct listing, all 4 files read, accurate `INDEX.md` |

The default is therefore 24576, chosen by measurement rather than by picking the
safest-looking number. 24576 remains well below the 32768 that hung a 27.9B model,
and `OPENCLAW_OLLAMA_NUM_CTX` lowers it for constrained hosts.

Verified on: MacBook Air M4 / 24 GB, host Ollama 0.33.3, OpenClaw 2026.9.1 in the
extension container, `qwen3:8b` (Q4_K_M, advertised context 40960) at ~20 tok/s.
