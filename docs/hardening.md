Anti‑Replay Hardening Plan (v1/v2)

Objectives
- Keep instant correct‑answer reveal and confetti.
- Keep the same questions for all players.
- Reduce repeat attempts from same device/incognito/new browser with minimal friction.

What Changed (App v1)
- Per‑session shuffling
  - Shuffle question order and each question’s option order on Start.
  - Correct answer index is recomputed per question after option shuffle.
  - Implementation: src/components/QuizGame.js (secure RNG + Fisher–Yates).
- Multi‑path save with indexes
  - Save score via a single PATCH at DB root with keys:
    - leaderboard/{quizId}/{uid}: { name, nameSlug, score, timestamp, fp, fpMachine }
    - nameIndex/{quizId}/{nameSlug}: uid
    - fingerprints/{quizId}/{fp}: uid
    - machinePrints/{quizId}/{fpMachine}: uid (observe‑only in v2; enforced in v2.1)
  - nameSlug: sanitized, lowercased, punctuation‑stripped name (non‑PII).
  - fp: SHA‑256 hash of a small, non‑PII device fingerprint salted with quizId.
- Existing client guards remain (localStorage flag + existing server record check).

Rules Rollout
- v1 (now): first‑score‑only per uid
  - File: docs/firebase-rules.v1.json
  - Enforces a single write to leaderboard/{quizId}/{uid}.
- v2 (after app adoption): enforce name/fingerprint indices
  - File: docs/firebase-rules.v2.json
  - Requires nameSlug + fp fields on leaderboard write.
  - Leaderboard validation allows index entries to be missing (free) or already mapped to the same uid; the multi‑path update creates them atomically at `nameIndex` and `fingerprints`, whose own rules ensure uniqueness.
  - Ensures each nameSlug and each fp is used by only one uid per quiz.

Staged Tightening (v2.1): enforce machine‑level prints
- File: docs/firebase-rules.v2.1.json
- Adds a browser‑agnostic machine print gate (`fpMachine`), blocking cross‑browser replays on the same machine.
- Requires `fpMachine` in the leaderboard entry and validates that `machinePrints/{quizId}/{fpMachine}` is free or mapped to the same uid.

Checklist before enabling v2.1
- Adoption ≥ 95%: New leaderboard entries include `fpMachine` and matching `machinePrints` mapping.
- Low collision risk: Minimal `machinePrints/{quizId}` collisions across different uids (spot‑check).
- Admin ready: Comfortable freeing `machinePrints/{quizId}/{fpMachine}` if a shared device is blocked.
- Communication: Short note clarifying first score per device to keep scoring fair.

Privacy Notes
- No raw device attributes are stored; only salted SHA‑256 hashes (fp, fpMachine).
- nameSlug stores a normalized variant of the display name for uniqueness checks.
- Reads remain public. Writes require anonymous auth and rules enforcement.
- `fpMachine` is a browser‑agnostic hash used to study cross‑browser duplication. It is not enforced in rules v2.

Operational Steps
1) Apply rules v1 in Firebase console.
2) Deploy app v1.
3) After majority of writes include nameSlug/fp, apply rules v2.

Admin Guidance
- If a shared kiosk caused a false positive, an admin can remove fingerprints/{quizId}/{fp} to free that device.
- Score bounds in rules are set to a generous upper limit (1000). Adjust if quiz length/timer change.

Testing Checklist
- First attempt from a device writes successfully.
- Second attempt from the same uid is blocked (v1+).
- Incognito/new uid on same device is blocked after v2 (fp mapping).
- Duplicate display names (after normalization) are blocked after v2 (nameIndex mapping).

