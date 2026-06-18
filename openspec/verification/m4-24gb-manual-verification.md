# Manual Verification Plan: M4 Mac 24GB

## Test Environment

**Target Hardware**: M4 Mac (base or Pro) with 24GB unified memory
**OS**: macOS Sequoia 15.x
**Ollama**: v0.19+ (MLX backend)
**Extension**: Local dev build

---

## Prerequisites

1. Ollama installed and running on host
2. Extension installed from local dev build (`make install-dev`)
3. All test models pulled: `ollama pull gemma4 qwen3:8b llama3.2 qwen3:14b gemma4-fast qwen2.5:3b`
4. Ollama env vars set:
   ```bash
   export OLLAMA_FLASH_ATTENTION=1
   export OLLAMA_KV_CACHE_TYPE=q8_0
   export OLLAMA_NUM_PARALLEL=1
   export OLLAMA_KEEP_ALIVE=30m
   ```

---

## Test Matrix

### Test 1: Model Performance Benchmarks

**Goal**: Verify actual tokens/sec matches our estimates

| Model | Expected tok/s | Actual tok/s | Status |
|-------|----------------|--------------|--------|
| gemma4-fast | 35-45 | | |
| qwen2.5:3b | 40-50 | | |
| qwen3:8b | 28-35 | | |
| llama3.2 | 24-28 | | |
| gemma4 | 20-25 | | |
| qwen3.5 | 15-20 | | |
| qwen3:14b | 10-16 | | |

**Test Command**:
```bash
# Test generation speed
curl http://localhost:11434/api/generate -d '{
  "model": "gemma4",
  "prompt": "Write a paragraph about machine learning.",
  "stream": false
}' | jq '.eval_rate'
```

**Pass Criteria**:
- Actual tok/s within 20% of expected range
- No OOM errors
- Model loads successfully

---

### Test 2: Prompt Evaluation Timeout Risk

**Goal**: Verify which models hit the 120s timeout with large prompts

**Test Setup**:
1. Configure OpenClaw with `num_ctx: 16384` (16K context)
2. Create a large workspace file (simulate AGENTS.md at 15KB)
3. Send a complex multi-turn conversation to build context
4. Measure prompt eval time for each model

**Measurement**:
```bash
# Use Ollama API to measure prompt eval
curl http://localhost:11434/api/generate -d '{
  "model": "MODEL_NAME",
  "prompt": "PASTE_LARGE_PROMPT_HERE",
  "stream": false
}' | jq '.prompt_eval_count, .prompt_eval_duration'

# Calculate: prompt_eval_count / (prompt_eval_duration / 1e9) = tok/s
```

**Timeout Risk Verification**:

| Model | Context | Prompt Eval Time | Timeout? |
|-------|---------|------------------|----------|
| gemma4-fast | 8K | Expected: ~15s | |
| gemma4-fast | 16K | Expected: ~30s | |
| gemma4 | 8K | Expected: ~25s | |
| gemma4 | 16K | Expected: ~50s | |
| qwen3:14b | 8K | Expected: ~35s | |
| qwen3:14b | 16K | Expected: ~70s | |

**Pass Criteria**:
- gemma4 at 16K: <90s (safe margin)
- qwen3:14b at 16K: <100s (acceptable risk)
- No actual timeouts in OpenClaw during 5-turn conversation

---

### Test 3: Workspace File Size Impact

**Goal**: Quantify how workspace file size affects prompt eval time

**Test Steps**:
1. Start with minimal workspace (empty AGENTS.md)
2. Measure baseline prompt eval time
3. Add 10KB to AGENTS.md
4. Measure prompt eval time
5. Add another 10KB (20KB total)
6. Measure again

**Expected Impact**:
| Workspace Size | Added Eval Time |
|----------------|-----------------|
| 10KB | ~10-15s |
| 20KB | ~20-30s |

**Pass Criteria**:
- Each 10KB adds roughly 10-15s to eval time
- UI warnings appear at correct thresholds

---

### Test 4: Configuration Effectiveness

**Goal**: Verify each configuration change has expected effect

**Test A: Lean Mode**
1. Disable lean mode, measure prompt eval
2. Enable lean mode, measure again
3. Verify faster eval with lean mode

**Test B: Context Size**
1. Test with num_ctx: 32768
2. Test with num_ctx: 16384
3. Test with num_ctx: 8192
4. Verify smaller context = faster eval

**Test C: KV Cache Type**
1. Test with OLLAMA_KV_CACHE_TYPE=f16
2. Test with q8_0
3. Test with q4_0 (if available)
4. Verify memory usage and speed differences

**Pass Criteria**:
- Lean mode: 10-20% faster
- Half context size: ~40% faster
- q8_0 vs f16: similar speed, less memory

---

### Test 5: Full Extension Flow

**Goal**: End-to-end verification of hardware profile features

**Flow 1: First-time Setup**
1. Reset extension state
2. Open extension
3. Verify hardware detection shows "M4 Mac • 24GB • Balanced"
4. Select gemma4
5. Verify safe settings modal appears
6. Apply settings
7. Verify config applied correctly

**Flow 2: Model with Risk Warning**
1. Go to settings
2. Select qwen3:14b
3. Verify high risk warning appears
4. Verify mitigation suggestions shown
5. Apply with mitigations
6. Verify lean mode enabled and context reduced

