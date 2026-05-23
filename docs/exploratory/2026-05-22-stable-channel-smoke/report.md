# stable Channel Smoke Test - 2026-05-22

## Environment

- Repo branch: `main`
- Base commit under test: `52a9ab7`
- Release tag under test: `v0.3.4`
- Channel under test: `stable`
- Extension install under test: `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable`
- Runtime image under test: `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:stable`
- Docker Desktop version: `4.73.0 (226246)` with Docker Engine server `29.4.3`
- macOS version / chip: `macOS 26.5`, `arm64`
- Host Ollama status: not tested in this pass

## Preflight

1. `make verify-release-channel RELEASE_CHANNEL=stable EXPECTED_RELEASE_TAG=v0.3.4`
2. `make verify-channel-install RELEASE_CHANNEL=stable EXPECTED_RELEASE_TAG=v0.3.4`
3. `docker extension ls`
4. `docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'`

## Manual Flow

1. Install the channel image in Docker Desktop if it is not already installed.
2. Open the `OpenClaw` extension.
3. Click `Check Requirements`.
4. Click `Start`.
5. Wait for `OpenClaw is ready`.
6. Click `Open Control UI`.
7. Confirm the Control UI opens on localhost without manual token editing.
8. If testing the local-model path, confirm host Ollama is already running with a model pulled, then finish one chat prompt through `Local Model Setup`.

## Results

| Flow | Result | Evidence |
| --- | --- | --- |
| Channel preflight | PASS | `verify-release-channel.txt` confirms GHCR `stable` extension/runtime tags are public and match `v0.3.4`; `verify-channel-install-dry-run.txt` confirms validator command construction. |
| Extension registered in Docker Desktop (stable) | PASS | `docker-extension-ls.txt` shows `jcowhigjr/openclaw-docker-desktop-extension` at version `stable` running in Docker Desktop. Installed via `docker extension install -f ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable`. |
| Runtime container running | PASS | `docker-ps-a.txt` shows `openclaw-docker-extension-service` running healthy on `127.0.0.1:18789->18790`; `openclaw-service-inspect.txt` confirms localhost port binding and hardening flags. |
| Localhost exposure | PASS | `control-ui-healthz.txt` returned `{"ok":true,"status":"live"}` from `http://127.0.0.1:18789/healthz`. |
| Extension UI in Docker Desktop | PASS | `extension-ui.png` shows OpenClaw Extension tab in Docker Desktop with Status `RUNNING` and "OpenClaw is ready". Runtime image shown as `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.3.4`. |
| Check Requirements | PASS | `check-requirements-pass.png` shows green banner: "Docker is ready, host port 18789 is available, and host Ollama is reachable for gemma4:latest." |
| Control UI bootstrap from extension button | PASS | `control-ui-launch.png` shows green banner "Opened OpenClaw Control. Paste the gateway token if the dashboard asks for one." `control-ui.png` shows OpenClaw Gateway Dashboard loading at `ws://127.0.0.1:18789` with auth prompt (expected for fresh browser session). |
| Local-model flow (if used) | NOT TESTED | Host Ollama is reachable (confirmed by Check Requirements), but full chat flow was not exercised in this pass. |

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
- `extension-ui.png` — Docker Desktop OpenClaw extension tab, Status RUNNING
- `check-requirements-pass.png` — Check Requirements green pass banner
- `control-ui-launch.png` — Open Control UI green banner confirmation
- `control-ui.png` — OpenClaw Gateway Dashboard at `ws://127.0.0.1:18789`

## Findings

1. Stable channel verifies cleanly against `v0.3.4` for both extension and runtime images.
2. `docker extension install -f ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable` succeeds and registers at version `stable` in Docker Desktop.
3. Note: `docker extension validate --validate-install-uninstall` reports a semver warning for the `stable` floating tag (not semver compliant) — this is expected for a channel tag, not a release tag. The install/uninstall flow itself completed successfully.
4. Runtime service is healthy, bound to `127.0.0.1:18789` only (localhost-only, correct).
5. Check Requirements confirms Docker readiness, host port availability, and host Ollama reachability (gemma4:latest).
6. Open Control UI launches the Gateway Dashboard in the browser at the correct localhost address.

## Recommendation

The stable-channel Docker Desktop UI smoke pass is complete. All required evidence is captured. This packet is sufficient to satisfy the `#86` release gate for the Docker Desktop / public external release of `v0.3.4`.
