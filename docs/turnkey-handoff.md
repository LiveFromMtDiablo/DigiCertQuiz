# DigiCert Quiz – Turnkey Handoff Guide

This guide packages everything needed to stand up your own copy of the DigiCert Quiz stack using **GitHub**, **Vercel**, and **Firebase**, and then operate it without engineering support.

Use it in either of two ways:
- As the checklist an engineer follows to set things up and then transfer ownership.
- As the self-service runbook a marketing/ops team follows to create a fresh instance.

---

## 1. What You Own in This Stack

Each quiz deployment consists of three things you fully control:

- **GitHub repository**
  - Contains all quiz source code and quiz content.
  - Recommended: one repo per quiz programme or brand.
- **Vercel project**
  - Builds and hosts the React single-page app.
  - Auto-deploys on pushes to your chosen branch (e.g., `main`).
- **Firebase project**
  - Stores quiz leaderboards and anti-replay data in **Realtime Database**.
  - Handles anonymous auth for quiz players.

You can create multiple completely independent deployments by repeating this guide with new GitHub/Vercel/Firebase projects.

---

## 2. Prerequisites

Before starting, make sure you have:

- A GitHub account with permission to create repositories.
- A Vercel account (can be linked to GitHub).
- A Firebase project OR permission to create one in the correct Google Cloud org.
- Node.js and npm locally if you plan to run the app on your laptop (optional but recommended).

---

## 3. Create / Copy the GitHub Repository

You have two options. In both cases, the repo contents should match this folder (excluding `node_modules` and local-only files).

### Option A – Engineer prepares and transfers

1. On GitHub, create a new **private** repository (e.g., `product-quiz-2025`).
2. From this directory, initialize and push:
   - `git init`
   - `git remote add origin <new-repo-url>`
   - `git add .`
   - `git commit -m "Initial commit: DigiCert quiz"`
   - `git push -u origin main`
3. In GitHub, transfer repository ownership to the marketing-owned org / user.
4. Ensure marketing has **Admin** rights; then remove your personal access if desired.

### Option B – Marketing self-service

1. Download the code bundle or clone the template repo you were given.
2. Create a new GitHub repo under your own org/user.
3. Push the contents of this project to that repo.

Once the repo exists under marketing’s GitHub, the rest of the setup is self-contained.

---

## 4. Set Up Firebase (Leaderboard Backend)

You will create a dedicated Firebase project for this quiz (or reuse an existing one if already provisioned for quizzes).

### 4.1 Create the Firebase project and web app

1. Go to **Firebase Console** → **Add project**.
2. Name it something like `product-quiz-2025` and finish project creation.
3. In the new project:
   - Go to **Build → Realtime Database** and create a database.
   - Choose a location appropriate for your region.
4. Go to **Build → Authentication → Sign-in method**:
   - Enable **Anonymous** sign-in.
5. Go to **Project settings → General → Your apps**:
   - Add a **Web app** (</>) if one does not exist.
   - Copy the generated **Firebase config** snippet; you will paste these values into the app code in the next section.

### 4.2 Apply database rules

The repo contains recommended Realtime Database rules under `docs/`:

- `docs/firebase-rules.v1.json` – first-score-only per user.
- `docs/firebase-rules.v2.json` – adds name and device fingerprint enforcement.

Pick the rules version appropriate for your rollout (see `docs/admin.md` and `docs/hardening.md` for details).

To apply:

1. In Firebase Console, go to **Build → Realtime Database → Rules**.
2. Replace the existing rules with the JSON from your chosen file.
3. Click **Publish**.

You can tighten or relax rules later using the same process.

### 4.3 Wire the app to your Firebase project

The quiz app reads Firebase configuration from `src/services/firebaseConfig.js`.

