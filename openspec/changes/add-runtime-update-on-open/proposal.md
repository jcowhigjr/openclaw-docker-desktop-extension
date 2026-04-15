## Why

The current MVP roadmap does not include a user-facing way to keep the bundled OpenClaw runtime current once GHCR publishing exists. Open WebUI shows a better Docker Desktop pattern here: when the configured image uses a moving tag, the extension can detect a newer image and let the user update without dropping local state.

## What Changes

- Add a configurable runtime update policy for published OpenClaw runtime images.
- Check for newer runtime images when the extension opens and before launch when the configured image uses an updateable channel.
- Allow the user to automatically apply the newer image before launch, preserving the existing named volume and saved settings.
- Show a clear update notice with the running image version and the available image version.
- Explicitly defer “what’s new” or release-note rendering until after the core update path works.

## Capabilities

### New Capabilities
- `runtime-update-flow`: Detect, present, and optionally apply newer published runtime images before launching OpenClaw.

### Modified Capabilities
- None.

## Impact

- Affected code: `ui/src/App.tsx`, `ui/src/dockerDesktopClient.ts`, `README.md`, and any new UI helpers added for update checks.
- External systems: Docker CLI image inspect/pull flows, GHCR tag or digest lookups for the configured runtime image.
- Product impact: adds a lightweight “stay current” path that depends on issue `#3` finishing the published-image path.
