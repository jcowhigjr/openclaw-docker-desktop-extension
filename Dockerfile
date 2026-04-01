FROM node:24-alpine AS client-builder
WORKDIR /ui
COPY ui/package.json /ui/package.json
COPY ui/package-lock.json /ui/package-lock.json
RUN npm ci
COPY ui /ui
RUN npm run build

FROM alpine:3.20
LABEL org.opencontainers.image.title="OpenClaw for Docker Desktop" \
    org.opencontainers.image.description="Run OpenClaw from Docker Desktop with a macOS-safe port bridge and one-click controls." \
    org.opencontainers.image.vendor="OpenAI Codex" \
    com.docker.desktop.extension.api.version="0.4.2" \
    com.docker.desktop.extension.icon="https://raw.githubusercontent.com/openclaw/openclaw/main/docs/static/icon.png" \
    com.docker.extension.categories="ai,developer-tools"

COPY docker-compose.yaml .
COPY metadata.json .
COPY openclaw.svg .
COPY --from=client-builder /ui/build ui
