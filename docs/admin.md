# DigiCert Quiz Admin Runbook

This is the operational runbook for Firebase-backed quiz support.

## Quick Links

- `docs/firebase-rules.v1.json`: first-score-only per anonymous uid
- `docs/firebase-rules.v2.json`: adds normalized-name and browser/device fingerprint enforcement
- `docs/firebase-rules.v3.json`: reserves attempts at quiz start and supports resume
- `docs/hardening.md`: rollout and anti-replay context

Current recommendation:

- Run `v3` unless you intentionally need a rollback

Important note:

- `machinePrints/{quizId}/{fpMachine}` is still observe-only in this repo
- There is no checked-in `docs/firebase-rules.v2.1.json`
- `vercel.json` sets `Cache-Control: no-cache, no-store, must-revalidate` on `/`, `/quiz/*`, and `/leaderboard/*` so Safari does not hold onto a stale SPA shell after deploys

## Quiz IDs and Paths

Each quiz uses a slug such as `week-21-cert-central-part-3`.

Common Firebase paths:

- `leaderboard/{quizId}/{uid}`
- `nameIndex/{quizId}/{nameSlug}`
- `fingerprints/{quizId}/{fp}`
- `machinePrints/{quizId}/{fpMachine}`
- `attempts/{quizId}/{uid}`
- `attemptFingerprints/{quizId}/{fp}`

## Data Model Snapshot

### Leaderboard record

Path:

- `leaderboard/{quizId}/{uid}`

Typical fields:

- `name`
- `nameSlug`
- `score`
- `timestamp`
- `fp`

### Attempt record (`v3`)

Path:

- `attempts/{quizId}/{uid}`

Typical fields include:

- `name`
- `nameSlug`
- `fp`
- `fpMachine`
- `questionSet`
- `currentQuestion`
- `totalScore`
- `timeLeft`
- `questionDeadlineAt`
- `selectedAnswer`
- `showFeedback`
- `isCorrect`
- `status`
- `createdAt`
- `updatedAt`
- `completedAt`

### Index records

- `nameIndex/{quizId}/{nameSlug}` -> `uid`
- `fingerprints/{quizId}/{fp}` -> `uid`
- `attemptFingerprints/{quizId}/{fp}` -> `uid`
- `machinePrints/{quizId}/{fpMachine}` -> `uid` for observation only

## Applying Rules

### Apply `v1`

1. Open Firebase Console.
2. Go to Realtime Database -> Rules.
3. Paste `docs/firebase-rules.v1.json`.
4. Publish.

Use `v1` only as a temporary rollback or compatibility mode.

### Apply `v2`

1. Confirm you want normalized-name and browser/device fingerprint enforcement.
2. In Realtime Database -> Rules, paste `docs/firebase-rules.v2.json`.
3. Publish.
4. Watch for save failures caused by duplicate `nameSlug` or `fp`.

### Apply `v3`

1. In Realtime Database -> Rules, paste `docs/firebase-rules.v3.json`.
2. Publish.
3. Verify:
   - starting a quiz creates `attempts/{quizId}/{uid}`
   - starting a quiz creates `attemptFingerprints/{quizId}/{fp}`
   - refresh resumes the same run
   - completing the quiz marks the attempt `completed`

## Post-Deploy Smoke Test for `v3`

1. Open a quiz in a fresh browser session.
2. Click Start and confirm question 1 loads.
3. In Firebase, confirm both of these now exist:
   - `attempts/{quizId}/{uid}`
   - `attemptFingerprints/{quizId}/{fp}`
4. Refresh mid-quiz and confirm the same run resumes.
5. Finish the quiz and confirm:
   - the leaderboard row is written
   - the attempt is marked `completed`
   - the player cannot start a second run

## Common Support Tasks

### Free a player for a fresh retry (`v3`)

Delete the player's quiz-specific records:

- `attempts/{quizId}/{uid}`
- `attemptFingerprints/{quizId}/{fp}`
- `leaderboard/{quizId}/{uid}` if a score was already saved
- `fingerprints/{quizId}/{fp}` if a score was already saved
- `nameIndex/{quizId}/{nameSlug}` if you also need to free the display name

Optional cleanup:

- `machinePrints/{quizId}/{fpMachine}` if you are manually clearing every related trace for investigation

### Free a player for a fresh retry (`v1` or `v2`)

- `v1`: delete `leaderboard/{quizId}/{uid}`
- `v2`: also delete any related uniqueness locks:
  - `fingerprints/{quizId}/{fp}`
  - `nameIndex/{quizId}/{nameSlug}`

### Change a player's display name

1. Find the player under `leaderboard/{quizId}`.
2. Note the current `uid` and `nameSlug`.
3. Update the leaderboard record with the corrected `name` and `nameSlug`.
4. Delete the old `nameIndex/{quizId}/{oldSlug}` row.
5. Create `nameIndex/{quizId}/{newSlug}` with value `uid`.

Name slug rules match the app:

- trim whitespace
- lowercase
- strip punctuation
- convert spaces to `-`

### Restore or manually add a leaderboard entry

1. Choose the `quizId`.
2. Use the original `uid` if you know it; otherwise pick a deliberate manual key.
3. Create or update `leaderboard/{quizId}/{uid}`.

Minimum payloads:

- `v1`: `{ name, score, timestamp }`
- `v2` and `v3`: `{ name, nameSlug, score, timestamp, fp }`

If you are restoring a `v2` or `v3` entry, also restore:

- `nameIndex/{quizId}/{nameSlug}` = `uid`
- `fingerprints/{quizId}/{fp}` = `uid`

Restore `attempts` and `attemptFingerprints` only if you specifically need the run to remain resumable rather than simply restoring the score.

## Investigating Common Failures

### "We couldn't verify quiz eligibility right now. Please refresh and try again."

Most likely causes:

- `attemptFingerprints/{quizId}/{fp}` does not have the expected authenticated read access in the published rules
- the published rules are older than the current app flow

Action:

- Republish the full current `docs/firebase-rules.v3.json`

### "Could not start the quiz right now. Please try again."

Most likely causes:

- the `attempts` validation in Firebase is out of date
- nullable fields such as `selectedAnswer`, `questionDeadlineAt`, or `completedAt` are being rejected

Action:

- Republish the full current `docs/firebase-rules.v3.json`

### "This device appears to have already been used for this quiz."

Check:

- `fingerprints/{quizId}/{fp}`

If that path belongs to a different `uid`, the duplicate-fingerprint rule is working as designed.

### Duplicate display name error

Check:

- `nameIndex/{quizId}/{nameSlug}`

If it points at a different `uid`, the normalized display name is already claimed.

## Rollback Guidance

Safest rollback path:

- Publish `docs/firebase-rules.v1.json`

Compatibility note:

- The current client still contains a fallback single-write path for legacy `v1` behavior if the indexed root write is rejected with `401` or `403`
- That keeps emergency rollback viable, but `v3` remains the intended steady state

## Score Cap

The rules files use a generous upper bound for `score`.

If you need to change it:

- update the score validation in the published rules
- use `maxTime * numberOfQuestions` as the baseline

Example:

- a 5-question quiz at 100 seconds each has a natural max score of `500`

## Notes

- Reads are public or authenticated depending on the rules version you publish
- Writes require Firebase anonymous auth and must satisfy the active rules
- Device fingerprints are hashed values, not raw device attributes
