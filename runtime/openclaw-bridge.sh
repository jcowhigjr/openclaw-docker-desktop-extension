#!/bin/sh
set -eu

docker-entrypoint.sh node openclaw.mjs gateway --allow-unconfigured >/tmp/openclaw.log 2>&1 &

exec socat TCP-LISTEN:18790,bind=0.0.0.0,reuseaddr,fork TCP:127.0.0.1:18789
