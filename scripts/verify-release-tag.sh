#!/bin/sh

set -eu

release_tag="${1:-${RELEASE_TAG:-}}"
release_version="${release_tag#v}"
repo_owner="${REPO_OWNER:-jcowhigjr}"
repo_name="${REPO_NAME:-openclaw-docker-desktop-extension}"
ghcr_owner="${GHCR_OWNER:-$repo_owner}"
dockerhub_owner="${DOCKERHUB_OWNER:-$repo_owner}"
dry_run="${DRY_RUN:-0}"
extension_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension:${release_tag}"
runtime_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension-runtime:${release_tag}"
extension_semver_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension:${release_version}"
runtime_semver_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension-runtime:${release_version}"
dockerhub_extension_semver_image="docker.io/${dockerhub_owner}/openclaw-docker-desktop-extension:${release_version}"
extension_repo="${ghcr_owner}/openclaw-docker-desktop-extension"
dockerhub_extension_repo="${dockerhub_owner}/openclaw-docker-desktop-extension"
expected_extension_title="${EXPECTED_EXTENSION_TITLE:-Shellharbor for OpenClaw}"

if [ -z "$release_tag" ]; then
  echo "RELEASE_TAG is required, for example: make verify-release-tag RELEASE_TAG=v0.1.0" >&2
  exit 1
fi

if [ "$dry_run" = "1" ]; then
  cat <<EOF
dry run: gh api /repos/${repo_owner}/${repo_name}/releases/tags/${release_tag}
dry run: docker manifest inspect ${extension_image}
dry run: docker manifest inspect ${runtime_image}
dry run: docker manifest inspect ${extension_semver_image}
dry run: docker manifest inspect ${runtime_semver_image}
dry run: docker manifest inspect ${dockerhub_extension_semver_image}
dry run: verify extension label org.opencontainers.image.title=${expected_extension_title} on ${extension_image}
dry run: verify extension label org.opencontainers.image.title=${expected_extension_title} on ${extension_semver_image}
dry run: verify extension label org.opencontainers.image.title=${expected_extension_title} on ${dockerhub_extension_semver_image}
EOF
  exit 0
fi

anonymous_docker_config="$(mktemp -d)"
trap 'rm -rf "$anonymous_docker_config"' EXIT HUP INT TERM

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is required for release verification." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required for release verification." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required for release verification." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required for release verification." >&2
  exit 1
fi

auth_status="$(gh auth status 2>&1 || true)"

if ! printf '%s\n' "$auth_status" | grep -F "Active account: true" >/dev/null 2>&1; then
  echo "gh auth status failed. Log in with 'gh auth login' before verifying a release tag." >&2
  exit 1
fi

require_release() {
  if gh api "/repos/${repo_owner}/${repo_name}/releases/tags/${release_tag}" >/dev/null 2>&1; then
    echo "release exists: ${release_tag}"
    return 0
  fi

  if gh api "/repos/${repo_owner}/${repo_name}/git/ref/tags/${release_tag}" >/dev/null 2>&1; then
    echo "git tag exists but GitHub release is missing: ${release_tag}" >&2
    echo "Next step: publish the GitHub release so the GHCR install path is user-visible." >&2
    return 1
  fi

  echo "git tag and GitHub release are both missing: ${release_tag}" >&2
  echo "Next step: create the tag and let the publish workflow run first." >&2
  return 1
}

require_anonymous_manifest() {
  image_ref="$1"
  registry_name="$2"
  next_step="$3"

  if DOCKER_CONFIG="$anonymous_docker_config" docker manifest inspect "$image_ref" >/dev/null 2>&1; then
    echo "${registry_name} tag is publicly readable: ${image_ref}"
    return 0
  fi

  echo "${registry_name} tag is missing or not publicly readable: ${image_ref}" >&2
  echo "Next step: ${next_step}" >&2
  return 1
}

fetch_ghcr_token() {
  repo_path="$1"

  curl -fsSL "https://ghcr.io/token?scope=repository:${repo_path}:pull&service=ghcr.io" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

fetch_dockerhub_token() {
  repo_path="$1"

  curl -fsSL "https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo_path}:pull" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])'
}

