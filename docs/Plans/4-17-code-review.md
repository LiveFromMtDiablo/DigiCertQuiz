# Code & Architecture Review: `src/components/QuizGame.js`

## Context

`QuizGame.js` is the container component that orchestrates the entire quiz experience: identity, eligibility, attempt resume, question flow, scoring, and leaderboard submission. At 962 lines it's the largest file in the project. This review assesses structure, correctness, React patterns, and performance — then prioritizes what's worth fixing.

**Not an implementation plan.** This is analysis. Happy to follow up by extracting a plan per section if you want to act on any of it.

---

## Executive summary

The file is in decent shape — view logic is already lifted into three screen components, state is consolidated in `useQuizState`, score submission is in `useLeaderboardSubmission`, and pure logic is spread across `utils/quizAttemptState`, `quizEligibility`, and `deviceFingerprint`. Good bones.

What remains in the container is still doing **too much**: a 130-line eligibility/resume effect, a 200-line `handleStart`, two near-duplicate restore functions, and several helpers that don't need to live inside the component. There's also one likely null-deref bug, a couple of memoization problems that silently defeat the child hooks, and some inconsistent error-logging conventions.

Nothing is on fire. Everything below is an incremental cleanup.

---

## Strengths worth preserving

1. **Separation of view from logic.** `IntroScreen` / `QuestionScreen` / `LeaderboardScreen` receive props only — no data fetching in children. Good.
2. **State reducer pattern** ([useQuizState.js:24](src/hooks/useQuizState.js:24)) with `set_field` / `merge_state` / `reset_runtime_state` is clean and keeps setters stable via `useCallback`.
3. **Secure shuffle** — `secureRandomInt` at [QuizGame.js:117](src/components/QuizGame.js:117) uses `crypto.getRandomValues` with rejection sampling to avoid modulo bias. Correct implementation.
4. **Multi-source attempt reconciliation** via `chooseCanonicalAttempt` — local, server-own, fingerprint-locked — is a non-trivial UX win.
5. **Cancellation pattern** in the async effect ([QuizGame.js:369](src/components/QuizGame.js:369)) correctly guards against stale updates.
6. **`shouldPreserveOptionOrder`** logic for "All of the above" and grouped references (A/B, "A and C") is a subtle correctness fix that most quiz implementations miss.

---

## Findings

### P1 — Correctness risks

**1. Null-deref on degraded-auth path** — [QuizGame.js:760](src/components/QuizGame.js:760)
```js
if (ownAttempt.res && (ownAttempt.res.status === 401 || ...)) {
```
If `fetchAttemptByUid` ever returns `undefined` (e.g., the promise rejects and is caught elsewhere, or the API shape drifts), this throws before the fallback resume runs. Should be `ownAttempt?.res?.status === 401 || ownAttempt?.res?.status === 403`. Worth a grep through `fetchAttemptByUid` to confirm the return shape is reliably `{ data, res, uid }`.

**2. Two restore functions ~80% identical** — `restoreStoredAttempt` ([L193](src/components/QuizGame.js:193)) and `restoreServerAttempt` ([L240](src/components/QuizGame.js:240)) differ only in their source (`attempt.gameQuestions` vs `parseQuestionSet(attempt.questionSet)`), the `playerName` key (`playerName` vs `name`), and the resume message. Duplication means drift: fix a bug in one and forget the other. Unify into `restoreAttempt(source, attempt)` with the source-specific bits passed in.

**3. Effect ordering race** — the "reset + restore local" effect ([L347](src/components/QuizGame.js:347)) and the "check server" effect ([L368](src/components/QuizGame.js:368)) both depend on `[identityRefreshNonce, quizId]` and run in parallel on mount. The first synchronously restores local; the second later may overwrite it with server-own or fingerprint data. User may briefly see the local restore flash in before the server data lands. Usually fine, but visually jarring and the double-restore is wasted work. Consolidate into one hook.

---

### P2 — Architecture / size

