# DigiCert Quiz - Multi-Quiz Architecture Plan

## Status Update (Implemented)

The refactor and security hardening are live. Highlights:
- Clean URLs with React Router (`/quiz/:quizId`), root redirects to current quiz
- Quiz UI extracted to `src/components/QuizGame.js`; Week 1 data in `src/quizzes/week-1-key-sovereignty.js`
- Per‑quiz, per‑user leaderboard under `leaderboard/{quizId}/{uid}` with Anonymous Auth
- Rules validate name/score/timestamp; updates allowed only if higher
- First‑score‑only UX; intro shows Top 3; leaderboard shows Top 25
- DigiCert branding added; icon sizes improved; final score display corrected

New (Implemented): Screenshot Leaderboard view
- Standalone full leaderboard screen for email-ready screenshots
- Shows Top 30 in a 10/10/10 three-column layout (desktop 1920×1080)
- Routes: `/leaderboard/full` (current quiz) and `/leaderboard/full/:quizId`
- Header includes quiz title and "Last refreshed: <date>"
- Appends sanitized tagline (removes leading "This week’s focus:") after a bullet
- Trophies for ranks 1–3 rendered to the left of the score
- No breakpoints/responsiveness; designed to fit above the fold; not linked from quiz flow

## Overview

### Current State (Post‑Refactor)
- Router-based app; `App.js` only defines routes
- Quiz logic in `src/components/QuizGame.js`; Week 1 data file present
- Clean URLs (example): `/quiz/week-1-key-sovereignty`; root redirects to current quiz
- Leaderboard per quiz at `/leaderboard/{quizId}/{uid}` (Anonymous Auth for writes)
 - Intro shows Top 3; in-quiz leaderboard view shows Top 25; standalone screenshot leaderboard shows Top 30

### Goal (Multiple Quizzes)
- Multiple quizzes, one per week
- Each quiz accessible via its own URL
- Old quizzes remain accessible indefinitely
- Separate leaderboards per quiz
- Easy for non-technical team to add new quizzes
- No homepage/archive page needed yet (can add later)

### Key Requirements
- ✅ Each quiz gets unique URL (e.g., `/quiz/week-1-key-sovereignty`)
- ✅ Old quizzes never disappear
- ✅ Separate Firebase leaderboard per quiz
- ✅ Same UI/design for all quizzes
- ✅ Simple process for adding new weekly quizzes
- ✅ Team-friendly (low technical barrier)

---

## Architecture Design

### File Structure (Current)

```
DigiCertQuiz/
├── src/
│   ├── App.js                          # Router setup (NEW)
│   ├── index.js                        # Entry point (unchanged)
│   ├── styles.css                      # Global styles (unchanged)
│   ├── components/
│   │   └── QuizGame.js                 # Quiz UI component
│   │   └── FullLeaderboard.js          # Screenshot view: Top 30 (10/10/10)
│   ├── services/
│   │   ├── firebaseConfig.js           # Firebase config + DB URL
│   │   └── firebaseAuth.js             # Anonymous Auth (sign-in/refresh)
│   └── quizzes/
│       ├── index.js                    # Quiz registry & helper accessors
│       ├── week-1-key-sovereignty.js   # Week 1 quiz data (currently live)
│       ├── README.md                   # Authoring guide for new quizzes
│       └── registry.test.js            # Automated registry/schema validation
├── public/
│   └── images/digicert-blue-logo-large.jpg  # Branding asset
├── package.json                        # Dependencies (includes react-router-dom)
└── QUIZ_ARCHITECTURE_PLAN.md          # This document
```

### Component Breakdown

#### `App.js` (Router)
**Purpose:** Handle URL routing and load appropriate quiz

