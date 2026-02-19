# Cumulative Leaderboard (Scripts + Reports)

This repo includes a small reporting pipeline to produce:

- A cumulative leaderboard across multiple weekly quizzes
- A "likely duplicates" list (name variants that are probably the same person)
- A fully merged cumulative leaderboard (where duplicates are consolidated)
- Screenshot-friendly pages for sharing (weekly Top 30 and cumulative Top 30)

## Script: `scripts/cumulative-leaderboard.js`

What it does:

- Fetches each quiz leaderboard from Firebase Realtime Database
- Aggregates totals per player (keyed by `nameSlug`)
- Outputs:
  - `cumulative-leaderboard.csv` (raw cumulative results)
  - `potential-duplicates.csv` (pair list to review / accept)
  - `cumulative-leaderboard-merged.csv` (fully merged results accepting all detected duplicates)

### Quiz coverage

The script uses a configured list of quiz IDs plus an optional range flag:

- Edit `ALL_QUIZ_IDS` inside `scripts/cumulative-leaderboard.js`
- By default, the script includes all IDs in that list
- Use `--from-week N` to include only week `N` and newer (for example, `--from-week 14`)
- `--from-week` also supports inline form: `--from-week=14`

### Weekly update checklist (e.g., add week 14)

1. Add the new quiz id (e.g. `week-16-...`) to `ALL_QUIZ_IDS` in `scripts/cumulative-leaderboard.js` when that week should be part of cumulative reporting.
2. Ensure Firebase reads are available (temporary public read) or set `AUTH_TOKEN`
3. Regenerate outputs with the desired range:

```sh
node scripts/cumulative-leaderboard.js \
  --from-week 14 \
  --csv cumulative-leaderboard.csv \
  --dupes-csv potential-duplicates.csv \
  --merged-csv public/cumulative-leaderboard-merged.csv
```

4. Quick sanity check:
   - `public/cumulative-leaderboard-merged.csv` header includes the new `W{N}-...` column
   - Visit `/leaderboard/cumulative` and confirm the Top 30 looks right
5. Commit + push the updated CSV(s) and script change (Vercel deploy picks up the new CSV)
6. Re-lock Firebase reads if you temporarily opened them

### Firebase reads (unlocking)

The report script reads from:

- `https://digicert-product-quiz-default-rtdb.firebaseio.com/leaderboard/{quizId}.json`

If reads are locked down, the easiest approach for running reports is to temporarily allow public reads on the `leaderboard` path in the Firebase Console:

- Firebase Console -> Realtime Database -> Rules
- Temporarily change:
  - `leaderboard: { ".read": "auth != null", ... }`
- To:
  - `leaderboard: { ".read": true, ... }`
- Publish, run the report, then revert back to the authenticated rule.

Reference rules file in this repo: `docs/firebase-rules.v2.json`

### Commands

Generate a cumulative CSV (also prints CSV to stdout):

```sh
node scripts/cumulative-leaderboard.js --csv cumulative-leaderboard.csv
```

Generate only from a given week onward:

```sh
node scripts/cumulative-leaderboard.js --from-week 14 --csv cumulative-leaderboard.csv
```

Generate the likely-duplicate pairs list:

```sh
node scripts/cumulative-leaderboard.js --dupes-csv potential-duplicates.csv
```

Generate the fully merged cumulative leaderboard (recommended location is under `public/` so the screenshot page can load it):

```sh
node scripts/cumulative-leaderboard.js --merged-csv public/cumulative-leaderboard-merged.csv
```

All in one run:

```sh
node scripts/cumulative-leaderboard.js \
  --from-week 14 \
  --csv cumulative-leaderboard.csv \
  --dupes-csv potential-duplicates.csv \
  --merged-csv public/cumulative-leaderboard-merged.csv
```

## How duplicates are detected

The script flags likely duplicates using two signals:

1. `slug_similarity`
   - Compares `nameSlug` values via a Levenshtein-based similarity score
   - A higher threshold is used for CSV output (`POTENTIAL_DUPES_SLUG_SIM_THRESHOLD`, currently `0.85`)

2. `last_initial_vs_lastname`
   - Catches cases like:
     - `Riann Pretorius` vs `Riann P`
     - `Riaan Pretorius` vs `Riaan P.`
   - Logic: first-name matches (typo-tolerant) AND one entry ends with a single-letter last initial while the other has a full last name starting with that initial.

## `potential-duplicates.csv` columns (how to read it)

This file is a *pair list* (two rows that likely represent the same person).

- `Method`: `slug_similarity` or `last_initial_vs_lastname` (or both, joined with `+`)
- `Score`: similarity percent for `slug_similarity` (blank for last-initial matches)
- `Total1` / `Total2`: each entry’s existing cumulative total (as-is)
- `OverlapQuizzes`: how many quizzes both entries played
- `MergedTotalLowestOverlap`: conservative merged estimate:
  - For overlapping quizzes, keep only the *lower* score
  - For non-overlapping quizzes, include both scores
- `OverlapDetails`: e.g. `W12:383/489->383` means both played week 12; keep 383

## Fully merged output: `--merged-csv`

`--merged-csv` accepts **all** detected duplicate edges, merges connected components (transitive merges), and writes a new cumulative leaderboard where:

- Each merged "player" has one row
- For each quiz, if multiple merged members have a score, the merged score for that quiz is the **lowest** of those scores
- The merged total is the sum across quizzes of those per-quiz merged scores

This is intentionally conservative (it prevents duplicates inflating totals).

## Screenshot pages

Weekly Top 30 (Firebase-backed):

- `/leaderboard/full` (current quiz)
- `/leaderboard/full/:quizId` (specific quiz)

Cumulative Top 30 (CSV-backed):

- `/leaderboard/cumulative`
- Loads `/cumulative-leaderboard-merged.csv` from `public/cumulative-leaderboard-merged.csv`

Implementation files:

- Weekly screenshot page: `src/components/FullLeaderboard.js`
- Cumulative screenshot page: `src/components/CumulativeMergedLeaderboard.js`
- Routes: `src/App.js`
