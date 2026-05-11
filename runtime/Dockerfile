FROM ghcr.io/openclaw/openclaw:latest

LABEL org.opencontainers.image.title="OpenClaw Docker Desktop Extension Runtime" \
    org.opencontainers.image.description="OpenClaw runtime wrapper with a localhost bridge for the Docker Desktop extension." \
    org.opencontainers.image.vendor="jcowhigjr/openclaw-docker-desktop-extension" \
    org.opencontainers.image.source="https://github.com/jcowhigjr/openclaw-docker-desktop-extension" \
    org.opencontainers.image.licenses="MIT"

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends socat \
    && rm -rf /var/lib/apt/lists/*

COPY openclaw-bridge.sh /usr/local/bin/openclaw-bridge.sh
RUN chmod 755 /usr/local/bin/openclaw-bridge.sh

USER node

ENTRYPOINT ["sh", "/usr/local/bin/openclaw-bridge.sh"]
