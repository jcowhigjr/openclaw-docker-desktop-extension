**Delivery order:** 1 of 2 in the local-model tool-use batch (blocked by: none; the tool-surface issue depends on it)
**Minimum agent tier:** T2 — runtime entrypoint plus helper change with a proven workaround; one migration rule for existing configs; no design question left open

## Problem

Any OpenClaw → Ollama request that waits more than **~70 seconds for its first byte** gets killed. That covers a cold model load, or prefill of a prompt longer than ~9K tokens on an M4/24GB. OpenClaw logs:

```
embedded run agent end: … isError=true model=qwen3:8b-opencode provider=ollama error=LLM request failed: network connection error. rawError=fetch failed
transient same-model retry 1/8 for ollama/qwen3:8b-opencode reason=timeout
```

Ollama logs each one as `500 | 1m10s…1m13s | POST "/api/chat"` followed by `srv stop: cancel task`, sometimes mid-prefill.

The cut is not an OpenClaw timeout. It is the **TCP keepalive path between the runtime container and `host.docker.internal`**. Node/undici enables TCP keepalive on its sockets, and the kernel fails the read with `ETIMEDOUT` after ~70s of silence. That matches a 60s idle timer followed by fast probes that Docker Desktop's host forwarder never answers. curl (60s probe interval) and keepalive-off sockets on the same path are unaffected. Container sysctls are the kernel defaults (`7200/75/9`), so this comes from the per-socket settings Node applies.

OpenClaw's same-model retry (up to 8) sometimes rescues the turn, because llama-server reuses the partially prefilled KV cache on each attempt. To users that looks like "slow but the tokens accumulate". Other times it fails outright: with Tool Search off (19.5K-token prompt), the A/B arm failed 2/2 after 221s.

This is very likely the real cause behind the "120s idle watchdog" failures in #156. The comment on the `localModelLean` default in `ollama-config-write` (`runtime/openclaw-extension-helper.js`) cites the same watchdog.

## Evidence (2026-09-24, M4/24GB, Docker Desktop, Ollama 0.34.3, runtime `0.5.0` / OpenClaw `2026.9.3`)

Same Ollama and model, fresh uncached ~12.3K-token prompts (`stream: true`, `num_predict: 5`):

| Client | Path | Result |
|---|---|---|
| curl on the host | `127.0.0.1:11434` | 200 after 149s |
| curl in a throwaway container | `host.docker.internal:11434` | 200 after 93.8s |
| Node `fetch` in the service container | `host.docker.internal:11434` | **`fetch failed` / `ETIMEDOUT read ETIMEDOUT` after 73.3s** |
| Node `http.request` with keepalive **off**, service container | `host.docker.internal:11434` | 200 after 101.8s |
| Node `fetch` in the service container through an in-container relay `socat TCP-LISTEN:11435,bind=127.0.0.1,reuseaddr,fork TCP:host.docker.internal:11434` | `127.0.0.1:11435` | **200 after 110.5s** |
| Raw idle TCP (`nc -d -k -l` on host) from a container | `host.docker.internal:18999` | connection held the full 200s |

OpenClaw end to end: Ollama's log for 2026-09-24 shows **22** `/api/chat` requests that returned 500 at **1m10s–1m14s**. They include the manual Control UI attempts, every A/B arm, and the plain-Node repro above. Raising `models.providers.ollama.timeoutSeconds` to 300 did **not** change that. With `baseUrl` pointed at the in-container relay, a cold first call ran **3m29s and returned 200 with no retries**, and the tool-using turn passed.

## Proposed fix

1. The runtime entrypoint starts a second relay next to the existing 18789→18790 bridge: `socat TCP-LISTEN:11434,bind=127.0.0.1,reuseaddr,fork TCP:host.docker.internal:11434`. It binds container loopback only, runs as the same non-root user, and needs nothing beyond the current hardening flags. `socat` is already in the image.
2. `ollama-config-write` writes `models.providers.ollama.baseUrl = http://127.0.0.1:11434` (OpenClaw's documented default URL). The UI's own detection and probe calls may keep using `host.docker.internal`, because curl is unaffected.
3. Migration: on the next Apply, the helper rewrites an existing `http://host.docker.internal:11434` baseUrl to the relay URL. It leaves any other user-set URL alone (remote Ollama, custom port).
4. Update the `localModelLean` comment in the helper so it stops citing the 120s watchdog as the cause.
5. File upstream with a minimal repro: Docker Desktop for Mac (the host forwarder doesn't keep keepalive-probed connections alive). An OpenClaw issue asking for a provider-level keepalive option is optional.

## Acceptance criteria

- [ ] From the service container, a Node `fetch` to the configured Ollama URL survives a ≥100s wait for the first byte (keep a script under `scripts/` that reproduces the table above and exits non-zero on `ETIMEDOUT`).
- [ ] A cold first agent turn whose prefill exceeds 70s completes with **no** `transient same-model retry` lines in the gateway log.
- [ ] Container restart brings the relay back; `ps` shows both socat listeners and the 11434 relay binds 127.0.0.1 only.
- [ ] Existing installs with `host.docker.internal:11434` are migrated on Apply; custom URLs are untouched (helper tests cover both).
- [ ] Re-check #156 against this fix and close it or narrow it.

Related: #156, #241, the tool-surface issue that follows.
