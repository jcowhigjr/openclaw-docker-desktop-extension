# Issue #160: Model Selection UI with Performance Indicators

## Summary
Improve the Ollama model selection UI to show performance indicators, estimated tokens/second, and timeout risk levels based on detected hardware.

## Background
Users currently select Ollama models without understanding the performance implications for their specific hardware. A 9.7B model like `qwen3.5` runs at ~10-16 tok/s on M4 24GB (usable) but would be dangerously slow on CPU-only 8GB RAM (likely to timeout). The UI should surface this information at selection time.

## Acceptance Criteria

### A/C 1: Model Performance Metadata
- [ ] Maintain internal database of model parameters and performance characteristics:
  - Parameter count (3B, 4B, 7B, 8B, 9B, 14B, etc.)
  - Typical RAM usage at Q4_K_M quantization
  - Expected tokens/second on different hardware profiles
- [ ] Show parameter count and estimated RAM usage in model list

### A/C 2: Hardware-Specific Speed Estimates
- [ ] For detected hardware profile, show estimated performance:
  - "On your M4 Mac (24GB): ~15-20 tok/s"
  - "Estimated prompt eval: ~30-40s for typical chat"
- [ ] Show different estimate if running CPU-only vs GPU-accelerated

### A/C 3: Timeout Risk Indicator
- [ ] Show visual risk indicator for each model:
  - 🟢 Low risk: Models <7B on any hardware
  - 🟡 Medium risk: Models 7-10B on Apple Silicon
  - 🔴 High risk: Models >10B or any model on CPU-only
- [ ] Show specific warning for models that may hit 120s timeout:
  "⚠️ With your hardware, large prompts on this model may exceed OpenClaw's 120s timeout limit."

### A/C 4: Recommended Model Highlighting
- [ ] Highlight recommended models for detected hardware:
  - Light: Show "Recommended" badge on gemma4-fast, qwen2.5:3b
  - Balanced: Show "Recommended" on gemma4, qwen3:8b, llama3.2
- [ ] Sort recommended models to top of list
- [ ] Show "Best for your Mac" callout

### A/C 5: One-Click Safe Configuration
- [ ] When user selects a model, offer "Apply with safe settings":
  - Sets appropriate `num_ctx` for hardware
  - Enables `localModelLean` if recommended
  - Configures compaction settings
- [ ] Confirm before applying: "This will also enable lean mode and set context to 16K for best performance."

## Model Performance Database (Initial)

| Model | Params | RAM (Q4) | M4 24GB tok/s | CPU-Only tok/s | Risk on M4 24GB | Risk on CPU |
|-------|--------|----------|---------------|----------------|-----------------|-------------|
| gemma4-fast | 4B | ~3GB | 35-45 | 20-25 | 🟢 Low | 🟡 Medium |
| qwen2.5:3b | 3B | ~2GB | 40-50 | 25-30 | 🟢 Low | 🟢 Low |
| llama3.2 | 8B | ~5GB | 24-28 | 12-15 | 🟢 Low | 🟡 Medium |
| gemma4 | 9B | ~6GB | 20-25 | 10-12 | 🟡 Medium | 🔴 High |
| qwen3.5 | 9.7B | ~6GB | 15-20 | 8-10 | 🟡 Medium | 🔴 High |
| qwen3:14b | 14B | ~9GB | 10-16 | 5-7 | 🟡 Medium | 🔴 High |
| llama3.1:70b | 70B | ~40GB | N/A (OOM) | N/A | 🔴 N/A | 🔴 N/A |

## UI Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  Select Ollama Model                                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Detected: M4 Mac, 24GB RAM                                  │
│                                                               │
│  ⭐ Recommended for your Mac                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🥇 gemma4         9B  ~6GB   ~22 tok/s  🟢 Low risk │    │
│  │ 🥈 llama3.2       8B  ~5GB   ~26 tok/s  🟢 Low risk │    │
│  │ 🥉 qwen3:8b       8B  ~5GB   ~30 tok/s  🟢 Low risk │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Other available models:                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ gemma4-fast       4B  ~3GB   ~40 tok/s  🟢 Low risk │    │
│  │ qwen3.5           9.7B ~6GB   ~18 tok/s  🟡 Medium   │    │
│  │ ⚠️ qwen3:14b     14B  ~9GB   ~13 tok/s  🟡 Medium   │    │
│  │     Large prompts may exceed 120s timeout             │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Selected: qwen3.5                                          │
│  [Apply with Safe Settings]  [Advanced...]                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Technical Implementation

### Model Metadata Type
```typescript
type ModelMetadata = {
  id: string;
  name: string;
  parameters: number; // in billions
  ramUsageGB: number; // Q4_K_M quantization estimate
  performance: {
    'm4-24gb': { tokPerSecond: [number, number]; notes?: string };
    'cpu-light': { tokPerSecond: [number, number]; notes?: string };
    'cpu-balanced': { tokPerSecond: [number, number]; notes?: string };
  };
  riskProfile: {
    'm4-24gb': 'low' | 'medium' | 'high';
    'cpu-light': 'low' | 'medium' | 'high';
    'cpu-balanced': 'low' | 'medium' | 'high';
  };
};
```

### Dynamic Risk Calculation
```typescript
function calculateRisk(
  model: ModelMetadata,
  hardwareProfile: HardwareProfile,
  estimatedPromptTokens: number // user's typical prompt size
): 'low' | 'medium' | 'high' {
  // Calculate estimated prompt eval time
  const perf = model.performance[hardwareProfile.id];
  const evalTimeSeconds = estimatedPromptTokens / perf.tokPerSecond[0];
  
  // Risk if approaching 120s timeout
  if (evalTimeSeconds > 90) return 'high';
  if (evalTimeSeconds > 60) return 'medium';
  return 'low';
}
```

## Out of Scope
- Automatic model downloading (still manual)
- Real-time benchmarking on user's machine
- Predicting exact token counts for specific prompts
- Non-Ollama local providers (LM Studio, etc.)

## Related
- Issue #157 (Hardware Profile Detection)
- Issue #158 (Ollama Env Var Passthrough)
- docs/local-model-tuning.md
