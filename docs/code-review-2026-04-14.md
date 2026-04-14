# DigiCertQuiz — Code Review

**Date:** 2026-04-14
**Scope:** Code quality & health + architecture & maintainability
**Depth:** High-level sweep (not an exhaustive audit)
**Out of scope:** Security review, performance/bundle review, individual quiz content correctness

---

## 1. Summary

DigiCertQuiz is **functionally sound and thoughtfully modularized at the edges** — `src/utils/` has one-concern-per-file with paired `.test.js` files, `src/services/firebaseAuth.js` is a real abstraction (not scattered Firebase calls), and `src/quizzes/` cleanly separates content from code. The quiz-registry pattern works: 23 weekly quizzes plug in via a single file.

However, complexity has concentrated in one place. `src/components/QuizGame.js` has grown to **1,660 lines** and now owns the intro screen, timer, questions, Firebase I/O, device fingerprinting, anti-replay eligibility, localStorage, and the in-game leaderboard. Meanwhile, `QUIZ_ARCHITECTURE_PLAN.md` documents an earlier version of the app (pre-hardening) and no longer matches reality, and there is no CI enforcing the quiz-registry validation that guards weekly deploys.

The net picture: the scaffolding is good, but the center load-bearing beam is overweight and the blueprints are out of date. The highest-leverage improvements are (a) splitting `QuizGame.js`, (b) updating the architecture doc, and (c) adding a minimal GitHub Actions workflow.

---

## 2. Findings

### High severity

#### 1. `QuizGame.js` is 1,660 lines and owns too many concerns
- **File:** `src/components/QuizGame.js`
- **Impact:** Any change — UI tweak, submission retry logic, eligibility rule — requires reasoning about the whole file. It's the single biggest drag on future change velocity and onboarding.
- **Direction:** Extract, in order of payoff:
  - `src/services/leaderboardApi.js` — pure `fetchLeaderboard`, `submitScore`, `checkNameConflict` functions.
  - `useLeaderboardSubmission()` hook — wraps the submit + eligibility-classification flow.
  - `useDeviceFingerprint()` hook — owns seed management, sha256 derivation, rotation.
  - `useQuizState()` hook / reducer — the intro → in-progress → completed state machine.
  - Smaller presentational components (`<IntroScreen>`, `<QuestionCard>`, `<InGameLeaderboard>`).
- Don't do all five at once; `leaderboardApi.js` alone will cut hundreds of lines.

#### 2. Anti-replay & submission-flow tests have scaffolding but thin scenario coverage
- **Files:** `src/components/QuizGame.test.js`, `src/utils/quizEligibility.test.js`
- **Impact:** The test file has good setup (`buildServerAttempt`, `buildLocalAttempt`, mocked auth, fingerprint harness) and `quizEligibility.test.js` covers `classifyNameConflict` / `classifySaveFailure` at the unit level — but the **end-to-end branches of the submission flow** (same device reattempts, duplicate normalized name across users, server-side eligibility mismatch mapping to UI copy, transient 5xx vs fatal 403) are the highest-risk paths and lean on unit coverage rather than integration tests. These paths are exactly where a silent regression would be worst.
- **Direction:** Add a small number of scenario tests that drive `QuizGame` through:
  - Same-fingerprint second attempt (should block with correct copy).
  - Duplicate normalized name from a different uid (should block with correct copy).
  - Server attempt restoration when localStorage is wiped mid-quiz.
  - Transient network failure during submit (should retry or surface retry UI).

#### 3. Errors are swallowed, logged-only, or surfaced generically
- **Files:** `src/services/firebaseAuth.js:11`, `:19`, `:94` (silent `catch (_) {}` around localStorage and refresh); `src/components/QuizGame.js` (submission failure paths, `console.warn` on server sync)
- **Impact:** Failures become invisible. A user whose score fails to save sees a generic message with no retry; a localStorage denial silently produces no auth; a token-refresh failure falls through to re-sign-in without context. Debugging production issues from logs alone will be frustrating.
- **Direction:** Classify errors into **transient** (network 5xx, timeouts) and **fatal** (403 eligibility, 400 shape). Expose fatal errors to the UI with actionable copy. Auto-retry transient errors with backoff before surfacing. Avoid `catch (_) {}` — at minimum log through a named channel (`logSilent("auth.loadAuth", e)`) so the pattern is searchable.

---

### Medium severity

