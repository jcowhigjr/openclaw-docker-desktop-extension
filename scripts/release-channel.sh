#!/bin/sh

set -eu

release_tag="${1:-${RELEASE_TAG:-}}"
event_name="${2:-${GITHUB_EVENT_NAME:-${EVENT_NAME:-}}}"
promote_channel="${3:-${PROMOTE_CHANNEL:-0}}"

if [ -z "$release_tag" ]; then
  echo "RELEASE_TAG is required, for example: ./scripts/release-channel.sh v0.1.0 push" >&2
  exit 1
fi

if [ -z "$event_name" ]; then
  echo "event name is required, for example: ./scripts/release-channel.sh v0.1.0 push" >&2
  exit 1
fi

case "$promote_channel" in
  1|true|TRUE|yes|YES)
    promote_channel=1
    ;;
  *)
    promote_channel=0
    ;;
esac

channel_tag=""
has_channel_tag=false

if [ "$event_name" != "workflow_dispatch" ] || [ "$promote_channel" = "1" ]; then
  case "$release_tag" in
    *-alpha|*-alpha.*|*-beta|*-beta.*|*-rc|*-rc.*)
      channel_tag="beta"
      ;;
    *)
      channel_tag="stable"
      ;;
  esac
  has_channel_tag=true
fi

cat <<EOF
release_tag=${release_tag}
channel_tag=${channel_tag}
has_channel_tag=${has_channel_tag}
EOF
