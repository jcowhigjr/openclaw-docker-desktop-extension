# Issue #158: Ollama Environment Variable Passthrough

## Summary
Pass performance-tuning environment variables to the runtime container when running Ollama in containerized mode, or document host Ollama optimization for users.

## Background
The extension currently configures `num_ctx` via `OPENCLAW_OLLAMA_NUM_CTX`. However, critical Ollama performance variables (`OLLAMA_FLASH_ATTENTION`, `OLLAMA_KV_CACHE_TYPE`, `OLLAMA_NUM_PARALLEL`) must be set on the Ollama host process. For users running containerized Ollama (future feature), these should be passed through. For host Ollama users, we should provide documentation and UI guidance.

## Acceptance Criteria

### A/C 1: Container Launch Environment Variables
- [ ] When creating the OpenClaw runtime container, pass through relevant env vars if set in Docker Desktop environment
- [ ] Document which Ollama env vars affect performance
- [ ] Allow override via extension settings UI

### A/C 2: UI for Ollama Host Optimization
- [ ] Detect if Ollama is running on host vs in container
- [ ] Show warning if host Ollama lacks performance optimizations
- [ ] Provide copy-paste commands for setting Ollama env vars on macOS
- [ ] One-click "Copy Ollama optimization commands" button

### A/C 3: Recommended Settings by Hardware
- [ ] Automatically suggest optimal OLLAMA_KV_CACHE_TYPE based on detected hardware
- [ ] Show in UI: "For your M4 Mac with 24GB RAM, we recommend: OLLAMA_KV_CACHE_TYPE=q8_0"
- [ ] Link to local-model-tuning.md for full details

## Configuration Variables to Support

| Variable | Default | Light | Balanced | Performance |
|----------|---------|-------|----------|-------------|
| OLLAMA_FLASH_ATTENTION | 0 | 1 | 1 | 1 |
| OLLAMA_KV_CACHE_TYPE | f16 | q4_0 | q8_0 | f16 |
| OLLAMA_NUM_PARALLEL | 4 | 1 | 1 | 1-2 |
| OLLAMA_KEEP_ALIVE | 5m | 30m | 30m | 30m |

## Technical Implementation

### Option A: Pass to Container (if containerized Ollama)
```typescript
// In buildRuntimeRunArgs, add -e flags for Ollama vars
return [
  '-d',
  '--name', options.containerName,
  '-e', 'OLLAMA_FLASH_ATTENTION=1',
  '-e', 'OLLAMA_KV_CACHE_TYPE=q8_0',
  // ... rest of args
];
```

### Option B: Host Ollama UI Guidance (immediate implementation)
- Detect Ollama location via API endpoint analysis
- Show contextual guidance in Ollama setup flow
- Provide shell commands for user's detected shell (zsh/bash)

## UI Mockup

```
┌─────────────────────────────────────────┐
│  Ollama Performance Optimization        │
├─────────────────────────────────────────┤
│                                         │
│  Detected: Ollama running on host       │
│  Hardware: M4 Mac, 24GB RAM             │
│                                         │
│  Recommended settings for your Mac:     │
│  ┌─────────────────────────────────┐   │
│  │ export OLLAMA_FLASH_ATTENTION=1 │   │
│  │ export OLLAMA_KV_CACHE_TYPE=q8_0│   │
│  │ export OLLAMA_KEEP_ALIVE=30m    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Copy Commands]  [Learn More]          │
│                                         │
│  ⚠️ Without these, large prompts may    │
│     timeout after 120 seconds           │
│                                         │
└─────────────────────────────────────────┘
```

## Out of Scope
- Actually modifying user's shell profile (provide commands only)
- Windows/Linux Ollama service configuration (macOS primary)
- Containerized Ollama deployment (future feature)

## Related
- Issue #157 (Hardware Profile Detection)
- docs/local-model-tuning.md
