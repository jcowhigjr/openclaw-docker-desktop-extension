# Local Model Diagnostics

A symptom-first index of local-model failures, with the *real* cause behind each and the
command that distinguishes it from what the message appears to say.

Every entry here was observed on a real host. The message text is quoted verbatim so it is
greppable. Where a cause is not fully established, the entry says so.

For tuning (model choice, context size, thinking), see
[local-model-tuning.md](local-model-tuning.md). For a pre-flight sanity pass before
reporting a bug, see [preflight-checklist.md](preflight-checklist.md).

**The one rule that would have saved the most time:** the message names the subsystem that
*noticed* the failure, not the one that *caused* it. Verify the named subsystem is actually
at fault before acting on it.

---

## The agent replies but never does anything

### `LLM request failed: network connection error.`

This label covers two different faults. Check which one it is before acting.

**1. A ~70-second network cut (#246).** If Ollama's log shows the request ending in a
500 after 1m10s–1m14s, the connection really was dropped:

```bash
grep '"/api/chat"' ~/.ollama/logs/server.log | tail -5
```

Node's TCP keepalive probes through `host.docker.internal` go unanswered by Docker
Desktop's forwarder, so the kernel fails the socket (`ETIMEDOUT`) once a request has
waited ~70s for its first byte. Cold loads and long prompts hit it; short requests never
do. That is why a quick reachability check passes, and why curl (which probes every 60s)
works while OpenClaw does not. Current versions route Ollama through an in-container
relay. Confirm it is in use, and re-apply the model in Local Model Setup if not:

```bash
docker exec openclaw-docker-extension-service openclaw config get models.providers.ollama.baseUrl
# expect http://127.0.0.1:11434
```

**2. A turn timeout with a misleading label (#219).** Read the gateway log. The real
reason is there:

```bash
docker exec openclaw-docker-extension-service \
  sh -lc 'grep -E "reason=timeout|retry window elapsed|lane task error" /tmp/openclaw.log | tail -5'
```

`reason=timeout` with a large `durationMs` means the turn ran out of time. Prove the
relay path is reachable rather than assuming. This only proves reachability: a fast
request cannot show the ~70s cut in cause 1.

```bash
docker exec openclaw-docker-extension-service node -e "fetch('http://127.0.0.1:11434/api/tags').then(r=>r.json()).then(d=>console.log('reachable, models:',d.models.length)).catch(e=>console.log('FAIL',e.message))"
```

Most common trigger: the **first turn after a reboot**, when the page cache is cold. Warm
the model and retry before debugging anything:

```bash
curl -s http://127.0.0.1:11434/api/generate \
  -d '{"model":"qwen3:8b","prompt":"hi","stream":false,"think":false,"keep_alive":"15m"}' >/dev/null
```

### `empty response detected ... retrying 1/1 with visible-answer continuation`

The model spent its output budget on a thinking trace and returned no visible content.
OpenClaw reads `message.content`; thinking arrives in a separate field.

`reasoning: false` on the model entry does **not** fix this. The Ollama request needs
`think: false`, which comes from `params.thinking`:

```bash
docker exec openclaw-docker-extension-service \
  grep -o '"thinking":[^,}]*' /home/node/.openclaw/openclaw.json
```

Expect `"thinking": false`. No output means the key is absent — see
[local-model-tuning.md](local-model-tuning.md#disabling-ollama-native-thinking-qwen3-style-models).

### The model invents filenames that do not exist

Symptom: it reports `file1.txt`, `file2.txt`… missing, having never listed the directory.

Two contributing causes, usually together:

1. **Context too small.** At Ollama's 4096 default the workspace bootstrap is truncated and
   the model guesses. Check what is actually being served:

   ```bash
   curl -s http://127.0.0.1:11434/api/ps | python3 -c "import sys,json;[print(m['name'],m.get('context_length')) for m in json.load(sys.stdin)['models']]"
   ```

   Anything at or near 4096 is too small. See #213.

2. **The prompt did not name a tool.** Small models need to be told which tool to use.
   "List the files" is not enough; "Use the exec tool to run: ls \<path\>" is. (The shell
   tool is named `exec` in OpenClaw 2026.9.x.)

### The model says it will run a command, but nothing runs

Symptom: the reply describes the command, or the turn times out after the model has
called `tool_call` over and over with the command's arguments.

OpenClaw's Tool Search hides tools behind `tool_search` → `tool_describe` → `tool_call`
for local models, and an 8B model cannot drive that indirection (#247). The extension
turns Tool Search off for local models; confirm it is off:

```bash
docker exec openclaw-docker-extension-service openclaw config get tools.toolSearch
# expect false; if not, re-apply the model in Local Model Setup
```

### `dir_list failed: no paired nodes available; file-transfer tools require a paired node`

The model chose `dir_list` — a **remote, node-paired file-transfer tool** — when it needed
the local filesystem tools. Nothing is misconfigured; the model picked wrong from a
catalogue of similarly-named tools.

Local tools are `exec`, `read`, `write`, `edit`, and `apply_patch`. Name the one you want
in the prompt.

### `SESSION_WORK_START_CHANGED` / `Session ... changed while starting work`

A previous run on that session key is still active or was interrupted. Use a fresh key:

```bash
docker exec openclaw-docker-extension-service openclaw agent \
  --session-key "agent:main:$(date +%s)" -m "..."
```

---

## Ollama looks healthy but nothing works

### `/api/tags` returns models, but every load fails

**A successful `/api/tags` proves almost nothing.** It reads model metadata from disk. It
does not load a model, does not touch the GPU, and does not open the backend libraries —
so it keeps answering long after inference has stopped working.

Observed failure: `llama-server process has terminated: error: failed to create library`
on every load, while `/api/tags` answered normally throughout.

Root cause in that case was a **version mismatch**: a long-lived `ollama serve` process
from an older build was still holding the port after the app on disk had been updated, so
it tried to open backend libraries belonging to a different version.

Check version coherence between the running server and the binary on disk:

```bash
ollama --version                                   # binary on disk
curl -s http://127.0.0.1:11434/api/version         # process actually serving
```

If they disagree, the serving process is stale. Restart Ollama and confirm the version
changes. The only trustworthy health check is an actual load:

```bash
curl -s http://127.0.0.1:11434/api/generate \
  -d '{"model":"<model>","prompt":"ok","stream":false,"think":false}'
```

### Ollama lists models you did not install, or omits ones you did

The server is reading a different model store than you expect. The macOS app sets
`OLLAMA_MODELS` (observed: `/Users/Shared/ollama-models`), while a bare `ollama serve`
started from a shell defaults to `~/.ollama/models`.

The server's own startup log records what it used:

```bash
grep -o 'OLLAMA_MODELS:[^ ]*' ~/.ollama/logs/server.log | tail -1
```

---

## The context setting keeps getting overwritten

Symptom: `num_ctx` was configured, worked, and later reverted to a small value without
anyone editing it.

The extension's **Detect Ollama Models** / apply flow rewrites
`models.providers.ollama` wholesale. Anything hand-tuned in that block — `num_ctx`,
`contextTokens`, `params` — is replaced by whatever the helper writes. Re-applying a model
is therefore not a no-op.

A client-independent alternative is to bake the context into a **Modelfile variant**. The
value then lives in the model itself, so it survives config rewrites, applies to every
client, and needs no coordination with whatever the extension writes:

```bash
cat > /tmp/Modelfile <<'EOF'
FROM qwen3:8b
PARAMETER num_ctx 24576
EOF
ollama create qwen3:8b-agent -f /tmp/Modelfile
```

This reuses the existing weights — no download, negligible extra disk. Verify:

```bash
ollama show qwen3:8b-agent --parameters
```

Then select `qwen3:8b-agent` as the configured model. Confirmed working on this pattern:
an equivalent variant built for OpenCode carried `num_ctx 32768` in its manifest and
restored tool use independently of client-side settings.

**Trade-off:** it is another model entry to keep track of, and the value is now in two
places if the client also sets one. Prefer it when a setting keeps getting clobbered or
must hold across several clients; prefer client config when one client owns the setting.

---

## The gateway will not start

The container's log lives on tmpfs and dies with the container, so a crashed container
takes its own diagnostic with it. Run the gateway in the foreground to see the real error:

```bash
docker run --rm --platform linux/arm64 --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m --cap-drop ALL --security-opt no-new-privileges \
  -v openclaw-docker-extension-home:/home/node \
  --entrypoint docker-entrypoint.sh openclaw-docker-extension-runtime:dev \
  node openclaw.mjs gateway --allow-unconfigured 2>&1 | head -15
```

The last line beginning `Gateway failed to start:` is the actual cause.

| Message | Cause | Fix |
|---|---|---|
| `meta: Unrecognized key: "lastTouchedAt"` | config schema drift after an upgrade | remove the key |
| `agents.ownership: multi-agent rosters require agents.ownership="explicit"` | more than one agent with no declared owner | set `agents.ownership: "explicit"`, or remove unused agents |
| `Legacy workspace setup state requires migration for <path>` | forward migration pending | `openclaw doctor --fix` — **once per workspace named**; repeat until it starts |
| `restart-loop breaker tripped: N unclean boot(s)` | consequence of one of the above | fix the real error; this clears itself |

`doctor --fix` migrates one workspace per invocation. Do not assume a single run is enough.

### After a downgrade, the older container exits immediately

`doctor --fix` migrations are **forward-only**. Once workspace state has moved into
SQLite, an older OpenClaw cannot read the volume, and the container exits(1) at once.

Keeping the previous container is therefore *not* a rollback. Rolling back requires a
**volume snapshot taken before the migration**:

```bash
docker run --rm -v openclaw-docker-extension-home:/data -v "$PWD":/backup alpine \
  tar czf /backup/openclaw-volume-pre-upgrade.tar.gz -C /data .
```

---

## Noise that is not your problem

| Message | Meaning |
|---|---|
| `No API key found for provider "openai"` from `[memory]` | the memory plugin wants embeddings; harmless on an offline setup, but it repeats every few seconds |
| `workspace bootstrap file AGENTS.md is N chars (limit 5000); truncating` | expected for large workspace files; contributes to small-context failures |
| `control ui build rejected ... clientBuild=legacy ... code=4008` | the browser is serving a cached older Control UI; hard-reload and clear site data |

---

## See Also

- [local-model-tuning.md](local-model-tuning.md) — model choice, context sizing, thinking
- [preflight-checklist.md](preflight-checklist.md) — the two-minute pass before reporting a bug