#### 4. State is fragmented across local state, localStorage, firebaseAuth, and utils
- **Files:** `src/components/QuizGame.js` (15+ `useState` hooks), localStorage keys (`firebaseAuth`, `quizAttempt:*`, `submitted:*`, `devFingerprintSeed`), `src/services/firebaseAuth.js` (module-level `inFlightAuthPromise`)
- **Impact:** There's no single place that answers "what's the current state of a user's attempt?" Debugging "why didn't my submission go through" requires reading all three layers.
- **Direction:** Introduce a lightweight reducer or Context for attempt state (current question, selected answer, totalScore, eligibility status, submission status). Keep auth separate. Keep localStorage as persistence, not as the source of truth — the reducer rehydrates from it on mount.

#### 5. Firebase REST calls are embedded in components
- **Files:** `src/components/QuizGame.js`, `src/components/FullLeaderboard.js`, `src/components/CumulativeMergedLeaderboard.js`
- **Impact:** Three components each do their own `fetch` against the Realtime DB URL. Adding retry, switching to the Firebase SDK, or changing paths means touching all three. Tests have to mock `fetch` instead of a service boundary.
- **Direction:** `src/services/leaderboardApi.js` with pure async functions. `firebaseAuth.js` already shows the pattern — copy it.

#### 6. Three leaderboard views re-implement similar logic
- **Files:** `src/components/QuizGame.js` (in-quiz Top 25), `src/components/FullLeaderboard.js:9` (Top 30, 3-column screenshot view), `src/components/CumulativeMergedLeaderboard.js:4` (Top 50 cumulative)
- **Impact:** `SCREEN_BACKGROUND_STYLE` is defined three times. Fetch/sort/render patterns are parallel but diverge in small ways. Changing the trophy threshold or tie-breaker rule means three edits.
- **Direction:** `src/constants/styles.js` for the background constant. A `useLeaderboard(quizId, { limit, sort })` hook that handles fetch, sort, and error state once. A single `leaderboardConfig` export (sort function, limits per view, trophy thresholds).

#### 7. `QUIZ_ARCHITECTURE_PLAN.md` has diverged from the code
- **Files:** `QUIZ_ARCHITECTURE_PLAN.md` (repo root, 26 KB) vs. `docs/hardening.md` and current code
- **Impact:** The plan documents v1 rules and a simpler submission model. The code implements v3 with `nameSlug`, device fingerprints, machine prints, and submission locks. A new contributor reading the plan will be actively misled.
- **Direction:** Either (a) update the plan to match reality with a "Hardening" section that links `docs/hardening.md`, or (b) mark the plan as historical and replace with a shorter, current `docs/architecture.md`. Option (b) is usually cheaper.

#### 8. No CI — quiz-registry validation relies on manual discipline
- **Files:** `src/quizzes/registry.test.js` exists; no `.github/workflows/` directory
- **Impact:** `npm run test:quizzes` catches registry typos (missing import, mismatched id, forgotten entry in the `quizzes` map) but only if someone remembers to run it. On a weekly-deploy cadence, this is the cheapest possible broken-prod risk.
- **Direction:** Add `.github/workflows/test.yml` that runs `npm test -- --watchAll=false` on PRs against `main`/`dev`. ~15 lines of YAML, enormous safety-net ROI.

#### 9. Magic numbers scattered
- **Files:** `src/services/firebaseAuth.js:33` (`30_000` token skew), `:69` and `:84` (`5_000` tolerance); `src/components/QuizGame.js` (default `maxTime`, trophy/rank thresholds)
- **Impact:** Tuning requires archaeology. New contributors can't tell if `5_000` is "5 seconds because of X" or "arbitrary".
- **Direction:** `src/constants/auth.js` with `TOKEN_EXPIRY_SKEW_MS`, `TOKEN_EXPIRY_TOLERANCE_MS`. `src/constants/quiz.js` for game defaults. Each constant gets a one-line comment explaining the rationale.

#### 10. Device-fingerprinting / anti-replay logic has no inline explanation
- **Files:** `src/components/QuizGame.js` (fingerprint derivation, `submitLock`, nameSlug flow), `src/utils/quizAudit.js`, `src/utils/quizEligibility.js`
- **Impact:** Future-you (or a new contributor) will see fingerprint seeds, rotation, submit locks, and machine prints with no indication of *why* they exist or what user-facing behavior depends on them. Refactors will inadvertently loosen the hardening.
- **Direction:** Add a 10–15 line header comment at the top of `QuizGame.js` describing the three hardening layers (first-score-only, nameSlug uniqueness, device fingerprint) and pointing at `docs/hardening.md`. Add a text diagram to `docs/hardening.md` showing the FP derivation inputs.

