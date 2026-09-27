**Delivery order:** 1 of 1 — release blocker for the Ollama path; fix before any further `stable` promotion
**Minimum agent tier:** T2 — one helper function, a documented upstream CLI to call instead, tests to update; no design question left open

## Problem

On a **fresh** `v0.5.0` install, applying a model in Local Model Setup leaves the agent unable to run a single turn:

```
Auth profile store ~/.openclaw/agents/main/agent/openclaw-agent.sqlite requires legacy
credential migration; run openclaw doctor --fix. | AUTH_PROFILE_MIGRATION_REQUIRED
```

The extension's own helper (`ollama-auth-profiles-write` in `runtime/openclaw-extension-helper.js`) writes `agents/<id>/agent/auth-profiles.json`. The OpenClaw the same release ships (`2026.9.3` in `…-runtime:0.5.0`) moved auth profiles into its SQLite store and treats that JSON file as **legacy** input that must be migrated before any agent run. So the extension writes a format its own runtime refuses. Still true on `main`.

The bug is invisible to CI: `scripts/test-runtime-helper.sh` asserts the JSON is written, which it is. Nothing checks that the shipped OpenClaw will accept it.

## Evidence (2026-09-24)

- Install: `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.5.0`, OpenClaw `2026.9.3 (1391f7c)`. Volume and container both created by the extension on 2026-09-23. No old or restored state (`lastTouchedVersion: 2026.9.3`, no pre-existing workspace files).
- `auth-profiles.json` mtime is about 4 minutes after container creation, consistent with the Apply step.
- `openclaw doctor` (read-only) reports an **Auth profile SQLite migration** section naming that file, and `doctor:auth-profiles run failed: … requires legacy credential migration`.
- A/B on disposable volumes restored from the same snapshot, same image, same command (`openclaw agent --local -m "Reply with exactly the word: pong"`):

| State | Result |
|---|---|
| As shipped (legacy JSON present) | `requires legacy credential migration` |
| Legacy JSON removed, profile written with `printf 'ollama-local\n' \| openclaw models auth paste-api-key --provider ollama --agent main` | `pong` |

  After the fix, doctor's migration markers are gone and `openclaw models auth list --agent main` shows `ollama:manual [ollama/api_key]`, the same profile id the helper already uses.

## Proposed fix

Replace the helper's JSON write with OpenClaw's supported command, run once per agent:

```sh
printf 'ollama-local\n' | openclaw models auth paste-api-key --provider ollama --agent <id>
```

The default profile id is already `ollama:manual`. Remove any stale `auth-profiles.json` the old helper left behind, or have the fix path run `openclaw doctor --fix` for existing installs, so already-installed users recover on their next Apply.

## Acceptance criteria

- [ ] On a fresh volume, Apply plus one no-tool agent turn succeeds (e.g. replies `pong`). Verified against the **shipped** runtime image, not a dev build.
- [ ] An existing install carrying the legacy JSON also recovers after Apply.
- [ ] `scripts/test-runtime-helper.sh` no longer only asserts the JSON exists. Add a test that exercises a real OpenClaw from the runtime image, or at minimum asserts the helper no longer writes the legacy file.
- [ ] `docs/local-model-diagnostics.md` gains an entry for `AUTH_PROFILE_MIGRATION_REQUIRED`.

## Unrelated, noted while testing

A fresh install defaults to **Safer** execution mode. Non-interactive `openclaw agent --local` tool calls are therefore blocked (`⚠️ Tool Call blocked`, then a timeout), because no one can approve them. That is expected behaviour, not part of this bug, but it means CLI smoke checks should use no-tool prompts or Full access mode.
