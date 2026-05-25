#!/bin/sh
# Verify that the built runtime Docker image contains the helper script.
# This catches the case where runtime/ content was changed but the image
# was never rebuilt after merging (the gap that caused v0.3.4 to ship
# without openclaw-extension-helper.js).
set -eu

image="${RUNTIME_IMAGE:-openclaw-docker-extension-runtime}:${RUNTIME_TAG:-dev}"

if ! docker image inspect "$image" >/dev/null 2>&1; then
  echo "runtime image $image not found locally; building it now..." >&2
  make build-runtime
fi

if ! docker run --rm --entrypoint /bin/sh "$image" \
  -c 'test -f /usr/local/bin/openclaw-extension-helper.js'; then
  echo "FAIL: $image is missing /usr/local/bin/openclaw-extension-helper.js" >&2
  exit 1
fi

if ! docker run --rm --entrypoint /bin/sh "$image" \
  -c 'test -f /usr/local/bin/openclaw-bridge.sh'; then
  echo "FAIL: $image is missing /usr/local/bin/openclaw-bridge.sh" >&2
  exit 1
fi

echo "runtime image helper checks passed"
