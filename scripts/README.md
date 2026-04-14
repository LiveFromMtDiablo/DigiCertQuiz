# Scripts

## `cumulative-leaderboard.js`

- Purpose: fetch weekly leaderboard data, aggregate total points across quizzes, and emit CSV reports for the cumulative leaderboard workflow.
- When to run: when refreshing the cumulative leaderboard page or reviewing likely duplicate player merges.
- Expected output: optional root-level CSVs for raw totals and duplicate review plus a merged CSV, typically written to `public/cumulative-leaderboard-merged.csv`.
- Inputs: optional `AUTH_TOKEN`, `--from-week`, `--csv`, `--dupes-csv`, and `--merged-csv`.
- Owner: DigiCert Quiz maintainers.

## `quiz-integrity-audit.js`

- Purpose: inspect one quiz for missing index rows, shared fingerprints, and suspicious replay patterns.
- When to run: after a quiz closes, during support review, or while investigating anti-replay anomalies.
- Expected output: a console summary by default, or JSON when run with `--json`.
- Inputs: anonymous Firebase auth via the configured project plus optional `--quiz-id`, `--window-minutes`, and `--json`.
- Owner: DigiCert Quiz maintainers.
