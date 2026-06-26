# Issue #157: Hardware Profile Detection and UI

## Summary
Add automatic hardware detection and profile-based configuration recommendations to help users tune OpenClaw for their specific Mac hardware (M4 24GB and other configurations).

## Background
Users with M4 Macs and 24GB RAM (like the maintainer) need optimal local model configurations. Currently they must manually discover and apply tuning from the local-model-tuning.md guide. This feature would detect hardware capabilities and suggest/appply optimal settings automatically.

## Acceptance Criteria

### A/C 1: Hardware Detection
- [ ] Detect macOS hardware (Apple Silicon generation: M1/M2/M3/M4/Pro/Max)
- [ ] Detect total system RAM
- [ ] Detect GPU availability and VRAM/unified memory
- [ ] Store detected profile in extension config
- [ ] Show detected profile in UI (read-only informational display)

### A/C 2: Model Recommendations
- [ ] Based on detected profile, recommend specific Ollama models:
  - Light (8-16GB, CPU): `gemma4-fast`, `qwen2.5:3b`
  - Balanced (16-24GB, Apple Silicon): `gemma4`, `qwen3:8b`, `llama3.2`
  - Performance (32GB+, GPU): Any available model
- [ ] Show recommendation before model selection
- [ ] Explain why each model is recommended (speed/quality trade-off)
- [ ] Allow user to override recommendation

### A/C 3: Context Size Warnings
- [ ] When selecting models >9B parameters on CPU-only: show warning about 120s timeout risk
- [ ] When selecting large context (32768) on light hardware: suggest smaller context
- [ ] Provide one-click "Apply safe settings" button

### A/C 4: Configuration Presets
- [ ] Apply hardware-appropriate OpenClaw config:
  - `localModelLean: true` for Light/Balanced profiles
  - Optimized `num_ctx` based on RAM (8192 light, 16384 balanced, 32768 performance)
  - `compaction.reserveTokens` appropriate for profile
- [ ] Pass Ollama environment variables if running containerized Ollama:
  - `OLLAMA_FLASH_ATTENTION=1` for all Apple Silicon
  - `OLLAMA_KV_CACHE_TYPE` based on profile (q4_0 light, q8_0 balanced, f16 performance)

## Technical Notes

### Detection Approach
```typescript
// Use Docker Desktop SDK to detect host capabilities
// Option 1: Read system_profiler via exec into a lightweight container
// Option 2: Use navigator.hardwareConcurrency + userAgent in UI (less accurate)
// Option 3: Detect via Ollama API after connection (memory-based inference)
```

### Profile Schema
```typescript
type HardwareProfile = {
  platform: 'macos' | 'linux' | 'windows';
  chip: 'intel' | 'm1' | 'm2' | 'm3' | 'm4' | 'm4-pro' | 'm4-max' | 'unknown';
  totalRamGB: number;
  hasGpu: boolean;
  unifiedMemory: boolean; // Apple Silicon
  recommendedProfile: 'light' | 'balanced' | 'performance';
};
```

### Configuration Mapping
| Profile | Recommended Models | num_ctx | localModelLean | OLLAMA_KV_CACHE_TYPE |
|---------|-------------------|---------|----------------|---------------------|
| light | gemma4-fast, qwen2.5:3b | 8192 | true | q4_0 |
| balanced | gemma4, qwen3:8b, llama3.2 | 16384 | true | q8_0 |
| performance | Any | 32768 | false | f16 |

## Out of Scope
- Auto-detection of Linux/Windows hardware details (macOS focus for this extension)
- Automatic model downloading (recommend only)
- Real-time performance monitoring
- Dynamic profile switching after initial setup

## Related Documentation
- docs/local-model-tuning.md
- Issue #156 (120s timeout context)
