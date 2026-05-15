# Skill Dependency Architecture

This note records the Docker Desktop extension position for OpenClaw skills that need extra binaries, model runtimes, or services.

## Problem

The extension runs OpenClaw inside a Linux container. Some OpenClaw skill remediation text assumes a host workstation and can suggest host package managers such as Homebrew. That is wrong for the default Docker Desktop path when the missing dependency is needed inside the container.

The first observed example is `openai-whisper`: it reported missing `bin:whisper` and suggested installing Homebrew, even though the user was inside the containerized OpenClaw runtime.

## Current Supported Path

For Marketplace readiness, the supported local-model path is:

- OpenClaw runtime in the extension-managed container
- host Ollama on `127.0.0.1:11434`
- container access through `http://host.docker.internal:11434`
- extension UI detection and config write through `Local Model Setup`

This keeps the extension image smaller and lets Ollama use the host Mac's normal local-model runtime and acceleration. It is intentionally narrower than solving all possible skill dependencies.

## Recommendation

Use a four-tier model for skill dependencies:

1. **Supported host bridge**
   - Use for host Ollama first.
   - Dependency lives on the host by design.
   - UI copy must say the tool is host-managed and optional.

2. **Bundled runtime tool**
   - Use only for small, high-value tools needed by common first-run workflows.
   - Tool lives in the OpenClaw runtime image.
   - Avoid adding large model runtimes or heavy media stacks until there is user demand.

3. **Optional sidecar or on-demand image**
   - Preferred direction for heavier tools such as Whisper.
   - Tool lives in a dedicated container image with explicit pull/start/stop behavior.
   - The extension should show download size, running state, and cleanup path before enabling it.

4. **Unsupported or deferred**
   - Default classification for skills whose dependency path is not designed yet.
   - UI/remediation text should not tell Docker Desktop users to install host packages unless the skill is explicitly host-managed.

## Classification

| Capability | Current classification | Rationale | Next action |
| --- | --- | --- | --- |
| Host Ollama models | Supported host bridge | Already implemented through `Local Model Setup`; keeps local inference outside the extension image. | Keep as the main differentiator for local/offline use. |
| Docker MCP tools and Docker Models | Roadmap integration path | Fits Docker Desktop ecosystem, but already tracked separately and should not block Marketplace readiness. | Revisit after Marketplace submission or external user feedback. |
| `openai-whisper` / local speech-to-text | Deferred sidecar candidate | Needs `whisper` and likely media/model dependencies; bundling by default would increase image size and maintenance surface. | Create a follow-up issue for a Whisper sidecar proof of concept only if users ask for local transcription. |
| Generic skill CLIs | Unsupported by default | Requirements vary and host-package remediation is often wrong from inside the container. | Inventory top bundled skills before enabling install UX. |

## UX Rules

- Say where the dependency must run: host, OpenClaw container, sidecar container, or unsupported.
- Do not present Homebrew, apt, or other package-manager commands unless the target environment is explicit.
- For sidecars, show the image name, approximate download size when known, data path, and stop/remove action.
- For host bridges, label the boundary clearly: the extension can connect to the host service, but does not install or manage it.
- Keep the isolation language honest: containers and sidecars improve cleanup and dependency isolation, but are not a perfect security boundary.

## Near-Term Implementation Tickets

- Add Docker Desktop-specific missing-requirements copy for unsupported/deferred skills.
- Inventory bundled skills and record external binary/runtime requirements.
- Add an allowlist of extension-supported skill dependency modes: `host-bridge`, `runtime-bundled`, `sidecar`, `unsupported`.
- Consider a Whisper sidecar proof of concept only after the inventory confirms demand and size/runtime tradeoffs.

## Decision

Do not install arbitrary skills or their dependencies onto the user's host by default. For the next 24-48 hours of Marketplace work, keep host Ollama as the supported local-model story, mark heavy skill dependencies as deferred, and avoid adding sidecar orchestration until after submission or real user demand.
