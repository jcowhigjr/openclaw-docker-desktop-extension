## Why

The extension now has a clearer GHCR-backed install path, but its browser-launch flow still assumes a raw localhost URL plus manual token copy. Manual validation showed that treating Portless as a second-origin PWA host turns a simple local admin surface into a proxy/origin/auth problem, so the correct Post-Traction investment is to make the canonical localhost Control UI installable and bootstrap-authenticated instead of documenting the proxy hack.

## What Changes

- Add a first-class local Control UI launch flow that preserves one canonical browser origin for the extension-managed OpenClaw gateway.
- Replace the current "open raw URL and copy token manually" handoff with a dashboard bootstrap flow that opens the Control UI with the intended auth semantics for the current browser session.
- Make the canonical local Control UI path suitable for installed-app treatment on macOS without requiring Portless, certificate bypass, or non-loopback origin exceptions.
- Clarify in docs and issue tracking that Portless exploration was useful for validation, but is not the target architecture for the default standalone-app experience.
- Keep this work explicitly in the Post-Traction bucket and avoid broad reverse-proxy or alternate-hostname support unless that becomes a separate deliberate feature.

## Capabilities

### New Capabilities
- `installed-local-control-ui-flow`: Support and document a canonical localhost Control UI launch/bootstrap flow that can be installed as a standalone browser app on macOS.

### Modified Capabilities
- None.

## Impact

- Affected code: `ui/src/App.tsx`, any new extension-side launch/bootstrap helpers, `README.md`, `docs/**`, and roadmap-facing issue/project references.
- Dependencies: the existing localhost-served OpenClaw gateway UI, Chrome app-install behavior on macOS, and upstream dashboard/bootstrap semantics.
- Product impact: improves native-feeling day-two UX while keeping the extension aligned with the upstream local Control UI model instead of layering on a second-origin proxy path.