**Responsibilities:**
- Define SPA routes (`/`, `/quiz/:quizId`) with React Router (BrowserRouter is created in `src/index.js`)
- Add screenshot leaderboard routes: `/leaderboard/full` and `/leaderboard/full/:quizId`
- Resolve quiz data via the `getQuiz` helper
- Render a Link-based not-found screen that keeps navigation client side
- Redirect the homepage to the current quiz (for now)

**Code Structure:**
```javascript
import { Routes, Route, Navigate, useParams, Link } from 'react-router-dom';
import QuizGame from './components/QuizGame';
import { getQuiz, currentQuizId } from './quizzes';

// BrowserRouter is instantiated in src/index.js
// Route /quiz/:quizId → loads that quiz
// Route / → redirects to current quiz
```

#### `components/QuizGame.js` (Quiz UI)
**Purpose:** Display quiz interface and handle game logic

**Responsibilities:**
- Render intro, question, and leaderboard screens for each quiz
- Track timer-based scoring and enforce first-score-only submissions
- Interact with Firebase using quiz-scoped leaderboard paths and anonymous auth
- Enforce unique leaderboard display names per quiz to match employee audience expectations
- In-quiz Leaderboard displays Top 25

**Props:**
```javascript
<QuizGame
  quizId="week-1-key-sovereignty"
  title="DigiCert Weekly Product Quiz #1"
  questions={[/* ... */]}
  maxTime={100}
/>
```

#### `quizzes/index.js` (Quiz Registry)
**Purpose:** Central registry of all quizzes

**Responsibilities:**
- Import quiz modules as they are authored
- Export a map of quizzes keyed by `id`
- Provide a `getQuiz` helper for router lookups
- Define which quiz is "current" for the homepage redirect

**Code Structure:**
```javascript
import week1 from './week-1-key-sovereignty';

export const quizzes = {
  [week1.id]: week1,
};

export const currentQuizId = week1.id;

export function getQuiz(id) {
  return quizzes[id];
}
```

#### `quizzes/week-1-key-sovereignty.js` (Quiz Data)
**Purpose:** Individual quiz content

**Structure:**
```javascript
const quiz = {
  id: "week-1-key-sovereignty",
  title: "DigiCert Weekly Product Quiz #1",
  maxTime: 100,
  questions: [
    {
      question: "What best defines key sovereignty?",
      options: ["...", "...", "...", "..."],
      correctAnswer: 1,
    },
    // ... more questions
  ],
};

export default quiz;
```

---

## URL Structure

### Quiz URLs

Each quiz has its own permanent URL:

```
digi-cert-quiz.vercel.app/quiz/week-1-key-sovereignty
digi-cert-quiz.vercel.app/quiz/week-2-certificate-lifecycle
digi-cert-quiz.vercel.app/quiz/week-3-pki-fundamentals
digi-cert-quiz.vercel.app/quiz/week-4-code-signing
```

*Currently, only `week-1-key-sovereignty` is published; future quizzes will follow the same pattern.*

**URL Pattern:** `/quiz/{quiz-id}`

**Quiz ID Format:** `week-{number}-{topic-slug}`
- Example: `week-1-key-sovereignty`
- Lowercase, hyphenated
- Descriptive and readable

### Homepage URL

```
digi-cert-quiz.vercel.app/
```

**Current Behavior:** Redirects to current week's quiz

**Future Options:**
- Quiz archive/library page
- Featured quiz
- Quiz selector
- Company branding page

### Invalid URLs

```
digi-cert-quiz.vercel.app/quiz/invalid-quiz-id
```

**Behavior:** Show 404 or "Quiz not found" message, link to current quiz

### Screenshot Leaderboard URLs

Standalone, desktop-only view for email screenshots:

```
/leaderboard/full                 # current quiz
/leaderboard/full/:quizId         # specific quiz
```

Notes:
- Renders Top 30 across three columns (10/10/10)
- Header: Title + "Last refreshed: <date>" + sanitized tagline (intro without leading "This week’s focus:")
- Trophies for ranks 1–3 shown left of score
- Not linked from quiz; direct navigation only

