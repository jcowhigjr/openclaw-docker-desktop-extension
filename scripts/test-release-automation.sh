#!/bin/sh
# SPDX-License-Identifier: Apache-2.0

set -eu

workflow=".github/workflows/release-please.yml"
publish_workflow=".github/workflows/publish.yml"

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
import re

with open("release-please-config.json", encoding="utf-8") as handle:
    config = json.load(handle)
with open(".release-please-manifest.json", encoding="utf-8") as handle:
    manifest = json.load(handle)

assert config["release-type"] == "simple"
assert config["include-v-in-tag"] is True
assert config.get("include-component-in-tag") is False
assert config["draft"] is True
assert config["force-tag-creation"] is True
assert config["packages"]["."]["package-name"] == "openclaw-docker-desktop-extension"
assert "docs/**" in config["packages"]["."]["exclude-paths"]
assert "openspec/**" in config["packages"]["."]["exclude-paths"]
# Manifest version advances on each release-please PR; only require a sane semver.
version = manifest["."]
assert isinstance(version, str) and re.fullmatch(r"\d+\.\d+\.\d+", version), version
PY

require_file_contains "$workflow" "googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7 # v5.0.0" "pinned release-please action"
require_file_contains "$workflow" 'RELEASE_PLEASE_TOKEN: ${{ secrets.RELEASE_PLEASE_TOKEN }}' "release automation token preflight"
require_file_contains "$workflow" "needs.release-please.outputs.release_created == 'true'" "release-created publish gate"
require_file_contains "$workflow" "uses: ./.github/workflows/publish.yml" "single reusable production publisher"
require_file_contains "$workflow" "promote_channel: true" "automated stable/beta promotion"

require_file_contains "$publish_workflow" "workflow_call:" "reusable publish contract"
require_file_contains "$publish_workflow" "release_tag:" "workflow_call release_tag input"
require_file_contains "$publish_workflow" "promote_channel:" "workflow_call promote_channel input"
require_file_contains "$publish_workflow" 'if [ -n "${INPUT_RELEASE_TAG}" ]; then' "prefer explicit release_tag input over parent event ref"
require_file_contains "$publish_workflow" 'type=raw,value=${{ env.RELEASE_VERSION }}' "immutable semver tag"
require_file_contains "$publish_workflow" "VITE_DEFAULT_RUNTIME_IMAGE=" "extension defaults to matching runtime version"
require_file_contains "$workflow" "Normalize release tag to v*" "normalize component tags to v*"

# Channel promotion must remain opt-in for manual repair (workflow_dispatch without promote).
require_file_contains "scripts/release-channel.sh" 'event_name" = "push"' "push events promote channels by default"
require_file_contains "scripts/release-channel.sh" "promote_channel" "explicit promote still supported"

echo "release automation checks passed"
