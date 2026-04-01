# OpenClaw Docker Desktop Extension

Docker Desktop extension for running OpenClaw with a macOS-safe `socat` bridge.

## What it does

- Starts an OpenClaw container from Docker Desktop
- Wraps the container with an internal `socat` bridge so the Control UI works on macOS
- Persists the generated gateway token in a named Docker volume
- Lets you start, stop, restart, and open the Control UI without using the CLI

## Default runtime

- Image: `openclaw-docker-extension-runtime:dev`
- Host port: `18789`
- Published port inside wrapper: `18790`
- Volume: `openclaw-docker-extension-home`

## Build and install

```bash
cd /Users/temp/workspace/openclaw-docker-extension
cd ui && npm install && cd ..
docker build -t openclaw-docker-extension-runtime:dev -f runtime/Dockerfile runtime
make install-dev
```

## Notes

This extension intentionally uses a wrapper launch command instead of the stock
`docker run` path because OpenClaw listens on loopback inside the container and
Docker Desktop on macOS may not forward that listener correctly. The wrapper
adds `socat` inside a small runtime image and publishes a bridged port that
behaves like a normal host-facing service.
