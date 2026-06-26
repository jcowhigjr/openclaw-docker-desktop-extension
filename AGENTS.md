# AGENTS

This repo is a small, maintained product surface, not an open-ended experiment. Work like a staff engineer with merge authority.

## Mission

- Keep this project useful as a Docker Desktop path for trying OpenClaw on macOS.
- Optimize for clarity, reproducibility, and honest scope.
- Do not turn this into a large platform effort without outside traction.

## Product Positioning

- This repo provides a Docker Desktop extension that runs OpenClaw in a more isolated local container setup on macOS.
- Do not describe it as "more secure than the official install."
- Preferred language:
  - "more isolated"
  - "easier to clean up"
  - "localhost-only exposure"
  - "not a perfect security boundary"

## Current Roadmap

- Treat issue [#12](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/12) as the source of truth for roadmap and decision gates.
- Current live status as of 2026-06-26: latest release is `v0.3.6`; GHCR `stable` was promoted to `v0.3.6`; pinned GHCR and Docker Hub `0.3.6` install validation was recorded in #86; the latest committed real Docker Desktop stable-channel smoke packet remains `v0.3.4`.
- MVP is complete enough to share: GHCR/channel install path, update/restart flow, localhost Control UI bootstrap, token retry UX, first-run provider fork and chat gating, host Ollama setup, execution mode UX, repo metadata, `.env` documentation, readiness checks, build validation, and committed Docker Desktop stable-channel smoke evidence.
- Default post-MVP posture is pause unless outside traction appears or a release/distribution gate fails and needs a small reproducible fix.
- Active gates and follow-ups are:
  1. [#86](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/86) Docker Marketplace submission governance gate; repo-side release verification is not the blocker for `v0.3.6`.
  2. [#156](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/156)-[#160](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/160) local-model performance/supportability follow-ups; treat them as post-MVP, not a reason to restart broad feature work.
  3. [#65](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/65) longer-term security, hardening, supply-chain, and network migration epic.
- [#161](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/pull/161) merged on 2026-06-26 as a docs-only OpenSpec hardware-profile design package; do not reopen that planning lane unless working a specific follow-up issue.
- Native migration after a successful Docker Desktop trial is documented in `docs/native-migration-investigation.md`; keep it manual/documentation-only unless real user demand justifies reopening implementation work.
- Treat [#2](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/2) and [#13](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/13) as historical execution-mode context, not active implementation tracks.
- Do not start new feature branches from stale priority notes. Re-check #12, open issues, and the latest merged PRs first.

## Decision Gates

- Keep investing until MVP is true:
  - install is reproducible
  - first-run auth is obvious
  - platform constraints are explicit
  - README explains the project in under a minute
  - isolation story is honest and documented
- After MVP, prefer pausing unless there is real outside traction.
- Traction means at least one of:
  - outside users try it successfully
  - support requests or improvement requests arrive
  - upstream shows interest
  - GHCR and release work materially reduce onboarding friction

## PR and Merge Policy

- Prefer small PRs tied to one issue.
- Use `Closes #<issue>` only when the PR fully satisfies the issue.
- Use `Contributes to #<issue>` when the work is partial.
- When the user explicitly confirms a working state, create a versioned git tag before proceeding with new exploratory changes.
- Merge when all are true:
  - checks are green
  - scope matches the issue
  - no unresolved material review findings remain
  - the repo is left cleaner than before
- After merge:
  - verify the linked issue state
  - close or update related issues
  - update milestones when priorities change
- Planning freshness hook: after any PR that closes or materially changes a roadmap item, check whether README Roadmap path, AGENTS Current Roadmap, and issue #12 need a one-comment status update. Keep this to a small patch or comment; do not create a planning subsystem.
- External review loop: before merging user-facing PRs, expect the maintainer may paste the PR into Gemini CLI for a review comment and Claude for a more critical review. Treat those reviews as input to verify, not orders to follow blindly.

## Repo Hygiene

- Add or update docs when behavior changes.
- Prefer repo-local instructions and automation over repeated chat guidance.
- Use `.dockerignore`, image metadata, and build validation to keep the repo publishable.
- Keep the README crisp and public-facing.

## Secrets and Auth

- Never commit secrets or auth material.
- Never write tokens into repo git remotes or checked-in config.
- For local runtime secrets, prefer the persistent OpenClaw volume and write-only UI flows.
- If a secret has already been pasted into chat, recommend rotation without derailing the task.

## Verification

- Do not claim success without verifying the relevant path:
  - UI build for frontend changes
  - Docker image build for runtime or packaging changes
  - PR checks before merge
- Before pushing, run the repo pre-push path with `make test-pre-push` or the installed `.githooks/pre-push`. Do not bypass it with `--no-verify` unless the maintainer explicitly approves the bypass and the PR states what verification replaced it.
- Use manual UI testing plus screenshots when:
  - establishing a baseline before a meaningful UI or UX change
  - acting as QA after merging a user-facing change
  - tagging a user-verified release or milestone
- Treat those screenshots as rollback and comparison evidence, not just decoration.
- A CI guard (`scripts/test-ui-screenshot-sync.sh`, wired into `make test-pre-push` and the Build workflow) fails when `ui/src/` changed since the last `v*` release tag but no screenshot under `docs/` was updated.
  - To refresh a screenshot, run `make capture-readme-screenshot`. Onboarding screens can be forced in demo mode with `?demo=1&onboarding=<fork|free-needs-model|free-ready|resolved>`.
  - If a UI change has no visual diff, waive the requirement with a commit trailer (non-empty reason):

        Screenshots-Not-Needed: <reason>

    With squash-merge, the trailer must land in the squashed commit message to satisfy the PR check.
- Prefer capturing both:
  - the extension UI state
  - the relevant OpenClaw UI state when the feature crosses that boundary
- If verification is partial, say exactly what ran and what did not.

## Workstation-Specific Local Developer Notes

- On this workstation, Docker Desktop CLI symlinks are installed under `$HOME/.docker/bin`.
- If `docker` resolves to another install or cannot reach the Desktop engine, use `$HOME/.docker/bin/docker` or add `$HOME/.docker/bin` to `PATH` before live Docker validation.
- Current local-model development assumes host Ollama is already running on `127.0.0.1:11434`; container-to-host checks should use `http://host.docker.internal:11434`.
