# DigiCertQuiz Architecture

This is the current high-level reference for how the quiz app is wired today.

## Routing

- `/` renders the quiz exported as `currentQuizId` from `src/quizzes/index.js`.
- `/quiz/:quizId` loads a specific weekly quiz through the quiz registry.
- `/leaderboard/full` and `/leaderboard/full/:quizId` render the screenshot-friendly Top 30 leaderboard view.
- `/leaderboard/cumulative` renders the merged cumulative leaderboard sourced from `public/cumulative-leaderboard-merged.csv`.
- `vercel.json` keeps SPA rewrites for `/quiz/*` and `/leaderboard/*`, and also disables aggressive caching on the SPA entry HTML. This avoids Safari serving a stale shell at `/` after deploys.

## Quiz Registry

- Each quiz lives in `src/quizzes/week-N-slug.js`.
- `src/quizzes/index.js` imports every quiz module, exports the `quizzes` map, and controls which quiz is currently live through `currentQuizId`.
- `src/quizzes/registry.test.js` validates the registry contract and catches missing imports, duplicate ids, and malformed quiz modules.

## Runtime Flow

- `src/components/QuizGame.js` is now the orchestration layer for the live quiz flow. It coordinates auth, eligibility, attempt restore, timer effects, and screen transitions.
- `src/components/quiz-game/IntroScreen.js`, `QuestionScreen.js`, and `LeaderboardScreen.js` own the rendered UI for the three quiz states.
- `src/hooks/useQuizState.js` holds reducer-backed runtime quiz state and reset/merge helpers.
- `src/hooks/useLeaderboardSubmission.js` owns final score submission, retry, and failure classification behavior.
- `src/utils/quizAttemptState.js` owns local attempt serialization, restore helpers, question-set parsing, and canonical snapshot selection.
- `src/utils/deviceFingerprint.js` owns browser and machine fingerprint derivation plus the local dev reset helper behavior.
- `src/services/firebaseAuth.js` handles anonymous Firebase auth with cached-token reuse, refresh, and in-flight de-duplication.
- `src/services/leaderboardApi.js` owns Firebase REST reads/writes for leaderboard fetches, attempt reservation/sync, attempt lookup, and score persistence, including the legacy fallback write path.
- `src/constants/ui.js` centralizes shared quiz chrome such as the background treatment and trophy colors used across leaderboard views.

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
