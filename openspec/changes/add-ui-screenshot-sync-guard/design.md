## Context

Releases are gated by CI (`build.yml`) and the `test-pre-push` aggregate target, which chains a set of `scripts/test-*.sh` helpers. There are no external users, so CI is the only quality signal. Screenshots live under `docs/` (marketplace hero `docs/assets/openclaw-extension-dashboard.png`, plus dated `docs/exploratory/**` smoke captures). UI source lives under `ui/src/`. `v0.3.6` introduced a new first-run onboarding flow with no screenshot, demonstrating the drift this guard targets.

The existing repo already has related plumbing: a `capture-readme-screenshot` Makefile target and `scripts/capture-readme-screenshot.sh`, and a `create-smoke-report` flow. This change is verification-only — it does not capture screenshots, only detects when a human (or the capture target) should have.

## Goals / Non-Goals

**Goals:**
- Fail the release-checklist path when `ui/src/` changes lack a screenshot update under `docs/`.
- Default to the "last release tag..HEAD" range; allow override for PR/CI.
- Provide an explicit, auditable opt-out for no-visual-diff changes.
- Match existing conventions: a `scripts/test-ui-screenshot-sync.sh`, a Makefile target, inclusion in `test-pre-push` and `build.yml`, plus a self-test.

**Non-Goals:**
- Automated visual-regression / pixel diffing (out of scope; possible future capability).
- Validating screenshot *content* (that the new screenshot actually shows the changed UI).
- Capturing screenshots automatically as part of the guard.
- Blocking on non-`ui/src/` UI-adjacent changes (e.g. docs-only or build config).

## Decisions

**Decision: Git-diff range comparison, not file-content hashing.**
The guard compares two git refs and inspects the set of changed paths. Rationale: simple, deterministic, no state to store. Alternative considered — a manifest mapping components→screenshots — rejected as heavy and high-maintenance for a zero-user project.

**Decision: Default range = `last release tag..HEAD`; override via env vars.**
Use `git describe --tags --abbrev=0 --match 'v*'` (or equivalent tag listing) for the base, `HEAD` for the tip. Honor `BASE_REF`/`HEAD_REF` (or a single `DIFF_RANGE`) env override so CI on PRs can pass `origin/main...HEAD`. Rationale: the user framed this as a release-checklist gate, but PR-time feedback is cheap to enable with the same script. When no release tag exists, exit zero (safe default) rather than erroring — avoids breaking the very first release.

**Decision: Opt-out via commit trailer `Screenshots-Not-Needed: <reason>`.**
Scan commits in the range (`git log <range> --format=%B` / `%(trailers)`) for the trailer; require a non-empty reason. Rationale: auditable in history, no extra files, reviewable in the PR. Alternatives considered — a sentinel file (clutters tree, easy to forget to remove) and a PR label (not visible to a local `make test-pre-push`, GitHub-only) — both rejected. Trailer works identically locally and in CI.

**Decision: "Visual-relevant" = any path under `ui/src/`.**
Coarse but predictable. Rationale: nearly all visual changes route through `ui/src/`; narrowing to `.tsx`/`.css` risks missing asset or template changes. False positives are absorbed by the opt-out trailer. Build config and tests under `ui/` outside `src/` are excluded to reduce noise.

**Decision: Screenshot surface = image files under `docs/`.**
Match `docs/**/*.{png,jpg,jpeg,gif,webp}`. Rationale: all current screenshots live under `docs/`; keeps the rule one-directory simple.

**Decision: Self-test builds a throwaway git repo in a temp dir.**
The self-test (`scripts/test-ui-screenshot-sync-selftest.sh`) constructs fixtures with `git init` in `mktemp -d`, exercising: (a) ui change + no screenshot → fail, (b) ui change + screenshot → pass, (c) ui change + valid opt-out → pass, (d) ui change + empty-reason opt-out → fail. Rationale: deterministic, independent of the real repo's evolving history; mirrors the existing dry-run test scripts.

## Risks / Trade-offs

- **False positives on behavior-only UI fixes** → Mitigated by the `Screenshots-Not-Needed:` opt-out; document it in the failure message so the fix is obvious.
- **Coarse `ui/src/` matching flags non-visual refactors** → Same opt-out path; acceptable for a zero-user project favoring safety.
- **Squash-merge drops the opt-out trailer** → The trailer must land in the squashed commit message; note this in the failure output and contributor docs. For `test-pre-push` (pre-squash, local) it works on the real commits.
- **`git describe` finds a non-release tag** → Constrain to `v*` match; if matching fails, fall back to safe-pass rather than erroring.
- **Shallow CI clones lack tags/history** → CI step must fetch tags / use sufficient `fetch-depth`; document in the workflow step. On PRs, prefer the explicit range override over tag discovery.

## Migration Plan

1. Add `scripts/test-ui-screenshot-sync.sh` + `scripts/test-ui-screenshot-sync-selftest.sh` (executable).
2. Add Makefile target `test-ui-screenshot-sync`, append to `test-pre-push` chain and `.PHONY`.
3. Add a Build-workflow step running the self-test (deterministic) and, on PRs, the guard with an explicit range + tag fetch.
4. Document the opt-out trailer in contributor docs / AGENTS.md.

Rollback: remove the target from `test-pre-push` and the workflow step; scripts are inert if unreferenced.

## Open Questions

- Should PR-time CI run the guard as a hard failure or a warning initially? (Lean: warning/annotation for the first release cycle, then promote to hard fail — but default local `test-pre-push` is a hard fail as specified.)
- Should the opt-out reason be required to reference an issue/PR? (Lean: no — keep friction low; non-empty reason is enough.)
