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
  echo "expected DOCKER_CONFIG for anonymous GHCR reads" >&2
  exit 1
fi

if [ "$1" = "manifest" ] && [ "$2" = "inspect" ] && [ "$3" = "ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:v1.2.3" ]; then
  exit 0
fi

if [ "$1" = "manifest" ] && [ "$2" = "inspect" ] && [ "$3" = "ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:v1.2.3" ]; then
  exit 0
fi

if [ "$1" = "manifest" ] && [ "$2" = "inspect" ] && [ "$3" = "ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:1.2.3" ]; then
  exit 0
fi

if [ "$1" = "manifest" ] && [ "$2" = "inspect" ] && [ "$3" = "ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:1.2.3" ]; then
  exit 0
fi

if [ "$1" = "manifest" ] && [ "$2" = "inspect" ] && [ "$3" = "docker.io/jcowhigjr/openclaw-docker-desktop-extension:1.2.3" ]; then
  exit 0
fi

if [ "$1" = "manifest" ] && [ "$2" = "inspect" ] && [ "$3" = "--verbose" ] && [ "$4" = "ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:v1.2.3" ]; then
  cat <<'JSON'
[
  {
    "OCIManifest": {
      "config": {
        "digest": "sha256:testconfigv"
      }
    }
  }
]
JSON
  exit 0
fi

if [ "$1" = "manifest" ] && [ "$2" = "inspect" ] && [ "$3" = "--verbose" ] && [ "$4" = "ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:1.2.3" ]; then
  cat <<'JSON'
[
  {
    "OCIManifest": {
      "config": {
        "digest": "sha256:testconfigsemver"
      }
    }
  }
]
JSON
  exit 0
fi

echo "unexpected docker invocation: $*" >&2
exit 1
EOF
chmod +x "${fakebin}/docker"

cat >"${fakebin}/curl" <<'EOF'
#!/bin/sh
set -eu

case "$*" in
  *"https://ghcr.io/token?scope=repository:jcowhigjr/openclaw-docker-desktop-extension:pull&service=ghcr.io"*)
    printf '%s\n' '{"token":"test-token"}'
    ;;
  *"https://ghcr.io/v2/jcowhigjr/openclaw-docker-desktop-extension/manifests/v1.2.3"*)
    printf '%s\n' '{"config":{"digest":"sha256:testconfigv"}}'
    ;;
  *"https://ghcr.io/v2/jcowhigjr/openclaw-docker-desktop-extension/manifests/1.2.3"*)
    printf '%s\n' '{"config":{"digest":"sha256:testconfigsemver"}}'
    ;;
  *"https://ghcr.io/v2/jcowhigjr/openclaw-docker-desktop-extension/manifests/sha256:testconfigv"*)
    printf '%s\n' '{"config":{"digest":"sha256:testconfigv"}}'
    ;;
  *"https://ghcr.io/v2/jcowhigjr/openclaw-docker-desktop-extension/manifests/sha256:testconfigsemver"*)
    printf '%s\n' '{"config":{"digest":"sha256:testconfigsemver"}}'
    ;;
  *"https://ghcr.io/v2/jcowhigjr/openclaw-docker-desktop-extension/blobs/sha256:testconfigv"*)
    printf '%s\n' '{"config":{"Labels":{"org.opencontainers.image.title":"OpenClaw"}}}'
    ;;
  *"https://ghcr.io/v2/jcowhigjr/openclaw-docker-desktop-extension/blobs/sha256:testconfigsemver"*)
    printf '%s\n' '{"config":{"Labels":{"org.opencontainers.image.title":"OpenClaw"}}}'
    ;;
  *"https://auth.docker.io/token?service=registry.docker.io&scope=repository:jcowhigjr/openclaw-docker-desktop-extension:pull"*)
    printf '%s\n' '{"token":"test-token"}'
    ;;
  *"https://registry-1.docker.io/v2/jcowhigjr/openclaw-docker-desktop-extension/manifests/1.2.3"*)
    printf '%s\n' '{"config":{"digest":"sha256:testconfigdockerhub"}}'
    ;;
  *"https://registry-1.docker.io/v2/jcowhigjr/openclaw-docker-desktop-extension/manifests/sha256:testconfigdockerhub"*)
    printf '%s\n' '{"config":{"digest":"sha256:testconfigdockerhub"}}'
    ;;
  *"https://registry-1.docker.io/v2/jcowhigjr/openclaw-docker-desktop-extension/blobs/sha256:testconfigdockerhub"*)
    printf '%s\n' '{"config":{"Labels":{"org.opencontainers.image.title":"OpenClaw"}}}'
    ;;
  *)
    echo "unexpected curl invocation: $*" >&2
    exit 1
    ;;
esac
EOF
chmod +x "${fakebin}/curl"

output="$(
  PATH="${fakebin}:$PATH" \
  "${repo_root}/scripts/verify-release-tag.sh" v1.2.3 2>&1
)"

printf '%s\n' "$output" | grep -F "published OCI title matches expected value: ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:v1.2.3" >/dev/null
printf '%s\n' "$output" | grep -F "published OCI title matches expected value: ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:1.2.3" >/dev/null
printf '%s\n' "$output" | grep -F "published OCI title matches expected value: docker.io/jcowhigjr/openclaw-docker-desktop-extension:1.2.3" >/dev/null
printf '%s\n' "$output" | grep -F "Release install path is ready for this tag:" >/dev/null

echo "release tag title verification checks passed"
