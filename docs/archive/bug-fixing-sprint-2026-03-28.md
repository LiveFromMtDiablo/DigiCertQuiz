Bug-Fixing Sprint: Score Submission False Positives

Historical note
- This file is a dated sprint artifact from March 2026, not the current operating runbook.
- For current guidance, use `docs/admin.md`, `docs/hardening.md`, and `docs/turnkey-handoff.md`.

Sprint Date
- Target start: March 28, 2026
- Duration: 1 working day for diagnosis + first fixes, with follow-up if production data shows wider impact

Problem Statement
- Some players report that their score is rejected with the message:
  - "Could not save score. Please only play each quiz once to keep scoring fair!"
- Based on the current app and Firebase rules, that message does not uniquely mean "replay detected."
- The current implementation can surface the same message for several legitimate first-play failures.

Relevant Files
- `src/components/QuizGame.js`
- `src/services/firebaseAuth.js`
- `docs/firebase-rules.v2.json`
- `docs/admin.md`
- `docs/hardening.md`

Verified Live Rules (March 27, 2026)
- Production is currently running the v2-style ruleset:
  - first-score-only per anonymous Firebase uid
  - unique `nameSlug` per quiz via `nameIndex/{quizId}/{nameSlug}`
  - unique device fingerprint per quiz via `fingerprints/{quizId}/{fp}`
  - observe-only `machinePrints/{quizId}/{fpMachine}` writes
- This means name and fingerprint conflicts are not hypothetical rollout concerns; they are active production enforcement paths.

Current Rule Behavior
- Writes are first-score-only per anonymous Firebase uid:
  - `leaderboard/{quizId}/{uid}` can only be created once
- Production rules also enforce:
  - unique `nameSlug` per quiz via `nameIndex/{quizId}/{nameSlug}`
  - unique device fingerprint per quiz via `fingerprints/{quizId}/{fp}`
- `machinePrints` are written but not enforced by leaderboard validation

Confirmed / Likely Failure Modes
1. Name collision after normalization
- The intro screen checks the raw display name with a weaker comparison than the database rule.
- The save path uses `nameSlug`, which lowercases, trims, collapses spaces, and strips punctuation.
- Example classes:
  - `Raju Muke` vs `Raju  Muke`
  - `OBrien` vs `O'Brien`
  - `Anne-Marie` vs `AnneMarie`
- Result:
  - player can start normally
  - save fails at the end with a misleading replay message

2. Fingerprint collision between different legitimate users
- The app derives `fp` from coarse browser/device attributes.
- On standardized corporate machines, two different people can plausibly produce the same fingerprint.
- If the fingerprint is already claimed by another uid, the first save for the second person is rejected.
- This is the highest-priority probable false-positive in the current ruleset.

3. Shared browser profile or reused workstation
- Anonymous auth is persisted in local storage.
- If two people use the same browser profile, they share the same Firebase uid.
- The second person is blocked by the first-score-only uid rule even if they personally never played.

4. Late rejection after the player already finishes the quiz
- The app checks for an existing server-side submission asynchronously after load.
- A player can sometimes start before that check completes.
- If the browser has a reused uid but no local `submitted:{quizId}` flag, the person may finish the whole quiz and only fail on final save.
- This matches the screenshot pattern closely.

5. Non-replay failures mislabeled as replay failures
- The client currently maps most `401` / `403` responses to the same "only play once" message.
- The catch path also uses that same message for other thrown save/auth failures.
- This makes support triage noisy and obscures root cause.

What Is Less Likely
- `machinePrints` conflicts are not the primary suspect.
- A root multi-path `PATCH` can fail on `machinePrints`, but the current fallback single leaderboard `PUT` should still succeed because leaderboard validation does not enforce `fpMachine`.
- By contrast, true `nameIndex` and `fingerprints` conflicts will fail both:
  - the root multi-path `PATCH`
  - the fallback single leaderboard `PUT`

Sprint Goal
- Make score-save failures diagnosable and reduce legitimate first-play rejections without weakening anti-replay controls more than necessary.

Sprint Scope
1. Improve diagnostics and user-facing error handling
2. Prevent avoidable late-stage failures before a player starts the quiz
3. Reduce false positives caused by name and fingerprint enforcement
4. Add a support/admin workflow for verifying and resolving reported cases

Out of Scope
- Major backend migration away from Firebase Realtime Database
- Full redesign of anti-cheat strategy
- Rules v2.1 machine-print enforcement

Priority Backlog

P0: Separate failure reasons in the client
- Replace the single replay-style error with distinct outcomes for:
  - existing uid submission
  - duplicate normalized name
  - duplicate fingerprint
  - auth/session failure
  - generic save failure
- Do not rely on Firebase error bodies alone to classify these outcomes.
- Use preflight and follow-up reads to classify likely causes, then log the failing response body in a more structured way for debugging.

