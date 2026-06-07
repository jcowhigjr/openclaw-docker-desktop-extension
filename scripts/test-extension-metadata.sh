#!/bin/sh

set -eu

dockerfile="${1:-Dockerfile}"
workflow="${2:-.github/workflows/publish.yml}"
runtime_workflow="${3:-.github/workflows/publish-runtime.yml}"

require_file_contains() {
  file="$1"
  pattern="$2"
  description="$3"

  if ! grep -Fq "$pattern" "$file"; then
    echo "missing ${description}: ${pattern}" >&2
    return 1
  fi
}

require_file_contains "$dockerfile" 'org.opencontainers.image.title="Shellharbor for OpenClaw"' "validator-safe OCI title"
require_file_contains "$dockerfile" 'org.opencontainers.image.licenses="Apache-2.0"' "repo license label"
require_file_contains "$dockerfile" 'com.docker.desktop.extension.icon="https://raw.githubusercontent.com/jcowhigjr/openclaw-docker-desktop-extension/main/icon.svg"' "repo-owned icon URL"
require_file_contains "$dockerfile" 'com.docker.extension.publisher-url="https://github.com/jcowhigjr/openclaw-docker-desktop-extension"' "publisher URL label"
require_file_contains "$dockerfile" 'com.docker.extension.detailed-description=' "detailed description label"
require_file_contains "$dockerfile" 'com.docker.extension.changelog=' "changelog label"
require_file_contains "$dockerfile" 'com.docker.extension.screenshots=' "screenshots label"
require_file_contains "$dockerfile" 'com.docker.extension.categories="utility-tools"' "Docker Marketplace category label"

require_file_contains "$workflow" 'RELEASE_VERSION=${release_tag#v}' "semver alias derivation"
require_file_contains "$workflow" 'org.opencontainers.image.title=Shellharbor for OpenClaw' "published validator-safe OCI title override"
require_file_contains "$workflow" 'DOCKERHUB_EXTENSION_IMAGE_NAME: jcowhigjr/openclaw-docker-desktop-extension' "Docker Hub extension image target"
require_file_contains "$workflow" 'username: ${{ secrets.DOCKERHUB_USERNAME }}' "Docker Hub login username secret"
require_file_contains "$workflow" 'password: ${{ secrets.DOCKERHUB_TOKEN }}' "Docker Hub login token secret"
require_file_contains "$workflow" 'type=raw,value=${{ env.RELEASE_VERSION }}' "semver image tag alias"
require_file_contains "$workflow" 'platforms: linux/arm64,linux/amd64' "multi-platform release build"
require_file_contains "$workflow" 'VITE_DEFAULT_RUNTIME_IMAGE=${{ env.REGISTRY }}/${{ env.RUNTIME_IMAGE_NAME }}:${{ env.RELEASE_VERSION }}' "semver runtime default"
require_file_contains "$runtime_workflow" 'openclaw-docker-desktop-extension-runtime' "canonical scheduled runtime image target"
require_file_contains "$runtime_workflow" 'openclaw-docker-extension-runtime' "legacy scheduled runtime alias"
require_file_contains "$runtime_workflow" '${{ env.LEGACY_RUNTIME_IMAGE }}' "legacy scheduled runtime metadata image"

echo "extension metadata checks passed"
