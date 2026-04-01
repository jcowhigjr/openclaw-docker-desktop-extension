# OpenClaw Docker Desktop Extension

Docker Desktop extension for running OpenClaw on macOS with a localhost bridge workaround.

## Why this exists

OpenClaw's gateway listens on loopback inside the container. On Docker Desktop for macOS, publishing that listener directly can leave the Control UI unreachable from the host even when the process is healthy inside the container.

This extension works around that by running OpenClaw inside a small wrapper image that includes `socat`, then publishing a bridged localhost port that behaves like a normal host-facing service.

## What it does

- Starts and manages an OpenClaw service container from Docker Desktop
- Uses a bundled `socat` bridge so the Control UI is reachable on macOS
- Persists OpenClaw state in a named Docker volume
- Exposes a simple Docker Desktop UI for start, stop, restart, and open-in-browser actions
- Surfaces runtime diagnostics in a debug panel inside the extension

## Tested environment

- Docker Desktop on macOS
- Apple Silicon
- OpenClaw upstream image via a local runtime wrapper

## Default runtime

- Runtime image: `openclaw-docker-extension-runtime:dev`
- Host port: `18789`
- Internal bridge port: `18790`
- Named volume: `openclaw-docker-extension-home`
- Service container: `openclaw-docker-extension-service`

## Repository layout

- [metadata.json](./metadata.json): Docker Desktop extension metadata
- [docker-compose.yaml](./docker-compose.yaml): extension service wiring
- [runtime/Dockerfile](./runtime/Dockerfile): local runtime image that bundles `socat`
- [runtime/openclaw-bridge.sh](./runtime/openclaw-bridge.sh): starts OpenClaw and the bridge
- [ui/src/App.tsx](./ui/src/App.tsx): extension dashboard

## Build and install

```bash
npm --prefix ui install
docker build -t openclaw-docker-extension-runtime:dev -f runtime/Dockerfile runtime
docker build -t openclaw-docker-extension:dev .
docker extension install -f openclaw-docker-extension:dev
```

If your Docker Desktop policy blocks local extension installs, enable non-Marketplace or local extension installs in Docker Desktop first.

## Usage

1. Open the `OpenClaw` extension tab in Docker Desktop.
2. Start the service.
3. If you want Anthropic-backed chat, paste your Anthropic API key into `Provider Auth` and save it.
4. Wait for the status to become `RUNNING`.
5. Open the Control UI.
6. Connect using:
   - Browser URL: `http://127.0.0.1:18789`
   - WebSocket URL: `ws://127.0.0.1:18789`

## Provider auth

The extension includes a masked, write-only Anthropic API key field.

- The key is written into `/home/node/.openclaw/.env`
- That file lives in the persistent Docker volume `openclaw-docker-extension-home`
- The extension clears the input field after save
- The service restarts after the key is written so OpenClaw reloads the credential

This means the credential survives container restarts and rebuilds, but is removed if you delete the named volume.

## Security notes

- The wrapper publishes OpenClaw on `127.0.0.1` only.
- State is stored in the named Docker volume `openclaw-docker-extension-home`.
- This project is not an official Docker or OpenClaw extension.

## Current limitations

- Gateway token autofill is not fully reliable yet. If the token field is blank in the extension UI, open the Control UI and paste the token manually.
- The runtime can spend a short warm-up period in `starting` even after the host health check is already passing.
- This has been tested primarily on macOS with Docker Desktop. Other environments may not need the bridge at all.
- Anthropic provider auth currently supports the local `.env` persistence path first. It does not yet manage richer OpenClaw auth-profile workflows in the UI.

## Troubleshooting

- If the extension says `RUNNING` but the browser page does not open, check `http://127.0.0.1:18789/healthz`.
- If the token field is empty, inspect the debug panel in the extension and fetch the token from the service container or volume.
- If local installation fails, confirm Docker Desktop allows local extensions.

## Attribution

- OpenClaw upstream project: <https://github.com/openclaw/openclaw>
- Docker Desktop extension structure was informed by the Open WebUI Docker Desktop extension pattern
