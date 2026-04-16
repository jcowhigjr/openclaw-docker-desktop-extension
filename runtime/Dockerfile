FROM ghcr.io/openclaw/openclaw:latest

USER root

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends socat \
    && rm -rf /var/lib/apt/lists/*

COPY openclaw-bridge.sh /usr/local/bin/openclaw-bridge.sh
RUN chmod 755 /usr/local/bin/openclaw-bridge.sh

USER node

ENTRYPOINT ["sh", "/usr/local/bin/openclaw-bridge.sh"]
