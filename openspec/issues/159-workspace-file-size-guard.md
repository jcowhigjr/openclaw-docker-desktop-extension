# Issue #159: Workspace File Size Guard and Optimization Hints

## Summary
Warn users when OpenClaw workspace files (AGENTS.md, SOUL.md, etc.) grow large enough to significantly slow down prompt evaluation on local models.

## Background
OpenClaw injects workspace files (AGENTS.md, SOUL.md, TOOLS.md, IDENTITY.md, USER.md) into every prompt. Large files cause slower prompt evaluation, especially problematic on CPU-only hardware where we're already near the 120s timeout limit. The default AGENTS.md template is ~7KB and can grow significantly with user additions.

## Acceptance Criteria

### A/C 1: File Size Detection
- [ ] After Ollama setup completes, check workspace file sizes in the OpenClaw volume
- [ ] Calculate total injected context size from workspace files
- [ ] Store size metrics in extension state

### A/C 2: Size Warnings
- [ ] Show warning when any single file > 10,000 characters
- [ ] Show warning when total workspace context > 20,000 characters
- [ ] Display warning in Ollama setup completion flow and in settings

### A/C 3: Optimization Guidance
- [ ] Provide specific, actionable recommendations:
   - "AGENTS.md is 15KB. Consider moving long skill documentation to skill-specific files."
   - "SOUL.md is 8KB. This may add 2-3s to every prompt eval on your hardware."
- [ ] One-click "View workspace files" button (open Control UI to workspace)
- [ ] Link to local-model-tuning.md for trimming guidance

### A/C 4: Lean Mode Suggestion
- [ ] If workspace files are large AND hardware profile is light/balanced: suggest enabling `localModelLean: true`
- [ ] Explain trade-off: "Lean mode removes browser/cron/message tools to compensate for large workspace context"
- [ ] One-click enable in UI

## Size Thresholds

| Metric | Warning Level | Critical Level |
|--------|--------------|----------------|
| Single file | 10,000 chars | 20,000 chars |
| Total workspace | 20,000 chars | 40,000 chars |
| AGENTS.md specifically | 8,000 chars | 15,000 chars |

## Time Impact Estimates (for UI display)

Based on research at ~127 tok/s CPU prompt eval:
- 10KB text ≈ 2,500 tokens ≈ ~20s additional prompt eval time
- 20KB text ≈ 5,000 tokens ≈ ~40s additional prompt eval time

These estimates help users understand the impact on the 120s timeout budget.

## UI Mockup

```
┌─────────────────────────────────────────┐
│  Workspace File Size Check                │
├─────────────────────────────────────────┤
│                                         │
│  ⚠️ Large workspace files detected       │
│                                         │
│  File sizes:                            │
│  • AGENTS.md    15,400 chars  ▲ Large    │
│  • SOUL.md       8,200 chars  ▲ Large    │
│  • TOOLS.md      2,100 chars  ✓ OK       │
│  • USER.md         800 chars  ✓ OK       │
│                                         │
│  Total: ~26K chars ≈ ~50s prompt eval    │
│                                         │
│  [Trim AGENTS.md] [Enable Lean Mode]    │
│  [View in Control UI] [Dismiss]           │
│                                         │
│  Tip: Move skill docs to skill files.   │
│  See local-model-tuning.md for details. │
│                                         │
└─────────────────────────────────────────┘
```

## Technical Implementation

### Size Check Command
```typescript
// Execute in container to check file sizes
const sizeCheckArgs = [
  'sh', '-c',
  'cd /home/node/.openclaw/workspace && wc -c AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md 2>/dev/null || echo "0 AGENTS.md"'
];
```

### Storage in Extension State
```typescript
type WorkspaceSizeState = {
  checkedAt: string; // ISO timestamp
  files: {
    path: string;
    bytes: number;
    status: 'ok' | 'warning' | 'critical';
  }[];
  totalBytes: number;
  totalStatus: 'ok' | 'warning' | 'critical';
};
```

## Out of Scope
- Automatically truncating files (user decision required)
- Periodic background checks (check at setup/apply time only)
- Checking memory/ directory contents (not injected every turn)

## Related
- Issue #157 (Hardware Profile Detection - for size impact context)
- docs/local-model-tuning.md
- OpenClaw docs on workspace files
