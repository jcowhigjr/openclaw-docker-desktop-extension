# Submission Readiness Packet

This packet is the short reviewer guide for the OpenClaw Docker Desktop extension.
It summarizes what is ready, how to smoke test it, and what is intentionally deferred.

## Project Positioning

This repository provides a Docker Desktop extension for trying OpenClaw on macOS with:

- a localhost-only OpenClaw Control UI launch path
- a Docker-managed runtime container and persistent named volume
- GHCR release/channel install paths
- runtime update and restart controls
- host Ollama setup for offline-first local model use after initial model download
- explicit execution-mode controls for safer vs full-access command execution

The project is a credible local trial path, not a hardened security boundary and not a full native OpenClaw installer.

Marketplace listing copy is drafted in [marketplace-listing.md](marketplace-listing.md).

## Reviewer Smoke Test

Use this path for a 5-10 minute functional review on macOS with Docker Desktop.
The extension is not listed in the Docker Extensions Marketplace yet, so this
review path uses the GHCR stable channel.

If you want a timestamped evidence packet before starting, run:

```bash
make create-smoke-report RELEASE_CHANNEL=stable RELEASE_TAG=v0.3.4
```

That scaffolds a report under `docs/exploratory/` with the preflight commands,
manual steps, and artifact checklist already filled in.

1. Start Docker Desktop and wait for the Docker Engine to become ready.
2. Confirm Docker Desktop allows local or non-Marketplace extension installs.
3. Install the current stable channel:

   ```bash
   docker extension install ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable
   ```

4. Open the `OpenClaw` extension in Docker Desktop.
5. Click `Check Requirements`.
6. Click `Start`.
7. Wait for `OpenClaw is ready`.
8. Click `Open Control UI`.
9. Confirm the Control UI opens at localhost and does not require manual URL/token editing.
10. If testing local models, start Ollama on the host Mac, ensure a model is already pulled, then use `Local Model Setup`.
11. Send a basic chat prompt in the Control UI.

Maintainer release-channel validation:

```bash
make verify-channel-install RELEASE_CHANNEL=stable
make verify-channel-install RELEASE_CHANNEL=stable EXPECTED_RELEASE_TAG=v0.3.4
```

Use `DRY_RUN=1` when you want to validate command construction without mutating Docker Desktop.

## What Is Ready

- Install/update: GHCR release and channel paths are documented and validated by repository scripts.
- Marketplace metadata: required labels, semver aliases, multi-arch images, and Docker's documented `utility-tools` category are covered by the pre-push metadata guard.
- Startup UX: the extension exposes `Check Requirements`, start/stop/restart, update/restart, and debug output.
- Control UI bootstrap: `Open Control UI` launches the canonical localhost URL and passes the gateway token via URL fragment.
- Local model path: host Ollama detection and configuration are supported through `Local Model Setup`.
- Offline-first story: after Ollama and the selected model are installed, the local model path does not depend on hosted-provider network access for core local chat.
- Execution mode: `Safer` and `Full access` modes write the OpenClaw exec policy and approvals file, then restart OpenClaw so cached policy reloads.
- Runtime hardening: newly created service containers use localhost binding, read-only root filesystem, tmpfs `/tmp`, dropped Linux capabilities, `no-new-privileges`, and a nofile ulimit.
- Troubleshooting: README covers Docker Desktop vs Ollama startup requirements, port conflicts, gateway token fallback, and localhost health checks.

## Known Limits

- macOS and Apple Silicon are the validated first path.
- Existing containers created before the restored hardening flags must be removed and recreated to pick up Docker run-time hardening settings.
- Host Ollama must be running for local-model detection and for any already configured `ollama/<model>` default.
- The extension does not bundle a local inference runtime.
- The extension does not perform automatic host posture scanning.
- Provider credentials beyond the Ollama setup path remain OpenClaw-owned.
- Release notes / what-changed UI after runtime updates is not implemented yet.

## Remaining Roadmap

Open issues at submission time:

- [#65](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/65): long-term security, hardening, supply-chain, and network migration epic.
- [#12](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/12): roadmap and decision gates tracker.

Native migration after a Docker Desktop trial is documented as a manual investigation path in [native-migration-investigation.md](native-migration-investigation.md).

These are not blockers for an external review of the current Docker Desktop extension path.

## Suggested Reviewer Questions

- Does the extension communicate the Docker Desktop and Ollama prerequisites clearly enough?
- Is the localhost-only Control UI path understandable to a non-expert user?
- Is the security story honest: more isolated local packaging, not a sandbox guarantee?
- Does `Check Requirements` reduce first-run confusion enough for a public review?
- Is the host-Ollama offline path a sufficient first local-model strategy before considering bundled inference?
