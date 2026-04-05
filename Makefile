IMAGE ?= openclaw-docker-extension
TAG ?= dev
RUNTIME_IMAGE ?= openclaw-docker-extension-runtime
RUNTIME_TAG ?= dev
DEFAULT_RUNTIME_IMAGE ?= $(RUNTIME_IMAGE):$(RUNTIME_TAG)
GHCR_OWNER ?= jcowhigjr
RELEASE_TAG ?=
REPO_OWNER ?= jcowhigjr
REPO_NAME ?= openclaw-docker-desktop-extension
RELEASE_EXTENSION_IMAGE ?= ghcr.io/$(GHCR_OWNER)/openclaw-docker-desktop-extension:$(RELEASE_TAG)
SCREENSHOT_URL ?= http://127.0.0.1:4173/?demo=1
SCREENSHOT_PATH ?= docs/assets/openclaw-extension-dashboard.png

.DEFAULT_GOAL := build-extension

build-runtime:
	docker build -t $(RUNTIME_IMAGE):$(RUNTIME_TAG) -f runtime/Dockerfile runtime

build-extension:
	docker build --build-arg VITE_DEFAULT_RUNTIME_IMAGE=$(DEFAULT_RUNTIME_IMAGE) --tag=$(IMAGE):$(TAG) .

install-dev: build-runtime build-extension
	docker extension install -f $(IMAGE):$(TAG)

update-extension: build-runtime build-extension
	docker extension update $(IMAGE):$(TAG)

install-release:
	@test -n "$(RELEASE_TAG)" || (echo "RELEASE_TAG is required, for example: make install-release RELEASE_TAG=v0.1.0" && exit 1)
	docker extension install -f $(RELEASE_EXTENSION_IMAGE)

update-release:
	@test -n "$(RELEASE_TAG)" || (echo "RELEASE_TAG is required, for example: make update-release RELEASE_TAG=v0.1.0" && exit 1)
	docker extension update $(RELEASE_EXTENSION_IMAGE)

verify-release-tag:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" GHCR_OWNER="$(GHCR_OWNER)" ./scripts/verify-release-tag.sh

publish-release:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" DRY_RUN="$(DRY_RUN)" ./scripts/publish-release.sh

uninstall:
	docker extension rm $(IMAGE)

capture-readme-screenshot:
	cd ui && npm run build
	cd ui && (npm exec vite preview -- --host 127.0.0.1 --port 4173 >/tmp/openclaw-vite-preview.log 2>&1 & echo $$! > /tmp/openclaw-vite-preview.pid)
	while ! curl -fsS http://127.0.0.1:4173 >/dev/null 2>&1; do sleep 1; done
	npx --yes playwright screenshot --device="Desktop Chrome" --color-scheme=light --wait-for-selector="text=OpenClaw Extension" --wait-for-timeout=1000 "$(SCREENSHOT_URL)" "$(SCREENSHOT_PATH)"
	kill $$(cat /tmp/openclaw-vite-preview.pid) && rm -f /tmp/openclaw-vite-preview.pid

.PHONY: build-runtime build-extension install-dev update-extension install-release update-release verify-release-tag publish-release uninstall capture-readme-screenshot
