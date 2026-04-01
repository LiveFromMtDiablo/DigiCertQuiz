# DigiCertQuiz

## Local Setup

Run commands from the repo root (`/Users/j.pace.admin/Documents/GitHub/DigiCertQuiz`):

```sh
npm install
npm start
```

If you see `ENOENT ... /Users/<you>/package.json`, you're in the wrong directory. `cd` into this repo and rerun.

When `npm start` finishes compiling, open the local dev URL it prints, usually `http://localhost:3000`.

### Localhost Dev Fingerprint Reset

On localhost only, the quiz intro and leaderboard screens show a `Reset Dev Fingerprint` helper.

- It rotates a local-only fingerprint seed used by the browser and machine fingerprint hashes.
- It clears cached anonymous Firebase auth.
- It clears local quiz attempt and submitted flags.
- It immediately re-runs eligibility checks so you can test fresh-start flows without manually clearing storage.

This helper is intentionally disabled in production builds and should not appear for real users.

## Testing

Useful test commands:

```sh
# Run the full Jest suite once
npm test -- --watchAll=false

# Run the full suite with coverage output
npm run test:coverage

# Run only quiz-registry validation
npm run test:quizzes

# Run only the QuizGame component tests, including dev fingerprint reset coverage
npm test -- --runTestsByPath src/components/QuizGame.test.js --watchAll=false
```

Coverage output is written to `/coverage`. Open `coverage/lcov-report/index.html` for the HTML report after running `npm run test:coverage`.

Current automated-test snapshot as of April 1, 2026:

- 8 passing Jest suites
- 41 passing tests
- Coverage:
  - 68.49% statements
  - 58.65% branches
  - 72.79% functions
  - 69.84% lines

Areas with strong coverage:

- `src/components/QuizGame.js`
- `src/services/firebaseAuth.js`
- `src/App.js`
- `src/utils/*`
- `src/quizzes/*`

Next obvious coverage targets are the standalone leaderboard screens:

- `src/components/FullLeaderboard.js`
- `src/components/CumulativeMergedLeaderboard.js`

Current coverage specifically includes the localhost-only dev fingerprint reset flow:

- reset helper visibility on localhost
- clearing cached auth and quiz locks
- rotating the local dev fingerprint seed
- deriving a different fingerprint after seed rotation

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
