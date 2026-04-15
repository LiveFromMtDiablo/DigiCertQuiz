# QuizGame Refactor Plan

## Purpose

This document breaks the `src/components/QuizGame.js` decomposition into small, testable milestones that can be completed across multiple sessions or sprints without losing direction.

It is intended to answer four questions at every handoff:

1. What are we extracting next?
2. What should not change yet?
3. Which tests prove the extraction is safe?
4. What is the clean stopping point for this phase?

## Current State

As of April 15, 2026:

- `src/components/QuizGame.js` is 1,754 lines.
- The component currently owns:
  - intro / question / leaderboard rendering
  - timer and scoring flow
  - local attempt persistence
  - server attempt restore and synchronization
  - device fingerprint and dev reset behavior
  - leaderboard loading
  - final score submission and save-failure classification
- `src/components/QuizGame.test.js` already provides strong integration-style coverage for the highest-risk branches.
- `src/utils/quizEligibility.js`, `src/utils/quizSubmission.js`, and `src/utils/leaderboardSort.js` already model the preferred pattern: focused logic files with paired tests.

## Goals

- Reduce the size and cognitive load of `QuizGame.js`.
- Move side effects and Firebase REST logic behind named boundaries.
- Make hardening behavior easier to understand and safer to change.
- Preserve the current UX and current anti-replay behavior during the refactor.
- Leave the app shippable after every phase.

## Non-Goals

- Rewriting the quiz UI.
- Changing quiz rules, scoring, or leaderboard semantics.
- Replacing Firebase auth or Realtime Database.
- Rebuilding all test scaffolding from scratch.
- Converting the whole app to Context or global state in one pass.

## Guardrails

- Do not attempt the full split in one PR.
- Keep `QuizGame` behavior stable while extracting internals.
- Prefer extracting pure helpers and service functions before hooks.
- Keep existing `QuizGame.test.js` coverage green while adding narrower tests for new modules.
- Stop after each phase if the extracted boundary is clean and the tests are green.

## Target End State

The likely end-state layout is:

- `src/components/QuizGame.js`
  - thin composition shell
- `src/components/quiz-game/IntroScreen.js`
- `src/components/quiz-game/QuestionScreen.js`
- `src/components/quiz-game/LeaderboardScreen.js`
- `src/hooks/useQuizState.js`
- `src/hooks/useLeaderboardSubmission.js`
- `src/hooks/useDeviceFingerprint.js`
- `src/services/leaderboardApi.js`
- `src/utils/quizAttemptState.js`
- `src/constants/ui.js` or `src/constants/styles.js`

The exact filenames can shift slightly, but the responsibilities should not.

## Existing Coverage To Preserve

Before moving code, treat the following current tests as baseline behavioral protection:

- `starts a fresh quiz and reserves the attempt on the server`
- `shows a localhost-only reset control that clears cached auth and quiz locks`
- `changes the derived fingerprint when the dev seed changes`
- local restore, timeout restore, and server restore scenarios
- duplicate fingerprint and duplicate name blocking scenarios
- secure reservation fallback scenarios
- indexed score save success / fallback / retry / fatal failure scenarios
- final-question retry recovery scenario

These currently live in `src/components/QuizGame.test.js` and should remain intact until the refactor is complete.

## Phase Plan

## Phase 0: Baseline And Safety Net

### Objective

Stabilize the starting point so later extractions are easier to review and safer to pause between sessions.

### Scope

- Add this plan doc.
- Add lightweight file-level comments only where they help future extraction.
- Optionally add section comments in `QuizGame.js` to mark major responsibility blocks.
- Confirm all existing tests pass before starting deeper extraction work.

### Code Changes

- `docs/quizgame-refactor-plan.md`
- optional small comments in `src/components/QuizGame.js`

### Tests

- Run `npm test -- --watchAll=false`
- Run `npm run test:quizzes`

### Done When

- The repo has a clear roadmap.
- The current behavior is captured by a known-green baseline.
- The next session can start Phase 1 without re-discovering the architecture.

## Phase 1: Extract Firebase / Leaderboard Service Boundary

### Objective

Move raw Firebase REST calls out of `QuizGame` and reuse the same service from the full leaderboard view.

### Scope

Create `src/services/leaderboardApi.js` and move the following responsibilities there:

