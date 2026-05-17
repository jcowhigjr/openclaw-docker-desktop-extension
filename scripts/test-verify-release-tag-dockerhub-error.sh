#!/bin/sh

set -eu

repo_root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

fakebin="${tmp_dir}/fakebin"
mkdir -p "$fakebin"

cat >"${fakebin}/gh" <<'EOF'
#!/bin/sh
set -eu

if [ "$1" = "auth" ] && [ "$2" = "status" ]; then
  cat <<'STATUS'
github.com
  ✓ Logged in to github.com account jcowhigjr (keyring)
  - Active account: true
STATUS
  exit 0
fi

if [ "$1" = "api" ] && [ "$2" = "/repos/jcowhigjr/openclaw-docker-desktop-extension/releases/tags/v1.2.3" ]; then
  exit 0
fi

echo "unexpected gh invocation: $*" >&2
exit 1
EOF
chmod +x "${fakebin}/gh"

cat >"${fakebin}/docker" <<'EOF'
#!/bin/sh
set -eu

if [ -z "${DOCKER_CONFIG:-}" ]; then
  echo "expected DOCKER_CONFIG for anonymous reads" >&2
  exit 1
fi

case "$3" in
  ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:v1.2.3|\
  ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:v1.2.3|\
  ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:1.2.3|\
  ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:1.2.3)
    exit 0
    ;;
  docker.io/jcowhigjr/openclaw-docker-desktop-extension:1.2.3)
    exit 1
    ;;
esac

echo "unexpected docker invocation: $*" >&2
exit 1
EOF
chmod +x "${fakebin}/docker"

cat >"${fakebin}/curl" <<'EOF'
#!/bin/sh
set -eu
echo "unexpected curl invocation: $*" >&2
exit 1
EOF
chmod +x "${fakebin}/curl"

set +e
output="$(
  PATH="${fakebin}:$PATH" \
  "${repo_root}/scripts/verify-release-tag.sh" v1.2.3 2>&1
)"
status=$?
set -e

[ "$status" -ne 0 ]
printf '%s\n' "$output" | grep -F "docker.io tag is missing or not publicly readable: docker.io/jcowhigjr/openclaw-docker-desktop-extension:1.2.3" >/dev/null
printf '%s\n' "$output" | grep -F "Next step: confirm the publish workflow completed and the Docker Hub repository/tag is public." >/dev/null

echo "release tag docker hub failure messaging checks passed"
