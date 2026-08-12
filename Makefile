IMAGE ?= openclaw-docker-extension
TAG ?= dev
RUNTIME_IMAGE ?= openclaw-docker-extension-runtime
RUNTIME_TAG ?= dev
OPENCLAW_VERSION ?= latest
GHCR_OWNER ?= jcowhigjr
DOCKERHUB_OWNER ?= jcowhigjr
RELEASE_TAG ?=
RELEASE_VERSION ?= $(patsubst v%,%,$(RELEASE_TAG))
RELEASE_CHANNEL ?= stable
REPO_OWNER ?= jcowhigjr
REPO_NAME ?= openclaw-docker-desktop-extension
REGISTRY_IMAGE ?= ghcr.io/$(GHCR_OWNER)/openclaw-docker-desktop-extension-runtime
REGISTRY_TAG ?= latest
# For release builds, use the tagged registry image. Otherwise use the published latest.
ifeq ($(RELEASE_TAG),)
  DEFAULT_RUNTIME_IMAGE ?= $(RUNTIME_IMAGE):$(RUNTIME_TAG)
else
  DEFAULT_RUNTIME_IMAGE ?= ghcr.io/$(GHCR_OWNER)/openclaw-docker-desktop-extension-runtime:$(RELEASE_TAG)
endif
RELEASE_EXTENSION_IMAGE ?= ghcr.io/$(GHCR_OWNER)/openclaw-docker-desktop-extension:$(RELEASE_VERSION)
CHANNEL_EXTENSION_IMAGE ?= ghcr.io/$(GHCR_OWNER)/openclaw-docker-desktop-extension:$(RELEASE_CHANNEL)
SCREENSHOT_PORT ?= 4173
SCREENSHOT_URL ?= http://127.0.0.1:$(SCREENSHOT_PORT)/?demo=1
SCREENSHOT_PATH ?= docs/assets/openclaw-extension-dashboard.png

.DEFAULT_GOAL := build-extension

build-runtime:
	docker build --pull --build-arg OPENCLAW_VERSION=$(OPENCLAW_VERSION) -t $(RUNTIME_IMAGE):$(RUNTIME_TAG) -f runtime/Dockerfile runtime

build-extension:
	docker build --build-arg VITE_DEFAULT_RUNTIME_IMAGE=$(DEFAULT_RUNTIME_IMAGE) --tag=$(IMAGE):$(TAG) .

install-dev: build-runtime build-extension
	docker extension install -f $(IMAGE):$(TAG)

update-extension: build-runtime build-extension
	docker extension update $(IMAGE):$(TAG)

publish-runtime:
	docker buildx build \
	  --pull \
	  --build-arg OPENCLAW_VERSION=$(OPENCLAW_VERSION) \
	  --platform linux/arm64,linux/amd64 \
	  --tag $(REGISTRY_IMAGE):$(REGISTRY_TAG) \
	  --push \
	  -f runtime/Dockerfile \
	  runtime

install-release: ; @test -n "$(RELEASE_TAG)" || (echo "RELEASE_TAG is required, for example: make install-release RELEASE_TAG=v0.1.0" && exit 1); IMAGE_TAG="$(RELEASE_VERSION)" GHCR_OWNER="$(GHCR_OWNER)" IMAGE_NAME="openclaw-docker-desktop-extension" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-image.sh; if [ "$(DRY_RUN)" = "1" ]; then echo "dry run: docker extension install -f $(RELEASE_EXTENSION_IMAGE)"; else docker extension install -f $(RELEASE_EXTENSION_IMAGE); fi

update-release: ; @test -n "$(RELEASE_TAG)" || (echo "RELEASE_TAG is required, for example: make update-release RELEASE_TAG=v0.1.0" && exit 1); IMAGE_TAG="$(RELEASE_VERSION)" GHCR_OWNER="$(GHCR_OWNER)" IMAGE_NAME="openclaw-docker-desktop-extension" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-image.sh; if [ "$(DRY_RUN)" = "1" ]; then echo "dry run: docker extension update $(RELEASE_EXTENSION_IMAGE)"; else docker extension update $(RELEASE_EXTENSION_IMAGE); fi

install-channel: ; @test -n "$(RELEASE_CHANNEL)" || (echo "RELEASE_CHANNEL is required, for example: make install-channel RELEASE_CHANNEL=stable" && exit 1); IMAGE_TAG="$(RELEASE_CHANNEL)" GHCR_OWNER="$(GHCR_OWNER)" IMAGE_NAME="openclaw-docker-desktop-extension" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-image.sh; if [ "$(DRY_RUN)" = "1" ]; then echo "dry run: docker extension install -f $(CHANNEL_EXTENSION_IMAGE)"; else docker extension install -f $(CHANNEL_EXTENSION_IMAGE); fi

update-channel: ; @test -n "$(RELEASE_CHANNEL)" || (echo "RELEASE_CHANNEL is required, for example: make update-channel RELEASE_CHANNEL=stable" && exit 1); IMAGE_TAG="$(RELEASE_CHANNEL)" GHCR_OWNER="$(GHCR_OWNER)" IMAGE_NAME="openclaw-docker-desktop-extension" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-image.sh; if [ "$(DRY_RUN)" = "1" ]; then echo "dry run: docker extension update $(CHANNEL_EXTENSION_IMAGE)"; else docker extension update $(CHANNEL_EXTENSION_IMAGE); fi

