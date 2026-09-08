# User operations (non-obvious Docker Desktop controls)

These controls look ordinary in Docker Desktop but are easy to misread.
Follow this page when a local OpenClaw install is already healthy and you need
to keep it that way, or when **Share** appears to do nothing.

Related product issues: image-setting persistence and the downgrade banner are
tracked under
[#220](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/220).
Broader UX follow-up (banner copy, Share, local-tag rewrite) is tracked under
[#225](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/225).

---

## 1. OpenClaw Image vs the running container

**Settings → OpenClaw Image** is the image used the next time the extension
**creates** a container (`Start` when none exists, or **Update and Restart**).
It is **not** a live readout of the image your healthy container is already
using.

It is normal for a maintainer or recovery install to show something like:

| Surface | Example |
| --- | --- |
| Running container (Docker) | `openclaw-docker-extension-runtime:dev` (newer OpenClaw) |
| Settings → OpenClaw Image | `ghcr.io/jcowhigjr/openclaw-docker-desktop-extension-runtime:0.3.6` |

Those can differ. Treat Settings as “what recreate would use,” not “what is
running now.”

### Do not click **Update and Restart** in that situation

**Update and Restart**:

1. Removes the existing OpenClaw service container.
2. Starts a new one from **whatever is in Settings → OpenClaw Image**.

If Settings still points at an older GHCR tag while the running container is a
newer local image, the button is a **downgrade**, not an upgrade.

The blue banner that says a “new” runtime image is available for the configured
GHCR ref is **misleading** when the running image is already newer. The
extension compares “running container id” to “id of the configured tag after
`docker pull`.” Different does **not** mean newer.

Plain **Restart** only restarts the existing container and keeps its current
image. Prefer that for normal bounce.

### Why saving `:dev` often fails

On load, the extension rewrites some stored image names back to the built-in
default GHCR image. In particular, saving:

- `openclaw-docker-extension-runtime:dev`
- `ghcr.io/jcowhigjr/openclaw-docker-extension-runtime:latest`

…is not durable across reload. That is intentional migration code in the UI,
not only Docker Desktop storage flakiness.

### Durable local pin (verified workaround)

When the healthy runtime is a local `…:dev` image and Settings still show an
old GHCR pin:

1. Tag a stable local name (does not touch the running container):

   ```bash
   docker tag openclaw-docker-extension-runtime:dev openclaw-docker-extension-runtime:working
   ```

2. In the extension: **Settings → OpenClaw Image** → set:

   `openclaw-docker-extension-runtime:working`

3. Click **Save Settings**.

4. **Do not** click **Update and Restart**.

5. Reload the extension UI and confirm:

   - the field still shows `…:working`
   - the blue GHCR update banner is gone

Non-`ghcr.io/` image names skip the extension’s pull-based update check, so the
downgrade banner should clear once the setting sticks.

**Do not** try to “protect” a good image by retagging it onto the GHCR
`…:0.3.6` name. The update-check path runs `docker pull` on configured
`ghcr.io/…` refs and **overwrites** that local retag with the registry image.

If the field flips back to GHCR even with `:working`, keep avoiding **Update
and Restart**, keep a volume snapshot if you have one, and treat that as the
persistence bug in #220.

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
| This project’s UX | **Still a product problem:** we install and document **GHCR** paths, Desktop still shows **Share**, and there is no in-product explanation. Users reasonably conclude the extension is broken. |

**What to do instead of Share**

- Point people at the documented install commands in the README (`docker extension install ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:…` or the `make install-channel` / `make install-release` helpers).
- For a Hub-style share link, the extension image must be installed from a **Docker Hub** tag that Desktop can share; GHCR-only installs cannot use this control until Docker supports non-Hub share or we document a Hub-only distribution path for that purpose.

Uninstall from the same Manage menu is separate and still works for removing the extension.

---

## 3. Quick “keep my working install” checklist

- [ ] Confirm the service container image with `docker ps` (expect local `…:dev` or `…:working` when recovering).
- [ ] Set Settings → OpenClaw Image to a **non-GHCR** local tag that is not rewritten on load (`…:working`).
- [ ] **Save Settings**; reload; confirm the value stuck.
- [ ] Never use **Update and Restart** to “apply” a safer Settings value while a newer local runtime is already running.
- [ ] Ignore **Share** on GHCR/unpublished installs; use README install URLs instead.
- [ ] Snapshot the OpenClaw volume before any intentional recreate or upgrade experiment.

---

## 4. Related reading

- [Preflight checklist](preflight-checklist.md) — Docker engine and Ollama before blaming the extension
- [Local model diagnostics](local-model-diagnostics.md) — agent-turn failures after the runtime is healthy
- [Local model tuning](local-model-tuning.md) — context, thinking, hardware profiles