---

### Low severity

#### 11. Root-directory clutter (partial `.gitignore` coverage, plus `.gitignore` duplication)
- **Files (at repo root):**
  - `firebase-debug.log` — 2.7 MB
  - `quiz_background.psd` — 2.0 MB
  - `CCWeek21/`, `TLMWeek20/`, `DNS_quizzes/` — `.docx` authoring sources only, not code
  - `cumulative-leaderboard.csv`, `cumulative-leaderboard-merged.csv`, `cumulative-leaderboard_VANILLA.csv`, `potential-duplicates.csv`
- **Impact:** Noise for new contributors; they expect weekly quiz code at the root and instead find authoring artifacts and generated files. The `.psd` and `firebase-debug.log` especially shouldn't be in a working tree.
- **`.gitignore` observations:** It already lists `firebase-debug.log`, `/CCWeek21`, `/TLMWeek20`, and DNS `.docx` files — but the **same entries are duplicated** (firebase-debug.log appears three times, DNS files twice). Likely these were added to `.gitignore` *after* first being committed, so they may still be tracked. Confirm with `git ls-files | grep -E 'firebase-debug|CCWeek21|TLMWeek20|DNS_quizzes'`; if any appear, `git rm --cached <path>` to untrack. While you're in there, de-dupe the `.gitignore`.
- **Direction:**
  - De-duplicate `.gitignore`.
  - `git rm --cached` anything newly ignored that's still tracked.
  - Move `.docx` authoring sources under `docs/authoring-sources/` (or delete if superseded).
  - Move generated CSVs into `public/` (where `cumulative-leaderboard-merged.csv` already lives) or a `build/` / `out/` dir and gitignore the source versions.
  - Move `quiz_background.psd` out of the repo (Figma, Google Drive, or `docs/design-sources/` with LFS).

#### 12. `scripts/` directory is undocumented
- **Files:** `scripts/cumulative-leaderboard.js`, `scripts/quiz-integrity-audit.js`
- **Impact:** Unclear which scripts are one-off tools, which are release-process steps, and which are on-demand admin utilities. The README mentions `cumulative-leaderboard.js` but not `quiz-integrity-audit.js`.
- **Direction:** Add `scripts/README.md` with one section per script: **Purpose**, **When to run**, **Expected output**, **Who owns it**.

---

## 3. Adding a new weekly quiz — current friction

Concrete maintainability check: what does the flow look like today?

1. Create `src/quizzes/week-N-slug.js` (copy an existing file as template).
2. Edit `src/quizzes/index.js`:
   - Add `import weekN from "./week-N-slug";` at the top.
   - Add `[weekN.id]: weekN,` in the `quizzes` map.
   - When flipping to live: update `export const currentQuizId = weekN.id;` at `src/quizzes/index.js:51`.
3. Run `npm run test:quizzes` locally.
4. Push; deploy.

**Silent-failure modes today:**
- Forgetting the import → runtime "Cannot find module" only when someone visits the quiz URL.
- Mismatched `id` between the file and a deep link → quiz appears missing.
- Forgetting to update `currentQuizId` → new quiz exists but isn't the default landing.
- Not running `test:quizzes` → typos reach production because there is **no CI gate**.

**Smallest fix with largest payoff:** finding #8 (add a GitHub Actions workflow that runs the test suite on PRs). That alone removes the biggest silent-failure class.

---

## 4. Recommended priorities

**Quick wins (low effort, high ROI — do these first):**
- #8 — Add `.github/workflows/test.yml` (~15 lines of YAML).
- #7 — Update `QUIZ_ARCHITECTURE_PLAN.md` or replace with current `docs/architecture.md`.
- #11 — De-dupe `.gitignore`, `git rm --cached` tracked-then-ignored files, move `.docx` and `.psd` artifacts.
- #12 — `scripts/README.md`.
- #9 — Extract auth/quiz constants.
- #10 — Header comment in `QuizGame.js` + diagram in `docs/hardening.md`.