- protected reads
- fetch leaderboard entries
- fetch attempt by uid
- fetch fingerprint-locked attempt
- create server attempt reservation
- sync in-progress attempt snapshot
- indexed score submission
- legacy fallback direct leaderboard write
- machine-print observation write

`QuizGame` should still orchestrate the flow, but it should stop constructing raw URLs inline.

### Suggested Exports

- `readProtectedData`
- `fetchQuizLeaderboard`
- `fetchAttemptByUid`
- `fetchFingerprintLockedAttempt`
- `createServerAttempt`
- `syncServerAttempt`
- `submitIndexedScore`
- `submitLegacyLeaderboardScore`
- `writeMachinePrintObservation`

### Files

- add `src/services/leaderboardApi.js`
- add `src/services/leaderboardApi.test.js`
- update `src/components/QuizGame.js`
- update `src/components/FullLeaderboard.js`

### Tests To Add

Unit tests in `src/services/leaderboardApi.test.js`:

- `fetchQuizLeaderboard` returns sorted entries from Firebase object payloads
- `fetchQuizLeaderboard` returns an empty array for `null` payloads
- `fetchAttemptByUid` returns `{ res, data, uid }` shape for success
- `fetchAttemptByUid` returns `{ res, data: null }` on non-OK response
- `fetchFingerprintLockedAttempt` returns `lookupStatus: "ok"` with missing owner
- `fetchFingerprintLockedAttempt` returns owner + attempt when owner exists
- `fetchFingerprintLockedAttempt` returns `lookupStatus: "unavailable"` on denied lookup
- `createServerAttempt` writes both attempt and attempt fingerprint keys
- `submitIndexedScore` issues one PATCH to root payload
- legacy save helper issues direct leaderboard PUT

Integration tests to keep green in `src/components/QuizGame.test.js`:

- fresh start reservation
- stale lock handling
- degraded fingerprint lookup handling
- direct leaderboard fallback
- retry on transient save error

### Done When

- `QuizGame.js` no longer contains raw Firebase URL construction except possibly in one temporary compatibility path.
- `FullLeaderboard.js` consumes the same leaderboard-fetch service boundary.
- New service tests are green and existing component tests still pass.

## Phase 2: Extract Attempt Persistence And Restore Logic

### Objective

Separate the attempt snapshot model from React rendering so resume behavior becomes easier to reason about and test.

### Scope

Create a pure utility module for:

- localStorage attempt keys
- save / load / clear operations
- question-set validation
- serialize / parse question set
- build attempt record
- choose canonical attempt
- restored-time computation

Where possible, move logic out of `QuizGame` into pure functions that receive plain data and return plain data.

### Files

- add `src/utils/quizAttemptState.js`
- add `src/utils/quizAttemptState.test.js`
- update `src/components/QuizGame.js`

### Suggested Exports

- `getAttemptStorageKey`
- `loadStoredAttempt`
- `saveStoredAttempt`
- `clearStoredAttempt`
- `isValidQuestionSet`
- `serializeQuestionSet`
- `parseQuestionSet`
- `buildAttemptRecord`
- `chooseCanonicalAttempt`
- `computeRestoredTimeLeft`

### Tests To Add

Unit tests in `src/utils/quizAttemptState.test.js`:

- local save/load round trip with matching version
- mismatched version returns `null`
- malformed JSON returns `null`
- `isValidQuestionSet` rejects malformed questions
- `parseQuestionSet` rejects invalid payload
- `buildAttemptRecord` includes status, timestamps, and serialized question set
- `chooseCanonicalAttempt` prefers newest valid snapshot
- `chooseCanonicalAttempt` ignores invalid local attempts
- `computeRestoredTimeLeft` handles feedback vs active-question restore

Integration tests to keep green in `src/components/QuizGame.test.js`:

- local attempt restore after refresh
- timed-out restored question becomes incorrect feedback
- server snapshot preferred over stale local snapshot
- stale fingerprint lock with no attempt blocks start

### Done When

- Restore logic is mostly pure and testable outside React.
- `QuizGame` mostly calls helpers instead of embedding restore math inline.
- Existing restore scenarios still pass unchanged.

## Phase 3: Extract Device Fingerprint And Dev Reset Behavior

### Objective

