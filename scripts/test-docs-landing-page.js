#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const docsDir = path.join(repoRoot, "docs");
const indexPath = path.join(docsDir, "index.html");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function assertIncludes(content, expected, label) {
  if (!content.includes(expected)) {
    fail(`docs landing page missing ${label}: ${expected}`);
  }
}

function assertFileExists(relativePath, label = relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`docs landing page references missing ${label}: ${relativePath}`);
  }
}

const html = fs.readFileSync(indexPath, "utf8");

assertIncludes(html, "<html lang=\"en\">", "language declaration");
assertIncludes(
  html,
  "docker extension install ghcr.io/jcowhigjr/openclaw-docker-desktop-extension:stable",
  "stable GHCR install command",
);
assertIncludes(html, "v0.3.6", "current validated release tag");
assertIncludes(html, "Not listed in the Docker Extensions Marketplace yet", "marketplace status");
assertIncludes(html, "not a hardened sandbox", "honest isolation boundary");
assertIncludes(html, "assets/openclaw-extension-dashboard.png", "extension screenshot");

for (const href of html.matchAll(/href="([^"]+)"/g)) {
  const target = href[1];
  if (target.startsWith("http") || target.startsWith("#") || target.startsWith("data:")) {
    continue;
  }
  assertFileExists(path.join("docs", target), `link target ${target}`);
}

for (const src of html.matchAll(/src="([^"]+)"/g)) {
  assertFileExists(path.join("docs", src[1]), `asset ${src[1]}`);
}

for (const stylesheet of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)) {
  assertFileExists(path.join("docs", stylesheet[1]), `stylesheet ${stylesheet[1]}`);
}

if (!process.exitCode) {
  console.log("docs landing page checks passed");
}
