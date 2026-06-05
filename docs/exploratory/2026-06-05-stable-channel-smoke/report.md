# stable Channel Smoke Test - 2026-06-05

## Environment

- Repo branch: `fix/ollama-auth-propagation`
- Base commit under test: `0204f70`
- Release tag under test: _fill in after selecting the target release_
- Channel under test: `stable`
- Extension install under test: `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable`
- Runtime image under test: `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:stable`
- Docker Desktop version: 4.75.0 (227598), Engine 29.5.2
- macOS version / chip: macOS 26.5.1 (25F80), arm64 (Darwin 25.5.0)
- Host Ollama status: not tested this pass

## Preflight

1. `make verify-release-channel RELEASE_CHANNEL=stable`
2. `make verify-channel-install RELEASE_CHANNEL=stable`
3. `docker extension ls`
4. `docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'`

## Manual Flow

1. Install the channel image in Docker Desktop if it is not already installed.
2. Open the `OpenClaw` extension.
3. Confirm the `Quick Start` card lists the expected four-step flow.
4. Click `Check Requirements`.
5. Click `Start`.
6. Wait for `OpenClaw is ready`.
7. Confirm the `Gateway Token` field fills automatically, shows `Auto-attached`, and uses success styling. If it remains blank, click `Refresh Token` once and record the result.
8. Click `Open Control UI`.
9. Confirm the Control UI opens on localhost without manual token editing.
10. Confirm update status does not flicker or repeatedly switch after startup while the extension is idle.
11. If testing the local-model path, confirm host Ollama is already running with a model pulled, then reopen or refresh the extension.
12. Confirm `Local Model Setup` detects installed host Ollama models automatically or after clicking `Detect Ollama Models`.
13. If no Ollama model is configured yet, confirm the setup banner appears, click `Select Recommended Model`, then click `Apply and Restart`.
14. Reopen the extension and confirm the Ollama setup banner stays dismissed only after using its dismiss control.
15. Finish one basic chat prompt in the Control UI.

## Artifacts

- `environment.txt`
- `verify-release-channel.txt`
- `verify-channel-install-dry-run.txt`
- `docker-extension-ls.txt`
- `docker-extension-inspect.txt`
- `docker-ps-a.txt`
- `docker-image-ls.txt`
- `openclaw-service-inspect.txt`
- `openclaw-service.log`
- `control-ui-healthz.txt`
- `control-ui.png`
- `extension-ui.png` or note why Docker Desktop UI capture was blocked

## Results

| Flow | Result | Evidence |
| --- | --- | --- |
| Channel preflight | PASS | `verify-release-channel.txt`: both channel images publicly readable; install path ready |
| Extension registered in Docker Desktop | FINDING | `docker-extension-ls.txt`: extension registered as `dev` (local build), not the stable channel image — see Findings |
| Runtime container running | PASS | `docker-ps-a.txt`: `openclaw-docker-extension-service` Up 5h (healthy); `openclaw-service-inspect.txt`: image version `2026.6.1`, created 2026-06-03 |
| Localhost exposure | PASS | `control-ui-healthz.txt`: `{"ok":true,"status":"live"}` on 127.0.0.1:18789 |
| Quick Start onboarding | PASS | Extension UI shows Status: Running, "OpenClaw is ready." — onboarding previously completed; `extension-ui.png` |
| Gateway token auto-attached UX | PASS | Gateway Token field populated, "Auto-attached" label visible, Refresh Token + Copy buttons present; `extension-ui.png` |
| Control UI bootstrap from extension button | PASS | "Open Control UI" opened browser tab titled "OpenClaw Control" on localhost:18789; Overview shows STATUS: OK, UPTIME: 5h; `control-ui.png` |
| Runtime update status stability | PASS | Overview Snapshot stable: STATUS OK, TICK INTERVAL 30s, LAST CHANNELS REFRESH "just now"; no flicker observed during idle observation; `control-ui.png` |
| Local-model flow (if used) | SKIP | Host Ollama not tested this pass |
| Ollama setup banner persistence (if used) | SKIP | Host Ollama not tested this pass |

## Findings

1. **Extension installed as `dev` (local build), not stable channel image.** `docker extension ls` shows `openclaw-docker-extension` at version `dev` with provider `jcowhigjr/openclaw-docker-desktop-extension`. The stable channel image (`ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable`) is not the active install. This means the runtime container running (image `2026.6.1`, revision `2e08f0f`) is from a local build, not the published stable channel artifact. A full stable channel smoke requires switching to the channel image via `make install-channel RELEASE_CHANNEL=stable` (or `make update-channel` if already installed).
2. **Two socat bridge errors in service log.** `openclaw-service.log` shows two `Connection refused` errors from socat bridges at 03:48 and 12:22 UTC today — both before the service was confirmed healthy. No indication of persistent failure.
3. **No Anthropic API key configured; agent falls back to gemma4:latest (Ollama).** Control UI chat session shows "No API key found for provider 'anthropic'" in the heartbeat session from 14h ago. Chat round-trip (`Check system health`) completed (Done, 4.1k/200k context used) but model selector shows `gemma4:latest · Off` (host Ollama not running). This is a pre-existing configuration state, not a regression.
4. **`MEMORY.md` workspace file missing.** Control UI workspace panel shows `MEMORY.md` with a "Missing" badge. Low severity — does not affect gateway or extension operation.

## Recommendation

_Cannot recommend release clearance on this pass. Blocker: the active extension install is a local `dev` build, not the published stable channel image. All runtime/GUI checks pass against the dev build (runtime v2026.6.1). Re-run against `make install-channel RELEASE_CHANNEL=stable` to complete a true stable channel smoke._