---

## Firebase Leaderboard Strategy

### Current Structure (Per‑Quiz, Per‑User)
```
/leaderboard/
  ├── week-1-key-sovereignty/
  │   ├── {uidA}: { name, score, timestamp }
  │   ├── {uidB}: { name, score, timestamp }
  │   └── ...
  └── week-2-.../
      └── {uidX}: { name, score, timestamp }
```

### Implementation (in app)

Save score (simplified):
```javascript
// Ensure Anonymous Auth; get { uid, idToken }
await fetch(`${DB_URL}/leaderboard/${quizId}/${uid}.json?auth=${idToken}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name, score, timestamp: { '.sv': 'timestamp' } })
});
```

Load leaderboard:
```javascript
const res = await fetch(`${DB_URL}/leaderboard/${quizId}.json`, { cache: 'no-store' });
const data = await res.json();
const entries = data ? Object.values(data) : [];
entries.sort((a,b) => (b.score - a.score) || (b.timestamp - a.timestamp));
```

### Rules (published)
- Reads are public; writes require auth and are allowed only for the user’s own `{uid}`.
- Validates: name pattern (2–30 chars), score range (0–900 for Week 1), timestamp <= now.
- Allows create, or update only if the new score is higher.

### Benefits
- ✅ One record per user/device per quiz
- ✅ Safe updates (only if higher)
- ✅ Server timestamps; resistant to client clock skew
- ✅ Clear partitioning per quiz

### Screenshot Leaderboard Consumption
- Reads the same per-quiz collection and applies the existing sort: score desc, then timestamp desc
- Displays Top 30 instead of Top 25 and uses a fixed, compact layout suitable for 1920×1080

---

## Implementation Steps

### Phase 1: Setup & Dependencies (done)

**Step 1.1:** Install React Router
```bash
npm install react-router-dom
```

**Step 1.2:** Create folder structure
```bash
mkdir src/components
mkdir src/quizzes
```

### Phase 2: Extract Quiz Component (done)

**Step 2.1:** Create `components/QuizGame.js`
- Copy all current quiz logic from `App.js`
- Convert to accept props: `{ quizId, title, questions, maxTime }`
- Update Firebase paths to include `quizId`
- Export as default

**Step 2.2:** Update state management
- Keep all existing state (screen, playerName, currentQuestion, etc.)
- Add quiz data as props instead of constants

### Phase 3: Create Quiz Data Files (done)

**Step 3.1:** Create `quizzes/week-1-key-sovereignty.js`
- Export quiz object with id, title, maxTime, questions
- Use your current 5 Key Sovereignty questions

**Step 3.2:** Create `quizzes/index.js`
- Import week-1 quiz
- Export `quizzes` object
- Export `currentQuizId`

**Step 3.3:** Maintain `quizzes/README.md`
- Keep authoring instructions, templates, and field definitions current for non-technical contributors
- Document any new quiz metadata fields as they are introduced

### Phase 4: Implement Routing (done)

**Step 4.1:** Update `App.js`
- Import React Router components
- Import QuizGame component
- Import quizzes registry
- Set up routes

**Step 4.2:** Add route handlers
- `/quiz/:quizId` → QuizGame with quiz data
- `/` → Redirect to current quiz
- `*` → 404 handler

**Step 4.3:** Add URL parameter handling
- Extract `quizId` from URL
- Look up quiz in registry
- Pass quiz data to QuizGame

### Phase 5: Testing

**Step 5.1:** Test locally
```bash
npm start
```
Run `npm run test:quizzes` to ensure registry and schema validations pass before publishing.

**Step 5.2:** Test scenarios
- Navigate to `/quiz/week-1-key-sovereignty`
- Take quiz, verify leaderboard saves correctly
- Navigate to `/` (should redirect)
- Try invalid URL (should show 404)

**Step 5.3:** Test on dev branch
- Push to `dev` branch
- Check Vercel preview URL
- Verify all routes work in production build

### Phase 6: Deploy

**Step 6.1:** Merge to main
```bash
# In GitHub Desktop:
# 1. Switch to main
# 2. Merge dev into main
# 3. Push
```

**Step 6.2:** Update existing links
- Update any shared links to use new URL format
- `/quiz/week-1-key-sovereignty` instead of just `/`

**Step 6.3:** Verify production
- Check `digi-cert-quiz.vercel.app/quiz/week-1-key-sovereignty`
- Take quiz, verify leaderboard works
- Check Firebase to see new path structure

---

## Adding New Quizzes (Team Instructions)

### For Non-Technical Team Members

**Step 1: Copy the Template**

1. Navigate to `src/quizzes/` folder
2. Copy `week-1-key-sovereignty.js`
3. Rename to `week-{N}-{topic}.js` (e.g., `week-2-certificate-lifecycle.js`)

**Step 2: Update Quiz Content**

Open your new file and update:

```javascript
const quiz = {
  id: "week-2-certificate-lifecycle",          // Must match file name slug
  title: "DigiCert Weekly Product Quiz #2",     // Display title
  maxTime: 100,                                 // Seconds per question (adjust if needed)
  questions: [
    {
      question: "Your question text?",          // Replace with quiz content
      options: ["Answer A", "Answer B", "Answer C", "Answer D"],
      correctAnswer: 1,                         // 0 = first option, 1 = second, etc.
    },
    // Add at least 4 total questions
  ],
};

