# DigiCertQuiz

## Local Setup

Run commands from the repo root (`/Users/j.pace.admin/Documents/GitHub/DigiCertQuiz`):

```sh
npm install
```

If you see `ENOENT ... /Users/<you>/package.json`, you're in the wrong directory. `cd` into this repo and rerun.

## Full Leaderboard (Screenshot View)

- Route: open `/leaderboard/full` to show the current quiz’s full leaderboard (top 30) formatted for a 1920×1080 desktop screenshot.
- Optional: open `/leaderboard/full/:quizId` to target a specific quiz id.
- Layout: three columns of 10 entries (10/10/10), ranks continue across columns.
- Header includes the quiz title and today’s date for convenient email screenshots.

Implementation files:
- `src/components/FullLeaderboard.js`
- `src/App.js`

## Cumulative Leaderboard (Merged + Screenshot View)

- Script: `scripts/cumulative-leaderboard.js`
- Cumulative screenshot route: open `/leaderboard/cumulative` (Top 30 total points across quizzes, screenshot-friendly).
- Data source for the cumulative screenshot route: `public/cumulative-leaderboard-merged.csv` (served as `/cumulative-leaderboard-merged.csv`).

Typical workflow:

```sh
# 1) Generate the raw cumulative CSV + likely-duplicate pairs + fully merged CSV (written into /public)
#    Example below scopes the report to week 14 and newer.
node scripts/cumulative-leaderboard.js \
  --from-week 14 \
  --csv cumulative-leaderboard.csv \
  --dupes-csv potential-duplicates.csv \
  --merged-csv public/cumulative-leaderboard-merged.csv

# 2) Open the screenshot page
#    /leaderboard/cumulative
```

More details: `docs/cumulative-leaderboard.md`

## Turnkey Handoff

For a step-by-step guide to setting up a fresh copy of this quiz stack on **GitHub**, **Vercel**, and **Firebase** (and then handing it over to a non-engineering team), see:

- `docs/turnkey-handoff.md`
