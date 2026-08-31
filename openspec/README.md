> **STATUS (2026-08-31): the hardware-profile lane is superseded.** An audit against
> Ollama 0.33.2 found its core premises no longer hold (MLX claim false; Ollama now
> serves live model recommendations with `vram_bytes`; no telemetry exists to measure
> the stated success metrics). Model fit is delegated to Ollama in
> [#190](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/190).
> Current active issues: [#189](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/189)
> (num_ctx), [#190](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/190)
> (model fit), [#191](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/191)
> (load preflight), [#192](https://github.com/jcowhigjr/openclaw-docker-desktop-extension/issues/192)
> (dependency drift). Treat the model tables below as historical.

# OpenSpec: Hardware Profile System for Local Models

This directory contains the specification, design, and implementation planning for the Hardware Profile System—a set of extension features to optimize OpenClaw for local Ollama models on constrained hardware, with primary focus on M4 Macs with 24GB RAM.

## Background

OpenClaw has a hardcoded 120-second idle timeout watchdog that cannot be changed through configuration. On CPU-only or memory-constrained hardware, evaluating large prompts can exceed this limit, causing timeouts before the first token arrives.

This system provides **practical workarounds** by helping users:
1. Select appropriate models for their hardware
2. Apply optimal configurations automatically
3. Understand performance trade-offs upfront
4. Tune their setup to stay under the timeout limit

**Key insight**: No upstream fix is required. These are extension-side improvements.

---

## Deliverables

### 1. GitHub Issues (Ready to File)

| Issue | Title | Priority | Effort |
|-------|-------|----------|--------|
| [#157](issues/157-hardware-profile-detection-ui.md) | Hardware Profile Detection and UI | P1 | Medium |
| [#158](issues/158-ollama-env-var-passthrough.md) | Ollama Environment Variable Passthrough | P1 | Small |
| [#159](issues/159-workspace-file-size-guard.md) | Workspace File Size Guard | P2 | Medium |
| [#160](issues/160-model-selection-ui-improvements.md) | Model Selection UI with Performance Indicators | P1 | Large |

### 2. Specification Documents

| Document | Purpose |
|----------|---------|
| [specs/hardware-profile-system.md](specs/hardware-profile-system.md) | Complete system specification with M4 24GB research |
| [ui/hardware-profile-ui-design.md](ui/hardware-profile-ui-design.md) | Detailed UI wireframes and interaction flows |
| [tech/hardware-profile-implementation.md](tech/hardware-profile-implementation.md) | Technical architecture and implementation guide |

### 3. Verification & Testing

| Document | Purpose |
|----------|---------|
| [verification/m4-24gb-manual-verification.md](verification/m4-24gb-manual-verification.md) | Manual test plan for M4 24GB hardware |

### 4. Supporting Documentation

| Document | Purpose |
|----------|---------|
| [../docs/local-model-tuning.md](../docs/local-model-tuning.md) | User-facing tuning guide (already created) |

---

## Key Research Findings for M4 Mac 24GB

### Optimal Models (from benchmarks)

| Model | Parameters | RAM | Speed | Risk Level | Best For |
|-------|------------|-----|-------|------------|----------|
| **gemma4-fast** | 4B | ~3GB | 35-45 tok/s | 🟢 Very Low | Fast tasks |
| **qwen2.5:3b** | 3B | ~2GB | 40-50 tok/s | 🟢 Very Low | Quick chat |
| **qwen3:8b** | 8B | ~5GB | 28-35 tok/s | 🟢 Low | Coding |
| **llama3.2** | 8B | ~5GB | 24-28 tok/s | 🟢 Low | General |
| **gemma4** | 9B | ~6GB | 20-25 tok/s | 🟡 Medium | Balance |
| **qwen3.5** | 9.7B | ~6GB | 15-20 tok/s | 🟡 Medium | Quality |
| **qwen3:14b** | 14B | ~9GB | 10-16 tok/s | 🔴 High | Strong reasoning |

### Critical Optimizations

1. **OLLAMA_FLASH_ATTENTION=1**: 10-30% speedup, less memory
2. **OLLAMA_KV_CACHE_TYPE=q8_0**: 50% memory reduction vs f16
3. **localModelLean: true**: Removes browser/cron/message tools
4. **num_ctx: 16384**: Balanced context vs speed for 24GB
5. **Trim workspace files**: Every 10KB ≈ 10-15s eval time

### Configuration for M4 24GB

```json
{
  "agents": {
    "defaults": {
      "experimental": { "localModelLean": true },
      "compaction": { "reserveTokens": 8192 }
    }
  },
  "models": {
    "providers": {
      "ollama": {
        "models": [{
          "id": "gemma4:latest",
          "params": { "num_ctx": 16384 }
        }]
      }
    }
  }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Issues #157, #158)
- Hardware detection service
- Model metadata database
- Hardware banner component
- Ollama env var guidance UI

### Phase 2: Selection (Issue #160)
- Model selector with performance indicators
- Risk calculation and warnings
- Safe settings modal
- One-click config application

### Phase 3: Optimization (Issue #159)
- Workspace file size checking
- Size guard UI component
- Settings panel integration
- Diagnostics tools

### Phase 4: Polish
- Manual verification on M4 24GB
- Performance benchmark validation
- UI/UX refinement
- Documentation updates

---

## Quick Reference: File Locations

```
openspec/
├── README.md                                    # This file
├── issues/
│   ├── 157-hardware-profile-detection-ui.md     # Issue spec
│   ├── 158-ollama-env-var-passthrough.md        # Issue spec
│   ├── 159-workspace-file-size-guard.md         # Issue spec
│   └── 160-model-selection-ui-improvements.md   # Issue spec
├── specs/
│   └── hardware-profile-system.md               # System spec
├── ui/
│   └── hardware-profile-ui-design.md            # UI design
├── tech/
│   └── hardware-profile-implementation.md       # Tech design
└── verification/
    └── m4-24gb-manual-verification.md           # Test plan
```

---

## Next Steps

1. **Review and file GitHub issues**: Start with #157 and #158 (foundational)
2. **Manual verification**: Run the M4 24GB test plan on actual hardware
3. **Begin Phase 1 implementation**: Hardware detection and UI banner
4. **Iterate based on verification results**: Adjust performance estimates as needed

## Success Criteria

- [ ] M4 24GB users can complete setup without timeout errors
- [ ] Recommended models appropriate for detected hardware
- [ ] UI warnings prevent selection of high-risk models
- [ ] Safe settings apply correct configuration in one click
- [ ] Workspace file warnings appear at appropriate thresholds

---

**Created**: 2026-01-XX  
**Target Release**: v0.4.0  
**Primary Hardware Target**: M4 Mac with 24GB RAM
