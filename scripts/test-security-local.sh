#!/bin/sh
set -eu

repo_root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"

if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --source "$repo_root" --redact --no-banner
else
  echo "gitleaks is not installed; skipping local secret scan" >&2
  echo "Install gitleaks to match the GitHub Secret scan before pushing." >&2
fi

(cd "$repo_root/ui" && npm audit --audit-level=critical)

echo "local security checks passed"
