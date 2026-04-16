# QuizGame Refactor — Refreshed Review (v3, Final)

## Context

First-pass review was high-level and architectural. Second pass applied a sharper React-specific lens (hook dependencies, re-render behavior, test quality, accessibility, race conditions). This third version incorporates review from Codex, who corrected two overreaches and caught one a11y miss. The final prioritized list below reflects our agreed position.

**Evolution of the review**
- **v1** (structural): correctly flagged prop explosion, silent errors, and the then-946-line god component
- **v2** (React-specific): surfaced a real missing-dep bug, argued for React.memo on screens, framed auth/reserve as TOCTOU, called out broad test gaps and a11y holes
- **v3** (final, post-Codex): replaced the React.memo fix with a better root-cause fix at the timer dispatch, reframed auth/reserve as an error-classification issue (not a race), narrowed the test-gap finding to the one specific swallow, added the `IntroScreen` label gap Codex caught

---

## Agreed Findings

### Correctness

**Missing dep — `QuizGame.js:519`**
The "time expired" effect has deps `[currentQuestion, screen, showFeedback, timeLeft, totalScore]` but is missing `questionDeadlineAt`. If a deadline is ever reset while `timeLeft` is already 0, the effect won't re-fire. Low real-world probability, but a genuine correctness bug.

### Performance

**Timer dispatches re-render every 250ms even when displayed second is unchanged — `QuizGame.js:507`**
The interval fires every 250ms and dispatches `setTimeLeft` unconditionally. The `useQuizState` reducer returns `{...state, [field]: value}` on every `set_field`, so `useReducer` doesn't bail out the way `useState` would on equal primitives — every tick re-renders `QuestionScreen` even when the integer second hasn't changed.

Fix: gate the dispatch at the interval callsite on integer-second change. This kills the re-render at the source, which is strictly cheaper than memoizing downstream children.

(An earlier version of this review proposed wrapping the three screen components in `React.memo`. Codex correctly pointed out that only `QuestionScreen` is mounted during active timer ticks, so memoizing `IntroScreen`/`LeaderboardScreen` wouldn't touch the hot path.)

### Accessibility

- `IntroScreen.js:135` — name input has a placeholder but no proper `<label htmlFor>`. Placeholder-as-label is a known screen-reader trap: the text disappears on focus and is inconsistently announced.
- `QuestionScreen.js:56-82` — answer options are plain `<button>`s. Add `role="radiogroup"` on the container and `role="radio"` on each option with appropriate `aria-checked`.
- `QuestionScreen.js:31` — timer has no `aria-live`. Add `aria-live="polite"` so remaining time is announced.
- `QuestionScreen.js:85-112` — correct/incorrect feedback is color-only. Add `role="status"` so it's announced when it appears.
- `LeaderboardScreen.js:74-102` — ranked list is `<div>`s. Use a semantic `<ol>`.
- No focus management on screen transitions (`QuizGame.js:679` and friends). Lower priority than the above.

### Error Classification (not TOCTOU)

**Auth expiry during attempt reservation — `QuizGame.js`**
`getAttemptIdentity()` is called right before reservation (lines 279 and 666) and there's a re-auth path at line 707, so this is not a race-condition bug. However, if auth expires between check and reserve, the user sees a generic "couldn't start" error. The right fix is to classify this specific failure mode and show a targeted retry prompt.

(v2 framed this as TOCTOU. That was too dramatic — Codex correctly reframed it as error-classification work.)

### Silent Failures

Two bare catches should log via the existing `logSilent` pattern:
- `QuizGame.js:625` — `shuffleQuestionsAndOptions` falls back to unshuffled order with no breadcrumb. If shuffling ever breaks, quiz order becomes deterministic invisibly.
- `deviceFingerprint.js:88` — `rotateDevFingerprintSeed` silently ignores localStorage failures (quota, disabled). Dev reset appears to succeed but may have partially failed.

The other ~7 silent catches are intentional graceful degradation and fine as-is.

### Test Coverage

The suite already covers substantially more than v2 claimed. Confirmed coverage in `QuizGame.test.js`:
- Restored timed-out attempts (line 485)
- 403 graceful degradation (line 703)
- Reservation-failure recovery (line 870)
- Local-only fallback (line 912)
- 401/403 save failures (lines 1090, 1132)

Remaining specific gap worth filling: the eligibility lookup silent-swallow at `QuizGame.js:380` (the `completedFingerprintLookup` 401/403 path).

(v2 claimed broader untested branches around 401/403 handling and tab-backgrounding. The 401/403 framing was wrong once the coverage above is laid out; tab-backgrounding and same-instant-submit are still uncovered but are nice-to-haves, not "classes of bug that would ship undetected" as v2 asserted.)

---

## Final Prioritized List (agreed with Codex)

1. **Fix the missing dep at `QuizGame.js:519` AND gate timer updates at the source** — correctness bug + the real perf win, both small
2. **Accessibility pass** across `QuestionScreen.js` (roles, aria-live, role=status), `LeaderboardScreen.js` (semantic `<ol>`), and `IntroScreen.js:135` (proper label on the name input)
3. **Improve auth-expiry error messaging** around attempt reservation (classify the specific failure instead of showing a generic "couldn't start")
4. **Add the narrow eligibility 401/403 swallow test** at `QuizGame.js:380`
5. **Log the bare catches** at `QuizGame.js:625` and `deviceFingerprint.js:88` via `logSilent`
6. **Phase 7 (later): `useEligibility` / `useAttemptRestore` extraction** to get `QuizGame.js` under 500 lines — leave as future cleanup

---

## Files That Would Change

- `src/components/QuizGame.js` — missing-dep fix, timer-dispatch gate, auth-expiry error classification, `logSilent` at line 625
- `src/components/quiz-game/IntroScreen.js` — `<label htmlFor>` on the name input
- `src/components/quiz-game/QuestionScreen.js` — `role="radiogroup"`/`role="radio"`, `aria-live="polite"` on timer, `role="status"` on feedback
- `src/components/quiz-game/LeaderboardScreen.js` — semantic `<ol>` in place of `<div>` list
- `src/utils/deviceFingerprint.js` — `logSilent` on the `rotateDevFingerprintSeed` catch
- `src/components/QuizGame.test.js` — one narrow test for the line 380 eligibility swallow

## Verification Plan

- `npm test` — full suite green, including the new eligibility swallow test
- `npm test:coverage` — confirm the new test exercises the target branch
- Manual with axe DevTools or VoiceOver: walk the intro → question → results flow and confirm the name input, options, timer, feedback, and leaderboard are all announced correctly
- Manual: trigger an auth expiry mid-reserve (e.g., by invalidating the cached token) and confirm the user sees a targeted retry prompt instead of a generic error
- Production: watch for any shift in "couldn't start" error rates after the auth-classification change lands

---

**Bottom line**: the refactoring is solid. The final punch list above is grounded in how this specific code actually behaves — the root-cause timer fix replaces a blanket React.memo instinct, the auth issue is error-messaging not a race, and the test critique is scoped to the one real hole. The extraction work remains a good later-phase cleanup but isn't blocking anything today.
