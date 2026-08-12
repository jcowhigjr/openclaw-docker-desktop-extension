#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const agentsPath = path.join(repoRoot, "AGENTS.md");
const memoryPath = path.join(repoRoot, "docs", "agent-memory.md");
const evaluationPath = path.join(repoRoot, "evals", "automation-activity-audit.md");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function read(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    fail(`missing agent memory surface: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
}

function requireText(content, expected, label) {
  if (!content.includes(expected)) {
    fail(`${label} missing required text: ${expected}`);
  }
}

const agents = read("AGENTS.md");
const memory = read("docs/agent-memory.md");
const evaluation = read("evals/automation-activity-audit.md");

requireText(agents, "docs/agent-memory.md", "AGENTS.md");
requireText(agents, "make test-agent-memory", "AGENTS.md");

for (const field of [
  "**Status:**",
  "**Added:**",
  "**Scope:**",
  "**Failure:**",
  "**Evidence:**",
  "**Correct behavior:**",
  "**Validation:**",
  "**Review when:**",
]) {
  requireText(memory, field, "agent memory ledger");
}

requireText(memory, "evals/automation-activity-audit.md", "agent memory ledger");
requireText(evaluation, "A passing score is 8/8", "automation activity evaluation");
requireText(evaluation, "Treating the screenshot as GitHub Actions", "automation activity evaluation");
requireText(evaluation, "Using successful status indicators as proof", "automation activity evaluation");

if (!process.exitCode) {
  console.log("agent memory checks passed");
}
