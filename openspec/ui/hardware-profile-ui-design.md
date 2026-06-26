# Hardware Profile System - UI Design Document

## Design Principles

1. **Transparent**: Show users what we detected and why we're recommending settings
2. **Non-blocking**: Never prevent user from overriding recommendations
3. **Educational**: Explain the "why" behind each suggestion
4. **Progressive disclosure**: Start simple, allow deep dives

---

## Screen 1: Hardware Detection Banner

### Purpose
Immediately show users we understand their hardware and have tailored recommendations.

### Placement
Top of main extension panel, persistent once detected.

### Design

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐     │
│  │ 🖥️  M4 Mac • 24GB RAM • Apple GPU                        │  ✓ │
│  │ Balanced profile: Optimized for 8-14B models             │     │
│  │ [Optimize Settings] [Change Profile] [ⓘ]                 │     │
│  └─────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

### States

**Initial (Detecting):**
```
┌────────────────────────────────────────┐
│ 🔍 Detecting your Mac hardware...      │
└────────────────────────────────────────┘
```

**Detected:**
```
┌─────────────────────────────────────────────────────────┐
│ 🖥️  M4 Pro • 24GB RAM • Apple GPU                        │
│ Balanced profile: Optimized for 8-14B models          │
│ [Optimize Settings] [ⓘ]                               │
└─────────────────────────────────────────────────────────┘
```

**Manual Override Active:**
```
┌─────────────────────────────────────────────────────────┐
│ 🖥️  M4 Pro • 24GB RAM (Custom: Light profile)           │
│ [Revert to Auto] [ⓘ]                                    │
└─────────────────────────────────────────────────────────┘
```

### Interaction
- Clicking chip icon opens hardware details modal
- "Optimize Settings" applies profile defaults
- Info icon opens local-model-tuning.md

---

## Screen 2: Model Selection with Performance Indicators

### Purpose
Help users choose appropriate models for their hardware with clear performance expectations.

### Placement
Ollama setup flow, after connection test.

### Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Select Ollama Model                                              │
│                                                                   │
│  🖥️  Using: M4 Mac, 24GB RAM                                     │
│                                                                   │
│  ─────────────────────────────────────────────────────────────   │
│  ⭐ RECOMMENDED FOR YOUR MAC                                      │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🔥 Gemma 4 (9B)         [Recommended]                      │  │
│  │    ~22 tokens/sec • ~6GB RAM • Good balance               │  │
│  │    ✓ Low timeout risk                                     │  │
│  │    [Select]                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Qwen3 8B               [Recommended]                      │  │
│  │    ~30 tokens/sec • ~5GB RAM • Fast responses           │  │
│  │    ✓ Low timeout risk                                     │  │
│  │    [Select]                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Gemma 4 Fast (4B)                                       │  │
│  │    ~40 tokens/sec • ~3GB RAM • Maximum speed            │  │
│  │    ✓ Low timeout risk                                     │  │
│  │    [Select]                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ─────────────────────────────────────────────────────────────   │
│  OTHER AVAILABLE MODELS                                           │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Qwen3.5 (9.7B)                                          │  │
│  │    ~18 tokens/sec • ~6GB RAM • Higher quality           │  │
│  │    ⚠️ Medium timeout risk on large prompts               │  │
│  │    [Select]                                               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Qwen3 14B              [Advanced]                       │  │
│  │    ~13 tokens/sec • ~9GB RAM • Slower, stronger          │  │
│  │    ⚠️ High timeout risk • May need lean mode             │  │
│  │    [Select with Warnings]                                   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [Show All Models...]                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Card Components

Each model card shows:
- **Model name** + parameter count
- **Performance badge**: 🔥 Fast, ⚡ Balanced, 🐢 Slow
- **Tokens/sec**: Estimated range
- **RAM usage**: Approximate memory needed
- **Risk indicator**: ✓ Low / ⚠️ Medium / 🚫 High timeout risk
- **Description**: One-line use case
- **Action button**: Select / Select with Warnings

### Risk Calculation Display

When user hovers on risk indicator:

```
┌─────────────────────────────────────┐
│  ⚠️ Timeout Risk Explained          │
│                                     │
│  Estimated performance on your Mac: │
│  • Prompt eval: 25-35s (typical)    │
│  • Token generation: ~18 tok/s      │
│                                     │
│  Risk factors:                      │
│  • Large prompts (>15K tokens)      │
│  • Heavy tool usage                 │
│  • Large workspace files            │
│                                     │
│  [Learn how to mitigate]           │
└─────────────────────────────────────┘
```

---

## Screen 3: Safe Settings Confirmation

### Purpose
Apply hardware-optimized configuration with user consent and transparency.

### Placement
After model selection, before applying to OpenClaw.

### Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Apply Safe Settings for Qwen3.5?                               │
│                                                                   │
│  Based on your M4 Mac (24GB), we recommend:                     │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ⚙️ Configuration Changes                                │  │
│  │                                                           │  │
│  │  OpenClaw Settings:                                      │  │
│  │  • Enable lean mode (smaller prompts)        [✓]         │  │
│  │  • Set context window to 16K tokens          [✓]         │  │
│  │  • Configure early compaction                [✓]         │  │
│  │                                                           │  │
│  │  Ollama Host Settings (copy these):                      │  │
│  │  • OLLAMA_FLASH_ATTENTION=1                            │  │
│  │  • OLLAMA_KV_CACHE_TYPE=q8_0                           │  │
│  │  • OLLAMA_KEEP_ALIVE=30m                               │  │
│  │    [Copy Commands]                                       │  │
│  │                                                           │  │
│  │  Expected improvement:                                   │  │
│  │  • Prompt eval: 40% faster                             │  │
│  │  • Timeout risk: Low → Very Low                        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [Apply Settings]  [Customize...]  [Skip - Use Defaults]        │
│                                                                   │
│  💡 Tip: You can change these later in Settings                 │
└─────────────────────────────────────────────────────────────────┘
```

### Customization Modal

If user clicks "Customize...":

```
┌─────────────────────────────────────────────────────────────────┐
│  Customize Configuration                                        │
│                                                                   │
│  Context Window                                                 │
│  ● 8K (fastest)  ○ 16K (balanced)  ○ 32K (full)                 │
│  Smaller = faster prompt evaluation                             │
│                                                                   │
│  Lean Mode                                                      │
│  ☑ Enable lean mode (removes browser/cron/message tools)       │
│  Reduces prompt size, helpful for timeout prevention           │
│                                                                   │
│  Tool Support                                                   │
│  ☑ Enable full tool support (may increase prompt size)         │
│                                                                   │
│  Compaction                                                     │
│  Trigger compaction when within: [8192] tokens of limit       │
│                                                                   │
│           [Cancel]  [Apply Custom]                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Screen 4: Workspace File Size Guard

### Purpose
Warn users when workspace files are large enough to impact performance.

### Placement
Shown during setup completion and in Settings > Diagnostics.

### Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Workspace File Check                                             │
│                                                                   │
│  ⚠️ Large files may slow down prompt evaluation                │
│                                                                   │
│  Your workspace files:                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ File              Size      Status   Impact                 │  │
│  │ ─────────────────────────────────────────────────────────  │  │
│  │ AGENTS.md         15.4 KB   ⚠️ Large  ~25s eval time        │  │
│  │ SOUL.md           8.2 KB    ⚠️ Large  ~13s eval time        │  │
│  │ TOOLS.md          2.1 KB    ✓ OK     ~3s eval time         │  │
│  │ IDENTITY.md       0.8 KB    ✓ OK     ~1s eval time         │  │
│  │ USER.md           0.4 KB    ✓ OK     ~1s eval time         │  │
│  │ ─────────────────────────────────────────────────────────  │  │
│  │ TOTAL             26.9 KB   ⚠️ High  ~43s added eval       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  💡 This adds ~43 seconds to every prompt evaluation            │
│     on your hardware (M4 24GB)                                   │
│                                                                   │
│  Quick fixes:                                                   │
│  [Enable Lean Mode] [Open in Control UI] [Learn More]           │
│                                                                   │
│  [Dismiss]  [Don't Show Again]                                    │
└─────────────────────────────────────────────────────────────────┘
```

### File Actions Dropdown

Each file row has actions:

```
┌────────────────────────┐
│ Actions for AGENTS.md  │
├────────────────────────┤
│ View in Control UI     │
│ ─────────────────────  │
│ Open in editor         │
│ Move to docs/ folder   │
│ ─────────────────────  │
│ Trim to 8K characters  │
│ (creates backup)       │
└────────────────────────┘
```

---

## Screen 5: Ollama Host Optimization Guide

### Purpose
Help users configure their host Ollama for optimal performance.

### Placement
Shown after Ollama connection test if optimizations are available.

### Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Optimize Your Ollama Host                                        │
│                                                                   │
│  🖥️  Detected: Ollama running on your Mac (host)                 │
│                                                                   │
│  Your hardware (M4, 24GB) can benefit from these settings:        │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Current vs Recommended                                  │  │
│  │                                                           │  │
│  │  OLLAMA_FLASH_ATTENTION    ❌ Not set  →  ✅ 1          │  │
│  │  OLLAMA_KV_CACHE_TYPE      f16 (default) →  q8_0         │  │
│  │  OLLAMA_NUM_PARALLEL       4 (default)   →  1            │  │
│  │  OLLAMA_KEEP_ALIVE         5m (default)  →  30m        │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Expected benefits:                                             │
│  • 30% faster prompt evaluation                                  │
│  • 50% less memory usage                                        │
│  • Lower risk of 120s timeout                                   │
│                                                                   │
│  To apply, run these commands in Terminal:                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  # Add to your ~/.zshrc or ~/.bash_profile                │  │
│  │  export OLLAMA_FLASH_ATTENTION=1                          │  │
│  │  export OLLAMA_KV_CACHE_TYPE=q8_0                          │  │
│  │  export OLLAMA_NUM_PARALLEL=1                              │  │
│  │  export OLLAMA_KEEP_ALIVE=30m                            │  │
│  │                                                           │  │
│  │  # Then restart Ollama                                    │  │
│  │  killall ollama && ollama serve                          │  │
│  └───────────────────────────────────────────────────────────┘  │
│  [Copy All Commands]  [Copy Export Lines Only]                  │
│                                                                   │
│  [I've Already Done This]  [Remind Me Later]  [Don't Ask Again] │
└─────────────────────────────────────────────────────────────────┘
```

### Check Verification

After user clicks "I've Already Done This":

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Verifying Ollama Settings...                                │
│                                                                   │
│  Testing with a small prompt...                                  │
│  ✓ OLLAMA_FLASH_ATTENTION is active                            │
│  ✓ Response time improved (was: 45s, now: 28s)                  │
│                                                                   │
│  [Done]                                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Screen 6: Settings Panel Integration

### Purpose
Allow users to view and adjust hardware profile settings.

### Placement
New "Hardware & Performance" section in Settings tab.

### Design

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                                      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ HARDWARE & PERFORMANCE                                      ││
│  │                                                              ││
│  │ Detected Profile                                            ││
│  │ 🖥️  M4 Mac • 24GB RAM • Apple GPU                           ││
│  │ Balanced (8-14B models recommended)                         ││
│  │ [Change to Light] [Change to Performance]                   ││
│  │                                                              ││
│  │ ─────────────────────────────────────────────────────────    ││
│  │                                                              ││
│  │ Performance Settings                                         ││
│  │                                                              ││
│  │ Lean Mode           [Enabled ▼]                             ││
│  │ Context Window      [16384 tokens ▼]                        ││
│  │ Tool Support        [Full ▼]                                  ││
│  │ Compaction Reserve  [8192 tokens ▼]                         ││
│  │                                                              ││
│  │ ─────────────────────────────────────────────────────────    ││
│  │                                                              ││
│  │ Diagnostics                                                  ││
│  │ [Check Workspace File Sizes]                                ││
│  │ [Test Current Performance]                                  ││
│  │ [View Local Model Tuning Guide]                            ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                   │
│  [Save Changes]  [Reset to Profile Defaults]                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

### Narrow Panel (Docker Desktop default)

```
┌─────────────────────────────┐
│ 🖥️ M4 • 24GB               │
│ Balanced profile            │
│ [Optimize] [ⓘ]             │
└─────────────────────────────┘
```

```
┌─────────────────────────────┐
│ Select Model                │
│                             │
│ ⭐ Recommended:              │
│ 🔥 Gemma 4 (9B)            │
│ ~22 tok/s • ✓ Low risk     │
│ [Select]                   │
│                             │
│  More models...             │
└─────────────────────────────┘
```

### Wide Panel (User expanded)

Full designs as shown above.

---

## Animation & Transitions

### Hardware Detection

1. **Scanning**: Pulse animation on chip icon (2s)
2. **Success**: Checkmark fade in, profile slide down (300ms)
3. **Error**: Shake animation, show manual selection

### Model Cards

1. **Hover**: Subtle lift (translateY -2px) + shadow increase
2. **Select**: Border highlight + ripple effect
3. **Risk reveal**: Yellow pulse on ⚠️ icon

### Settings Applied

1. **Success toast**: Slide in from bottom, auto-dismiss 5s
2. **Config change**: Subtle fade on affected values

---

## Color Scheme

| Element | Color | Usage |
|---------|-------|-------|
| Low risk | Green #22c55e | ✓ indicators |
| Medium risk | Amber #f59e0b | ⚠️ warnings |
| High risk | Red #ef4444 | 🚫 errors |
| Recommended | Blue #3b82f6 | ⭐ badges |
| Fast | Orange #f97316 | 🔥 indicators |
| Info | Gray #6b7280 | Tooltips, secondary |

---

## Accessibility

- All risk indicators have text equivalents (not just color)
- Icons have aria-labels
- Keyboard navigation for all interactive elements
- Reduced motion support via `prefers-reduced-motion`
