#!/bin/sh

set -eu

dockerfile="${1:-Dockerfile}"
workflow="${2:-.github/workflows/publish.yml}"

require_file_contains() {
  file="$1"
  pattern="$2"
  description="$3"

  if ! grep -Fq "$pattern" "$file"; then
    echo "missing ${description}: ${pattern}" >&2
    return 1
  fi
}

require_file_contains "$dockerfile" 'org.opencontainers.image.title="OpenClaw"' "validator-safe OCI title"
require_file_contains "$dockerfile" 'org.opencontainers.image.licenses="Apache-2.0"' "repo license label"
require_file_contains "$dockerfile" 'com.docker.desktop.extension.icon="https://raw.githubusercontent.com/jcowhigjr/openclaw-docker-desktop-extension/main/openclaw.svg"' "repo-owned icon URL"
require_file_contains "$dockerfile" 'com.docker.extension.publisher-url="https://github.com/jcowhigjr/openclaw-docker-desktop-extension"' "publisher URL label"
require_file_contains "$dockerfile" 'com.docker.extension.detailed-description=' "detailed description label"
require_file_contains "$dockerfile" 'com.docker.extension.changelog=' "changelog label"
require_file_contains "$dockerfile" 'com.docker.extension.screenshots=' "screenshots label"

require_file_contains "$workflow" 'RELEASE_VERSION=${release_tag#v}' "semver alias derivation"
require_file_contains "$workflow" 'org.opencontainers.image.title=OpenClaw' "published validator-safe OCI title override"
require_file_contains "$workflow" 'type=raw,value=${{ env.RELEASE_VERSION }}' "semver image tag alias"
require_file_contains "$workflow" 'platforms: linux/arm64,linux/amd64' "multi-platform release build"
require_file_contains "$workflow" 'VITE_DEFAULT_RUNTIME_IMAGE=${{ env.REGISTRY }}/${{ env.RUNTIME_IMAGE_NAME }}:${{ env.RELEASE_VERSION }}' "semver runtime default"

echo "extension metadata checks passed"
