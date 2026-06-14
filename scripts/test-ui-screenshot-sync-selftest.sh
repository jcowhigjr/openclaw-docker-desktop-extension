#!/usr/bin/env bash
#
# Self-test for scripts/test-ui-screenshot-sync.sh.
# Builds throwaway git repositories in a temp dir and asserts the guard's exit
# code for each case, independent of the real project history.

set -euo pipefail

GUARD="$(cd "$(dirname "$0")" && pwd)/test-ui-screenshot-sync.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

fail=0

git_init() {
  repo="$1"
  mkdir -p "$repo"
  git -C "$repo" init -q
  git -C "$repo" config user.email "selftest@example.com"
  git -C "$repo" config user.name "selftest"
}

# Run the guard inside repo with given range; print captured output, return exit code.
run_guard() {
  repo="$1"; range="$2"
  ( cd "$repo" && DIFF_RANGE="$range" bash "$GUARD" ) >"$WORK/out.log" 2>&1
}

assert_exit() {
  name="$1"; expected="$2"; actual="$3"
  if [ "$actual" -eq "$expected" ]; then
    echo "passed: $name (exit $actual)"
  else
    echo "FAILED: $name — expected exit $expected, got $actual" >&2
    sed 's/^/    /' "$WORK/out.log" >&2
    fail=1
  fi
}

seed_commit() {
  repo="$1"; msg="$2"
  git -C "$repo" add -A
  git -C "$repo" commit -q -m "$msg"
}

# --- Case A: ui change, no screenshot -> fail (exit 1) ---
A="$WORK/a"; git_init "$A"
mkdir -p "$A/ui/src"; echo "base" > "$A/ui/src/App.tsx"; seed_commit "$A" "base"
echo "changed" > "$A/ui/src/App.tsx"; seed_commit "$A" "ui change only"
set +e; run_guard "$A" "HEAD~1..HEAD"; rc=$?; set -e
assert_exit "ui change without screenshot fails" 1 "$rc"

# --- Case B: ui change + screenshot -> pass (exit 0) ---
B="$WORK/b"; git_init "$B"
mkdir -p "$B/ui/src" "$B/docs"; echo "base" > "$B/ui/src/App.tsx"; seed_commit "$B" "base"
echo "changed" > "$B/ui/src/App.tsx"; printf 'PNG' > "$B/docs/shot.png"; seed_commit "$B" "ui change + screenshot"
set +e; run_guard "$B" "HEAD~1..HEAD"; rc=$?; set -e
assert_exit "ui change with screenshot passes" 0 "$rc"

# --- Case C: ui change + valid opt-out trailer -> pass (exit 0) ---
C="$WORK/c"; git_init "$C"
mkdir -p "$C/ui/src"; echo "base" > "$C/ui/src/App.tsx"; seed_commit "$C" "base"
echo "changed" > "$C/ui/src/App.tsx"
git -C "$C" add -A
git -C "$C" commit -q -m "behavior-only fix

Screenshots-Not-Needed: logic change, identical render"
set +e; run_guard "$C" "HEAD~1..HEAD"; rc=$?; set -e
assert_exit "ui change with valid opt-out passes" 0 "$rc"

# --- Case D: ui change + empty-reason opt-out -> fail (exit 1) ---
D="$WORK/d"; git_init "$D"
mkdir -p "$D/ui/src"; echo "base" > "$D/ui/src/App.tsx"; seed_commit "$D" "base"
echo "changed" > "$D/ui/src/App.tsx"
git -C "$D" add -A
git -C "$D" commit -q -m "behavior-only fix

Screenshots-Not-Needed:   "
set +e; run_guard "$D" "HEAD~1..HEAD"; rc=$?; set -e
assert_exit "ui change with empty-reason opt-out fails" 1 "$rc"

# --- Case E: no ui change -> pass (exit 0) ---
E="$WORK/e"; git_init "$E"
mkdir -p "$E/docs"; echo "base" > "$E/README.md"; seed_commit "$E" "base"
echo "more" >> "$E/README.md"; seed_commit "$E" "docs-only change"
set +e; run_guard "$E" "HEAD~1..HEAD"; rc=$?; set -e
assert_exit "no ui change passes" 0 "$rc"

# --- Case F: no v* tag, no override -> safe pass (exit 0) ---
F="$WORK/f"; git_init "$F"
mkdir -p "$F/ui/src"; echo "base" > "$F/ui/src/App.tsx"; seed_commit "$F" "base"
echo "changed" > "$F/ui/src/App.tsx"; seed_commit "$F" "ui change, no tags"
set +e; ( cd "$F" && bash "$GUARD" ) >"$WORK/out.log" 2>&1; rc=$?; set -e
assert_exit "no release tag is a safe pass" 0 "$rc"

# --- Case G: base-side opt-out trailer must NOT waive a head-side ui change (three-dot) ---
# Regression guard for symmetric `git log A...B`.
G="$WORK/g"; git_init "$G"
mkdir -p "$G/ui/src"; echo "base" > "$G/ui/src/App.tsx"; seed_commit "$G" "base"
git -C "$G" branch -M main
# Base branch advances with an unrelated commit carrying an opt-out trailer.
echo "doc" > "$G/README.md"
git -C "$G" add -A
git -C "$G" commit -q -m "unrelated base change

Screenshots-Not-Needed: this was for a different change"
# Feature branch off the original base, with a real un-screenshotted ui change.
feature_branch="feature-selftest-$$"
git -C "$G" checkout -q -b "$feature_branch" main~1
echo "changed" > "$G/ui/src/App.tsx"; seed_commit "$G" "feature ui change, no screenshot"
set +e; run_guard "$G" "main...HEAD"; rc=$?; set -e
assert_exit "base-side opt-out does not waive head-side ui change" 1 "$rc"

# --- Case H: deleting a screenshot must NOT satisfy the guard ---
H="$WORK/h"; git_init "$H"
mkdir -p "$H/ui/src" "$H/docs"; echo "base" > "$H/ui/src/App.tsx"; printf 'PNG' > "$H/docs/shot.png"; seed_commit "$H" "base"
echo "changed" > "$H/ui/src/App.tsx"; rm "$H/docs/shot.png"; seed_commit "$H" "ui change + screenshot deletion"
set +e; run_guard "$H" "HEAD~1..HEAD"; rc=$?; set -e
assert_exit "screenshot deletion does not satisfy guard" 1 "$rc"

if [ "$fail" -ne 0 ]; then
  echo "ui-screenshot-sync selftest: FAILURES above" >&2
  exit 1
fi
echo "ui-screenshot-sync selftest: all cases passed"
