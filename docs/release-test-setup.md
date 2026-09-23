# Release test setup: backup/restore proof of concept

This is a bounded preparation exercise for the manual UI smoke and recovery
checks in [submission-readiness.md](submission-readiness.md). It contributes to
[#215](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/215)
and [#217](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/217).
It does not certify a release or implement safe runtime recreation.

## Verified on 2026-09-22

The rehearsal used Docker Engine 29.7.2, an existing local ARM64 helper image,
and three newly created volumes containing synthetic data only. Repository
baseline: `0301823da07f757d7b98a72a71b4d52c03a7ccde`.

| Check | Result |
| --- | --- |
| Snapshot synthetic source before a simulated destructive migration | PASS |
| Restore snapshot into a separate empty volume | PASS |
| Compare file hashes, numeric UID/GID, modes, symlink target and empty directory | PASS |
| Preserve the changed source while restoring the earlier state elsewhere | PASS |
| Reject a corrupted archive before extraction; destination remains unchanged | PASS |
| Remove only the helper and three volumes owned by this run | PASS |
| Existing application containers' IDs, image IDs, status and start timestamps | Unchanged before/after |
| Docker Desktop window selection and screenshot observation | Available through native app control |
| Reliable UI interaction and isolated Chrome profile | NOT VERIFIED; Chrome control failed after initial observation |
| OpenClaw fresh install, chat, runtime upgrade or application recovery | NOT RUN |

Existing application volumes were not mounted or read. No extension was installed,
no provider was contacted, and no browser test profile was created. The observed
Docker Desktop screen included unrelated workstation state, so that screenshot is
not included in this public document.

## Follow-up verification on 2026-09-23

- Native Chrome profile selection worked. The operator-designated test profile
  was selected and its menu offered **Sign in to Chrome**, confirming it was
  signed out. No new profile or extension was installed.
- The complete extension inventory was not readable through the UI connection.
  Re-selecting the Chrome app later selected a different profile's window. Stop
  before any interaction when the observed profile differs from the intended
  one; app-level selection alone is not a reliable profile binding.
- Docker Desktop displayed **Engine running**, but the configured engine socket
  returned `ConnectionRefusedError` (errno 61). The normal start command reported
  **already running** without restoring CLI access. No runtime or cleanup checks
  were rerun against an unavailable engine, and no existing Docker state changed.
- Shell syntax and the public repository boundary check passed again. The
  synthetic backup/restore results above remain the 2026-09-22 execution evidence;
  they are not a new release acceptance pass.

To continue, establish reliable engine access and profile-bound UI control first.
Re-query all Docker cleanup candidates after engine recovery; a previous inventory
does not authorize deletion or establish that an image is still unused.

## Repeat the disposable rehearsal

Use an **already local** image containing Node.js and GNU tar. The script resolves
it to a local image ID and uses `--pull=never`; it does not run OpenClaw's entrypoint.

```sh
bash scripts/poc-volume-restore.sh <local-helper-image>
```

Set `DOCKER` to the Docker Desktop CLI if it is not the default executable.
The recorded run used helper image ID
`sha256:16da990a54792f5af61baf3e34490980eeda0c992bd4f256e55b2ddc6921edd3`.
That was a local development image, not evidence about the released runtime.

The script creates unique `openclaw-restore-poc-*` volumes. It accepts no source
volume argument, refuses existing names, and checks ownership labels before
cleanup. Helpers have no network, host directories, Docker socket or published
ports. Limited filesystem capabilities preserve numeric ownership during restore.
It never uses the extension's discovery labels. An interrupted run that cannot
clean up reports failure; inspect its exact owned resources before retrying cleanup.

Expected output includes each `PASS` below and exits zero:

```text
PASS: post-snapshot synthetic migration changed the source
snapshot.tar.gz: OK
PASS: restored file hashes, numeric ownership, modes, symlink and empty directory match
PASS: restoring into a separate volume left the changed source intact
PASS: corrupt snapshot rejected before extraction; restored data unchanged
LIMIT: synthetic offline data only; no OpenClaw migration, database consistency or UI acceptance tested
PASS: owned helper and three disposable volumes removed
```

This tests offline filesystem recovery mechanics. It does not test live SQLite
consistency, application migrations, ACLs, extended attributes, sparse files,
hard links, or a usable backup of an existing installation.

## Next: prepare the same-machine test boundary

Do not install/open the extension against an existing installation until this
boundary is established. The extension can auto-start, finds containers by labels
before falling back to a fixed name, and uses a fixed data-volume name. Renaming
one container, selecting another port, or using another Chrome profile does not
isolate the application state. See
[#195](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/195).

Check both host free space and Docker disk usage before real backups, pulls or
builds. Budget for the archive, an uncompressed restored copy, candidate images
and Docker's working space. If capacity is insufficient, stop before creating
large artifacts. Review old unused image/cache candidates by exact IDs; retain
all application data and images needed by running **or stopped** containers and
the selected rollback pair. Recheck references immediately before any approved
deletion, use no force/prune-wide operation, and measure actual host space afterward.
Logical image sizes include shared layers and are not a space-recovery promise.

1. Record the exact Docker context, all matching labeled/named containers, every
   writer attached to the application volume, immutable image IDs, and the
   container recreation settings. Keep environment values and credentials private;
   publish only allowlisted metadata. Capture extension settings before uninstall
   if the extension is present.
2. Stop all writers before a real volume snapshot. Keep the archive, checksum and
   full recreation manifest in access-restricted storage outside the repository.
   Verify ownership, modes and fixture-independent file integrity after restoring
   into a separate volume. Retain the original image locally. Check whether the
   real data needs preservation beyond the filesystem features tested above.
3. In a separately named, non-discoverable container on a separate localhost port,
   check that the restored copy boots with the original image. Review and disable
   external channels/jobs before any cloned application starts; a copied account
   configuration can otherwise send real messages. If that cannot be established,
   stop at offline verification and use synthetic application state.
4. Prepare the exact resource-change list and restoration commands for review
   before replacing any existing container or the fixed-name volume. Account for
   **every matching label**, including retained old containers. A pre-upgrade image
   plus its matching pre-upgrade volume is the recovery unit. Retaining only a
   container is insufficient after forward-only migrations.
5. Once that scoped transition is approved, establish disposable state under the
   extension's expected names. Keep the verified backup outside the test state.
   Do not reset Docker Desktop or use broad prune commands.

These steps are planned; the POC did not perform a real backup, boot a private
clone, or replace an existing resource. A separate clean Docker Desktop machine
remains the fallback if the same-machine transition cannot be made reversible.

## Browser and UI execution contract

- Inspect the operator-designated test profile before use; do not create duplicate
  profiles. Confirm its identity, sign-in/sync state and existing extensions. If it
  contains personal or shared authenticated state, use a fresh dedicated profile.
- Any required browser extension belongs only in that approved test profile.
  Keep Chrome's normal process sandbox enabled. Profile separation isolates browser
  state; it is not a Docker, host-filesystem or credential security boundary.
- Make test windows visible. Describe each background UI operation immediately
  before performing it, and report the observed result. No silent clicks in a
  personal profile. Native Docker Desktop observation worked; reliable clicking
  still needs a check before relying on unattended UI execution.
- Identify external domains before access so the operator can whitelist them.
  This synthetic rehearsal requires none. Later release lookup/image retrieval
  starts with `github.com`, `api.github.com` and `ghcr.io` when those operations
  are needed. Enumerate and clear any additional authentication, redirect/CDN,
  model-download or browser-extension domains before accessing them; do not assume
  a wildcard allowlist. Prefer already downloaded local models for the smoke.
- Loopback Control UI and `host.docker.internal` Ollama access are local endpoints.
  Keep tokens out of screenshots, exported URLs and public logs.
- Verify that **Open Control UI** lands in the approved test profile; the button
  may use the system's default browser/profile. A manually opened URL is useful
  diagnostics but does not prove the extension-button launch path.

## Release acceptance after setup

Record the exact extension digest, runtime digest and embedded OpenClaw version
for each run. A passing development build does not certify `stable`. Follow the
full UI checklist in [submission-readiness.md](submission-readiness.md), including
provider onboarding, readiness, token bootstrap, an actual UI chat reply, and
persistence after restarting Docker Desktop. Capture the extension and Control UI
states. If a UI message is dropped, record a UI failure; CLI success is separate
diagnostic evidence. For any tool action, verify its result on disk.

Use synthetic application data for upgrade failure injection. The intended
release behavior must pass each case; record failures without converting manual
repair into an automatic-recovery claim.

| Scenario | Acceptance evidence |
| --- | --- |
| Normal supported runtime upgrade | Target version boots; settings, test data and chat survive |
| Replacement image cannot be pulled | Existing working service remains usable; actionable error |
| Replacement starts but never becomes healthy | Error is visible; documented recovery restores service and test data |
| Migration changes state before failing | Previous image plus pre-migration volume restore service and test data |
| Extension package update | Test independently from runtime upgrade; record both package/runtime identities and repeat UI smoke |

Issue #215 remains open until a supported recovery path works end to end. This
document and the synthetic POC do not close it. Sanitize screenshots and scoped
artifacts before allowlisting any public evidence; the broad inventory capture
problem is tracked separately in
[#238](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/238).
