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
- Issue [#7](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/7) is already closed; treat onboarding work as completed.
- Issue [#5](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/5) is already closed; treat architecture handling as completed for MVP.
- Active MVP priority:
  1. [#3](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/3) pre-built GHCR images
- Anything beyond those open MVP issues is unknown until issue [#12](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/12) says otherwise.
- Do not pick up "nice-to-have" work ahead of MVP issues unless explicitly requested.

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
- Use manual UI testing plus screenshots when:
  - establishing a baseline before a meaningful UI or UX change
  - acting as QA after merging a user-facing change
  - tagging a user-verified release or milestone
- Treat those screenshots as rollback and comparison evidence, not just decoration.
- Prefer capturing both:
  - the extension UI state
  - the relevant OpenClaw UI state when the feature crosses that boundary
- If verification is partial, say exactly what ran and what did not.
