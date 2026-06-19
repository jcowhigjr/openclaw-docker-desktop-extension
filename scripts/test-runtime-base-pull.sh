#!/bin/sh

set -eu

dockerfile="${1:-runtime/Dockerfile}"
makefile="${2:-Makefile}"
runtime_workflow="${3:-.github/workflows/publish-runtime.yml}"

require_file_contains() {
  file="$1"
  pattern="$2"
  description="$3"

  if ! grep -Fq -e "$pattern" "$file"; then
    echo "missing ${description}: ${pattern}" >&2
    return 1
  fi
}

require_file_contains "$dockerfile" 'ARG OPENCLAW_VERSION=latest' "parameterized base image build-arg"
require_file_contains "$dockerfile" 'FROM ghcr.io/openclaw/openclaw:${OPENCLAW_VERSION}' "parameterized base image FROM"
require_file_contains "$makefile" '--pull' "force-pull flag in runtime build recipes"
require_file_contains "$makefile" '--build-arg OPENCLAW_VERSION=$(OPENCLAW_VERSION)' "OPENCLAW_VERSION build-arg in runtime build recipes"
require_file_contains "$runtime_workflow" 'pull: true' "force-pull in publish-runtime workflow"

echo "runtime base pull checks passed"
