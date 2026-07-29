#!/bin/sh

set -eu

release_channel="${1:-${RELEASE_CHANNEL:-stable}}"
ghcr_owner="${GHCR_OWNER:-jcowhigjr}"
dockerhub_owner="${DOCKERHUB_OWNER:-$ghcr_owner}"
expected_release_tag="${EXPECTED_RELEASE_TAG:-}"
expected_release_version="${expected_release_tag#v}"
dry_run="${DRY_RUN:-0}"
extension_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension:${release_channel}"
runtime_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension-runtime:${release_channel}"
dockerhub_extension_image="docker.io/${dockerhub_owner}/openclaw-docker-desktop-extension:${release_channel}"
extension_repo="${ghcr_owner}/openclaw-docker-desktop-extension"
runtime_repo="${ghcr_owner}/openclaw-docker-desktop-extension-runtime"
dockerhub_extension_repo="${dockerhub_owner}/openclaw-docker-desktop-extension"

if [ -z "$release_channel" ]; then
  echo "RELEASE_CHANNEL is required, for example: make verify-release-channel RELEASE_CHANNEL=stable" >&2
  exit 1
fi

if [ "$dry_run" = "1" ]; then
  cat <<EOF
dry run: docker manifest inspect ${extension_image}
dry run: docker manifest inspect ${runtime_image}
dry run: docker manifest inspect ${dockerhub_extension_image}
EOF
  if [ -n "$expected_release_tag" ]; then
    echo "dry run: compare ${extension_image} to ghcr.io/${extension_repo}:${expected_release_tag}"
    echo "dry run: compare ${dockerhub_extension_image} to docker.io/${dockerhub_extension_repo}:${expected_release_version}"
  fi
  if [ "$release_channel" = "stable" ]; then
    echo "dry run: compare ${runtime_image} to ghcr.io/${runtime_repo}:latest"
  elif [ -n "$expected_release_tag" ]; then
    echo "dry run: compare ${runtime_image} to ghcr.io/${runtime_repo}:${expected_release_tag}"
  fi
  echo "dry run: compare ${extension_image} to ${dockerhub_extension_image}"
  exit 0
fi

for command in docker curl python3; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "${command} is required for release-channel verification." >&2
    exit 1
  fi
done

require_anonymous_manifest() {
  image_ref="$1"
  if docker manifest inspect "$image_ref" >/dev/null 2>&1; then
    echo "registry channel is publicly readable: ${image_ref}"
    return 0
  fi
  echo "registry channel is missing or not publicly readable: ${image_ref}" >&2
  return 1
}

fetch_registry_token() {
  registry="$1"
  repo_path="$2"
  if [ "$registry" = "ghcr.io" ]; then
    curl -fsSL "https://ghcr.io/token?scope=repository:${repo_path}:pull&service=ghcr.io"
  else
    curl -fsSL "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo_path}:pull"
  fi | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

fetch_registry_digest() {
  registry="$1"
  repo_path="$2"
  reference="$3"
  token="$(fetch_registry_token "$registry" "$repo_path")"
  if [ "$registry" = "ghcr.io" ]; then
    registry_url="https://ghcr.io"
  else
    registry_url="https://registry-1.docker.io"
  fi
  curl -fsSL -D - -o /dev/null \
    -H "Authorization: Bearer ${token}" \
    -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json' \
    "${registry_url}/v2/${repo_path}/manifests/${reference}" \
    | awk 'tolower($1) == "docker-content-digest:" { sub(/\r$/, "", $2); print $2; exit }'
}

require_matching_tag() {
  registry="$1"
  repo_path="$2"
  channel_ref="$3"
  expected_ref="$4"
  channel_digest="$(fetch_registry_digest "$registry" "$repo_path" "$channel_ref")"
  expected_digest="$(fetch_registry_digest "$registry" "$repo_path" "$expected_ref")"
  if [ -n "$channel_digest" ] && [ "$channel_digest" = "$expected_digest" ]; then
    echo "registry channel matches expected tag: ${registry}/${repo_path}:${channel_ref} -> ${expected_ref}"
    return 0
  fi
  echo "registry channel does not match expected tag: ${registry}/${repo_path}:${channel_ref}=${channel_digest:-<missing>} expected ${expected_ref}=${expected_digest:-<missing>}" >&2
  return 1
}

require_matching_registry_channels() {
  reference="$1"
  ghcr_digest="$(fetch_registry_digest "ghcr.io" "$extension_repo" "$reference")"
  dockerhub_digest="$(fetch_registry_digest "docker.io" "$dockerhub_extension_repo" "$reference")"
  if [ -n "$ghcr_digest" ] && [ "$ghcr_digest" = "$dockerhub_digest" ]; then
    echo "extension channel matches across registries: ${reference} -> ${ghcr_digest}"
    return 0
  fi
  echo "extension channel differs across registries: ghcr=${ghcr_digest:-<missing>} dockerhub=${dockerhub_digest:-<missing>}" >&2
  return 1
}

require_anonymous_manifest "$extension_image"
require_anonymous_manifest "$runtime_image"
require_anonymous_manifest "$dockerhub_extension_image"

if [ -n "$expected_release_tag" ]; then
  require_matching_tag "ghcr.io" "$extension_repo" "$release_channel" "$expected_release_tag"
  require_matching_tag "docker.io" "$dockerhub_extension_repo" "$release_channel" "$expected_release_version"
fi

if [ "$release_channel" = "stable" ]; then
  require_matching_tag "ghcr.io" "$runtime_repo" "$release_channel" "latest"
elif [ -n "$expected_release_tag" ]; then
  require_matching_tag "ghcr.io" "$runtime_repo" "$release_channel" "$expected_release_tag"
fi

require_matching_registry_channels "$release_channel"

cat <<EOF
Release channel path is ready for this channel:
  make install-channel RELEASE_CHANNEL=${release_channel}
EOF
