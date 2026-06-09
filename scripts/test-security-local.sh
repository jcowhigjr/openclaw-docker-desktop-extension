#!/bin/sh
set -eu

repo_root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
git_common_dir="$(git -C "$repo_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
original_core_bare="__unset__"
if [ -n "$git_common_dir" ]; then
  original_core_bare="$(git --git-dir="$git_common_dir" config --get core.bare 2>/dev/null || true)"
  [ -n "$original_core_bare" ] || original_core_bare="__unset__"
fi

restore_git_config() {
  [ -n "$git_common_dir" ] || return 0
  if [ "$original_core_bare" = "__unset__" ]; then
    git --git-dir="$git_common_dir" config --unset core.bare 2>/dev/null || true
  else
    git --git-dir="$git_common_dir" config core.bare "$original_core_bare"
  fi
}

trap restore_git_config EXIT

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks dir "$repo_root" --redact --no-banner
else
  echo "gitleaks is not installed; skipping local secret scan" >&2
  echo "Install gitleaks to match the GitHub Secret scan before pushing." >&2
fi

(cd "$repo_root/ui" && npm audit --audit-level=critical)

echo "local security checks passed"
