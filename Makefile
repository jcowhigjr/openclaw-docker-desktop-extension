IMAGE ?= openclaw-docker-extension
TAG ?= dev
RUNTIME_IMAGE ?= openclaw-docker-extension-runtime
RUNTIME_TAG ?= dev
DEFAULT_RUNTIME_IMAGE ?= $(RUNTIME_IMAGE):$(RUNTIME_TAG)
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

uninstall:
	docker extension rm $(IMAGE)

capture-readme-screenshot:
	cd ui && npm run build
	cd ui && (npm exec vite preview -- --host 127.0.0.1 --port 4173 >/tmp/openclaw-vite-preview.log 2>&1 & echo $$! > /tmp/openclaw-vite-preview.pid)
	while ! curl -fsS http://127.0.0.1:4173 >/dev/null 2>&1; do sleep 1; done
	npx --yes playwright screenshot --device="Desktop Chrome" --color-scheme=light --wait-for-selector="text=OpenClaw Extension" --wait-for-timeout=1000 "$(SCREENSHOT_URL)" "$(SCREENSHOT_PATH)"
	kill $$(cat /tmp/openclaw-vite-preview.pid) && rm -f /tmp/openclaw-vite-preview.pid

.PHONY: build-runtime build-extension install-dev update-extension uninstall capture-readme-screenshot
