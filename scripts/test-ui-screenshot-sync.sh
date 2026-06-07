#!/usr/bin/env bash
#
# Release-quality guard: fail when UI source changed in a commit range but no
# screenshot under docs/ was updated. Allows an explicit opt-out for changes
# with no visual diff via a `Screenshots-Not-Needed: <reason>` commit trailer.
#
# Range resolution (first match wins):
#   1. DIFF_RANGE                  - used verbatim (e.g. "origin/main...HEAD")
#   2. BASE_REF [+ HEAD_REF]       - "<BASE_REF>...<HEAD_REF:-HEAD>"
#   3. last v* tag .. HEAD         - default release-checklist behavior
#
# If no range can be resolved (no v* tag and no override), exit 0 (safe pass)
# so the very first release is never blocked.

set -euo pipefail

UI_SOURCE_PREFIX="ui/src/"
DOCS_IMAGE_REGEX='^docs/.*\.(png|jpe?g|gif|webp)$'
OPTOUT_TRAILER="Screenshots-Not-Needed"

resolve_range() {
  if [ -n "${DIFF_RANGE:-}" ]; then
    printf '%s' "$DIFF_RANGE"
    return 0
  fi

  if [ -n "${BASE_REF:-}" ]; then
    printf '%s...%s' "$BASE_REF" "${HEAD_REF:-HEAD}"
    return 0
  fi

  local last_tag
  if last_tag="$(git describe --tags --abbrev=0 --match 'v*' 2>/dev/null)"; then
    printf '%s..HEAD' "$last_tag"
    return 0
  fi

  return 1
}

if ! range="$(resolve_range)"; then
  echo "ui-screenshot-sync: no v* release tag and no range override; skipping (safe pass)."
  exit 0
fi

# Diff is merge-base relative for "A...B"; the trailer scan, however, must only
# see commits reachable from the head side (collapse "..." to ".."), otherwise
# an opt-out trailer on the base branch would waive the guard for unrelated work.
log_range="${range/.../..}"
echo "ui-screenshot-sync: evaluating range ${range}"

# Fail closed: a diff error must not be mistaken for "no changes".
if ! changed_files="$(git diff --name-only "$range" 2>&1)"; then
  echo "ui-screenshot-sync: could not diff range '${range}': ${changed_files}" >&2
  exit 1
fi

ui_changed="$(printf '%s\n' "$changed_files" | grep -F "$UI_SOURCE_PREFIX" || true)"
if [ -z "$ui_changed" ]; then
  echo "ui-screenshot-sync: no ${UI_SOURCE_PREFIX} changes in range; pass."
  exit 0
fi

# Only added/modified screenshots satisfy the guard — a deletion must not.
if ! shot_files="$(git diff --name-only --diff-filter=AM "$range" 2>&1)"; then
  echo "ui-screenshot-sync: could not diff range '${range}': ${shot_files}" >&2
  exit 1
fi
shot_changed="$(printf '%s\n' "$shot_files" | grep -iE "$DOCS_IMAGE_REGEX" || true)"
if [ -n "$shot_changed" ]; then
  echo "ui-screenshot-sync: UI source changed and docs/ screenshot updated; pass."
  echo "  screenshots:"
  printf '%s\n' "$shot_changed" | sed 's/^/    /'
  exit 0
fi

# No screenshot update — look for an explicit opt-out trailer in the range.
optout_present=0
optout_valid=0
optout_reason=""
while IFS= read -r sha; do
  [ -n "$sha" ] || continue
  line="$(git log -1 --format='%B' "$sha" | grep -iE "^${OPTOUT_TRAILER}:" | head -1 || true)"
  [ -n "$line" ] || continue
  optout_present=1
  reason="$(printf '%s' "$line" | sed -E 's/^[^:]*:[[:space:]]*//' | sed -E 's/[[:space:]]+$//')"
  if [ -n "$reason" ]; then
    optout_valid=1
    optout_reason="$reason"
  fi
done <<EOF
$(git log "$log_range" --format='%H' 2>/dev/null || true)
EOF

if [ "$optout_valid" -eq 1 ]; then
  echo "ui-screenshot-sync: screenshot requirement waived via ${OPTOUT_TRAILER} trailer."
  echo "  reason: ${optout_reason}"
  exit 0
fi

if [ "$optout_present" -eq 1 ]; then
  echo "ui-screenshot-sync: ${OPTOUT_TRAILER} trailer present but reason is empty — invalid opt-out." >&2
  exit 1
fi

echo "ui-screenshot-sync: UI source changed without a screenshot update." >&2
echo "  changed UI files:" >&2
printf '%s\n' "$ui_changed" | sed 's/^/    /' >&2
echo "" >&2
echo "  Fix one of:" >&2
echo "    - update a screenshot under docs/ (see: make capture-readme-screenshot)" >&2
echo "    - if there is no visual diff, add a commit trailer:" >&2
echo "        ${OPTOUT_TRAILER}: <reason>" >&2
echo "      (note: with squash-merge the trailer must land in the squashed commit message)" >&2
exit 1
