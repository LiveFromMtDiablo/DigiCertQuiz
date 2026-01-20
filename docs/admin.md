Admin FAQ – DigiCert Quiz Hardening

Quick Links
- Rules v1 (first‑score‑only): docs/firebase-rules.v1.json
- Rules v2 (name/fingerprint enforcement): docs/firebase-rules.v2.json
- Rules v2.1 (machine prints enforcement): docs/firebase-rules.v2.1.json
- Plan and guidance: docs/hardening.md
- Observe‑only machine prints: written under `machinePrints/{quizId}/{fpMachine}` (no enforcement in v2)

Quiz IDs
- Each quiz has an ID like `week-1-key-sovereignty`.
- Paths use this ID under `leaderboard/{quizId}/…`, `nameIndex/{quizId}/…`, `fingerprints/{quizId}/…`, `machinePrints/{quizId}/…`.

Data Model (writes)
- Leaderboard record (per user): `leaderboard/{quizId}/{uid}`
  - Fields: `name`, `nameSlug`, `score`, `timestamp` (server set), `fp`, `fpMachine`
- Indexes (enforced in rules):
  - `nameIndex/{quizId}/{nameSlug}` → `uid`
  - `fingerprints/{quizId}/{fp}` → `uid`
  - `machinePrints/{quizId}/{fpMachine}` → `uid` (enforced only in v2.1)

How to Apply Rules v1 (first‑score‑only)
1) Open Firebase Console → your project `digicert-product-quiz`.
2) Realtime Database → Rules.
3) Replace the contents with the JSON at docs/firebase-rules.v1.json and Publish.
4) Optional: adjust `score` max limit if needed (default 1000).

How to Upgrade to Rules v2 (enforce name + fingerprint)
1) Confirm most clients have shipped (app writes `nameSlug` + `fp`).
2) In Firebase Console → Realtime Database → Rules, paste docs/firebase-rules.v2.json and Publish.
3) Monitor write errors; if elevated, revert to v1 and investigate.

Optional: Observe‑Only Machine Prints
- The app writes `machinePrints/{quizId}/{fpMachine}` alongside `fingerprints`. Rules v2 allow these writes but do not enforce them on leaderboard validation.
- Use this to measure how many distinct uids share the same machine print before deciding to tighten further.

Free a Device (fingerprint) to Allow a Replay (v2)
- Go to Realtime Database → Data.
- Navigate to `fingerprints/{quizId}` and locate the hashed key for the device (fp).
- Delete `fingerprints/{quizId}/{fp}` to release the device lock.

Change/Correct a Player’s Display Name (v2)
1) Find the player’s `uid` under `leaderboard/{quizId}` (key is the uid). Confirm by matching `name/score/timestamp`.
2) Compute the old/new slugs:
   - old: the value in `leaderboard/{quizId}/{uid}/nameSlug`
   - new: lowercased, punctuation‑stripped, spaces to hyphens (same as app)
3) Update both:
   - Set `leaderboard/{quizId}/{uid}/name` to the new display name
   - Set `leaderboard/{quizId}/{uid}/nameSlug` to the new slug
   - Delete `nameIndex/{quizId}/{oldSlug}`
   - Create `nameIndex/{quizId}/{newSlug}` with value `uid`

Allow a Player a Fresh Attempt (v1 or v2)
- v1 only (first‑score‑only): delete `leaderboard/{quizId}/{uid}`.
- v2: also delete the device fingerprint and (optionally) the name index if reusing the name:
  - `leaderboard/{quizId}/{uid}`
  - `fingerprints/{quizId}/{fp}` (value of `fp` is in the player’s leaderboard record)
  - `nameIndex/{quizId}/{nameSlug}` (if you need to free the name)
  - If you later enforce machine prints, also delete `machinePrints/{quizId}/{fpMachine}`

Investigate “Permission denied” Errors
- Second attempt from same browser: blocked by v1 (`!data.exists()`).
- Incognito/same device after v2: blocked by `fingerprints` mapping.
- Duplicate display name after v2: blocked by `nameIndex` mapping.
 - Different browser on same machine after v2.1: blocked by `machinePrints` mapping.

Adjust Score Cap in Rules
- In the rules’ `.validate`, change the upper bound (default `<= 1000`).
- Rough formula: `maxTime × numberOfQuestions`. For the current quiz: `100 × 5 = 500`.

Rollback
- To relax restrictions: paste docs/firebase-rules.v1.json into the Rules editor and publish.
- App remains compatible; it falls back to a single leaderboard write if index writes are denied.

Where to Find a Player’s UID
- Realtime Database → `leaderboard/{quizId}` → each child key is the player’s `uid`.
- You can match by `name` and `score` to identify the correct record.

Notes
- The device fingerprint stored is a salted SHA-256 hash (no raw device data).
- Reads are public; writes require anonymous auth and pass rules checks.

Restore / Manually Add a Leaderboard Entry
1) In Firebase Console → Realtime Database → Data, identify the quizId (it’s the string used in the URL after `/quiz/`).
2) Pick the `uid` key for the record:
   - Best: use the original uid (if `nameIndex/{quizId}/{nameSlug}` still exists, its value is the uid).
   - If you don’t know it, create a new key like `manual-restore-2025-12-17` (note: this won’t be tied to the original player/device locks).
3) Create/update `leaderboard/{quizId}/{uid}` with at least these fields:
   - v1 rules: `{ name, score, timestamp }`
   - v2 rules: `{ name, nameSlug, score, timestamp, fp }`
   Notes:
   - `timestamp` is milliseconds since epoch (a number). Use “now” if you don’t know the original.
   - `nameSlug` is: trim/collapse spaces, lowercase, strip punctuation (keep a–z/0–9/spaces), then replace spaces with `-`.
4) If you’re on v2, also restore the indexes so uniqueness/anti-replay behavior matches the app:
   - `nameIndex/{quizId}/{nameSlug}` = `uid`
   - `fingerprints/{quizId}/{fp}` = `uid`
   - `machinePrints/{quizId}/{fpMachine}` = `uid` (optional/observe-only unless you enforce it)
