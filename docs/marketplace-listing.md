# Docker Marketplace Listing Draft

Use this as the source copy for Docker Hub and Docker Marketplace submission fields.

## Extension Name

Shellharbor for OpenClaw

## Short Description

Run OpenClaw on your Mac in one click — isolated, localhost-only, managed from Docker Desktop.

## Overview

Shellharbor gives macOS users a clean local path for trying OpenClaw without managing the container wiring by hand.

The extension starts and stops an OpenClaw runtime container, publishes the Control UI on `127.0.0.1`, preserves OpenClaw state in a Docker volume, checks runtime image freshness, and helps configure host Ollama models for local/offline use after the model is already installed.

Shellharbor is community packaging — not an official OpenClaw or Docker product. It is a Docker Desktop path for OpenClaw that is more isolated and easier to clean up than a direct host install, but it is not a perfect security boundary or a full native installer.

## Key Features

- Start, stop, restart, and inspect OpenClaw from Docker Desktop.
- Open the localhost Control UI with gateway-token bootstrap.
- Keep OpenClaw state in a persistent Docker volume across restarts and updates.
- Check runtime image freshness and apply update/restart from the extension.
- Detect host Ollama models and configure OpenClaw for a selected local model.
- Switch between safer and full-access execution modes with an OpenClaw restart.
- Keep service exposure bound to localhost.

## Getting Started

1. Start Docker Desktop and wait for the Docker Engine to become ready.
2. Install the extension from Docker Marketplace once published, or use the documented GHCR path while Marketplace submission is pending.
3. Open the `OpenClaw` extension in Docker Desktop.
4. Click `Check Requirements`.
5. Click `Start`.
6. Wait for `OpenClaw is ready`.
7. Click `Open Control UI`.
8. Configure OpenClaw provider auth, or use `Local Model Setup` with an already running host Ollama install.

## Current GHCR Install Path

Until the Marketplace listing is published:

```bash
docker extension install ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable
```

## Known Limits

- macOS and Apple Silicon are the validated first path.
- Host Ollama is the supported local-model path; bundled local inference is deferred.
- Provider credentials beyond the Ollama setup path remain OpenClaw-owned.
- Some OpenClaw skills may require tool dependencies that are not bundled in the runtime image yet.
- The extension does not perform automatic host posture scanning.
- The wrapper improves local isolation and cleanup, but it is not a hardened sandbox.

## Support and Resources

- Project landing page: https://jcowhigjr.github.io/openclaw-docker-desktop-extension/
- Source: https://github.com/jcowhigjr/openclaw-docker-desktop-extension
- Issues: https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues
- Submission readiness packet: https://github.com/jcowhigjr/openclaw-docker-desktop-extension/blob/main/docs/submission-readiness.md
- Upstream OpenClaw: https://github.com/openclaw/openclaw
