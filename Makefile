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

install-release: ; @test -n "$(RELEASE_TAG)" || (echo "RELEASE_TAG is required, for example: make install-release RELEASE_TAG=v0.1.0" && exit 1); RELEASE_TAG="$(RELEASE_TAG)" GHCR_OWNER="$(GHCR_OWNER)" IMAGE_NAME="openclaw-docker-desktop-extension" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-image.sh; if [ "$(DRY_RUN)" = "1" ]; then echo "dry run: docker extension install -f $(RELEASE_EXTENSION_IMAGE)"; else docker extension install -f $(RELEASE_EXTENSION_IMAGE); fi

update-release: ; @test -n "$(RELEASE_TAG)" || (echo "RELEASE_TAG is required, for example: make update-release RELEASE_TAG=v0.1.0" && exit 1); RELEASE_TAG="$(RELEASE_TAG)" GHCR_OWNER="$(GHCR_OWNER)" IMAGE_NAME="openclaw-docker-desktop-extension" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-image.sh; if [ "$(DRY_RUN)" = "1" ]; then echo "dry run: docker extension update $(RELEASE_EXTENSION_IMAGE)"; else docker extension update $(RELEASE_EXTENSION_IMAGE); fi

verify-release-tag:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" GHCR_OWNER="$(GHCR_OWNER)" ./scripts/verify-release-tag.sh

test-release-channel: ; @./scripts/test-release-channel.sh
test-release-tag-dry-run: ; @./scripts/test-release-tag-dry-run.sh
test-release-install-dry-run: ; @./scripts/test-release-install-dry-run.sh

verify-release-bundle:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" GHCR_OWNER="$(GHCR_OWNER)" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-bundle.sh

verify-release-install: ; @RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" GHCR_OWNER="$(GHCR_OWNER)" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-install.sh

publish-release:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" DRY_RUN="$(DRY_RUN)" ./scripts/publish-release.sh

ship-release:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" GHCR_OWNER="$(GHCR_OWNER)" DRY_RUN="$(DRY_RUN)" ./scripts/ship-release.sh

uninstall:
	docker extension rm $(IMAGE)

capture-readme-screenshot:
	cd ui && npm run build
	cd ui && (npm exec vite preview -- --host 127.0.0.1 --port 4173 >/tmp/openclaw-vite-preview.log 2>&1 & echo $$! > /tmp/openclaw-vite-preview.pid)
	while ! curl -fsS http://127.0.0.1:4173 >/dev/null 2>&1; do sleep 1; done
	npx --yes playwright screenshot --device="Desktop Chrome" --color-scheme=light --wait-for-selector="text=OpenClaw Extension" --wait-for-timeout=1000 "$(SCREENSHOT_URL)" "$(SCREENSHOT_PATH)"
	kill $$(cat /tmp/openclaw-vite-preview.pid) && rm -f /tmp/openclaw-vite-preview.pid

.PHONY: build-runtime build-extension install-dev update-extension install-release update-release verify-release-tag test-release-channel test-release-tag-dry-run test-release-install-dry-run verify-release-bundle verify-release-install publish-release ship-release uninstall capture-readme-screenshot
