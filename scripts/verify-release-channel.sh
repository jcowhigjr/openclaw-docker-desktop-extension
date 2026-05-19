#!/bin/sh

set -eu

release_channel="${1:-${RELEASE_CHANNEL:-stable}}"
ghcr_owner="${GHCR_OWNER:-jcowhigjr}"
expected_release_tag="${EXPECTED_RELEASE_TAG:-}"
dry_run="${DRY_RUN:-0}"
extension_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension:${release_channel}"
runtime_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension-runtime:${release_channel}"
extension_repo="${ghcr_owner}/openclaw-docker-desktop-extension"
runtime_repo="${ghcr_owner}/openclaw-docker-desktop-extension-runtime"

if [ -z "$release_channel" ]; then
  echo "RELEASE_CHANNEL is required, for example: make verify-release-channel RELEASE_CHANNEL=stable" >&2
  exit 1
fi

if [ "$dry_run" = "1" ]; then
  cat <<EOF
dry run: docker manifest inspect ${extension_image}
dry run: docker manifest inspect ${runtime_image}
EOF
  if [ -n "$expected_release_tag" ]; then
    cat <<EOF
dry run: compare ${extension_image} to ghcr.io/${extension_repo}:${expected_release_tag}
dry run: compare ${runtime_image} to ghcr.io/${runtime_repo}:${expected_release_tag}
EOF
  fi
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required for release-channel verification." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for release-channel verification." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for release-channel verification." >&2
  exit 1
fi

require_anonymous_manifest() {
  image_ref="$1"

  if docker manifest inspect "$image_ref" >/dev/null 2>&1; then
    echo "ghcr channel is publicly readable: ${image_ref}"
    return 0
  fi

  echo "ghcr channel is missing or not publicly readable: ${image_ref}" >&2
  case "$release_channel" in
    stable)
      echo "Next step: publish or repair a normal release tag so the publish workflow moves the stable channel." >&2
      ;;
    beta)
      echo "Next step: publish or repair a prerelease tag so the publish workflow moves the beta channel." >&2
      ;;
    *)
      echo "Next step: confirm the publish workflow completed and that this channel tag is expected to exist." >&2
      ;;
  esac
  return 1
}

require_anonymous_manifest "${extension_image}"
require_anonymous_manifest "${runtime_image}"

fetch_ghcr_token() {
  repo_path="$1"

  curl -fsSL "https://ghcr.io/token?scope=repository:${repo_path}:pull&service=ghcr.io" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

fetch_registry_digest() {
  repo_path="$1"
  reference="$2"
  token="$(fetch_ghcr_token "$repo_path")"

  curl -fsSL -D - -o /dev/null \
    -H "Authorization: Bearer ${token}" \
    -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json' \
    "https://ghcr.io/v2/${repo_path}/manifests/${reference}" \
    | awk 'tolower($1) == "docker-content-digest:" { sub(/\r$/, "", $2); print $2; exit }'
}

require_matching_tag() {
  repo_path="$1"
  channel_ref="$2"
  release_ref="$3"

  channel_digest="$(fetch_registry_digest "$repo_path" "$channel_ref")"
  release_digest="$(fetch_registry_digest "$repo_path" "$release_ref")"

  if [ -z "$channel_digest" ] || [ -z "$release_digest" ]; then
    echo "Unable to resolve GHCR digests for comparison: ghcr.io/${repo_path}:${channel_ref} vs ghcr.io/${repo_path}:${release_ref}" >&2
    echo "Next step: confirm the publish workflow completed and both tags are public." >&2
    return 1
  fi

  if [ "$channel_digest" = "$release_digest" ]; then
    echo "ghcr channel matches expected release: ghcr.io/${repo_path}:${channel_ref} -> ${release_ref}"
    return 0
  fi

  echo "ghcr channel does not match expected release: ghcr.io/${repo_path}:${channel_ref}=${channel_digest} expected ${release_ref}=${release_digest}" >&2
  echo "Next step: repair or republish the intended release so the floating channel points at the expected tag." >&2
  return 1
}

if [ -n "$expected_release_tag" ]; then
  require_matching_tag "${extension_repo}" "${release_channel}" "${expected_release_tag}"
  require_matching_tag "${runtime_repo}" "${release_channel}" "${expected_release_tag}"
fi

cat <<EOF
Release channel path is ready for this channel:
  make install-channel RELEASE_CHANNEL=${release_channel}
EOF
