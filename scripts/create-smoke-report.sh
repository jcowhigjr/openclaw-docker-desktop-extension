#!/bin/sh
set -eu

repo_root="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
report_date="${REPORT_DATE:-$(date +%F)}"
release_channel="${RELEASE_CHANNEL:-stable}"
release_tag="${RELEASE_TAG:-}"
report_slug="${REPORT_SLUG:-${release_channel}-channel-smoke}"
report_dir="${REPORT_DIR:-${repo_root}/docs/exploratory/${report_date}-${report_slug}}"
report_file="${report_dir}/report.md"
capture_script="${report_dir}/capture-artifacts.sh"

if [ -e "$report_file" ]; then
  echo "Smoke report already exists: ${report_file}" >&2
  echo "Next step: set REPORT_DIR or REPORT_DATE to create a new packet." >&2
  exit 1
fi

mkdir -p "$report_dir"

branch_name="$(git -C "$repo_root" branch --show-current)"
commit_short="$(git -C "$repo_root" rev-parse --short HEAD)"
if [ -n "$release_tag" ]; then
  release_reference="Release tag under test: \`${release_tag}\`"
else
  release_reference="Release tag under test: _fill in after selecting the target release_"
fi

cat >"$report_file" <<EOF
# ${release_channel} Channel Smoke Test - ${report_date}

## Environment

- Repo branch: \`${branch_name}\`
- Base commit under test: \`${commit_short}\`
- ${release_reference}
- Channel under test: \`${release_channel}\`
- Extension install under test: \`ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:${release_channel}\`
- Runtime image under test: \`ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:${release_channel}\`
- Docker Desktop version: _fill in_
- macOS version / chip: _fill in_
- Host Ollama status: _fill in if used_

## Preflight

1. \`make verify-release-channel RELEASE_CHANNEL=${release_channel}${release_tag:+ EXPECTED_RELEASE_TAG=${release_tag}}\`
2. \`make verify-channel-install RELEASE_CHANNEL=${release_channel}${release_tag:+ EXPECTED_RELEASE_TAG=${release_tag}}\`
3. \`docker extension ls\`
4. \`docker ps -a --format 'table {{.Names}}\\t{{.Image}}\\t{{.Status}}\\t{{.Ports}}'\`

## Manual Flow

1. Install the channel image in Docker Desktop if it is not already installed.
2. Open the \`OpenClaw\` extension.
3. Click \`Check Requirements\`.
4. Click \`Start\`.
5. Wait for \`OpenClaw is ready\`.
6. Click \`Open Control UI\`.
7. Confirm the Control UI opens on localhost without manual token editing.
8. If testing the local-model path, confirm host Ollama is already running with a model pulled, then finish one chat prompt through \`Local Model Setup\`.

## Artifacts

- \`docker-extension-ls.txt\`
- \`docker-ps-a.txt\`
- \`openclaw-service.log\`
- \`control-ui-healthz.txt\`
- \`control-ui.png\`
- \`extension-ui.png\` or note why Docker Desktop UI capture was blocked

## Results

| Flow | Result | Evidence |
| --- | --- | --- |
| Channel preflight | TODO | |
| Extension registered in Docker Desktop | TODO | |
| Runtime container running | TODO | |
| Localhost exposure | TODO | |
| Control UI bootstrap from extension button | TODO | |
| Local-model flow (if used) | TODO | |

## Findings

1. _Add findings, regressions, or blockers here._

## Recommendation

_State whether this smoke pass blocks release or Marketplace submission._
EOF

cat >"$capture_script" <<EOF
#!/bin/sh
set -eu

# Capture smoke-test CLI artifacts into this packet directory.
report_dir="\$(CDPATH= cd -- "\$(dirname "\$0")" && pwd)"

docker extension ls >"\${report_dir}/docker-extension-ls.txt"
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' >"\${report_dir}/docker-ps-a.txt"
docker logs openclaw-docker-extension-service >"\${report_dir}/openclaw-service.log" 2>&1
curl -fsS http://127.0.0.1:18789/healthz >"\${report_dir}/control-ui-healthz.txt"
EOF

chmod +x "$capture_script"

for artifact in docker-extension-ls.txt docker-ps-a.txt openclaw-service.log control-ui-healthz.txt; do
  : >"${report_dir}/${artifact}"
done

printf '%s\n' "$report_file"
