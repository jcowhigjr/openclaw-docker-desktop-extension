# User operations (non-obvious Docker Desktop controls)

These controls look ordinary in Docker Desktop but are easy to misread.

---

## 1. How OpenClaw updates

Each extension release pins the OpenClaw runtime image it was built and tested
with. **Settings → OpenClaw Runtime** shows that image read-only. There is no
separate runtime update control and no way to point the extension at another
runtime image
([#249](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/249)).

To update OpenClaw, update the extension. The next time the extension opens (or
when you click **Start**), it finds the service running the previous release's
image and recreates it from the new one:

1. The old service container is removed. The `openclaw-docker-extension-home`
   volume, which holds your config, sessions, and workspace, is kept.
2. A new container starts from the pinned image. Before the gateway starts, the
   runtime runs `openclaw doctor --fix --non-interactive`, which applies
   OpenClaw's own migrations to the kept volume.

Plain **Restart** restarts the existing container in place.

If the service was killed rather than stopped (a Docker Desktop crash, or
`docker rm -f` by hand), the next start can fail with
`Another Gateway owner lease is still active for this state directory`. The
killed gateway never released its lease on the data volume, and it expires on
its own within 5 minutes. Wait, then click **Start** again. The extension itself
always stops the service before removing or recreating it, so this only follows
an outside kill.

Before trying a release you are unsure about, snapshot the volume:

```bash
docker stop openclaw-docker-extension-service
docker run --rm -v openclaw-docker-extension-home:/home/node:ro -v "$HOME/openclaw-backups:/b" \
  --entrypoint sh ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:<tag> \
  -c 'tar -czf /b/openclaw-home-$(date +%Y%m%d-%H%M%S).tar.gz -C /home/node .'
```

---

## 2. Manage extensions → **Share**

On **Extensions → Manage**, this install often shows **UNPUBLISHED** and an
image such as:

`ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable`

**Share** is still offered in the overflow menu. For GHCR-backed installs it
fails.

Reproduced with the Docker Extensions CLI:

```text
$ docker extension share ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable
could not generate url to share: sharing extensions that are not hosted in DockerHub is not yet supported
```

### Bug or working as designed?

| Layer | Verdict |
| --- | --- |
| Docker Desktop platform | **Working as designed today:** share URLs require a **Docker Hub**–hosted extension image. See Docker’s [Share your extension](https://docs.docker.com/extensions/extensions-sdk/extensions/share/) docs. |
| This project’s UX | **Still a product problem:** we install and document **GHCR** paths, Desktop still shows **Share**, and there is no in-product explanation. Users reasonably conclude the extension is broken. Tracked under [#225](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/225). |

**What to do instead of Share**

- Point people at the documented install commands in the README (`docker extension install ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:…` or the `make install-channel` / `make install-release` helpers).
- For a Hub-style share link, the extension image must be installed from a **Docker Hub** tag that Desktop can share; GHCR-only installs cannot use this control until Docker supports non-Hub share or we document a Hub-only distribution path for that purpose.

Uninstall from the same Manage menu is separate and still works for removing the extension.

---

## 3. Two installs of the same extension

Installing a second tag of the extension (for example a local `:dev` build next
to a release) shows two **Shellharbor** tabs that manage the same service
container. `docker extension uninstall <image>:<tag>` does not reliably remove the
tag you name when two tags of the same image are installed. Remove the unwanted
one from **Extensions → Manage** in Docker Desktop instead.

---

## 4. Related reading

- [Preflight checklist](preflight-checklist.md) — Docker engine and Ollama before blaming the extension
- [Local model diagnostics](local-model-diagnostics.md) — agent-turn failures after the runtime is healthy
- [Local model tuning](local-model-tuning.md) — context, thinking, hardware profiles
