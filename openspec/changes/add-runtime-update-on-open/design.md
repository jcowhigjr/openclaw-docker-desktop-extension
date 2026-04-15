## Context

The current extension is a single-screen React app centered in `ui/src/App.tsx`. It can create, start, stop, restart, and remove one service container, persist config in local storage, and preserve OpenClaw state in the named volume `openclaw-docker-extension-home`. The repo roadmap in issue `#12` treats reproducible install and honest scope as MVP, while issue `#3` is establishing GHCR-published images and a simpler release install path.

Open WebUI uses a focused pattern that matches the user request:
- only floating or channel-like image references are treated as updateable
- the extension compares local and remote image digests
- a cached check runs when the extension is opened and again while the container is active
- the update path pulls the new image and recreates the container while keeping volumes

OpenClaw upstream releases frequently with dated tags, and upstream already has the notion of stable, beta, and dev channels. That means the Docker Desktop extension should avoid inventing a separate updater system. The extension only needs a lightweight image-channel policy and a safe container recreate flow.

## Goals / Non-Goals

**Goals:**
- Add a configurable update policy that works with published OpenClaw runtime images.
- Check for updates automatically on extension open and before launch for updateable image channels.
- Let the user choose whether updates are applied automatically before launch or manually from a banner.
- Preserve the existing volume, port, and provider-auth behavior during update.
- Keep the MVP change small enough to layer onto the current single-file UI.

**Non-Goals:**
- Building a full release-notes or “what’s new” surface.
- Updating pinned image tags automatically.
- Replacing the existing start/stop/restart/remove container controls.
- Introducing background daemons or scheduling beyond extension-open and launch-time checks.

## Decisions

1. Add an explicit update policy to extension settings.
Rationale: the user asked for a configurable behavior, and the current extension already stores settings locally. A small enum such as `manual`, `check-only`, and `auto-before-launch` is enough for MVP.
Alternative considered: always auto-update. Rejected because it hides network work and restart behavior from users and makes rollback less predictable.

2. Only perform update checks for published channel-style images.
Rationale: digest-based checks are useful for floating references such as `:latest`, `:main`, or a future stable/beta/dev channel mapping. Pinned version tags should stay reproducible and unchanged unless the user edits settings.
Alternative considered: compare every image tag remotely. Rejected because it turns versioned tags into mutable behavior and fights the reproducibility goal in issue `#12`.

3. Reuse the existing container recreate model instead of layering an in-place update.
Rationale: the container already keeps user state in a named volume, and config changes already imply restart semantics. Pulling the new image, removing the old container, and recreating it is simpler and matches the Open WebUI extension model.
Alternative considered: stopping and restarting the same container after pull. Rejected because Docker containers are bound to the image they were created from, so a true image update needs recreate semantics.

4. Surface update state in a top-level banner near the status card.
Rationale: the current UI is simple and status-oriented. A banner above the main controls matches the Open WebUI affordance without forcing a larger navigation or modal system.
Alternative considered: burying update status inside Settings. Rejected because it would not satisfy the “every time you click on it” expectation.

## Risks / Trade-offs

- [GHCR publishing is not fully in place yet] → Gate the feature behind the published-image path and treat it as dependent on issue `#3`.
- [Current UI is concentrated in one file] → Keep MVP implementation local to `App.tsx` plus a small helper module rather than forcing a large refactor first.
- [Registry checks can fail because of auth or rate limits] → Convert those cases into a non-fatal warning banner and let normal launch continue.
- [Auto-update before launch can increase first-open latency] → Limit automatic apply to the explicit `auto-before-launch` policy and keep a visible “checking/updating” state.

## Migration Plan

1. Extend stored config with an update policy field and default it conservatively for existing installs.
2. Add image-channel parsing and digest/version check helpers for updateable runtime images.
3. Add a banner and action flow in the extension UI.
4. Recreate the service container with the new image when the policy or user action requests it.
5. Update README language so the behavior is clear and explicitly tied to published images.

## Open Questions

- Should the default published image reference become a stable channel tag once issue `#3` lands, or remain a pinned release tag with update channels opt-in?
- Should “auto-before-launch” apply only when the container is stopped/missing, or also recreate a currently running container immediately on extension open?
- Does Docker Desktop expose enough image metadata from the extension API to show both current and available versions cleanly, or should MVP only show image refs/digests?
