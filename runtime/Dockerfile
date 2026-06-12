FROM ghcr.io/openclaw/openclaw:latest

LABEL org.opencontainers.image.title="Shellharbor for OpenClaw Runtime" \
    org.opencontainers.image.description="Shellharbor runtime bridge for running OpenClaw from Docker Desktop over localhost." \
    org.opencontainers.image.vendor="jcowhigjr/openclaw-docker-desktop-extension" \
    org.opencontainers.image.source="https://github.com/jcowhigjr/openclaw-docker-desktop-extension" \
    org.opencontainers.image.licenses="MIT AND Apache-2.0"

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends socat \
    && rm -rf /var/lib/apt/lists/*

COPY openclaw-bridge.sh /usr/local/bin/openclaw-bridge.sh
COPY openclaw-extension-helper.js /usr/local/bin/openclaw-extension-helper.js
RUN chmod 755 /usr/local/bin/openclaw-bridge.sh /usr/local/bin/openclaw-extension-helper.js

USER node

ENTRYPOINT ["sh", "/usr/local/bin/openclaw-bridge.sh"]
