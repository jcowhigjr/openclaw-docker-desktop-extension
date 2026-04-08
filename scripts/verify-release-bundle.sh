#!/bin/sh

set -eu

release_tag="${1:-${RELEASE_TAG:-}}"
repo_owner="${REPO_OWNER:-jcowhigjr}"
ghcr_owner="${GHCR_OWNER:-$repo_owner}"
verify_image="${VERIFY_IMAGE:-openclaw-docker-extension-release-check}"
verify_tag="${VERIFY_TAG:-${release_tag:-check}}"
dry_run="${DRY_RUN:-0}"

if [ -z "$release_tag" ]; then
  echo "RELEASE_TAG is required, for example: make verify-release-bundle RELEASE_TAG=v0.1.0" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker CLI is required for release-bundle verification." >&2
  exit 1
fi

expected_runtime_image="ghcr.io/${ghcr_owner}/openclaw-docker-desktop-extension-runtime:${release_tag}"
image_ref="${verify_image}:${verify_tag}"

if [ "$dry_run" = "1" ]; then
  echo "dry run: docker build --build-arg VITE_DEFAULT_RUNTIME_IMAGE=${expected_runtime_image} --tag ${image_ref} ."
  echo "dry run: docker create ${image_ref}"
  echo "dry run: docker cp <container>:/ui <tmpdir>/ui"
  echo "dry run: grep -R -F ${expected_runtime_image} <tmpdir>/ui"
  exit 0
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker Desktop must be running before verifying a release bundle." >&2
  echo "Next step: start Docker Desktop and rerun make verify-release-bundle RELEASE_TAG=${release_tag}" >&2
  exit 1
fi

tmpdir="$(mktemp -d)"
container_id=""

cleanup() {
  if [ -n "$container_id" ]; then
    docker rm -f "$container_id" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmpdir"
}

trap cleanup EXIT INT TERM

docker build \
  --build-arg "VITE_DEFAULT_RUNTIME_IMAGE=${expected_runtime_image}" \
  --tag "$image_ref" \
  .

container_id="$(docker create "$image_ref")"
docker cp "${container_id}:/ui" "${tmpdir}/ui" >/dev/null

if ! grep -R -F "$expected_runtime_image" "${tmpdir}/ui" >/dev/null 2>&1; then
  echo "Release bundle verification failed: ${image_ref} does not contain ${expected_runtime_image}" >&2
  echo "Next step: confirm the Docker build arg is wired through the UI build and extension image." >&2
  exit 1
fi

cat <<EOF
Release bundle verification passed:
  extension image: ${image_ref}
  bundled runtime default: ${expected_runtime_image}

Next maintainer steps:
  make publish-release RELEASE_TAG=${release_tag}
  make verify-release-tag RELEASE_TAG=${release_tag}
EOF