1. Open `src/services/firebaseConfig.js`:
   - Replace the existing `firebaseConfig` values with the config snippet from your Firebase Web app:
   - Keep the object shape (`apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `measurementId`).
2. Commit this change to your GitHub repo.

Notes:

- These values identify your Firebase project and are used from the browser; they are not secret credentials in the traditional sense, but you still control read/write access via the Realtime Database rules.
- If you later rotate API keys or create a new Firebase project, repeat this step with the updated config.

---

## 5. Run and Verify Locally (Optional but Recommended)

Running the app locally lets you confirm everything works before connecting Vercel.

From the project root:

1. Install dependencies:
   - `npm install`
2. Start the dev server:
   - `npm start`
3. In your browser:
   - Navigate to `/quiz/<quiz-id>` (e.g., `/quiz/week-1-key-sovereignty`).
   - Submit a test score; confirm it appears in the Firebase Realtime Database under:
     - `leaderboard/{quizId}/{uid}`
4. Optionally run schema checks for quizzes:
   - `npm run test:quizzes`

If writes are failing, check:

- That Anonymous auth is enabled.
- That your chosen rules file is published.
- That `firebaseConfig.js` points to the correct project and `databaseURL`.

---

## 6. Deploy with Vercel

Vercel builds and hosts the React app directly from your GitHub repo.

### 6.1 Create the Vercel project

1. Log in to **Vercel** and click **New Project**.
2. Choose **Import Git Repository** and select the quiz repo you created.
3. Vercel should auto-detect this as a Create React App project.
   - **Build command**: `npm run build`
   - **Output directory**: `build`
4. Click **Deploy**.

Once the first deployment finishes, Vercel will provide a preview URL and a production URL (typically on the `main` branch).

### 6.2 Ongoing deployments

- Any push to the configured branch (e.g., `main`) triggers a new build and deployment.
- For new quizzes:
  - Follow `src/quizzes/README.md` to add quiz content.
  - Commit and push; Vercel handles redeploying.

No Vercel environment variables are required for the current design; Firebase configuration lives in `firebaseConfig.js`.

---

## 7. Operations and Self-Service

Once GitHub, Vercel, and Firebase are set up, marketing/ops can run this quiz programme independently.

Key docs in this repo:

- Quiz content:
  - `src/quizzes/README.md` – how to author, register, and validate new quizzes.
- Architecture and behaviour:
  - `QUIZ_ARCHITECTURE_PLAN.md` – how routing, leaderboards, and quiz data are structured.
- Security and fairness:
  - `docs/hardening.md` – anti-replay design and rules rollout plan.
  - `docs/admin.md` – admin operations (free a device, change a name, adjust score caps, etc.).

Typical recurring tasks:

- **Add a new weekly quiz**
  - Follow `src/quizzes/README.md`.
  - Verify locally (optional) and then push to `main`.
- **Take a leaderboard screenshot**
  - Visit `/leaderboard/full` for the current quiz.
  - Or `/leaderboard/full/{quizId}` for a specific quiz.
- **Adjust fairness rules**
  - Update Firebase Realtime Database rules using `docs/firebase-rules.*.json`.

---

## 8. Handing Off Ownership (Engineer → Marketing)

If an engineer is setting things up initially and then stepping away, use this checklist to ensure a clean handoff:

- **GitHub**
  - Repo lives under the marketing-owned org/user.
  - At least two marketing/ops admins have `Admin` access.
  - Any personal engineering accounts are removed (if desired).
- **Vercel**
  - Project is owned by the marketing/ops Vercel team.
  - Production domain and preview URLs are documented.
  - GitHub integration is connected under their account.
- **Firebase**
  - Firebase project is in the correct org/billing account.
  - Marketing/ops admins have Owner/Editor permissions.
  - Engineering accounts downgraded or removed once handoff is complete.

After the above, the marketing team:

- Owns the full stack (code, hosting, and data).
- Can add new quizzes and change rules without needing the original engineer.
- Can replicate the quiz stack for another team/brand by repeating this document with a new GitHub repo, Vercel project, and Firebase project.

