# DigiCert Quiz Handoff Guide

This guide is the practical handoff path for standing up a fresh copy of the DigiCert Quiz stack and transferring it to a non-engineering owner.

The current stack is:

- GitHub for source control
- Vercel for hosting the React single-page app
- Firebase Realtime Database + Anonymous Auth for quiz eligibility, attempts, and leaderboards

## What This Repo Assumes

Before you copy this stack, it helps to know what is hardcoded in the repo today:

- Firebase web-app config lives in `src/services/firebaseConfig.js`
- Client-side routing depends on `vercel.json` rewrites for `/quiz/*` and `/leaderboard/*`
- The default live quiz route comes from `currentQuizId` in `src/quizzes/index.js`
- The recommended Firebase rules file is `docs/firebase-rules.v3.json`
- `machinePrints/{quizId}/{fpMachine}` is collected as an observe-only signal; there is no checked-in `v2.1` rules file in this repo

## 1. Accounts and Access You Need

- A GitHub account that can create a repository
- A Vercel account or team that can import the repository
- A Firebase project in the right Google org and billing context
- Local Node.js + npm if you want to verify locally before handing off

## 2. Create the GitHub Repository

Use either of these paths:

### Engineer-prepared handoff

1. Create a new private repository in the destination org.
2. Push this codebase into that repo.
3. Transfer or share admin access with the marketing/ops owner.
4. Remove personal engineering access after the handoff is complete if that is part of the transition plan.

### Self-service copy

1. Create a new private repository under the destination org or user.
2. Copy this codebase into it.
3. Push the project contents.

Recommended ownership outcome:

- The repo lives under the long-term business owner
- At least two non-engineering admins have access
- The default branch for production deploys is documented

## 3. Create and Configure Firebase

### 3.1 Create the project

1. In Firebase Console, create a new project.
2. Add a Web app under Project Settings.
3. Enable Anonymous Authentication.
4. Create a Realtime Database in the desired region.

### 3.2 Wire the app to the new Firebase project

Copy the Firebase config from the new web app into `src/services/firebaseConfig.js`.

Keep the same object shape:

- `apiKey`
- `authDomain`
- `databaseURL`
- `projectId`
- `storageBucket`
- `messagingSenderId`
- `appId`
- `measurementId`

Important note:

- These values are browser-visible configuration, not private server credentials.
- Changing Firebase projects requires a code change and redeploy because this repo does not currently read them from Vercel environment variables.

### 3.3 Publish database rules

Recommended choice:

- Publish `docs/firebase-rules.v3.json`

Why `v3` is the recommended baseline:

- It reserves quiz attempts at start time
- It prevents easy restart/replay after clearing local state
- It matches the app's current attempt-resume flow

Legacy files still in the repo:

- `docs/firebase-rules.v1.json`: first-score-only by uid
- `docs/firebase-rules.v2.json`: adds name and browser/device fingerprint enforcement

Use `v1` or `v2` only if you intentionally need a temporary rollback or troubleshooting step. The current app is built around the `v3` flow.

## 4. Verify the Stack Locally

From the repo root:

```sh
npm install
npm start
```

Then verify:

1. Open the local app URL.
2. Visit a quiz route such as `/quiz/week-21-cert-central-part-3` or whichever quiz is currently live in `src/quizzes/index.js`.
3. Start a quiz and confirm the run begins cleanly.
4. Submit a test score and confirm Firebase writes appear where expected.

For a `v3` setup, the important paths are:

- `attempts/{quizId}/{uid}`
- `attemptFingerprints/{quizId}/{fp}`
- `leaderboard/{quizId}/{uid}`
- `nameIndex/{quizId}/{nameSlug}`
- `fingerprints/{quizId}/{fp}`

Optional validation:

```sh
npm run test:quizzes
```

Localhost-only helper:

- On localhost, the intro and leaderboard screens expose `Reset Dev Fingerprint`
- It clears local quiz/auth state and rotates the local dev fingerprint seed
- It is disabled in production

## 5. Deploy to Vercel

### 5.1 Create the project

1. In Vercel, choose `New Project`.
2. Import the GitHub repository.
3. Keep the standard Create React App build settings:
   - Build command: `npm run build`
   - Output directory: `build`
4. Deploy.

### 5.2 Keep the routing rewrites

This repo depends on `vercel.json` so deep links like these load correctly:

- `/quiz/<quizId>`
- `/leaderboard/full`
- `/leaderboard/full/<quizId>`
- `/leaderboard/cumulative`

Do not remove `vercel.json` unless routing is redesigned.

### 5.3 Environment variables

No Vercel environment variables are required for the current client app.

That is convenient for handoff, but it also means:

- Firebase config changes require a commit
- Vercel redeploys are needed when the Firebase project changes

## 6. Day-2 Operating Tasks

### Add or stage a new quiz

Follow `src/quizzes/README.md`.

Important operational note:

- You can add a new quiz file and register it without making it live immediately
- The live default route is controlled by `currentQuizId` in `src/quizzes/index.js`

### Take leaderboard screenshots

- Weekly leaderboard: `/leaderboard/full`
- Weekly leaderboard for a specific quiz: `/leaderboard/full/{quizId}`
- Cumulative leaderboard: `/leaderboard/cumulative`

For cumulative reporting details, use `docs/cumulative-leaderboard.md`.

### Admin or fairness changes

Use:

- `docs/admin.md` for operational fixes and Firebase data edits
- `docs/hardening.md` for rules strategy and rollout context

## 7. Handoff Checklist

Before the engineer fully steps away, confirm:

- GitHub
  - Repository is owned by the long-term org or business owner
  - At least two non-engineering admins have admin access
- Vercel
  - Project is owned by the correct Vercel team
  - Production URL is documented
  - The connected Git provider is owned by the right account/team
- Firebase
  - Project lives in the correct billing/org context
  - Marketing/ops owners can access Authentication and Realtime Database
  - The published rules version is documented

Also document these repo-specific decisions:

- Which branch Vercel deploys to production
- Which quiz is live now (`currentQuizId`)
- Whether cumulative leaderboard reporting is part of the operating routine
- Who is responsible for Firebase data cleanup if a player needs a retry

## 8. Recommended Owner Docs

If you hand this repo to another team, point them here first:

- `README.md`
- `src/quizzes/README.md`
- `docs/admin.md`
- `docs/hardening.md`
- `docs/cumulative-leaderboard.md`

That set is enough for most non-engineering ownership paths without needing a separate engineering walkthrough.
