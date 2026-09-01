# Preflight Checklist

Run this before starting OpenClaw. It takes about two minutes and replaces the
half hour you would otherwise spend diagnosing an opaque chat timeout.

The extension cannot bundle its dependencies. Docker Desktop and Ollama are
separate applications that update themselves on their own schedule and do not
start at login. This checklist makes their state explicit instead of pretending
everything "just works."

Each step tells you what a **good** result looks like, so a bad one is obvious.

---

## 1. Is the Docker engine actually running?

```bash
docker info --format '{{.ServerVersion}}'
```

**Good:** a version number.
**Bad:** `Cannot connect to the Docker daemon`.

The Docker Desktop *window* being open does not mean the engine is running — the
GUI and the engine start separately, and Docker Desktop on macOS is frequently
configured with `AutoStart = False`. Start Docker Desktop and wait for the whale
icon to stop animating.

## 2. Is Ollama reachable?

```bash
curl -s --max-time 5 http://127.0.0.1:11434/api/version
```

**Good:** `{"version":"0.x.y"}`.
**Bad:** empty output or a connection error — Ollama is not running. Launch
Ollama.app, or run `ollama serve` in a terminal.

## 3. Can Ollama actually *load* a model?

This is the step that matters most, and the one everyone skips.

```bash
curl -s --max-time 120 http://127.0.0.1:11434/api/generate -d '{"model":"MODEL_NAME","prompt":"hi","stream":false}' | head -c 300
```

**Good:** a JSON response containing `"response"`.
**Bad:** `{"error":"llama-server process has terminated: ..."}`.

**Listing models is not the same as running them.** `ollama list` and the
extension's model dropdown both read from disk and will happily show models that
cannot load at all. A broken GPU/Metal backend, a bad update, or a full disk all
produce a healthy-looking list and a total inability to answer.

If this step fails, try running the server outside the desktop app — this alone
fixes a whole class of macOS Metal-compiler failures:

```bash
pkill -f "Ollama.app"; ollama serve
```

## 4. Does your chosen model fit in memory?

```bash
curl -s http://127.0.0.1:11434/api/tags | python3 -m json.tool | grep -E '"name"|"size"'
```

Compare the model's `size` (bytes of weights) against your usable VRAM budget.
On Apple Silicon that budget is roughly 75% of total RAM — a 24 GB Mac gets about
17.8 GiB. Ollama logs the exact figure at startup:

```bash
grep "vram-based default context" ~/.ollama/logs/server.log | tail -1
```

Leave headroom above the weights for the KV cache. **A model whose weights alone
approach your budget will not work**, regardless of what any recommendation says.

Measured reference (M4, 24 GB, 27.9B model at ~18.2 GB of weights):

| Prompt | Result |
|---|---|
| 6 tokens | 52 s |
| ~20k tokens (a realistic agent system prompt) | no reply in 10 minutes |

That second row is why chats appear to hang: OpenClaw's 120-second idle watchdog
fires long before the first token arrives.

## 5. Did anything update since it last worked?

```bash
curl -s http://127.0.0.1:11434/api/version
grep -c "failed to create library" ~/.ollama/logs/server.log
```

Ollama checks for updates **hourly** and replaces itself in place. If your
version changed and step 3 now fails, the update is your prime suspect — not
your configuration and not the extension.

A non-zero count in the second command means the inference backend is broken
even though the API answers normally.

---

## Quick copy-paste

```bash
D=$(docker info --format '{{.ServerVersion}}' 2>/dev/null); echo "1. docker engine: ${D:-DOWN - start Docker Desktop}"
O=$(curl -s --max-time 5 http://127.0.0.1:11434/api/version); echo "2. ollama api:    ${O:-DOWN - start Ollama}"
echo "3. models installed:"; curl -s http://127.0.0.1:11434/api/tags | grep -o '"name":"[^"]*"' | sed 's/^/     /'
echo "4. vram budget:  $(grep -h 'vram-based default context' ~/.ollama/logs/server*.log 2>/dev/null | tail -1 | grep -o 'total_vram=\"[^\"]*\"' || echo unknown)"
echo "5. backend load errors (all rotated logs): $(grep -hc 'failed to create library' ~/.ollama/logs/server*.log 2>/dev/null | paste -sd+ - | bc)"
```

Step 3's load test still has to be run by hand with a real model name — it is the
only step that proves the stack can do work.

---

## Why this exists rather than being hidden

Automating these checks into a green tick is tracked in
[#192](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/192)
and [#191](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/191).
The checks will become visible UI, not silent ones: an explicit five-minute
checklist that tells the truth is worth more than an interface that appears to
work and fails opaquely thirty minutes later.