**Flow 3: Workspace Size Check**
1. Create large AGENTS.md (20KB)
2. Restart extension
3. Verify size warning appears
4. Verify "trim" or "enable lean mode" actions work

**Pass Criteria**:
- All UI flows work without errors
- Configurations apply correctly
- Warnings appear at appropriate times

---

## Measurement Tools

### 1. Ollama API Timing Script

```bash
#!/bin/bash
# benchmark-model.sh

MODEL=$1
PROMPT="Write a detailed explanation of how neural networks work, including architecture, training process, and common applications. Be thorough and use examples."

echo "Benchmarking $MODEL..."

RESULT=$(curl -s http://localhost:11434/api/generate -d "{
  \"model\": \"$MODEL\",
  \"prompt\": \"$PROMPT\",
  \"stream\": false
}")

PROMPT_EVAL_COUNT=$(echo $RESULT | jq '.prompt_eval_count')
PROMPT_EVAL_DURATION=$(echo $RESULT | jq '.prompt_eval_duration')
EVAL_COUNT=$(echo $RESULT | jq '.eval_count')
EVAL_DURATION=$(echo $RESULT | jq '.eval_duration')

# Convert nanoseconds to seconds
PROMPT_EVAL_SECS=$(echo "scale=3; $PROMPT_EVAL_DURATION / 1000000000" | bc)
EVAL_SECS=$(echo "scale=3; $EVAL_DURATION / 1000000000" | bc)

# Calculate rates
PROMPT_RATE=$(echo "scale=1; $PROMPT_EVAL_COUNT / $PROMPT_EVAL_SECS" | bc)
GEN_RATE=$(echo "scale=1; $EVAL_COUNT / $EVAL_SECS" | bc)

echo "Prompt eval: $PROMPT_EVAL_COUNT tokens in ${PROMPT_EVAL_SECS}s = ${PROMPT_RATE} tok/s"
echo "Generation: $EVAL_COUNT tokens in ${EVAL_SECS}s = ${GEN_RATE} tok/s"
```

### 2. Workspace File Size Check

```bash
#!/bin/bash
# check-workspace.sh

CONTAINER="openclaw-docker-desktop-extension-runtime"

docker exec $CONTAINER sh -c '
  cd /home/node/.openclaw/workspace &&
  echo "=== Workspace File Sizes ===" &&
  wc -c AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md 2>/dev/null &&
  echo "=== Total ===" &&
  cat AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md 2>/dev/null | wc -c
'
```

### 3. OpenClaw Config Verification

```bash
#!/bin/bash
# verify-config.sh

CONTAINER="openclaw-docker-desktop-extension-runtime"

echo "=== OpenClaw Config ==="
docker exec $CONTAINER cat /home/node/.openclaw/openclaw.json | jq .

echo ""
echo "=== Ollama Model Config ==="
docker exec $CONTAINER cat /home/node/.openclaw/openclaw.json | jq '.models.providers.ollama.models[0]'
```

---

## Expected Results Summary

### M4 Mac 24GB - Balanced Profile

**Recommended Models**:
1. **gemma4** - Primary recommendation
   - Speed: ~22 tok/s
   - Prompt eval: ~25-35s at 16K context
   - Risk: Low to Medium
   
2. **qwen3:8b** - Fast alternative
   - Speed: ~30 tok/s
   - Prompt eval: ~20-25s at 16K context
   - Risk: Low

3. **gemma4-fast** - Maximum speed
   - Speed: ~40 tok/s
   - Prompt eval: ~15-20s at 16K context
   - Risk: Very Low

**Configuration**:
- num_ctx: 16384
- localModelLean: true
- OLLAMA_KV_CACHE_TYPE: q8_0
- OLLAMA_FLASH_ATTENTION: 1

**Timeout Risk Models**:
- qwen3:14b at 16K context: ~60-70s eval (medium risk)
- qwen3.5 at 16K context: ~50-60s eval (medium risk)

---

## Success Criteria

### Absolute Requirements
- [ ] gemma4 at 16K context: <90s prompt eval
- [ ] gemma4-fast at 16K context: <60s prompt eval
- [ ] No timeouts during normal 5-turn conversation
- [ ] Extension hardware detection works
- [ ] Model recommendations appropriate for hardware

### Nice-to-Have
- [ ] qwen3:14b at 16K context: <100s eval (borderline but usable)
- [ ] Lean mode provides measurable improvement
- [ ] UI warnings prevent user from selecting inappropriate models

---

## Issue Tracking

Use this section during testing to record actual vs expected:

| Test | Expected | Actual | Status | Notes |
|------|----------|--------|--------|-------|
| gemma4 tok/s | 20-25 | | | |
| gemma4 eval 16K | ~35s | | | |
| qwen3:14b eval 16K | ~70s | | | |
| Lean mode improvement | 10-20% | | | |
| Hardware detection | M4 24GB | | | |

---

## Sign-Off

**Tester**: _________________
**Date**: _________________
**Hardware**: _________________
**Ollama Version**: _________________

**Overall Result**: [ ] PASS [ ] FAIL

**Blocking Issues**:
- [ ] None
- [ ] Issue 1: _________________
- [ ] Issue 2: _________________

**Notes**:
_________________________________
_________________________________
