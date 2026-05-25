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
3. Confirm the \`Quick Start\` card lists the expected four-step flow.
4. Click \`Check Requirements\`.
5. Click \`Start\`.
6. Wait for \`OpenClaw is ready\`.
7. Confirm the \`Gateway Token\` field fills automatically, shows \`Auto-attached\`, and uses success styling. If it remains blank, click \`Refresh Token\` once and record the result.
8. Click \`Open Control UI\`.
9. Confirm the Control UI opens on localhost without manual token editing.
10. Confirm update status does not flicker or repeatedly switch after startup while the extension is idle.
11. If testing the local-model path, confirm host Ollama is already running with a model pulled, then reopen or refresh the extension.
12. Confirm \`Local Model Setup\` detects installed host Ollama models automatically or after clicking \`Detect Ollama Models\`.
13. If no Ollama model is configured yet, confirm the setup banner appears, click \`Select Recommended Model\`, then click \`Apply and Restart\`.
14. Reopen the extension and confirm the Ollama setup banner stays dismissed only after using its dismiss control.
15. Finish one basic chat prompt in the Control UI.

## Artifacts

- \`environment.txt\`
- \`verify-release-channel.txt\`
- \`verify-channel-install-dry-run.txt\`
- \`docker-extension-ls.txt\`
- \`docker-extension-inspect.txt\`
- \`docker-ps-a.txt\`
- \`docker-image-ls.txt\`
- \`openclaw-service-inspect.txt\`
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
| Quick Start onboarding | TODO | |
| Gateway token auto-attached UX | TODO | |
| Control UI bootstrap from extension button | TODO | |
| Runtime update status stability | TODO | |
| Local-model flow (if used) | TODO | |
| Ollama setup banner persistence (if used) | TODO | |

## Findings

1. _Add findings, regressions, or blockers here._

## Recommendation

_State whether this smoke pass blocks release or Marketplace submission._
EOF

cat >"$capture_script" <<EOF
#!/bin/sh
set -eu

# Capture smoke-test CLI artifacts into this packet directory.
# Keep gathering evidence even when one command fails.
report_dir="\$(CDPATH= cd -- "\$(dirname "\$0")" && pwd)"
repo_root="${repo_root}"
release_channel="${release_channel}"
release_tag="${release_tag}"

capture_cmd() {
  output_file="\$1"
  shift

  if "\$@" >"\${report_dir}/\${output_file}" 2>&1; then
    return 0
  fi

  status="\$?"
  {
    printf 'capture failed with exit %s\\n' "\$status"
    printf 'command:'
    for arg in "\$@"; do
      printf ' %s' "\$arg"
    done
    printf '\\n\\n'
    cat "\${report_dir}/\${output_file}"
  } >"\${report_dir}/\${output_file}.tmp"
  mv "\${report_dir}/\${output_file}.tmp" "\${report_dir}/\${output_file}"
}

capture_environment() {
  output_file="\${report_dir}/environment.txt"

  {
    printf 'captured_at=%s\n' "\$(date -u +%FT%TZ)"
    printf 'repo_root=%s\n' "\$repo_root"
    printf 'release_channel=%s\n' "\$release_channel"
    printf 'release_tag=%s\n' "\${release_tag:-}"
    printf '\n[sw_vers]\n'
    sw_vers
    printf '\n[uname]\n'
    uname -a
    printf '\n[docker version]\n'
    docker version
  } >"\$output_file" 2>&1 || {
    status="\$?"
    {
      printf 'capture failed with exit %s\n' "\$status"
      printf 'command: capture_environment\n\n'
      cat "\$output_file"
    } >"\${output_file}.tmp"
    mv "\${output_file}.tmp" "\$output_file"
  }
}

capture_environment

if [ -n "\$release_tag" ]; then
  capture_cmd verify-release-channel.txt make -C "\$repo_root" verify-release-channel RELEASE_CHANNEL="\$release_channel" EXPECTED_RELEASE_TAG="\$release_tag"
  capture_cmd verify-channel-install-dry-run.txt make -C "\$repo_root" verify-channel-install RELEASE_CHANNEL="\$release_channel" EXPECTED_RELEASE_TAG="\$release_tag" DRY_RUN=1
else
  capture_cmd verify-release-channel.txt make -C "\$repo_root" verify-release-channel RELEASE_CHANNEL="\$release_channel"
  capture_cmd verify-channel-install-dry-run.txt make -C "\$repo_root" verify-channel-install RELEASE_CHANNEL="\$release_channel" DRY_RUN=1
fi

capture_cmd docker-extension-ls.txt docker extension ls
capture_cmd docker-extension-inspect.txt docker extension inspect openclaw-docker-extension
capture_cmd docker-ps-a.txt docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
capture_cmd docker-image-ls.txt docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}\t{{.Size}}'
capture_cmd openclaw-service-inspect.txt docker inspect openclaw-docker-extension-service
capture_cmd openclaw-service.log docker logs openclaw-docker-extension-service
capture_cmd control-ui-healthz.txt curl -fsS http://127.0.0.1:18789/healthz
EOF

chmod +x "$capture_script"

for artifact in environment.txt verify-release-channel.txt verify-channel-install-dry-run.txt docker-extension-ls.txt docker-extension-inspect.txt docker-ps-a.txt docker-image-ls.txt openclaw-service-inspect.txt openclaw-service.log control-ui-healthz.txt; do
  : >"${report_dir}/${artifact}"
done

printf '%s\n' "$report_file"
