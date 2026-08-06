#!/bin/sh

set -eu

repo_root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

mkdir -p "$tmp_dir/bin"

cat >"$tmp_dir/bin/docker" <<'EOF'
#!/bin/sh
set -eu

if [ "$1" = "manifest" ] && [ "$2" = "inspect" ]; then
  exit 0
fi

echo "unexpected docker invocation: $*" >&2
exit 1
EOF

cat >"$tmp_dir/bin/curl" <<'EOF'
#!/bin/sh
set -eu

url=""
for arg in "$@"; do
  case "$arg" in
    http://*|https://*)
      url="$arg"
      ;;
  esac
done

case "$url" in
  https://ghcr.io/token\?*)
    printf '%s' '{"token":"test-token"}'
    ;;
  https://auth.docker.io/token\?*)
    printf '%s' '{"token":"test-token"}'
    ;;
  */manifests/stable|*/manifests/latest|*/manifests/v1.2.3|*/manifests/1.2.3)
    printf 'HTTP/1.1 200 OK\r\n'
    printf 'content-type: application/vnd.oci.image.index.v1+json\r\n'
    printf 'docker-content-digest: sha256:testdigest\r\n'
    printf '\r\n'
    ;;
  *)
    echo "unexpected curl url: $url" >&2
    exit 1
    ;;
esac
EOF

chmod +x "$tmp_dir/bin/docker" "$tmp_dir/bin/curl"

output="$(
  PATH="$tmp_dir/bin:$PATH" \
    EXPECTED_RELEASE_TAG="v1.2.3" \
    GHCR_OWNER="jcowhigjr" \
    "$repo_root/scripts/verify-release-channel.sh" stable
)"

printf '%s\n' "$output" | grep -F "registry channel matches expected tag: ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable -> v1.2.3" >/dev/null
printf '%s\n' "$output" | grep -F "registry channel matches expected tag: docker.io/jcowhigjr/openclaw-docker-desktop-extension:stable -> 1.2.3" >/dev/null
printf '%s\n' "$output" | grep -F "registry channel matches expected tag: ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:stable -> latest" >/dev/null
printf '%s\n' "$output" | grep -F "extension channel matches across registries: stable -> sha256:testdigest" >/dev/null

echo "verify-release-channel digest parsing checks passed"
