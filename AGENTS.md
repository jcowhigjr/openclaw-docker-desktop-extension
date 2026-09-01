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
- **Resume point (update this at the end of any session that changes priorities).**
  Current live status as of 2026-09-01: [#197](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/197) (thinking-trace leak) is done, merged as `ba4b24e` via PR [#199](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/pull/199), issue closed. The remaining local-usability batch, in delivery order: [#189](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/189)
  -> [#191](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/191)
  -> [#198](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/198)
  -> [#190](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/190)
  -> [#192](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/192).
  [#189](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/189) was rewritten: the defect is dead code in `ui/src/ollamaSetup.ts`, not writer divergence. [#198](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/198) (`localModelLean` never set) and [#196](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/196) (positioning: extension unreachable when the Docker Desktop dashboard is) were added since the original batch. Specs/checklist/contract land in PR [#194](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/pull/194). Each carries a delivery order and minimum agent
  tier. The hardware-profile lane (#157/#160) is superseded by #190. Users should run
  `docs/preflight-checklist.md` before reporting local-model problems.
- Previous live status as of 2026-06-26: latest release is `v0.3.6`; GHCR `stable` was promoted to `v0.3.6`; pinned GHCR and Docker Hub `0.3.6` install validation was recorded in #86; the latest committed real Docker Desktop stable-channel smoke packet remains `v0.3.4`.
- MVP is complete enough to share: GHCR/channel install path, update/restart flow, localhost Control UI bootstrap, token retry UX, first-run provider fork and chat gating, host Ollama setup, execution mode UX, repo metadata, `.env` documentation, readiness checks, build validation, and committed Docker Desktop stable-channel smoke evidence.
- Default post-MVP posture is pause unless outside traction appears or a release/distribution gate fails and needs a small reproducible fix.
- Active gates and follow-ups are:
  1. [#86](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/86) Docker Marketplace submission governance gate; repo-side release verification is not the blocker for `v0.3.6`.
  2. [#156](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/156)-[#160](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/160) local-model performance/supportability follow-ups; treat them as post-MVP, not a reason to restart broad feature work.
  3. [#65](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/65) longer-term security, hardening, supply-chain, and network migration epic.
- [#161](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/pull/161) merged on 2026-06-26 as a docs-only OpenSpec hardware-profile design package; do not reopen that planning lane unless working a specific follow-up issue.
- Native migration after a successful Docker Desktop trial is documented in `docs/native-migration-investigation.md`; keep it manual/documentation-only unless real user demand justifies reopening implementation work.
- Treat [#2](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/2) and [#13](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/13) as historical execution-mode context, not active implementation tracks.
- Do not start new feature branches from stale priority notes. Start every session by
  reading, in this order: the Resume point above, `gh issue list`, open task lists under
  `openspec/changes/*/tasks.md`, and the latest merged PRs. These are the only durable
  state. Anything held in one tool's private memory does not survive a tool switch and
  must be written into the repo before the session ends.

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
- **Merge without asking once the conditions above are satisfied.** Restating them as a question wastes the maintainer's time.
- Escalate only for genuine judgment calls: product direction, scope changes, anything irreversible beyond a squash-merge, or a review finding that conflicts with what a spec mandates.

## Repo Hygiene

- Add or update docs when behavior changes.
- Prefer repo-local instructions and automation over repeated chat guidance.
- Use `.dockerignore`, image metadata, and build validation to keep the repo publishable.
- Keep the README crisp and public-facing.
- **Verify claims about current behavior against `origin/main`, not the working tree.** Use `git show origin/main:<path>` to check what a file actually contains before describing it.
- This checkout carries long-lived uncommitted changes; a working-tree read routinely describes unshipped work as shipped.
- Applies to filing issues, writing specs, and any statement about current behavior — a wrong claim sourced this way has already reached filed GitHub issues and needed public correction.

## Issue Delivery Contract

Every issue filed in this repo carries two fields in its body, near the top:

```
**Delivery order:** <n> of <total in the current batch>  (blocked by: #x, or none)
**Minimum agent tier:** T1 | T2 | T3
```

Ordering is by dependency and by unblocking value, not by issue number. State the
blocker explicitly so parallel work is obvious.

Tier is the *minimum* capability that should take the issue on. Assign it from
observable properties of the work, not from a guess at difficulty:

| Tier | Assign when the issue has | Typical model class |
|---|---|---|
| **T1** | Mechanical, fully prescriptive change. Single concern. An existing test pattern to copy. No design decisions left open. | Small/fast (Haiku-class) |
| **T2** | Multiple files, or async/state-flow changes, or a new error taxonomy. Tests written from scratch. Design judgment bounded by the spec. | Mid (Sonnet-class) |
| **T3** | New external API integration, a ranking/heuristic to design, cross-cutting deletion across code + specs + docs, or open product judgment. | Frontier (Opus-class) |

Rules:

- A tier is a floor, not a ceiling. A higher tier may always take a lower-tier issue.
- If an implementer finds the work is above its assigned tier, it must stop and say so
  rather than guess. Re-tier the issue in a comment with the reason.
- If an issue cannot be given a tier, it is not specified well enough to file.

## Agent Contract Interoperability

Multiple agent tools work in this repo (Claude Code, Codex, Windsurf). They discover
instructions differently, which has produced duplicated and misattributed work.

- **`AGENTS.md` is the single source of truth.** `CLAUDE.md` exists only to redirect
  here. Do not fork guidance between them.
- **Never rely on a user's global agent config** to load this file. Anything a
  contributor must follow belongs in the repo, not in someone's home directory.
- **Never set repo-local git identity.** `git config --local user.email` inside this
  repo has already poisoned local history once: a self-test script set
  `selftest@example.com`, and every subsequent local commit inherited it. Test
  fixtures must build throwaway repos under `mktemp -d` and configure identity there.
- **Never commit to `main` locally.** Branch from `origin/main`, never from a local
  branch that may have drifted. A local `main` that has diverged is a bug to repair,
  not a base to build on.
- **Before starting work, check whether it already exists on `origin/main`.** Repeated
  redundant commits in this repo have come from branching off stale local state and
  redoing merged work.
- **Never run `git stash` (bare), `git rm --cached`, `git reset --hard`, or any other
  command that rewrites the index or working tree wholesale.** Worktrees here share a
  stash stack and an object store.
- One such command has already wiped a worktree's index mid-task, staging every tracked
  file as deleted and silently reverting a commit.
- If the index needs resetting, use `git reset` (mixed) plus `git checkout -- <path>` —
  prevention is the rule, that's the recovery.

## Public Repository Boundary

- Treat every tracked file, commit, branch, and pull-request revision as immediately public. GitHub Pages also deploys the entire `docs/` tree.
- Never stage or commit private AI-session output, raw retrospectives, internal product or competitive strategy, unpublished outreach drafts, or naming, namespace, domain-acquisition, and brand-defense plans.
- Commit only factual project documentation and deliberately sanitized public collateral. If publication intent is uncertain, fail closed and keep the material outside this repository.
- `scripts/public-docs-allowlist.txt` is the explicit publication contract for `docs/`. Do not add a path to it mechanically: inspect and sanitize the file, then add it only when its public purpose is explicit.
- Run `make test-public-repo-boundary` whenever adding or renaming documentation, planning artifacts, evaluations, or agent instructions. The same gate runs in pre-push and CI.
- Deleting sensitive material in a later commit does not remove it from history. After accidental publication, stop new work, rewrite the affected branch before another push, force-push with an exact lease, and report any remote retention that requires provider support.

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

## Session Retro Contract

- Before the final response in a long or blocker-heavy session, run a session retro:
  record what blocked progress and apply the smallest safe systemic fix. If your tool
  has a `session-retro` skill, use it; otherwise do it inline. Do not reference a
  tool-specific absolute path here — see Agent Contract Interoperability.
- Re-check capabilities after sandbox, auth, or network conditions change during the run.
- Prefer `gh` for GitHub writes when `gh auth status` is healthy and MCP writes are narrower or failing.
- Treat `branch already used by worktree` and dead preview URLs as routing problems that require fallback, not early stop conditions.
