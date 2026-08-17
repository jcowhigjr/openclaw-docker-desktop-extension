#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const allowlistPath = path.join(__dirname, "public-docs-allowlist.txt");
const failures = [];

function fail(message) {
  failures.push(message);
}

function readAllowlist() {
  return new Set(
    fs
      .readFileSync(allowlistPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")),
  );
}

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: repoRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean);
}

const allowedDocs = readAllowlist();
const tracked = trackedFiles();
const trackedDocs = tracked.filter((file) => file.startsWith("docs/"));
const trackedDocsSet = new Set(trackedDocs);

for (const file of trackedDocs) {
  if (!allowedDocs.has(file)) {
    fail(`unclassified public document: ${file}`);
  }
}

for (const file of allowedDocs) {
  if (!trackedDocsSet.has(file)) {
    fail(`stale public-docs allowlist entry: ${file}`);
  }
}

const restrictedPaths = [
  /(?:^|\/)(?:internal|private|positioning|strategy|outreach)(?:\/|$)/i,
  /^(?:evals|retros?|handoffs?|memory)(?:\/|$)/i,
  /(?:^|\/).*(?:brand-defense|go-to-market|moat|outreach-draft).*$/i,
];

const restrictedContent = [
  { label: "go-to-market planning", pattern: /\bgo[- ]to[- ]market\b/i },
  { label: "competitive defense planning", pattern: /\b(?:copycat|first[- ]mover|moat strategy)\b/i },
  { label: "unpublished outreach planning", pattern: /\b(?:silent prep|ready[- ]to[- ]send drafts?|claim the namespaces?)\b/i },
];

const contentScanExclusions = new Set([
  "AGENTS.md",
  "scripts/test-public-repo-boundary.js",
]);

for (const fixture of [
  "internal/private-plan.md",
  "docs/positioning/launch.md",
  "evals/automation-audit.md",
  "product-go-to-market.md",
]) {
  if (!restrictedPaths.some((pattern) => pattern.test(fixture))) {
    fail(`publication-boundary path self-test did not reject: ${fixture}`);
  }
}

for (const fixture of ["first-mover advantage", "silent prep", "ready-to-send draft"]) {
  if (!restrictedContent.some((rule) => rule.pattern.test(fixture))) {
    fail(`publication-boundary content self-test did not reject: ${fixture}`);
  }
}

if (allowedDocs.has("docs/unclassified-fixture.md")) {
  fail("publication-boundary allowlist self-test fixture must remain unclassified");
}

for (const file of tracked) {
  for (const pattern of restrictedPaths) {
    if (pattern.test(file)) {
      fail(`restricted public-document path: ${file}`);
    }
  }

  if (contentScanExclusions.has(file)) {
    continue;
  }

  const fullPath = path.join(repoRoot, file);
  if (!fs.existsSync(fullPath)) {
    continue;
  }
  const content = fs.readFileSync(fullPath);
  if (content.includes(0)) {
    continue;
  }

  const text = content.toString("utf8");
  for (const rule of restrictedContent) {
    if (rule.pattern.test(text)) {
      fail(`${file} contains restricted ${rule.label}`);
    }
  }
}

const agents = fs.readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
for (const requiredInstruction of [
  "Treat every tracked file, commit, branch, and pull-request revision as immediately public.",
  "make test-public-repo-boundary",
  "Deleting sensitive material in a later commit does not remove it from history.",
]) {
  if (!agents.includes(requiredInstruction)) {
    fail(`AGENTS.md missing publication-boundary instruction: ${requiredInstruction}`);
  }
}

if (failures.length > 0) {
  for (const message of failures) {
    console.error(message);
  }
  process.exit(1);
}

console.log("public repository boundary checks passed");
