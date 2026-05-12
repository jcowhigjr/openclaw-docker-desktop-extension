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
- MVP foundations are complete enough for external review: GHCR/channel install path, update/restart flow, localhost Control UI bootstrap, token retry UX, host Ollama setup, execution mode UX, repo metadata, `.env` documentation, readiness checks, and build validation.
- Active pre-submission priority is manual stable-channel smoke testing on a real Docker Desktop install.
- Remaining roadmap work is investigation or long-term hardening:
  1. [#64](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/64) native migration after Docker Desktop trial; keep this manual/documentation-only unless user demand justifies automation.
  2. [#65](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/65) longer-term security, hardening, supply-chain, and network migration epic.
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
- Prefer capturing both:
  - the extension UI state
  - the relevant OpenClaw UI state when the feature crosses that boundary
- If verification is partial, say exactly what ran and what did not.

## Workstation-Specific Local Developer Notes

- On this workstation, Docker Desktop CLI symlinks are installed under `$HOME/.docker/bin`.
- If `docker` resolves to another install or cannot reach the Desktop engine, use `$HOME/.docker/bin/docker` or add `$HOME/.docker/bin` to `PATH` before live Docker validation.
- Current local-model development assumes host Ollama is already running on `127.0.0.1:11434`; container-to-host checks should use `http://host.docker.internal:11434`.