P0: Block quiz start until submission state is known
- Add an explicit "checking eligibility" state before enabling Start.
- Prevent users from finishing the quiz only to be rejected at save time due to a reused uid.
- Treat Start as blocked until all required preflight data is ready, not just the local-storage flag.

P0: Preflight all enforced eligibility checks before quiz start
- Check the normalized `nameSlug`, not just the raw display name.
- Check the active uid against `leaderboard/{quizId}/{uid}`.
- Check the device fingerprint against `fingerprints/{quizId}/{fp}`.
- Surface precise messages before the first question is shown whenever possible.

P1: Revisit fingerprint enforcement strategy
- Investigate whether the current fingerprint inputs are too coarse for a managed-device environment.
- Options to evaluate:
  - keep the rule but weaken support messaging and add a release path
  - reduce reliance on fingerprint uniqueness
  - refine the fingerprint inputs if there is a defensible way to lower collisions
- Do not change this blindly without reviewing real conflict data.

P1: Improve support runbook
- Expand admin steps for investigating:
  - which uid was blocked
  - whether `nameIndex` caused the failure
  - whether `fingerprints` caused the failure
- Add a short decision tree for support requests.

Implementation Plan

Step 1: Client diagnostics
- Update `saveScore` in `src/components/QuizGame.js` to classify response failures.
- Distinguish rule conflicts from auth/network failures.
- Use reads against enforced paths to infer likely cause when a save fails:
  - `leaderboard/{quizId}/{uid}`
  - `nameIndex/{quizId}/{nameSlug}`
  - `fingerprints/{quizId}/{fp}`
- Preserve the anti-replay behavior while making the error accurate.

Step 2: Eligibility gating
- Add a loading/checking state around:
  - local `submitted:{quizId}` lookup
  - server lookup for `leaderboard/{quizId}/{uid}`
- leaderboard preload or equivalent preflight reads needed for uniqueness checks
- auth readiness required to compute uid/token/fingerprint
- Disable Start until the checks finish.

Step 3: Preflight validation
- Reuse the same normalization logic used for `nameSlug`.
- Validate all enforced uniqueness gates before the quiz starts:
  - normalized `nameSlug`
  - active uid first-score-only rule
  - fingerprint uniqueness rule

Step 4: Admin and support documentation
- Update `docs/admin.md` with a quick triage flow for March 28, 2026 onward.
- Include examples of the exact paths to inspect in Firebase.

Step 5: Data review
- Inspect a sample of rejected/complained-about cases in Firebase.
- Specifically compare:
  - `leaderboard/{quizId}/{uid}`
  - `nameIndex/{quizId}/{nameSlug}`
  - `fingerprints/{quizId}/{fp}`
- Use those findings to decide whether fingerprint enforcement needs adjustment.

Acceptance Criteria
- A reused uid case shows a clear replay/already-submitted message.
- A normalized-name conflict shows a clear duplicate-name message before gameplay begins.
- A fingerprint conflict is distinguishable from replay and from generic save failure, preferably before gameplay begins.
- Users cannot start the quiz while eligibility is still unknown.
- Support can investigate a complaint using a short documented checklist.

Recommended Order for March 28, 2026
1. Patch eligibility gating and full preflight checks (uid, normalized name, fingerprint)
2. Patch client messaging and save-failure classification fallback
3. Update support/admin docs
4. Review production conflict cases and decide whether fingerprint enforcement should be tuned

Suggested Manual Test Matrix
- Fresh browser profile, fresh player, unique name
- Same browser profile, second attempt on same quiz
- Two names that normalize to the same slug
- Fingerprint already claimed by another uid
- Simulated stale local storage with existing server submission
- Auth failure / token failure path
- Fingerprint-conflict scenario if reproducible in a controlled environment

Risks
- If fingerprint collisions are common in the DigiCert managed-device environment, diagnostics alone will not eliminate complaints.
- Weakening fingerprint enforcement too quickly may reopen obvious repeat-play loopholes.
- A client-only fix improves UX but cannot eliminate all rule-based conflicts without policy changes.

Decision Needed During Sprint
- Should fingerprint uniqueness remain a hard block for all users, or should it move to an investigation signal plus support workflow?

Expected Deliverables
- Updated `QuizGame.js` error handling and start gating
- Updated admin/support documentation
- Short findings note from real production conflict review

Testing Snapshot (April 1, 2026)
- Automated regression coverage has been expanded beyond utilities into the main quiz flow.
- Current status:
  - 8 passing Jest suites
  - 41 passing tests
  - Coverage:
    - 68.49% statements
    - 58.65% branches
    - 72.79% functions
    - 69.84% lines
- High-value covered areas now include:
  - `src/components/QuizGame.js`
  - `src/services/firebaseAuth.js`
  - `src/App.js`
  - `src/utils/quizEligibility.js`
  - `src/utils/quizSubmission.js`

Follow-On Backlog
