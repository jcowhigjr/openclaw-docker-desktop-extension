## 1. Config & state foundation

- [x] 1.1 Add `providerChoice: 'unset' | 'ollama' | 'anthropic'` to `ExtensionConfig` and `DEFAULT_CONFIG` in `ui/src/App.tsx`
- [ ] 1.2 Update `loadConfig()` to default `providerChoice` to `'unset'`, and infer a resolved choice for existing installs (e.g. an Ollama default already configured) so upgraders are not re-onboarded
- [x] 1.3 Ensure `persistConfig()` writes the new field

## 2. Pure onboarding logic module (TDD)

- [x] 2.1 Create `ui/src/firstRunOnboarding.ts` with `deriveOnboardingPhase(config, detectionResult)` returning the UI phase (`fork` | `free-needs-model` | `free-ready` | `resolved`)
- [x] 2.2 Add a `isChatGated(config, ollamaModelApplied)` predicate
- [x] 2.3 Add button/label helpers (mirror `ollamaUiState.ts` style)
- [x] 2.4 Write `ui/src/firstRunOnboarding.test.ts` covering each phase, the upgrader-resolved case, and the gating predicate

## 3. Onboarding UI

- [x] 3.1 Render a first-run provider fork card in `App.tsx` while phase !== `resolved` (Free local vs Hosted), replacing/augmenting the static Quick Start steps at `ui/src/App.tsx:928-947`
- [x] 3.2 Run Ollama detection on first-run mount (reuse `detectOllamaModels`/`runDetect`); pre-select Free local and show one-click "Use <model>" (via `chooseRecommendedOllamaModel` + `applyOllamaSetup`) when a model exists
- [x] 3.3 Free-local remediation states: actionable CTA + ollama.com link when unreachable; copyable `ollama pull <model>` + re-detect when zero models
- [x] 3.4 Hosted path: capture key / point at OpenClaw `.env` per README (thin); mark `providerChoice = 'anthropic'`
- [x] 3.5 Add a visible "skip / I configured this elsewhere" action that resolves onboarding
- [x] 3.6 On completing either path, set `providerChoice` and persist

## 4. Chat gating

- [ ] 4.1 Gate the chat / Open Control UI affordance on `isChatGated(...)`; show the "choose a provider / pick a model first" CTA instead of letting the raw anthropic error be the first experience
- [ ] 4.2 Add a "change provider" reset that returns to the fork

## 5. Verification

- [x] 5.1 Run `npm test` / vitest in `ui/` — all new and existing tests green
- [x] 5.2 Run typecheck + lint/build (`npm run build` in `ui/`)
- [ ] 5.3 Manual smoke: fresh config (no `providerChoice`) shows fork; Ollama-with-model gives one-click apply then unblocks chat; Ollama-without-model shows pull CTA; hosted path resolves; upgrader with existing Ollama default is NOT re-onboarded
- [ ] 5.4 Update README onboarding section to match the new first-run flow
