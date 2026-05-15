#!/usr/bin/env bash
set -euo pipefail

port="${SCREENSHOT_PORT:-4173}"
url="${SCREENSHOT_URL:-http://127.0.0.1:${port}/?demo=1}"
path="${SCREENSHOT_PATH:-docs/assets/openclaw-extension-dashboard.png}"
tmp_dir="${TMPDIR:-/tmp}"
log_file="${tmp_dir%/}/openclaw-vite-preview-${port}.log"
pid_file="${tmp_dir%/}/openclaw-vite-preview-${port}.pid"

cleanup() {
  if [[ -f "$pid_file" ]]; then
    local pid
    pid="$(cat "$pid_file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid"
      wait "$pid" 2>/dev/null || true
    fi
    rm -f "$pid_file"
  fi
}

trap cleanup EXIT

npm --prefix ui run build

(cd ui && npm exec vite preview -- --host 127.0.0.1 --port "$port" --strictPort) >"$log_file" 2>&1 &
echo "$!" >"$pid_file"

for _ in {1..30}; do
  if curl -fsS "http://127.0.0.1:${port}" >/dev/null 2>&1; then
    npx --yes playwright screenshot \
      --device="Desktop Chrome" \
      --color-scheme=light \
      --wait-for-selector="text=OpenClaw Extension" \
      --wait-for-timeout=1000 \
      "$url" \
      "$path"
    exit 0
  fi

  if ! kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    cat "$log_file" >&2
    exit 1
  fi

  sleep 1
done

cat "$log_file" >&2
echo "Timed out waiting for Vite preview on port ${port}" >&2
exit 1
