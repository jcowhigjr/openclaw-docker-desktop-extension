#!/bin/sh

set -eu

workflow=".github/workflows/release-please.yml"
publish_workflow=".github/workflows/publish.yml"
runtime_workflow=".github/workflows/publish-runtime.yml"

require_file_contains() {
  file="$1"
  pattern="$2"
  description="$3"

  if ! grep -Fq -- "$pattern" "$file"; then
    echo "missing ${description}: ${pattern}" >&2
    return 1
  fi
}

python3 - <<'PY'
import json

with open("release-please-config.json", encoding="utf-8") as handle:
    config = json.load(handle)
with open(".release-please-manifest.json", encoding="utf-8") as handle:
    manifest = json.load(handle)

assert config["release-type"] == "simple"
assert config["include-v-in-tag"] is True
assert config["draft"] is True
assert config["force-tag-creation"] is True
assert config["packages"]["."]["package-name"] == "openclaw-docker-desktop-extension"
assert "docs/**" in config["packages"]["."]["exclude-paths"]
assert manifest["."] == "0.3.6"
PY

require_file_contains "$workflow" "googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0" "pinned release-please action"
require_file_contains "$workflow" 'RELEASE_PLEASE_TOKEN: ${{ secrets.RELEASE_PLEASE_TOKEN }}' "release automation token preflight"
require_file_contains "$workflow" "needs.release-please.outputs.release_created == 'true'" "release-created publish gate"
require_file_contains "$workflow" "uses: ./.github/workflows/publish.yml" "single reusable production publisher"
require_file_contains "$workflow" "promote_channel: true" "automated stable/beta promotion"

require_file_contains "$publish_workflow" "workflow_call:" "reusable publish contract"
require_file_contains "$publish_workflow" "group: openclaw-published-channels" "serialized channel promotion"
require_file_contains "$publish_workflow" 'type=raw,value=${{ env.RELEASE_VERSION }}' "immutable semver tag"
require_file_contains "$publish_workflow" '--tag "${REGISTRY}/${EXTENSION_IMAGE_NAME}:${CHANNEL_TAG}"' "GHCR channel promotion"
require_file_contains "$publish_workflow" '--tag "${DOCKERHUB_EXTENSION_IMAGE_NAME}:${CHANNEL_TAG}"' "Docker Hub channel promotion"
require_file_contains "$runtime_workflow" '--tag "${RUNTIME_IMAGE}:stable"' "scheduled stable runtime promotion"

if grep -Fq 'type=raw,value=${{ steps.release-context.outputs.channel_tag }}' "$publish_workflow"; then
  echo "floating channels must not be pushed before release scans pass" >&2
  exit 1
fi

echo "release automation checks passed"
