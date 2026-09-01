# Issue #191: Local-model preflight is blind to load failures

Tracking: <https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/191>

**Delivery order:** 2 of 4  (blocked by: none)
**Minimum agent tier:** T2 — async detect flow, new error taxonomy entry, timeout-vs-error distinction

## Problem

The extension reports local setup as healthy when it is not.

`runDetect` (`ui/src/ollamaDetect.ts`) only calls `/api/tags`. That endpoint
lists models from disk and succeeds even when Ollama **cannot load any of them**.
The UI then shows a green `Detected N host Ollama models.` and setup proceeds.

The one call that would catch it already exists and is thrown away.
`buildOllamaWarmupArgs` POSTs to `/api/generate` — a real model load — and
`App.tsx` handles the result like this:

```js
.then(() => appendDebug(`warmed up Ollama model ${model.trim()}`))
.catch((err) => appendDebug(`ollama warmup skipped: ${formatUnknownError(err)}`));
```

Fire-and-forget, into a debug pane, labelled "skipped".

## Real failure this hid

On an M4/24GB host, every model load fails:

```
ggml_metal_library_compile_all: failed to build 'fa' library:
  "Unable to reach MTLCompilerService ... error 141 - Reentrancy avoided"
ggml_metal_device_init: error: failed to create library
llama-server terminated  error="signal: abort trap"
```

`/api/tags` returned 200 with 2 models throughout. The extension would have
reported success. The user experiences it as an opaque chat timeout much later,
with nothing pointing at Ollama.

**The failure is intermittent and self-recovering — which is the whole point.**
Failure counts per log rotation on the same host:

| Log | Through | Failures |
|---|---|---|
| server-5 | Aug 26 | 0 |
| server-4 | Aug 28 | 6 |
| server-3 | Aug 30 | 112 |
| server-1 | Aug 31 12:44 | 14 |
| server.log | Sep 1 | 0 |

The process that logged the last 14 failures started Aug 31 12:44:58 and never
restarted; it began serving loads normally again on its own. An earlier reading of
this data — that only the `Ollama.app` launch context fails, since a shell-launched
`ollama serve` worked — does not hold: that test simply landed in a good window.

This raises the bar for the probe rather than lowering it. A transient fault means a
point-in-time green light is close to worthless: the probe must run at the moment of
use, and a past success must not be cached as health.

## Proposed change

Promote the warmup from fire-and-forget to a real preflight probe.

- Run a bounded load probe (`/api/generate`, no prompt, short `keep_alive`)
  during detect/apply, not only on restart.
- On failure, set the Ollama status to `error` with the upstream message
  surfaced verbatim, plus a remedy in `ui/src/diag/errorCodes.ts` for the known
  Metal/library class ("Ollama lists models but cannot load them — restart
  Ollama, or run `ollama serve` from a terminal").
- Keep it non-blocking for *slow* loads (a timeout is not a failure); only a
  non-timeout error demotes status.

## Acceptance criteria

- [ ] A host where `/api/tags` succeeds but `/api/generate` errors reports
      `error` severity, not `success`.
- [ ] The upstream error text appears in the UI, not only in the debug pane.
- [ ] A slow-but-successful load is not reported as a failure.
- [ ] New error code + remedy registered and unit-tested.
- [ ] Regression test with an exec stub: tags OK / generate failing -> error state.

## Out of scope

- Fixing the Metal failure itself — that is upstream Ollama.
- Blocking setup on a slow first load.
