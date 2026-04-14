# DigiCertQuiz Architecture

This is the current high-level reference for how the quiz app is wired today.

## Routing

- `/` redirects to the quiz exported as `currentQuizId` from `src/quizzes/index.js`.
- `/quiz/:quizId` loads a specific weekly quiz through the quiz registry.
- `/leaderboard/full` and `/leaderboard/full/:quizId` render the screenshot-friendly Top 30 leaderboard view.
- `/leaderboard/cumulative` renders the merged cumulative leaderboard sourced from `public/cumulative-leaderboard-merged.csv`.

## Quiz Registry

- Each quiz lives in `src/quizzes/week-N-slug.js`.
- `src/quizzes/index.js` imports every quiz module, exports the `quizzes` map, and controls which quiz is currently live through `currentQuizId`.
- `src/quizzes/registry.test.js` validates the registry contract and catches missing imports, duplicate ids, and malformed quiz modules.

## Runtime Flow

- `src/components/QuizGame.js` owns the live quiz experience: intro, question flow, timer-based scoring, local resume state, server-backed attempt restore, and final save behavior.
- `src/services/firebaseAuth.js` handles anonymous Firebase auth with cached-token reuse, refresh, and in-flight de-duplication.
- Quiz save behavior writes the leaderboard entry plus hardening indexes through Firebase REST calls, with a legacy fallback write for older rules deployments.

## Hardening Model

- Start flow reserves an attempt at `attempts/{quizId}/{uid}` and `attemptFingerprints/{quizId}/{fp}` when the current rules support it.
- Completion flow writes `leaderboard/{quizId}/{uid}`, `nameIndex/{quizId}/{nameSlug}`, and `fingerprints/{quizId}/{fp}`.
- Machine-print writes are observe-only today and do not block successful score saves.
- Detailed rollout and rules guidance lives in `docs/hardening.md`.

## Operational Docs

- `docs/hardening.md`: anti-replay behavior and Firebase rules rollout
- `docs/admin.md`: support/admin fixes
- `docs/cumulative-leaderboard.md`: cumulative leaderboard workflow
- `scripts/README.md`: local script purpose and usage