**Larger investments (schedule deliberately):**
- #1 — Split `QuizGame.js`. Do it incrementally: `leaderboardApi.js` first, then one hook at a time.
- #5 — `leaderboardApi.js` service layer (strongly paired with #1).
- #2 — Scenario integration tests for the anti-replay branches.
- #4 — Centralize attempt state in a reducer or Context.
- #6 — Unified `useLeaderboard` hook + shared styles/config.

---

## 5. What's healthy (don't lose this)

- **Quiz-registry pattern** (`src/quizzes/index.js`) cleanly separates weekly content from game code. Keep this shape.
- **`src/utils/` module hygiene.** `leaderboardSort.js`, `quizAudit.js`, `quizEligibility.js`, `quizSubmission.js` each have a matched `.test.js`. This is the right pattern — the rest of the codebase should migrate toward it.
- **`src/services/firebaseAuth.js`** is a genuine abstraction with in-flight de-duplication (`inFlightAuthPromise`), refresh-then-signin fallback, and a paired test. It's a good template for the `leaderboardApi.js` that finding #5 proposes.
- **Coverage tooling is configured** (`npm run test:coverage`, `/coverage/` output). You don't need to build infrastructure, just raise the bar.
- **Dev-only fingerprint reset** is thoughtful: localhost-only, documented in `README.md`, and covered by tests. Exactly the right shape for a dev helper.

---

## Appendix — Files referenced

For spot-checking:

- `src/components/QuizGame.js` — findings #1, #3, #4, #5, #9, #10
- `src/components/FullLeaderboard.js` — finding #6
- `src/components/CumulativeMergedLeaderboard.js` — finding #6
- `src/components/QuizGame.test.js` — finding #2
- `src/services/firebaseAuth.js` — findings #3, #9
- `src/quizzes/index.js` — §3, finding #8
- `src/quizzes/registry.test.js` — finding #8
- `src/utils/quizEligibility.js`, `quizAudit.js`, `quizSubmission.js`, `leaderboardSort.js` — §5 (healthy examples)
- `QUIZ_ARCHITECTURE_PLAN.md`, `docs/hardening.md` — finding #7
- `.gitignore`, repo root — finding #11
- `scripts/` — finding #12

---

## 6. Response / Disposition

Reviewed against the live repo and then actioned in the follow-up implementation pass.

### Overall

- The review was directionally useful, especially on CI, explicit error handling, constants, docs, and repo hygiene.
- A few findings were overstated in this checkout:
  - finding #2: test coverage was stronger than described, but still had a few worthwhile gaps
  - finding #7: `QUIZ_ARCHITECTURE_PLAN.md` was stale in places, but not fully pre-hardening
  - finding #11: root clutter and duplicate ignore rules were real, but the tracked/untracked picture was not fully accurate
- Follow-up verification after implementation:
  - `npm test -- --watchAll=false` passed
  - `npm run build` passed
  - no observed regressions were reported after validation

### Finding-by-finding disposition

| # | Disposition | Status | Notes |
| --- | --- | --- | --- |
| 1 | Accept | Deferred | `QuizGame.js` is still too large; major decomposition intentionally postponed. |
| 2 | Partial accept | Implemented | Existing integration coverage was stronger than stated; added missing high-risk scenarios for duplicate fingerprint, `401`, `403`, and transient save retry behavior. |
| 3 | Accept | Implemented | Replaced key silent catches with searchable logging and made transient vs fatal save behavior explicit. |
| 4 | Accept | Deferred | State centralization remains a future refactor. |
| 5 | Partial accept | Deferred | A service-layer extraction is still a good idea, but the original finding overstated how many components hit Firebase in the same way. |
| 6 | Accept | Deferred | Shared leaderboard/view abstractions remain future cleanup. |
| 7 | Partial accept | Implemented | Added `docs/architecture.md` and marked `QUIZ_ARCHITECTURE_PLAN.md` as historical/current-reference redirected. |
| 8 | Accept | Implemented | Added GitHub Actions CI for `main` and `dev`. |
| 9 | Accept | Implemented | Added named auth/quiz constants and removed key magic numbers from core flows. |
| 10 | Partial accept | Deferred | Existing docs already covered much of the hardening model; a larger inline explanation pass is still optional future work. |
| 11 | Partial accept | Implemented | De-duplicated `.gitignore` and untracked ignored generated/debug/design artifacts while keeping local files on disk; broader source relocation was deferred. |
| 12 | Accept | Implemented | Added `scripts/README.md` documenting purpose, usage timing, and outputs. |