Move fingerprint derivation and dev reset logic behind one clear boundary because it is security-sensitive and easy to accidentally loosen.

### Scope

Extract:

- dev fingerprint reset enablement
- seed read / create / rotate
- stable hash helpers
- device fingerprint derivation
- machine fingerprint derivation
- dev reset key-clearing behavior

This can be a hook, a service, or a hybrid:

- pure helpers for hashing and storage
- hook only for values/actions that need React consumption

### Files

- add `src/hooks/useDeviceFingerprint.js` or `src/utils/deviceFingerprint.js`
- add corresponding test file
- update `src/components/QuizGame.js`

### Tests To Add

Unit tests:

- localhost gating enables dev reset only on local environments
- rotating the dev seed clears auth and attempt-related localStorage keys
- rotating the dev seed preserves unrelated keys
- the same input set yields a stable fingerprint
- changing the seed changes the derived fingerprint
- machine fingerprint excludes user agent input

Integration tests to keep green:

- localhost-only reset control behavior
- derived fingerprint changes when seed changes
- complete save flow still includes fingerprint-derived paths

### Done When

- `QuizGame` no longer owns hashing, seed rotation, or environment gating details.
- Hardening-specific code has a single home.

## Phase 4: Extract Submission Flow Hook

### Objective

Move save orchestration out of the component without yet changing the screen state model.

### Scope

Create `useLeaderboardSubmission()` to wrap:

- score clamping inputs
- indexed payload assembly
- save attempt / retry loop
- save-failure classification lookup
- machine-print observation
- success / failure return contract

This hook should accept dependencies and callbacks rather than reaching directly into too much component state.

### Suggested Inputs

- `quizId`
- `questions` or `questionCount`
- current attempt state needed for final payload
- callbacks like `onSaved`, `onFailure`, `markQuizSubmitted`, `loadLeaderboard`

### Files

- add `src/hooks/useLeaderboardSubmission.js`
- add `src/hooks/useLeaderboardSubmission.test.js` or keep most flow coverage in `QuizGame.test.js`
- update `src/components/QuizGame.js`

### Tests To Add

If using direct hook tests:

- successful save returns `{ ok: true }`
- transient 5xx retries once before success
- repeated transient failures return retryable UI failure
- 401 maps to auth-specific copy
- 403 maps to permissions-specific copy
- existing submission maps to already-played behavior
- duplicate name and duplicate fingerprint map correctly

If keeping behavior primarily at component level:

- leave current component tests in place
- add only narrow unit tests around any new pure helpers introduced inside the hook

Integration tests to keep green:

- perfect completion returns to leaderboard
- direct leaderboard fallback path
- one transient retry succeeds automatically
- fatal auth failure surfaces retry UI
- fatal permissions failure surfaces retry UI
- retry after final-question save failure preserves recoverability
- already-submitted failure stores local submitted flag

### Done When

- `QuizGame` no longer contains the full `saveScore` orchestration block.
- Submission behavior still matches current UX and current tests.

## Phase 5: Introduce Quiz State Reducer

### Objective

Reduce the number of interdependent `useState` calls and make transitions explicit.

### Scope

Move quiz runtime state into a reducer or state hook. Suggested reducer concerns:

- `screen`
- `playerName`
- `currentQuestion`
- `timeLeft`
- `questionDeadlineAt`
- `selectedAnswer`
- `showFeedback`
- `isCorrect`
- `totalScore`
- `finalScoreValue`
- `resumeNotice`
- `attemptCreatedAt`
- `gameQuestions`
- `error`

Keep auth and leaderboard fetch state separate unless there is a strong reason to merge them.

### Files

- add `src/hooks/useQuizState.js`
- add `src/hooks/useQuizState.test.js`
- update `src/components/QuizGame.js`

### Tests To Add

Reducer tests:

- intro -> question transition on successful start
- selecting an answer only updates selection before feedback
- submit answer toggles feedback and score correctly
- next question resets transient answer state
- final question prepares save state rather than advancing index
- restart returns to intro defaults
- restore payload hydrates state correctly

Integration tests to keep green:

- start flow
- restore flow
- timer expiry flow
- final save retry flow

### Done When

- Most screen-state transitions are explicit reducer actions.
- `QuizGame` reads cleaner because it dispatches actions instead of setting many fields directly.