export default quiz;
```

**Step 3: Register the Quiz**

Open [`src/quizzes/index.js`](./index.js) and update the registry:

- Add an import for your new module.
- Add the quiz to the exported `quizzes` map.
- Update `currentQuizId` if this is the newest quiz.
- Ensure the `getQuiz` helper returns the new quiz.

```javascript
import week1 from './week-1-key-sovereignty';
import week2 from './week-2-certificate-lifecycle';  // ← Add this line

export const quizzes = {
  [week1.id]: week1,
  [week2.id]: week2,  // ← Add this line
};

export const currentQuizId = week2.id;  // ← Update this

export function getQuiz(id) {
  return quizzes[id];
}
```

**Step 4: Commit and Deploy**

1. Open GitHub Desktop
2. You'll see your changes in the left panel
3. Write a commit message: "Add Week 2: Certificate Lifecycle quiz"
4. Click "Commit to dev"
5. Click "Push origin"
6. Wait 2 minutes, check Vercel for preview URL
7. Test the quiz: `digi-cert-quiz.vercel.app/quiz/week-2-certificate-lifecycle`
8. When ready, merge dev → main for production

**Step 5: Share the Link**

Your new quiz is live at:
```
https://digi-cert-quiz.vercel.app/quiz/week-2-certificate-lifecycle
```

Share this link via email, Slack, etc.

### Quiz ID Guidelines

**Format:** `week-{number}-{topic-slug}`

**Good Examples:**
- `week-1-key-sovereignty`
- `week-2-certificate-lifecycle`
- `week-3-pki-fundamentals`
- `week-4-code-signing-basics`

**Bad Examples:**
- `Week 1 Key Sovereignty` (no spaces, no capitals)
- `week1` (include topic for clarity)
- `key-sovereignty` (include week number)

**Rules:**
- All lowercase
- Use hyphens, not spaces or underscores
- Include week number
- Include descriptive topic
- Keep it concise but readable

---

## Technical Details

### React Router Configuration

```javascript
// App.js
import { Routes, Route, Navigate, useParams, Link } from 'react-router-dom';
import QuizGame from './components/QuizGame';
import { getQuiz, currentQuizId } from './quizzes';

