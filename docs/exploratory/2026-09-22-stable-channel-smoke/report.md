# stable Channel Smoke Test - 2026-09-22

## Environment

- Repo branch: `docs/submission-readiness-refresh-0922`
- Base commit under test: `4309885`
- Release tag under test: `v0.5.0`
- Channel under test: `stable`
- Extension install under test: `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable`
- Runtime image under test: `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:stable`
- Docker Desktop version: 4.89.0, engine 29.7.2 (from `docker version`, see `environment.txt`)
- macOS version / chip: macOS 26.6.2, arm64 (from `sw_vers`/`uname`, see `environment.txt`)
- Host Ollama status: running, not exercised as part of this pass

**Scope of this pass:** CLI/registry preflight only (steps 1-4 below). The Manual Flow
steps (installing the channel image fresh and clicking through the extension UI) were
**not performed** in this pass — no live `docker extension install` of the channel image
was done. Do not read the artifacts below as evidence that the manual UI flow was
verified on `v0.5.0`; only the registry/channel and CLI-visible state were.

**Redaction note:** `docker-extension-ls.txt`, `docker-ps-a.txt`, and `docker-image-ls.txt`
were captured on a real developer workstation running several unrelated Docker
extensions, containers, and images. Those files are filtered to rows relevant to this
extension before being committed; the number of omitted third-party rows is stated where
relevant so the filtering itself is auditable rather than silent. `environment.txt`'s
`repo_root` and the machine hostname in `uname` are both redacted by the capture tooling
itself as of this pass — both previously leaked real values, fixed at the source in
`scripts/create-smoke-report.sh`, not just in this one packet.

## Preflight

1. `make verify-release-channel RELEASE_CHANNEL=stable EXPECTED_RELEASE_TAG=v0.5.0`
2. `make verify-channel-install RELEASE_CHANNEL=stable EXPECTED_RELEASE_TAG=v0.5.0 DRY_RUN=1` —
   this pass captured the dry run only (see `verify-channel-install-dry-run.txt`); it
   validates command construction, not an actual install/uninstall cycle. Run without
   `DRY_RUN=1` for real install validation, which does mutate Docker Desktop.
3. `docker extension ls`
4. `docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'`

## Manual Flow

1. Install the channel image in Docker Desktop if it is not already installed.
2. Open the `Shellharbor` extension.
3. Confirm the `Quick Start` card lists the expected four-step flow.
4. Click `Check Requirements`.
5. Click `Start`.
6. Wait for `OpenClaw is ready`.
7. Confirm the `Gateway Token` field fills automatically, shows `Auto-attached`, and uses success styling. If it remains blank, click `Refresh Token` once and record the result.
8. Click `Open Control UI`.
9. Confirm the Control UI opens on localhost without manual token editing.
10. Confirm update status does not flicker or repeatedly switch after startup while the extension is idle.
11. If testing the local-model path, confirm host Ollama is already running with a model pulled, then reopen or refresh the extension.
12. Confirm `Local Model Setup` detects installed host Ollama models automatically or after clicking `Detect Ollama Models`.
13. If no Ollama model is configured yet, confirm the setup banner appears, click `Select Recommended Model`, then click `Apply and Restart`.
14. Reopen the extension and confirm the Ollama setup banner stays dismissed only after using its dismiss control.
15. Finish one basic chat prompt in the Control UI.

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
- `control-ui.png`
- `extension-ui.png` or note why Docker Desktop UI capture was blocked

## Results

| Flow | Result | Evidence |
| --- | --- | --- |
| Channel preflight | **PASS** — both extension and runtime GHCR `stable` tags publicly readable and resolve to `v0.5.0` | `verify-release-channel.txt` |
| Extension registered in Docker Desktop | **NOT INSTALLED** — no `jcowhigjr/...` entry in `docker extension ls` at capture time; a prior installed instance was removed by an earlier validator install/uninstall cycle and not reinstalled | `docker-extension-ls.txt` |
| Runtime container running | **N/A this pass** — the container visible in `docker-ps-a.txt` (`openclaw-docker-extension-service`, `Exited (255)`) is a maintainer's manual `docker run` container from an earlier debugging session, not one created by installing the channel extension; do not read it as representative | `docker-ps-a.txt` |
| Localhost exposure | NOT VERIFIED this pass | `control-ui-healthz.txt` shows connection refused, consistent with no container running |
| Quick Start onboarding | NOT DONE — requires the manual UI flow | |
| Gateway token auto-attached UX | NOT DONE — requires the manual UI flow | |
| Control UI bootstrap from extension button | NOT DONE — requires the manual UI flow | |
| Runtime update status stability | NOT DONE — requires the manual UI flow | |
| Local-model flow (if used) | NOT DONE — requires the manual UI flow | |
| Ollama setup banner persistence (if used) | NOT DONE — requires the manual UI flow | |

## Findings

1. The registry/channel path for `v0.5.0` is solid: both images are public, both resolve
   to the expected tag, `make install-channel RELEASE_CHANNEL=stable` is confirmed ready.
2. The manual UI walkthrough (steps 1-15) has not run against `v0.5.0`. The most recent
   committed manual UI pass is still `v0.3.4`
   ([2026-05-22-stable-channel-smoke](../2026-05-22-stable-channel-smoke/)), two releases
   behind.
3. `v0.5.0` (tagged 2026-09-10) does not contain #234's fix (merged 2026-09-22, verified:
   `git merge-base --is-ancestor 676a90b v0.5.0` fails). A user installing today's
   `stable` channel still hits the false-positive downgrade banner #234 fixes on `main`.
   Do not describe #234 as shipped/available to installed users until a release tag after
   it exists.
4. Two material product gaps are known from a separate hands-on review pass this same
   week and are **not** covered by this smoke packet's checklist: no safe container
   recreate ([#215](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/215))
   and no host folder mount ([#216](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/216)).
   Worth a reviewer reading `docs/submission-readiness.md`'s Known Limits before relying on
   this for anything beyond a trial.
5. Docker Marketplace publication is currently **paused platform-wide**, per Docker's own
   statement on `docker/extensions-submissions#253`, with no timeline given — separate
   from and in addition to this extension's own validation status.

## Recommendation

Does not block Marketplace submission on its own — the registry/channel path (what
Docker's own validator checks) is confirmed sound for `v0.5.0`. Does not fully satisfy
this repo's own smoke-test convention, though: a manual UI click-through on `v0.5.0` is
still owed before treating this packet as a complete replacement for the `v0.3.4` one.
Run steps 1-15 above against a real `docker extension install
ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable` before closing this out as a
full pass. Separately: go-live sign-off should not be read as complete until #215 has a
demonstrated safe upgrade/recovery path; #216 (no host mount) can remain a disclosed
limitation rather than a blocker.