## Phase 6: Split Presentational Screens

### Objective

Separate JSX-heavy rendering from state and side-effect orchestration.

### Scope

Extract presentational components:

- `IntroScreen`
- `QuestionScreen`
- `LeaderboardScreen`

Also extract shared visual constants now duplicated across leaderboard-related views:

- screen background style
- trophy colors
- any repeated display helpers that are stable and reusable

### Files

- add `src/components/quiz-game/IntroScreen.js`
- add `src/components/quiz-game/QuestionScreen.js`
- add `src/components/quiz-game/LeaderboardScreen.js`
- add `src/constants/styles.js` or `src/constants/ui.js`
- update `src/components/QuizGame.js`
- update `src/components/FullLeaderboard.js`
- optionally update `src/components/CumulativeMergedLeaderboard.js`

### Tests To Add

Component-level tests:

- `IntroScreen` disables start button under the expected conditions
- `QuestionScreen` shows feedback states correctly
- `LeaderboardScreen` highlights the current player entry correctly

Integration tests to keep green:

- all major `QuizGame.test.js` scenarios

### Done When

- `QuizGame` mainly composes hooks plus presentational screens.
- Shared leaderboard visuals are no longer duplicated.

## Phase 7: Cleanup, Docs, And Optional Follow-Ons

### Objective

Close the loop after the code has been safely decomposed.

### Scope

- Update `docs/architecture.md` to reflect the new boundaries.
- Add or expand inline comments where hardening behavior benefits from explanation.
- Revisit whether `FullLeaderboard` and `CumulativeMergedLeaderboard` should share more display primitives.
- Optionally add a short developer note describing where to change save flow, restore flow, and hardening logic.

### Tests

- Full test suite
- Targeted manual smoke pass:
  - start quiz
  - refresh mid-quiz
  - finish quiz
  - retry failed save
  - view full leaderboard

### Done When

- The docs match the code.
- The main component is materially smaller and easier to reason about.
- New contributors can find the right module without opening a 1,700-line file.

## Test Strategy By Layer

Use the following rule for where new tests should live:

- pure data transformation: `src/utils/*.test.js`
- REST/service request and response mapping: `src/services/*.test.js`
- hook-specific orchestration without much DOM: `src/hooks/*.test.js`
- cross-module user journeys: `src/components/QuizGame.test.js`

Avoid moving every current integration scenario into hook tests. The current component file is already a valuable safety net for user-facing behavior.

## Recommended Sprint Slices

If work is split across several sprints, these are the cleanest stopping points:

### Sprint A

- Phase 0
- Phase 1

Deliverable:

- Firebase/leaderboard API boundary extracted
- Full leaderboard view reusing that boundary

### Sprint B

- Phase 2
- Phase 3

Deliverable:

- attempt persistence and fingerprint logic extracted from `QuizGame`

### Sprint C

- Phase 4
- start of Phase 5

Deliverable:

- submission flow extracted
- reducer introduced if scope allows

### Sprint D

- finish Phase 5
- Phase 6
- Phase 7

Deliverable:

- thin `QuizGame` shell plus presentational screens and updated docs

## Session Handoff Checklist

At the end of any session, record:

- current phase and sub-step
- files created or renamed
- tests added
- tests still expected to fail, if any
- deliberate deferrals
- next safest extraction target

If a phase is only partially complete, stop only after:

- the app still builds
- existing behavior is not knowingly broken
- tests clearly indicate the remaining work

## Commands To Run During Each Phase

- `npm test -- --watchAll=false`
- `npm run test:quizzes`

Useful targeted commands while iterating:

- `npm test -- --watchAll=false --runTestsByPath src/components/QuizGame.test.js`
- `npm test -- --watchAll=false --runTestsByPath src/services/leaderboardApi.test.js`
- `npm test -- --watchAll=false --runTestsByPath src/utils/quizAttemptState.test.js`

## Success Criteria

This refactor is successful if all of the following are true:

- `QuizGame.js` becomes substantially smaller and easier to scan.
- Firebase URL construction and fetch orchestration are not spread across components.
- hardening behavior has a single obvious home.
- restore and save logic are mostly tested outside the main component.
- current user-facing behavior remains intact.
- the work can pause after any phase without leaving the app in an ambiguous state.