resolve_config_digest() {
  python3 -c '
import json
import sys

obj = json.load(sys.stdin)
media_type = obj.get("mediaType", "")

if media_type in {
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
}:
    manifests = obj.get("manifests", [])
    preferred = None
    fallback = None
    for manifest in manifests:
        platform = manifest.get("platform", {})
        if platform.get("os") != "linux":
            continue
        if fallback is None:
            fallback = manifest.get("digest")
        if platform.get("architecture") == "arm64":
            preferred = manifest.get("digest")
            break
    digest = preferred or fallback
    if not digest:
        raise SystemExit("no linux image manifest found")
    print(digest)
    raise SystemExit(0)

config = obj.get("config", {})
digest = config.get("digest")
if not digest:
    raise SystemExit("manifest config digest is missing")
print(digest)
'
}

require_registry_label() {
  repo_path="$1"
  reference="$2"
  label_key="$3"
  expected_value="$4"

  token="$(fetch_ghcr_token "$repo_path")"
  manifest_json="$(
    curl -fsSL \
      -H "Authorization: Bearer ${token}" \
      -H 'Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json' \
      "https://ghcr.io/v2/${repo_path}/manifests/${reference}"
  )"
  manifest_digest="$(printf '%s' "$manifest_json" | resolve_config_digest)"
  image_manifest_json="$(
    curl -fsSL \
      -H "Authorization: Bearer ${token}" \
      -H 'Accept: application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json' \
      "https://ghcr.io/v2/${repo_path}/manifests/${manifest_digest}"
  )"
  config_digest="$(
    printf '%s' "$image_manifest_json" \
      | python3 -c 'import json,sys; print(json.load(sys.stdin)["config"]["digest"])'
  )"
  actual_value="$(
    curl -fsSL -H "Authorization: Bearer ${token}" "https://ghcr.io/v2/${repo_path}/blobs/${config_digest}" \
      | python3 -c 'import json,sys; obj=json.load(sys.stdin); value=obj.get("config", {}).get("Labels", {}).get(sys.argv[1]); print("" if value is None else value)' "${label_key}"
  )"

  if [ "$actual_value" = "$expected_value" ]; then
    echo "published OCI title matches expected value: ghcr.io/${repo_path}:${reference}"
    return 0
  fi

  echo "published OCI title mismatch: ghcr.io/${repo_path}:${reference} ${label_key}=${actual_value:-<missing>} (expected ${expected_value})" >&2
  echo "Next step: fix the publish workflow labels before promoting or relying on this release tag." >&2
  return 1
}

require_dockerhub_registry_label() {
  repo_path="$1"
  reference="$2"
  label_key="$3"
  expected_value="$4"

  image_ref="docker.io/${repo_path}:${reference}"

  if ! docker pull --quiet "${image_ref}" >/dev/null 2>&1; then
    echo "docker pull failed for ${image_ref}" >&2
    echo "Next step: confirm Docker Hub login and that the image is publicly accessible." >&2
    return 1
  fi

  actual_value="$(
    docker inspect "${image_ref}" \
      | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0].get("Config",{}).get("Labels",{}).get(sys.argv[1],""))' "${label_key}"
  )"

  if [ "$actual_value" = "$expected_value" ]; then
    echo "published OCI title matches expected value: docker.io/${repo_path}:${reference}"
    return 0
  fi

  echo "published OCI title mismatch: docker.io/${repo_path}:${reference} ${label_key}=${actual_value:-<missing>} (expected ${expected_value})" >&2
  echo "Next step: fix the publish workflow labels before submitting to Docker Marketplace." >&2
  return 1
}

require_release
require_anonymous_manifest "${extension_image}" "ghcr" "confirm the publish workflow completed and the GHCR package is public."
require_anonymous_manifest "${runtime_image}" "ghcr" "confirm the publish workflow completed and the GHCR package is public."
require_anonymous_manifest "${extension_semver_image}" "ghcr" "confirm the publish workflow completed and the GHCR package is public."
require_anonymous_manifest "${runtime_semver_image}" "ghcr" "confirm the publish workflow completed and the GHCR package is public."
require_anonymous_manifest "${dockerhub_extension_semver_image}" "docker.io" "confirm the publish workflow completed and the Docker Hub repository/tag is public."
require_registry_label "${extension_repo}" "${release_tag}" "org.opencontainers.image.title" "${expected_extension_title}"
require_registry_label "${extension_repo}" "${release_version}" "org.opencontainers.image.title" "${expected_extension_title}"
require_dockerhub_registry_label "${dockerhub_extension_repo}" "${release_version}" "org.opencontainers.image.title" "${expected_extension_title}"

cat <<EOF
Release install path is ready for this tag:
  make install-release RELEASE_TAG=${release_tag}
EOF
