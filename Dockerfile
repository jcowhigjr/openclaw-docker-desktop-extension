FROM --platform=$BUILDPLATFORM node:24-alpine AS client-builder
ARG VITE_DEFAULT_RUNTIME_IMAGE=openclaw-docker-extension-runtime:dev
WORKDIR /ui
COPY ui/package.json /ui/package.json
COPY ui/package-lock.json /ui/package-lock.json
RUN npm ci
COPY ui /ui
ENV VITE_DEFAULT_RUNTIME_IMAGE=${VITE_DEFAULT_RUNTIME_IMAGE}
RUN npm run build

FROM alpine:3.20
LABEL org.opencontainers.image.title="Shellharbor for OpenClaw" \
    org.opencontainers.image.description="Run OpenClaw on your Mac in one click — isolated, localhost-only, managed from Docker Desktop." \
    org.opencontainers.image.vendor="jcowhigjr/openclaw-docker-desktop-extension" \
    org.opencontainers.image.source="https://github.com/jcowhigjr/openclaw-docker-desktop-extension" \
    org.opencontainers.image.licenses="Apache-2.0" \
    com.docker.desktop.extension.api.version="0.4.2" \
    com.docker.desktop.extension.icon="https://raw.githubusercontent.com/jcowhigjr/openclaw-docker-desktop-extension/main/icon.svg" \
    com.docker.extension.categories="utility-tools" \
    com.docker.extension.publisher-url="https://github.com/jcowhigjr/openclaw-docker-desktop-extension" \
    com.docker.extension.detailed-description="Shellharbor is the one-click way to run OpenClaw on macOS. It starts, isolates, and manages OpenClaw in a hardened, localhost-only container from Docker Desktop — with token bootstrap, host Ollama setup, execution-mode controls, and clear cleanup boundaries. Community packaging, not an official OpenClaw or Docker product." \
    com.docker.extension.changelog="Improves Docker Desktop submission metadata and release image compatibility for validator checks." \
    com.docker.extension.screenshots="[{\"alt\":\"OpenClaw extension dashboard\",\"url\":\"https://raw.githubusercontent.com/jcowhigjr/openclaw-docker-desktop-extension/main/docs/assets/openclaw-extension-dashboard.png\"}]" \
    com.docker.extension.additional-urls="[{\"title\":\"Documentation\",\"url\":\"https://github.com/jcowhigjr/openclaw-docker-desktop-extension#readme\"},{\"title\":\"Submission readiness\",\"url\":\"https://github.com/jcowhigjr/openclaw-docker-desktop-extension/blob/main/docs/submission-readiness.md\"},{\"title\":\"Issues\",\"url\":\"https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues\"}]"

COPY docker-compose.yaml .
COPY metadata.json .
COPY icon.svg .
COPY --from=client-builder /ui/build ui
