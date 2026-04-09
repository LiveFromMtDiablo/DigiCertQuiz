# Anti-Replay Hardening Guide

This document explains the current anti-replay design and the Firebase rules strategy that supports it.

## Goals

- Keep the quiz fast and low-friction
- Prevent easy replay from the same browser or device
- Preserve the same question set for every player
- Keep the support surface understandable for admins

## Current App Behavior

### Attempt reservation at quiz start

The current app reserves a run as soon as the player starts:

- creates `attempts/{quizId}/{uid}`
- creates `attemptFingerprints/{quizId}/{fp}`

That means clearing local storage no longer creates a truly fresh run for the same browser/device fingerprint.

### Resume behavior

If the same player refreshes during an in-progress quiz, the app restores the server-backed attempt state instead of starting over.

### Score save behavior

On successful completion, the app writes:

- `leaderboard/{quizId}/{uid}`
- `nameIndex/{quizId}/{nameSlug}`
- `fingerprints/{quizId}/{fp}`

If the quiz was started under the current `v3` flow, it also updates:

- `attempts/{quizId}/{uid}` to `completed`
- `attemptFingerprints/{quizId}/{fp}`

### Machine prints

The app also writes:

- `machinePrints/{quizId}/{fpMachine}`

That path is currently an observe-only signal for debugging and analysis. It is not enforced by any checked-in rules file in this repo.

## Rules Files in This Repo

### `v1`

File:

- `docs/firebase-rules.v1.json`

Behavior:

- first-score-only per anonymous Firebase uid

Use case:

- emergency rollback
- temporary legacy compatibility

### `v2`

File:

- `docs/firebase-rules.v2.json`

Behavior:

- first-score-only per uid
- unique normalized display name per quiz through `nameIndex`
- unique browser/device fingerprint per quiz through `fingerprints`

Use case:

- legacy mode when you want name and fingerprint enforcement without attempt reservation

### `v3`

File:

- `docs/firebase-rules.v3.json`

Behavior:

- everything in `v2`
- reserves attempts at quiz start
- blocks easy restart/replay after local-state clearing
- supports restore of in-progress runs

Use case:

- recommended steady state

## Recommended Rollout

For any fresh deployment:

1. Publish `docs/firebase-rules.v3.json`
2. Verify attempt creation and resume behavior
3. Use `docs/admin.md` for any support cleanup or manual recovery tasks

If you need to relax enforcement temporarily:

- roll back to `v1`
- treat `v2` as an intermediate legacy option, not the target end state

## Legacy Compatibility Note

The app still contains a compatibility fallback for old `v1` rules:

- it first tries a root multi-path `PATCH`
- if that write is rejected with `401` or `403`, it falls back to a single leaderboard `PUT`

That behavior exists to keep old-rule deployments from hard-failing during rollback or migration windows. It should not be treated as the preferred long-term path.

## Privacy Notes

- Raw device attributes are not stored directly
- `fp` and `fpMachine` are hashed values
- `nameSlug` is a normalized display-name key used for uniqueness enforcement

## What the Localhost Helper Does

On localhost only, the app exposes `Reset Dev Fingerprint`.

It:

- rotates a local development fingerprint seed
- clears cached anonymous auth
- clears local attempt/submission flags

It is disabled in production and does not weaken production enforcement.

## Testing Checklist

### Core checks

- first attempt from a clean browser works
- duplicate display names are blocked when they normalize to the same `nameSlug`
- same-browser replay is blocked after the attempt reservation is created
- refresh during an in-progress quiz restores the existing run
- completing a run marks the attempt `completed`

### `v3` database checks

After clicking Start, confirm:

- `attempts/{quizId}/{uid}` exists
- `attemptFingerprints/{quizId}/{fp}` exists

After completion, confirm:

- `leaderboard/{quizId}/{uid}` exists
- `nameIndex/{quizId}/{nameSlug}` exists
- `fingerprints/{quizId}/{fp}` exists

## Failure Modes Worth Knowing

### Eligibility check fails before the quiz starts

Likely cause:

- the published rules do not grant the reads the current app expects for `attemptFingerprints`

### Start fails immediately after a rules update

Likely cause:

- the live `attempts` validation is older than the app's current payload shape

### Score save fails after a rules change

Likely cause:

- mismatch between published rules and enforced uniqueness paths such as `nameIndex` or `fingerprints`

In all three cases, the fastest fix is usually to republish the full current rules file instead of editing fragments in the Firebase console.