**4. The container still owns too much.** Despite the extractions, QuizGame.js has three major responsibilities left inline:

  - **Eligibility + resume orchestration** (L341–504) — extract to `useQuizEligibility({ quizId, questions, identityRefreshNonce })` returning `{ status, restoredAttempt, error }`. The host component would only decide which screen to render.
  - **Attempt lifecycle** — `handleStart` (L602–798), `handleSubmitAnswer` (L800), `handleNextQuestion` (L843). These belong in a `useQuizAttempt` or similar hook. `handleStart` alone is 196 lines and mixes: client validation → name-index probe → server reservation → three fallback branches → local-only degraded mode. Each branch is legitimate, but the code reads like a state machine that's been flattened into conditionals. A tiny state machine (`idle | validating | reserving | fallback | ready`) would make the branches explicit.
  - **Local persistence effect** (L543–576) writes to localStorage on every state change while on the question screen. With a 1-second timer tick updating `timeLeft`, this means a `JSON.stringify` of the whole attempt every second. Measure, but consider: (a) only persist on meaningful transitions (answer submit, next question), and (b) keep the tick-level persistence but omit `timeLeft` from the stored record and derive it from `questionDeadlineAt` on restore (you're already half-doing this via `computeRestoredTimeLeft`).

**5. Helpers that shouldn't live in the component body.** `secureRandomInt`, `shuffleArray`, `isGroupedOptionReference`, `shuffleQuestionsAndOptions`, `getAttemptIdentity`, `syncCurrentServerAttempt`, `markQuizSubmitted` — all pure (or nearly pure) functions recreated on every render. Move the pure ones to `utils/quizShuffle.js` and wrap `markQuizSubmitted` / `syncCurrentServerAttempt` in `useCallback`.

---

### P3 — React correctness

**6. `markQuizSubmitted` is not stable** — declared as a plain function ([L105](src/components/QuizGame.js:105)) and passed into `useLeaderboardSubmission` ([L337](src/components/QuizGame.js:337)). Since `useLeaderboardSubmission` lists `markQuizSubmitted` in its deps, the returned `saveScore` callback is re-created on every render. Not a bug but defeats the `useCallback` inside the hook. Wrap in `useCallback` (no deps needed — it only uses `quizId` and `setAlreadySubmitted`).

**7. Per-render storage reads** — [L60–62](src/components/QuizGame.js:60):
```js
const devFingerprintResetEnabled = isDevFingerprintResetEnabled();
const devFingerprintSeed = getDevFingerprintSeed();
const devFingerprintSeedLabel = formatDevFingerprintSeed(devFingerprintSeed);
```
These run on every render of QuizGame, whether the intro or leaderboard screen is shown. `getDevFingerprintSeed` reads localStorage each time (worth confirming in that util). Memoize with `useMemo` or move into the intro/leaderboard screens themselves.

**8. Timer re-subscribes every tick** — the deadline-sync effect ([L508](src/components/QuizGame.js:508)) lists `timeLeft` in its deps, so every time the interval fires and calls `setTimeLeft(nextTimeLeft)`, the whole effect tears down and re-mounts (new interval). The `lastSyncedTimeLeft` local is also reset. Not broken, but churn. Drop `timeLeft` from deps; the interval reads from the deadline on each tick anyway.

**9. `loadLeaderboard` useCallback missing `setError`** — [L325](src/components/QuizGame.js:325). `setError` is stable (from `useFieldSetter`), so no runtime bug, but `exhaustive-deps` will flag it. Add it or silence the rule explicitly.

**10. `try { console.debug(...) } catch {}`** — [L315](src/components/QuizGame.js:315). `console.debug` doesn't throw. Drop the try/catch or remove the log entirely.

---

### P4 — Consistency / polish

**11. Mixed error-logging conventions.** Both `console.error`/`console.warn` and `logSilent` appear. Pick one policy: e.g., "use `logSilent` for expected/recoverable failures, `console.error` only for unexpected exceptions," and apply uniformly. Example divergence: [L299](src/components/QuizGame.js:299) uses `console.warn`, [L386](src/components/QuizGame.js:386) uses `logSilent` — both describe similar situations.

**12. Fallback scoring uses unshuffled `questions`** — [L802](src/components/QuizGame.js:802), [L844](src/components/QuizGame.js:844):
```js
const activeQuestions = gameQuestions || questions;
```
If `gameQuestions` is ever null on the question screen, the `correctAnswer` indexes would be from the unshuffled source. In practice, the flow guarantees `gameQuestions` is set before `screen === "question"` — so this is defensive but misleading. Either assert `gameQuestions` must exist on the question screen, or remove the fallback so a bug surfaces loudly instead of silently mis-scoring.

**13. Client-side scoring is trust-the-browser.** `handleSubmitAnswer` computes `correct` client-side and only the final score is submitted. If the quiz ever needs to be resistant to devtools tampering, scoring has to move server-side (question set + answers validated against a server record). Today's fingerprint + name-index + single-submit locks mitigate *who* submits, not *what* score. Worth flagging as a known trade-off rather than a defect.

**14. Missing container-level test.** There's `quiz-game/IntroScreen.test.js` but no `QuizGame.test.js`. The highest-risk logic (eligibility effect, `handleStart` fallback tree, multi-source attempt restore) is untested at the integration level. A handful of tests with mocked `leaderboardApi` would catch regressions cheaply.

---

## Suggested refactor sequence (if you want to act)

In order of value-per-effort:

1. **Fix the `ownAttempt.res` optional chain** (one-line, zero risk).
2. **Unify `restoreStoredAttempt` / `restoreServerAttempt`** (~30 LOC saved, reduces drift risk).
3. **Extract `useQuizEligibility` hook** — pulls the L347 + L368 effects into one place with a clear return shape. Biggest win for readability.
4. **Stabilize `markQuizSubmitted` with `useCallback`**; move pure shuffle helpers to `utils/quizShuffle.js`.
5. **Extract `useQuizAttempt` hook** housing `handleStart`/`handleSubmitAnswer`/`handleNextQuestion` and the persistence effect.
6. **Tests** — cover the fallback paths in `handleStart` and the multi-source restore.

After steps 1–5 the container should land around ~250–300 lines and read top-to-bottom as a coordinator of three hooks and three screens.

---

## Files referenced

- [src/components/QuizGame.js](src/components/QuizGame.js) — subject of review
- [src/hooks/useQuizState.js](src/hooks/useQuizState.js) — state reducer (good)
- [src/hooks/useLeaderboardSubmission.js](src/hooks/useLeaderboardSubmission.js) — receives non-stable `markQuizSubmitted`
- [src/utils/quizAttemptState.js](src/utils/quizAttemptState.js) — storage + `chooseCanonicalAttempt`
- [src/components/quiz-game/IntroScreen.js](src/components/quiz-game/IntroScreen.js), [QuestionScreen.js](src/components/quiz-game/QuestionScreen.js), [LeaderboardScreen.js](src/components/quiz-game/LeaderboardScreen.js) — view layer (good separation)

## Verification

No code changes are being proposed here; this document is the deliverable. If you want to act on any finding, each item is independently testable:
- For refactors (items 2–5): run the existing test suite (`npm test`) after each step; add targeted tests for new hooks before extracting.
- For the null-deref fix (item 1): simulate `fetchAttemptByUid` rejecting and confirm the fallback path still renders a usable error.