verify-release-tag:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" GHCR_OWNER="$(GHCR_OWNER)" DOCKERHUB_OWNER="$(DOCKERHUB_OWNER)" ./scripts/verify-release-tag.sh

verify-release-channel: ; @RELEASE_CHANNEL="$(RELEASE_CHANNEL)" GHCR_OWNER="$(GHCR_OWNER)" EXPECTED_RELEASE_TAG="$(EXPECTED_RELEASE_TAG)" ./scripts/verify-release-channel.sh

test-release-channel: ; @./scripts/test-release-channel.sh
test-runtime-bridge: ; @sh ./scripts/test-runtime-bridge.sh
test-runtime-base-pull: ; @sh ./scripts/test-runtime-base-pull.sh
test-extension-metadata: ; @./scripts/test-extension-metadata.sh
test-release-tag-dry-run: ; @./scripts/test-release-tag-dry-run.sh
test-verify-release-tag-dockerhub-error: ; @./scripts/test-verify-release-tag-dockerhub-error.sh
test-verify-release-tag-title: ; @./scripts/test-verify-release-tag-title.sh
test-release-install-dry-run: ; @./scripts/test-release-install-dry-run.sh
test-release-channel-dry-run: ; @./scripts/test-release-channel-dry-run.sh
test-verify-release-channel-digest: ; @./scripts/test-verify-release-channel-digest.sh
test-create-smoke-report: ; @sh ./scripts/test-create-smoke-report.sh
test-runtime-helper: ; @sh ./scripts/test-runtime-helper.sh
test-runtime-image-helper: ; @RUNTIME_IMAGE="$(RUNTIME_IMAGE)" RUNTIME_TAG="$(RUNTIME_TAG)" sh ./scripts/test-runtime-image-helper.sh
test-docs-landing-page: ; @node ./scripts/test-docs-landing-page.js
test-agent-memory: ; @node ./scripts/test-agent-memory.js
test-security-local: ; @sh ./scripts/test-security-local.sh
test-ui-screenshot-sync: ; @bash ./scripts/test-ui-screenshot-sync-selftest.sh
test-ui: ; @cd ui && npm ci && npm test && npm run build
test-pre-push: test-ui test-runtime-bridge test-runtime-base-pull test-extension-metadata test-release-tag-dry-run test-verify-release-tag-dockerhub-error test-verify-release-tag-title test-release-install-dry-run test-release-channel-dry-run test-verify-release-channel-digest test-create-smoke-report test-runtime-helper test-runtime-image-helper test-docs-landing-page test-agent-memory test-security-local test-ui-screenshot-sync
install-hooks: ; @git config core.hooksPath .githooks && chmod +x .githooks/pre-push && echo "installed repo git hooks from .githooks"

verify-release-bundle:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" GHCR_OWNER="$(GHCR_OWNER)" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-bundle.sh

verify-release-install: ; @RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" GHCR_OWNER="$(GHCR_OWNER)" DOCKERHUB_OWNER="$(DOCKERHUB_OWNER)" DRY_RUN="$(DRY_RUN)" ./scripts/verify-release-install.sh

verify-channel-install: ; @RELEASE_CHANNEL="$(RELEASE_CHANNEL)" GHCR_OWNER="$(GHCR_OWNER)" EXPECTED_RELEASE_TAG="$(EXPECTED_RELEASE_TAG)" DRY_RUN="$(DRY_RUN)" ./scripts/verify-channel-install.sh

publish-release:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" DRY_RUN="$(DRY_RUN)" ./scripts/publish-release.sh

ship-release:
	@RELEASE_TAG="$(RELEASE_TAG)" REPO_OWNER="$(REPO_OWNER)" REPO_NAME="$(REPO_NAME)" GHCR_OWNER="$(GHCR_OWNER)" DOCKERHUB_OWNER="$(DOCKERHUB_OWNER)" DRY_RUN="$(DRY_RUN)" ./scripts/ship-release.sh

uninstall:
	docker extension rm $(IMAGE)

capture-readme-screenshot:
	SCREENSHOT_PORT="$(SCREENSHOT_PORT)" SCREENSHOT_URL="$(SCREENSHOT_URL)" SCREENSHOT_PATH="$(SCREENSHOT_PATH)" ./scripts/capture-readme-screenshot.sh

create-smoke-report:
	@REPORT_DATE="$(REPORT_DATE)" RELEASE_CHANNEL="$(RELEASE_CHANNEL)" RELEASE_TAG="$(RELEASE_TAG)" REPORT_DIR="$(REPORT_DIR)" sh ./scripts/create-smoke-report.sh

.PHONY: build-runtime build-extension install-dev update-extension publish-runtime install-release update-release install-channel update-channel verify-release-tag verify-release-channel test-release-channel test-runtime-bridge test-runtime-base-pull test-extension-metadata test-release-tag-dry-run test-verify-release-tag-dockerhub-error test-verify-release-tag-title test-release-install-dry-run test-release-channel-dry-run test-verify-release-channel-digest test-create-smoke-report test-runtime-helper test-docs-landing-page test-agent-memory test-security-local test-ui-screenshot-sync test-ui test-pre-push install-hooks verify-release-bundle verify-release-install verify-channel-install publish-release ship-release uninstall capture-readme-screenshot create-smoke-report