function QuizPage() {
  const { quizId } = useParams();
  const quiz = getQuiz(quizId);

  if (!quiz) {
    return (
      <div>
        <h1>Quiz Not Found</h1>
        <Link to={`/quiz/${currentQuizId}`}>Go to current quiz</Link>
      </div>
    );
  }

  return (
    <QuizGame
      quizId={quiz.id}
      title={quiz.title}
      questions={quiz.questions}
      maxTime={quiz.maxTime}
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/quiz/${currentQuizId}`} replace />} />
      <Route path="/quiz/:quizId" element={<QuizPage />} />
      <Route path="/leaderboard/full" element={<FullLeaderboard />} />
      <Route path="/leaderboard/full/:quizId" element={<FullLeaderboard />} />
      <Route path="*" element={<Navigate to={`/quiz/${currentQuizId}`} replace />} />
    </Routes>
  );
}
```

### QuizGame Component Props

```javascript
// components/QuizGame.js
export default function QuizGame({ quizId, title, questions, maxTime = 100 }) {
  const loadLeaderboard = useCallback(async () => {
    const response = await fetch(`${DB_URL}/leaderboard/${quizId}.json?t=${Date.now()}`, {
      cache: "no-store",
    });
    // ...
  }, [quizId]);

  const saveScore = async (name, score) => {
    const { idToken, uid } = await getValidAuth();
    const safeScore = Math.max(0, Math.min(score, maxTime * questions.length));

    await fetch(`${DB_URL}/leaderboard/${quizId}/${uid}.json?auth=${encodeURIComponent(idToken)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score: safeScore, timestamp: { ".sv": "timestamp" } }),
    });
  };

  // Prevent duplicate submissions by checking localStorage and existing leaderboard entries.
}
```

### Vercel Configuration

No special configuration needed! React Router works automatically with Vercel because:
- Vercel detects Create React App
- Automatically configures SPA routing
- All routes serve `index.html`
- React Router handles client-side routing

---

## Future Enhancements

### Phase 2: Quiz Archive Page

**Homepage (`/`):**
- List all quizzes with cards
- Show quiz title, description, date
- "Start Quiz" button for each
- Highlight current week's quiz
- Search/filter by topic

**URL:** `digi-cert-quiz.vercel.app/`

### Phase 3: Quiz Categories

Organize quizzes by topic:
- Key Management
- Certificate Lifecycle
- PKI Fundamentals
- Code Signing
- IoT Security

### Phase 4: User Profiles

Track user progress:
- Login system (Firebase Auth)
- Quiz history (which quizzes completed)
- Aggregate scores
- Achievements/badges

### Phase 5: Quiz Analytics

Admin dashboard:
- How many people took each quiz
- Average scores per quiz
- Question difficulty analysis
- Time spent per question

### Phase 6: Dynamic Quiz Management

CMS or admin interface:
- Create quizzes via UI (no code)
- Edit existing quizzes
- Schedule future releases
- A/B test questions

---

## Migration Plan

### Pre-Migration (Current State)

**URL:** `digi-cert-quiz.vercel.app/`
**Shows:** Week 1 Key Sovereignty quiz
**Leaderboard:** `/leaderboard` (flat structure)

### Post-Migration (New Structure)

**URL:** `digi-cert-quiz.vercel.app/quiz/week-1-key-sovereignty`
**Shows:** Same quiz, new URL
**Leaderboard:** `/leaderboard/week-1-key-sovereignty`

### Handling Old Leaderboard Data

**Option A: Migrate Existing Data**
- Copy `/leaderboard` to `/leaderboard/week-1-key-sovereignty`
- Preserve existing scores
- Keep old data for reference

**Option B: Start Fresh**
- Leave old leaderboard at `/leaderboard`
- New structure starts clean
- Less complexity

**Recommendation:** Option A (migrate) to preserve user scores

### Communication Plan

**Internal Team:**
- Share this document
- Demo the new workflow
- Update any internal links

**External Users:**
- Old links to homepage will redirect to Week 1 quiz
- Share new specific quiz URLs going forward
- No disruption to user experience

---

## Key Benefits

### For Users
- ✅ Can revisit old quizzes anytime
- ✅ Consistent quiz experience
- ✅ Clear leaderboard per quiz
- ✅ Shareable quiz links

### For Content Team
- ✅ Easy to add new quizzes (copy/paste file)
- ✅ No code expertise required
- ✅ Safe (can't break old quizzes)
- ✅ Preview before production (dev branch)

### For Development
- ✅ Clean separation of concerns
- ✅ Scalable architecture
- ✅ Easy to add features later
- ✅ Type-safe quiz data structure

### For Maintenance
- ✅ Each quiz is independent
- ✅ Easy to fix individual quizzes
- ✅ No tangled dependencies
- ✅ Clear file organization

---

## Questions & Answers

### Q: What happens to the current production URL?
**A:** The root URL (`digi-cert-quiz.vercel.app/`) redirects to the current quiz. Week 1 is at `/quiz/week-1-key-sovereignty`.

### Q: Can we change old quizzes after they're deployed?
**A:** Yes! Just edit the quiz file and redeploy. The URL stays the same, content updates.

### Q: What if we want to retire/hide an old quiz?
**A:** Remove it from the `quizzes` registry in `index.js`. The file stays for reference but URL becomes inactive.

### Q: How do we handle quiz versioning if we fix errors?
**A:** Just update the quiz file and redeploy. Consider adding a `version` field to track updates.

### Q: Can we have quizzes with different numbers of questions?
**A:** Yes! Each quiz can have any number of questions. The component handles it dynamically.

### Q: What if we want to change the timer or scoring?
**A:** Those are currently global constants. Future enhancement: make them per-quiz configurable.

### Q: How do we test quizzes before making them public?
**A:** Use the dev branch workflow. Push to dev, get preview URL, test, then merge to main when ready.

### Q: Can we schedule quizzes to go live automatically?
**A:** Not yet. Currently requires manual deployment. Future enhancement: add scheduling system.

---

## Getting Help

### During Implementation
- Ask questions in Slack/Teams
- Refer to this document
- Check `src/quizzes/README.md` for quick reference

### After Implementation
- For adding quizzes: See "Adding New Quizzes" section above
- For bugs: Create GitHub issue
- For features: Discuss with team, update this plan

### Resources
- React Router Docs: https://reactrouter.com/
- Firebase REST API: https://firebase.google.com/docs/database/rest/start
- Create React App: https://create-react-app.dev/

---

## Timeline Estimate

**Phase 1 (Setup):** 15 minutes
- Install dependencies
- Create folders

**Phase 2 (Extract Component):** 30-45 minutes
- Move quiz logic to QuizGame component
- Test locally

**Phase 3 (Quiz Data Files):** 20 minutes
- Create quiz data structure
- Set up registry

**Phase 4 (Routing):** done
- Implemented React Router with clean URLs and redirects
- Routes tested in dev and production

**Phase 5 (Testing):** in progress
- Local + dev testing
- Leaderboard/auth/rules verified
- UI polish and copy updates

**Phase 6 (Deploy):** 10 minutes
- Merge to main
- Verify production

**Total Time (to date):** ~3–4 hours

---

## Success Criteria

Implementation is complete when:

- ✅ Week 1 quiz accessible at `/quiz/week-1-key-sovereignty`
- ✅ Homepage redirects to current quiz
- ✅ Leaderboard saves to `/leaderboard/{quizId}/{uid}` (per-user) and shows Top 25
- ✅ Screenshot leaderboard accessible at `/leaderboard/full` and shows Top 30 in a 3-column layout
- ✅ Can add new quiz by copying file
- ✅ All routes work in production
- ✅ First-score-only UX; duplicate display names blocked on Start
- ✅ Team can follow instructions to add quizzes
- ✅ Documentation is clear and complete

---

## Architecture Review – 2025-10-13

### Summary
- Confirmed routing flow delegates quiz selection via [`App.js`](src/App.js:6) with `BrowserRouter` instantiation handled in [`index.js`](src/index.js:3), maintaining clean `/quiz/:quizId` URLs.
- Validated per-quiz Firebase writes rely on anonymous auth through [`getValidAuth`](src/services/firebaseAuth.js:65) and scoped paths in [`QuizGame.js`](src/components/QuizGame.js:80), aligning with documented security rules.
- Observed quiz content separation via [`week-1-key-sovereignty.js`](src/quizzes/week-1-key-sovereignty.js:1), establishing the template for future quizzes.
 - Added standalone screenshot leaderboard via [`FullLeaderboard.js`](src/components/FullLeaderboard.js:1) and routes (`/leaderboard/full`, `/leaderboard/full/:quizId`). Header shows title, "Last refreshed: <date>", and sanitized tagline; trophies for ranks 1–3.

### Key Gaps & Risks
1. **Display-name uniqueness policy depends on an internal audience**
   Start validation in [`QuizGame.js`](src/components/QuizGame.js:164) still blocks duplicate sanitized names. The policy is documented in [`src/quizzes/README.md`](src/quizzes/README.md:103), but teams should revisit it if quizzes expand to external participants.
2. **Registry integrity relies on `npm run test:quizzes` staying in the workflow**
   [`registry.test.js`](src/quizzes/registry.test.js:1) guards against missing registrations, so ensure CI and release checklists run it before publishing new content.
3. **Future quiz metadata must be documented before use**
   If fields such as `description`, `week`, or `date` are reintroduced, update both the authoring guide and the validation test so contributors understand the required contract.

### Recommended Next Steps
- Keep [`src/quizzes/README.md`](src/quizzes/README.md:1) aligned with any new quiz metadata or policy changes.
- Integrate `npm run test:quizzes` into CI so registry mismatches are caught automatically.
- Re-evaluate the display-name policy when expanding beyond DigiCert employees and adjust [`QuizGame.js`](src/components/QuizGame.js:164) plus contributor docs accordingly.

### Pre-Launch Checklist (Internal Teams)

Before announcing a new quiz:

1. Confirm the quiz file exports `id`, `title`, `maxTime`, and populated questions.
2. Verify the quiz is registered in [`src/quizzes/index.js`](src/quizzes/index.js:1) and `currentQuizId` points to the intended release.
3. Run `npm run test:quizzes` to ensure registry consistency and quiz schema integrity.
4. Smoke test locally (`npm start`) by visiting `/quiz/{quiz-id}` to confirm routing, timer, and leaderboard submission.
5. Push to `dev`, validate the Vercel preview URL, then merge to `main` once approved.

**Document Version:** 1.1
**Created:** 2025-01-12
**Last Updated:** 2025-10-29
**Author:** Claude (AI Assistant)
**Maintained By:** DigiCert Quiz Team

---

## Anti-Replay Hardening (2025-11)

Overview
- Preserve instant answer reveal and confetti; all players see the same questions.
- Reduce repeat attempts via per-session shuffling and server rules.

App Updates
- Shuffle question order and option order per session on Start; recompute `correctAnswer` per question.
- Save scores via multi-path PATCH to write:
  - `leaderboard/{quizId}/{uid}`: `{ name, nameSlug, score, timestamp, fp }`
  - `nameIndex/{quizId}/{nameSlug}`: `uid`
  - `fingerprints/{quizId}/{fp}`: `uid`
- `nameSlug` is a normalized, lowercased name; `fp` is a salted SHA‑256 device fingerprint (non‑PII stored).

Rules Rollout
- v1 (now): First-score-only per uid. See `docs/firebase-rules.v1.json`.
- v2: Require `nameSlug` and `fp`, and enforce uniqueness per quiz. See `docs/firebase-rules.v2.json`.

Docs
- Full plan and admin guidance: `docs/hardening.md`.
