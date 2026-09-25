**Delivery order:** 2 of 2 in the v0.6.0 install-UX batch (blocked by: the fresh-install PR for #241/#242/#245/#246/#247, which also edits `ui/src/App.tsx` and adds doctor-on-start, the migration mechanism this issue relies on)
**Minimum agent tier:** T2 — deletes a UI surface and its persistence, adds one mismatch-recreate branch to Start; no open product question (decided by the maintainer 2026-09-24)

## Decision

The maintainer decided (2026-09-24): **no backward compatibility and no GUI for running old or other runtime versions.** The extension release pins its runtime image. Updating the extension is the only way to update OpenClaw.

## Problem

The extension exposes a user-editable **OpenClaw Image** setting (persisted in `localStorage`), a digest-based update banner, and **Update and Restart**. That surface has produced a string of issues:

- #220: the image setting appears not to persist, re-arming the downgrade banner.
- #225: the controls are non-obvious and can destroy a working install.
- #214: the OpenClaw version is frozen at image build time, and the update control can't move it.
- #139: runtime auto-update is unwired.
- #215: a runtime upgrade leaves existing installs unbootable.

Most of `ui/src/runtimeUpdate.ts` exists only to manage choosing among images, and the `migrateStoredRuntimeImage` allowlist from #234 exists only to repair old stored choices.

## Proposed change

1. The runtime image is always the build-time `VITE_DEFAULT_RUNTIME_IMAGE`, which is already pinned per release by the build.
2. Delete:
   - the **OpenClaw Image** Settings field and its `localStorage` persistence (`config.image`)
   - `migrateStoredRuntimeImage`
   - the digest update check, the update banner, and **Update and Restart**
   - any code in `runtimeUpdate.ts` left without a caller, and its tests
3. On **Start** (and on extension open when the service exists), if the existing container's image (`ContainerSnapshot.image`, added in #234) differs from the pinned image:
   - show "Updating OpenClaw to <version>…"
   - pull the pinned image, remove the old container, and create a new one with the current run args (so hardening flags also stay current)
   - keep the volume

   The runtime entrypoint's doctor-on-start (from the fresh-install PR) applies upstream migrations before the gateway starts.
4. Settings keeps a read-only "OpenClaw runtime: <image> (OpenClaw <version>)" line for support.
5. Docs: README and `docs/submission-readiness.md` say the runtime updates with the extension; remove the Update and Restart steps.

## Acceptance criteria

- [ ] No UI control can select a runtime image. `localStorage` no longer stores one, and a stale stored value is ignored without any migration code.
- [ ] Installing a newer extension build over an existing install recreates the service on the next open or Start, keeps the volume, and the first chat still works. Verified live with two local builds via `make install-dev`.
- [ ] The container is recreated only on an image mismatch. A plain Start of a matching container reuses it.
- [ ] `ui/src/runtimeUpdate.ts` retains only code with a caller, and the tests are updated.
- [ ] Screenshots refreshed (the UI changed).

Resolves or supersedes: #220, #225 (image/update part), #214, #139. Contributes to #215. Related: #234.
