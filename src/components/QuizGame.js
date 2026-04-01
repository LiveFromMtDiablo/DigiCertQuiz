import React, { useEffect, useState, useCallback } from "react";
import { Clock, CheckCircle, XCircle, Trophy } from "lucide-react";
import { DB_URL } from "../services/firebaseConfig";
import { AUTH_STORAGE_KEY, getValidAuth } from "../services/firebaseAuth";
import { sortLeaderboardEntries } from "../utils/leaderboardSort";
import {
  NAME_REGEX,
  sanitizeName,
  toNameSlug,
  classifyNameConflict,
  classifySaveFailure,
  ELIGIBILITY_CHECKING_MESSAGE,
  ELIGIBILITY_ERROR_MESSAGE,
} from "../utils/quizEligibility";
import {
  clampQuizScore,
  buildIndexedScorePayload,
  writeIndexedScoreSubmission,
  writeMachinePrintObservation,
} from "../utils/quizSubmission";

const TROPHY_COLORS = ["text-yellow-500", "text-gray-400", "text-orange-500"];
const QUIZ_ATTEMPT_STORAGE_VERSION = 1;
const ATTEMPT_STATUS_IN_PROGRESS = "in_progress";
const ATTEMPT_STATUS_COMPLETED = "completed";
const DEV_FINGERPRINT_SEED_KEY = "devFingerprintSeed";
const STALE_ATTEMPT_LOCK_MESSAGE =
  "This browser has a stale saved-attempt lock for this quiz. Please contact the quiz organizer to clear it.";

const SCREEN_BACKGROUND_STYLE = {
  backgroundImage:
    'url("/images/quiz_background2.png"), linear-gradient(to bottom right, #3b82f6, #9333ea)',
  backgroundRepeat: "no-repeat, no-repeat",
  backgroundAttachment: "fixed, fixed",
  backgroundPosition: "top left, center",
  backgroundSize: "auto, cover",
};

function getAttemptStorageKey(quizId) {
  return `quizAttempt:${quizId}`;
}

function loadStoredAttempt(quizId) {
  try {
    const raw = localStorage.getItem(getAttemptStorageKey(quizId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.version === QUIZ_ATTEMPT_STORAGE_VERSION ? parsed : null;
  } catch (_) {
    return null;
  }
}

function saveStoredAttempt(quizId, attempt) {
  try {
    localStorage.setItem(getAttemptStorageKey(quizId), JSON.stringify(attempt));
  } catch (_) {}
}

function clearStoredAttempt(quizId) {
  try {
    localStorage.removeItem(getAttemptStorageKey(quizId));
  } catch (_) {}
}

function isDevFingerprintResetEnabled() {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return false;
  }

  const hostname = window.location?.hostname || "";
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

function getDevFingerprintSeed() {
  if (!isDevFingerprintResetEnabled()) return "";

  try {
    return localStorage.getItem(DEV_FINGERPRINT_SEED_KEY) || "";
  } catch (_) {
    return "";
  }
}

function createDevFingerprintSeed() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `dev-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function rotateDevFingerprintSeed() {
  const nextSeed = createDevFingerprintSeed();

  try {
    const keysToRemove = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (
        key === AUTH_STORAGE_KEY ||
        key.startsWith("submitted:") ||
        key.startsWith("quizAttempt:")
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => localStorage.removeItem(key));
    localStorage.setItem(DEV_FINGERPRINT_SEED_KEY, nextSeed);
  } catch (_) {}

  return nextSeed;
}

function formatDevFingerprintSeed(seed) {
  return seed || "default (no override)";
}

async function sha256Hex(input) {
  const enc = new TextEncoder();
  const data = enc.encode(input);
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Fallback non-crypto hash (should rarely run)
    let h = 5381;
    for (let i = 0; i < data.length; i++) h = ((h << 5) + h) + data[i];
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getDeviceFingerprint(salt) {
  try {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const scr = typeof screen !== "undefined" ? screen : {};
    const devSeed = getDevFingerprintSeed();
    const tz =
      (Intl &&
        Intl.DateTimeFormat &&
        Intl.DateTimeFormat().resolvedOptions().timeZone) ||
      "";
    const parts = [
      String(salt || ""),
      String(nav.userAgent || ""),
      String(nav.platform || ""),
      String(nav.language || ""),
      String(tz || ""),
      String(scr.width || 0),
      String(scr.height || 0),
      String(scr.colorDepth || 0),
      String(typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1),
      String(nav.hardwareConcurrency || 0),
      String(nav.deviceMemory || 0),
      String("ontouchstart" in (typeof window !== "undefined" ? window : {})),
      String(devSeed || ""),
    ];
    return sha256Hex(parts.join("|"));
  } catch (_) {
    return sha256Hex(`fallback|${salt}|${Date.now()}`);
  }
}

async function getMachineFingerprint(salt) {
  // Browser-agnostic: exclude userAgent to approximate machine identity across browsers
  try {
    const nav = typeof navigator !== "undefined" ? navigator : {};
    const scr = typeof screen !== "undefined" ? screen : {};
    const devSeed = getDevFingerprintSeed();
    const tz =
      (Intl &&
        Intl.DateTimeFormat &&
        Intl.DateTimeFormat().resolvedOptions().timeZone) ||
      "";
    const parts = [
      String(salt || ""),
      String(nav.platform || ""),
      String(nav.language || ""),
      String(tz || ""),
      String(scr.width || 0),
      String(scr.height || 0),
      String(scr.colorDepth || 0),
      String(typeof devicePixelRatio !== "undefined" ? devicePixelRatio : 1),
      String(nav.hardwareConcurrency || 0),
      String(nav.deviceMemory || 0),
      String("ontouchstart" in (typeof window !== "undefined" ? window : {})),
      String(devSeed || ""),
    ];
    return sha256Hex(parts.join("|"));
  } catch (_) {
    return sha256Hex(`fallbackMachine|${salt}|${Date.now()}`);
  }
}

async function readProtectedData(path, idToken) {
  const response = await fetch(
    `${DB_URL}/${path}.json?auth=${encodeURIComponent(idToken)}&t=${Date.now()}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const error = new Error(`Failed to read ${path}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function isRestorableServerAttempt(attempt) {
  return Boolean(attempt && attempt.status !== ATTEMPT_STATUS_COMPLETED);
}

export default function QuizGame({ quizId, title, questions, maxTime = 100, intro }) {
  const devFingerprintResetEnabled = isDevFingerprintResetEnabled();
  const devFingerprintSeed = getDevFingerprintSeed();
  const devFingerprintSeedLabel = formatDevFingerprintSeed(devFingerprintSeed);
  const [screen, setScreen] = useState("intro");
  const [playerName, setPlayerName] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(maxTime);
  const [questionDeadlineAt, setQuestionDeadlineAt] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [totalScore, setTotalScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [finalScoreValue, setFinalScoreValue] = useState(null);
  const [gameQuestions, setGameQuestions] = useState(null);
  const [resumeNotice, setResumeNotice] = useState("");
  const [attemptCreatedAt, setAttemptCreatedAt] = useState(null);
  const [eligibilityStatus, setEligibilityStatus] = useState("checking");
  const [isStartingAttempt, setIsStartingAttempt] = useState(false);
  const [devResetNotice, setDevResetNotice] = useState("");
  const [identityRefreshNonce, setIdentityRefreshNonce] = useState(0);

  // Secure RNG and shuffle helpers (per-session order randomization)
  function secureRandomInt(maxExclusive) {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const maxUint32 = 0xffffffff;
      const threshold = maxUint32 - (maxUint32 % maxExclusive);
      let x;
      do {
        const buf = new Uint32Array(1);
        crypto.getRandomValues(buf);
        x = buf[0];
      } while (x >= threshold);
      return x % maxExclusive;
    }
    return Math.floor(Math.random() * maxExclusive);
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function isGroupedOptionReference(optionText, maxOptionCount) {
    if (typeof optionText !== "string") return false;

    const normalized = optionText
      .trim()
      .toUpperCase()
      .replace(/&/g, " AND ")
      .replace(/,/g, " ")
      .replace(/\b(AND|OR)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const tokens = normalized ? normalized.split(" ") : [];
    if (tokens.length < 2) return false;

    const max = Math.max(0, Math.min(6, Number(maxOptionCount) || 0));
    const allowed = new Set("ABCDEF".slice(0, max).split(""));
    return tokens.every((token) => token.length === 1 && allowed.has(token));
  }

  function shuffleQuestionsAndOptions(srcQuestions) {
    const remapped = srcQuestions.map((q) => {
      const options = q.options || [];
      const indices = Array.from({ length: options.length }, (_, i) => i);
      const allOfTheAboveIndex = options.findIndex(
        (opt) =>
          typeof opt === "string" &&
          opt.trim().toLowerCase() === "all of the above"
      );

      const shouldPreserveOptionOrder =
        q.shuffleOptions === false ||
        options.some((opt) => isGroupedOptionReference(opt, options.length));

      let finalIndexOrder;
      if (shouldPreserveOptionOrder) {
        finalIndexOrder = indices;
      } else if (allOfTheAboveIndex >= 0 && options.length > 1) {
        const indicesToShuffle = indices.filter((i) => i !== allOfTheAboveIndex);
        const shuffledIdx = shuffleArray(indicesToShuffle);
        finalIndexOrder = [...shuffledIdx, allOfTheAboveIndex];
      } else {
        finalIndexOrder = shuffleArray(indices);
      }

      const newOptions = finalIndexOrder.map((i) => options[i]);
      const newCorrect = finalIndexOrder.indexOf(q.correctAnswer);
      return { ...q, options: newOptions, correctAnswer: newCorrect };
    });
    return shuffleArray(remapped);
  }

  function restoreStoredAttempt(attempt) {
    const activeQuestions = Array.isArray(attempt?.gameQuestions)
      ? attempt.gameQuestions
      : null;
    if (!isValidQuestionSet(activeQuestions)) {
      clearStoredAttempt(quizId);
      return false;
    }

    const safeQuestionIndex = Math.min(
      Math.max(0, Number(attempt.currentQuestion) || 0),
      activeQuestions.length - 1
    );
    const storedDeadlineAt =
      typeof attempt.questionDeadlineAt === "number" ? attempt.questionDeadlineAt : null;
    const restoredTimeLeft = attempt.showFeedback
      ? Math.max(0, Number(attempt.timeLeft) || 0)
      : storedDeadlineAt
        ? Math.max(0, Math.ceil((storedDeadlineAt - Date.now()) / 1000))
        : maxTime;

    setPlayerName(typeof attempt.playerName === "string" ? attempt.playerName : "");
    setGameQuestions(activeQuestions);
    setCurrentQuestion(safeQuestionIndex);
    setSelectedAnswer(
      typeof attempt.selectedAnswer === "number" ? attempt.selectedAnswer : null
    );
    setShowFeedback(Boolean(attempt.showFeedback));
    setIsCorrect(Boolean(attempt.isCorrect));
    setTotalScore(Math.max(0, Number(attempt.totalScore) || 0));
    setFinalScoreValue(null);
    setAttemptCreatedAt(
      typeof attempt.createdAt === "number" ? attempt.createdAt : Date.now()
    );
    setQuestionDeadlineAt(attempt.showFeedback ? null : storedDeadlineAt);
    setTimeLeft(restoredTimeLeft);
    setScreen("question");
    setError("");
    setResumeNotice("Your in-progress quiz was restored. Refreshing will not restart it.");
    return true;
  }

  function resetGameState(nextScreen = "intro") {
    setScreen(nextScreen);
    setPlayerName("");
    setCurrentQuestion(0);
    setTimeLeft(maxTime);
    setQuestionDeadlineAt(null);
    setSelectedAnswer(null);
    setShowFeedback(false);
    setIsCorrect(false);
    setTotalScore(0);
    setError("");
    setFinalScoreValue(null);
    setAttemptCreatedAt(null);
    setGameQuestions(null);
    setResumeNotice("");
  }

  function isValidQuestionSet(activeQuestions) {
    return (
      Array.isArray(activeQuestions) &&
      activeQuestions.length === questions.length &&
      activeQuestions.every(
        (question) =>
          question &&
          typeof question.question === "string" &&
          Array.isArray(question.options) &&
          typeof question.correctAnswer === "number"
      )
    );
  }

  function serializeQuestionSet(activeQuestions) {
    return JSON.stringify(activeQuestions);
  }

  function parseQuestionSet(serialized) {
    try {
      const parsed = JSON.parse(serialized);
      return isValidQuestionSet(parsed) ? parsed : null;
    } catch (_) {
      return null;
    }
  }

  function buildAttemptRecord({
    name,
    nameSlug,
    fp,
    fpMachine,
    currentQuestion: questionIndex,
    totalScore: score,
    timeLeft: secondsLeft,
    questionDeadlineAt: deadlineAt,
    selectedAnswer: answerIndex,
    showFeedback: showingFeedback,
    isCorrect: answeredCorrectly,
    gameQuestions: activeQuestions,
    createdAt = Date.now(),
    status = ATTEMPT_STATUS_IN_PROGRESS,
    completedAt = null,
  }) {
    return {
      name,
      nameSlug,
      fp,
      fpMachine,
      questionSet: serializeQuestionSet(activeQuestions),
      currentQuestion: questionIndex,
      totalScore: score,
      timeLeft: secondsLeft,
      questionDeadlineAt: deadlineAt,
      selectedAnswer: answerIndex,
      showFeedback: showingFeedback,
      isCorrect: answeredCorrectly,
      status,
      createdAt,
      updatedAt: Date.now(),
      completedAt,
    };
  }

  function restoreServerAttempt(attempt) {
    const activeQuestions = parseQuestionSet(attempt?.questionSet);
    if (!activeQuestions) return false;

    const safeQuestionIndex = Math.min(
      Math.max(0, Number(attempt.currentQuestion) || 0),
      activeQuestions.length - 1
    );
    const storedDeadlineAt =
      typeof attempt.questionDeadlineAt === "number" ? attempt.questionDeadlineAt : null;
    const restoredTimeLeft = Boolean(attempt.showFeedback)
      ? Math.max(0, Number(attempt.timeLeft) || 0)
      : storedDeadlineAt
        ? Math.max(0, Math.ceil((storedDeadlineAt - Date.now()) / 1000))
        : maxTime;

    setPlayerName(typeof attempt.name === "string" ? attempt.name : "");
    setGameQuestions(activeQuestions);
    setCurrentQuestion(safeQuestionIndex);
    setSelectedAnswer(
      typeof attempt.selectedAnswer === "number" ? attempt.selectedAnswer : null
    );
    setShowFeedback(Boolean(attempt.showFeedback));
    setIsCorrect(Boolean(attempt.isCorrect));
    setTotalScore(Math.max(0, Number(attempt.totalScore) || 0));
    setFinalScoreValue(null);
    setAttemptCreatedAt(
      typeof attempt.createdAt === "number" ? attempt.createdAt : Date.now()
    );
    setQuestionDeadlineAt(Boolean(attempt.showFeedback) ? null : storedDeadlineAt);
    setTimeLeft(restoredTimeLeft);
    setScreen("question");
    setError("");
    setResumeNotice("Your in-progress quiz was restored from the server.");
    return true;
  }

  async function getAttemptIdentity() {
    const { uid, idToken } = await getValidAuth();
    const [fp, fpMachine] = await Promise.all([
      getDeviceFingerprint(quizId),
      getMachineFingerprint(quizId),
    ]);
    return { uid, idToken, fp, fpMachine };
  }

  async function fetchOwnAttempt() {
    const { uid, idToken } = await getValidAuth();
    return fetchAttemptByUid(uid, idToken);
  }

  async function fetchAttemptByUid(uid, idToken) {
    if (!uid) {
      return { res: null, data: null, uid: null };
    }

    const res = await fetch(
      `${DB_URL}/attempts/${quizId}/${uid}.json?auth=${encodeURIComponent(idToken)}&t=${Date.now()}`,
      { cache: "no-store" }
    );
    if (!res.ok) return { res, data: null, uid };
    const data = await res.json();
    return { res, data, uid };
  }

  async function fetchFingerprintLockedAttempt(idToken, fp) {
    if (!fp) {
      return { ownerUid: null, attemptResult: null, lookupStatus: "skipped" };
    }

    try {
      const ownerUid = await readProtectedData(
        `attemptFingerprints/${quizId}/${fp}`,
        idToken
      );
      if (!ownerUid) {
        return { ownerUid: null, attemptResult: null, lookupStatus: "ok" };
      }

      const attemptResult = await fetchAttemptByUid(ownerUid, idToken);
      return { ownerUid, attemptResult, lookupStatus: "ok" };
    } catch (err) {
      console.warn("Fingerprint-locked attempt lookup failed; continuing without it.", {
        quizId,
        status: err?.status || null,
        message: err?.message || String(err),
      });
      return {
        ownerUid: null,
        attemptResult: null,
        lookupStatus: "unavailable",
        error: err,
      };
    }
  }

  function chooseCanonicalAttempt(candidates) {
    const validCandidates = (candidates || []).filter((candidate) => {
      if (!candidate?.attempt) return false;
      if (candidate.source === "local") {
        return isValidQuestionSet(candidate.attempt.gameQuestions);
      }
      return isRestorableServerAttempt(candidate.attempt) && parseQuestionSet(candidate.attempt.questionSet);
    });

    if (validCandidates.length === 0) return null;

    if (validCandidates.length > 1) {
      console.warn("Multiple attempt snapshots found; restoring the most recent one.", {
        quizId,
        sources: validCandidates.map((candidate) => candidate.source),
      });
    }

    validCandidates.sort((left, right) => {
      const leftUpdatedAt =
        Number(left.attempt.updatedAt) || Number(left.attempt.createdAt) || 0;
      const rightUpdatedAt =
        Number(right.attempt.updatedAt) || Number(right.attempt.createdAt) || 0;
      return rightUpdatedAt - leftUpdatedAt;
    });

    return validCandidates[0];
  }

  async function createServerAttempt({
    name,
    nameSlug,
    gameQuestions: activeQuestions,
    questionDeadlineAt: deadlineAt,
  }) {
    const { uid, idToken, fp, fpMachine } = await getAttemptIdentity();
    const attemptRecord = buildAttemptRecord({
      name,
      nameSlug,
      fp,
      fpMachine,
      currentQuestion: 0,
      totalScore: 0,
      timeLeft: maxTime,
      questionDeadlineAt: deadlineAt,
      selectedAnswer: null,
      showFeedback: false,
      isCorrect: false,
      gameQuestions: activeQuestions,
    });

    const updates = {};
    updates[`attempts/${quizId}/${uid}`] = attemptRecord;
    updates[`attemptFingerprints/${quizId}/${fp}`] = uid;

    const response = await fetch(`${DB_URL}/.json?auth=${encodeURIComponent(idToken)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });

    return { response, attemptRecord };
  }

  async function syncServerAttempt(snapshot) {
    try {
      const { uid, idToken } = await getValidAuth();
      const res = await fetch(
        `${DB_URL}/attempts/${quizId}/${uid}.json?auth=${encodeURIComponent(idToken)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(snapshot),
        }
      );
      if (!res.ok) {
        console.warn("Attempt sync failed:", res.status);
      }
    } catch (err) {
      console.warn("Attempt sync failed:", err);
    }
  }
  // Load leaderboard for this quiz
  const loadLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const { idToken } = await getValidAuth();
      const url = `${DB_URL}/leaderboard/${quizId}.json?auth=${encodeURIComponent(idToken)}&t=${Date.now()}`;
      const response = await fetch(url, {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        const entries = data && typeof data === 'object' ? Object.values(data) : [];
        // Log count for troubleshooting
        try { console.debug('[leaderboard]', quizId, 'entries:', entries.length); } catch (_) {}
        const leaderboardArray = sortLeaderboardEntries(entries);
        setLeaderboard(leaderboardArray);
      }
      setLoading(false);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      setError(
        "Failed to load leaderboard. Please check your Firebase configuration."
      );
      setLoading(false);
    }
  }, [quizId]);

  // Save score for this quiz
  const saveScore = async (name, score) => {
    let auth = null;
    let fp = null;
    const nameSlug = toNameSlug(name);

    const applySaveFailure = async ({
      responseStatus,
      responseBody = "",
      sourceError = null,
    }) => {
      let existingSubmission = null;
      let nameIndexOwner = null;
      let fingerprintOwner = null;

      try {
        auth = auth || (await getValidAuth());
        fp = fp || (await getDeviceFingerprint(quizId));
        [existingSubmission, nameIndexOwner, fingerprintOwner] = await Promise.all([
          readProtectedData(`leaderboard/${quizId}/${auth.uid}`, auth.idToken),
          readProtectedData(`nameIndex/${quizId}/${nameSlug}`, auth.idToken),
          readProtectedData(`fingerprints/${quizId}/${fp}`, auth.idToken),
        ]);
      } catch (classificationError) {
        console.error("Error classifying save failure:", classificationError);
      }

      const failure = classifySaveFailure({
        uid: auth?.uid,
        existingSubmission,
        nameIndexOwner,
        fingerprintOwner,
        responseStatus,
      });

      console.error("Save failed:", {
        quizId,
        responseStatus,
        responseBody,
        failure,
        existingSubmission: Boolean(existingSubmission),
        nameIndexOwner,
        fingerprintOwner,
        uid: auth?.uid,
        nameSlug,
        sourceError: sourceError?.message || null,
      });

      if (failure.reason === "already_submitted") {
        setAlreadySubmitted(true);
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(`submitted:${quizId}`, "1");
          }
        } catch (_) {}
      }

      setError(failure.message);
    };

    try {
      // Clamp score to a safe maximum (respect shuffled set length)
      const activeQuestions = gameQuestions || questions;
      const maxPossible = maxTime * activeQuestions.length;
      const safeScore = clampQuizScore(score, maxPossible);

      // Ensure authenticated uid and token for protected write
      auth = await getValidAuth();
      const { idToken, uid } = auth;
      fp = await getDeviceFingerprint(quizId);
      const fpMachine = await getMachineFingerprint(quizId);

      const updates = buildIndexedScorePayload({
        quizId,
        uid,
        name,
        nameSlug,
        score: safeScore,
        fp,
      });
      // Observe-only machine-level print (no enforcement in rules yet)
      updates[`machinePrints/${quizId}/${fpMachine}`] = uid;
      if (gameQuestions) {
        updates[`attempts/${quizId}/${uid}`] = buildAttemptRecord({
          name,
          nameSlug,
          fp,
          fpMachine,
          currentQuestion: activeQuestions.length - 1,
          totalScore: safeScore,
          timeLeft,
          questionDeadlineAt: null,
          selectedAnswer,
          showFeedback: true,
          isCorrect,
          gameQuestions,
          createdAt: attemptCreatedAt || Date.now(),
          status: ATTEMPT_STATUS_COMPLETED,
          completedAt: Date.now(),
        });
        updates[`attemptFingerprints/${quizId}/${fp}`] = uid;
      }

      let response = await writeIndexedScoreSubmission({
        dbUrl: DB_URL,
        idToken,
        payload: updates,
      });

      if (!response.ok && (response.status === 401 || response.status === 403)) {
        // Likely rules v1 without permissions for nameIndex/fingerprints.
        // Fallback to single write to leaderboard path only.
        const newEntry = updates[`leaderboard/${quizId}/${uid}`];
        response = await fetch(
          `${DB_URL}/leaderboard/${quizId}/${uid}.json?auth=${encodeURIComponent(idToken)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newEntry),
          }
        );
      }

      if (response.ok) {
        await loadLeaderboard();
        try {
          if (typeof localStorage !== "undefined") {
            localStorage.setItem(`submitted:${quizId}`, "1");
            setAlreadySubmitted(true);
          }
        } catch (_) {}

        // Machine prints are observe-only today, so they must not break score saves.
        try {
          const machinePrintResponse = await writeMachinePrintObservation({
            dbUrl: DB_URL,
            idToken,
            quizId,
            uid,
            fpMachine,
          });
          if (!machinePrintResponse.ok) {
            console.warn("Machine print observation failed:", {
              quizId,
              uid,
              status: machinePrintResponse.status,
            });
          }
        } catch (machinePrintError) {
          console.warn("Machine print observation failed:", {
            quizId,
            uid,
            error: machinePrintError?.message || String(machinePrintError),
          });
        }
      } else {
        let errText = "";
        try {
          errText = await response.text();
        } catch (_) {}
        await applySaveFailure({
          responseStatus: response.status,
          responseBody: errText,
        });
      }
    } catch (err) {
      await applySaveFailure({
        responseStatus: err?.status || 0,
        sourceError: err,
      });
    }
  };

  useEffect(() => {
    if (screen === "intro" || screen === "leaderboard") {
      loadLeaderboard();
    }
  }, [screen, loadLeaderboard]);

  useEffect(() => {
    setEligibilityStatus("checking");
    resetGameState("intro");
    restoreStoredAttempt(loadStoredAttempt(quizId));
  }, [identityRefreshNonce, quizId]);

  // Detect if the user has already submitted a score for this quiz
  useEffect(() => {
    try {
      const flag = typeof localStorage !== "undefined" && localStorage.getItem(`submitted:${quizId}`);
      setAlreadySubmitted(Boolean(flag));
    } catch (_) {
      setAlreadySubmitted(false);
    }
  }, [identityRefreshNonce, quizId]);

  // Also check the server for an existing score or resumable attempt for this uid
  useEffect(() => {
    let cancelled = false;
    setAlreadySubmitted(false);
    setError("");

    (async () => {
      try {
        const localAttempt = loadStoredAttempt(quizId);
        const { uid, idToken } = await getValidAuth();
        if (cancelled) return;
        const fp = await getDeviceFingerprint(quizId);
        if (cancelled) return;

        const [leaderboardRes, ownAttemptResult, fingerprintLocked] = await Promise.all([
          fetch(`${DB_URL}/leaderboard/${quizId}/${uid}.json?auth=${encodeURIComponent(idToken)}`, {
            cache: "no-store",
          }),
          fetchAttemptByUid(uid, idToken),
          fetchFingerprintLockedAttempt(idToken, fp),
        ]);

        if (cancelled) return;

        if (leaderboardRes.ok) {
          const data = await leaderboardRes.json();
          if (data) setAlreadySubmitted(true);
        }

        const canonicalAttempt = chooseCanonicalAttempt([
          localAttempt ? { source: "local", attempt: localAttempt } : null,
          ownAttemptResult?.data
            ? { source: "server-own", attempt: ownAttemptResult.data, uid: ownAttemptResult.uid }
            : null,
          fingerprintLocked?.attemptResult?.data
            ? {
                source: "server-fingerprint",
                attempt: fingerprintLocked.attemptResult.data,
                uid: fingerprintLocked.ownerUid,
              }
            : null,
        ]);

        if (canonicalAttempt?.source === "local") {
          restoreStoredAttempt(canonicalAttempt.attempt);
        } else if (canonicalAttempt?.attempt) {
          if (localAttempt && canonicalAttempt.source !== "local") {
            clearStoredAttempt(quizId);
          }
          restoreServerAttempt(canonicalAttempt.attempt);
        } else if (
          !localAttempt &&
          fingerprintLocked?.lookupStatus === "ok" &&
          fingerprintLocked?.ownerUid &&
          !fingerprintLocked?.attemptResult?.data
        ) {
          setEligibilityStatus("error");
          setError(STALE_ATTEMPT_LOCK_MESSAGE);
          return;
        }

        if (!cancelled) {
          setEligibilityStatus("ready");
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Error checking eligibility:", err);
        setEligibilityStatus("error");
        setError(ELIGIBILITY_ERROR_MESSAGE);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identityRefreshNonce, quizId]);

  // Note: name uniqueness validation is performed on Start to avoid blocking typing

  useEffect(() => {
    if (screen !== "question" || showFeedback || !questionDeadlineAt) return undefined;

    const syncTimeLeft = () => {
      setTimeLeft(Math.max(0, Math.ceil((questionDeadlineAt - Date.now()) / 1000)));
    };

    syncTimeLeft();
    const timer = setInterval(syncTimeLeft, 250);
    return () => clearInterval(timer);
  }, [screen, showFeedback, questionDeadlineAt]);

  useEffect(() => {
    if (screen !== "question" || showFeedback || timeLeft !== 0) return undefined;

    setQuestionDeadlineAt(null);
    setIsCorrect(false);
    setShowFeedback(true);
    void syncServerAttempt({
      currentQuestion,
      totalScore,
      timeLeft: 0,
      questionDeadlineAt: null,
      showFeedback: true,
      isCorrect: false,
      updatedAt: Date.now(),
    });
    return undefined;
  }, [currentQuestion, screen, showFeedback, timeLeft, totalScore]);

  useEffect(() => {
    if (screen !== "question" || !gameQuestions || alreadySubmitted) return undefined;

    saveStoredAttempt(quizId, {
      version: QUIZ_ATTEMPT_STORAGE_VERSION,
      playerName,
      currentQuestion,
      timeLeft,
      questionDeadlineAt: showFeedback ? null : questionDeadlineAt,
      selectedAnswer,
      showFeedback,
      isCorrect,
      totalScore,
      createdAt: attemptCreatedAt,
      gameQuestions,
      updatedAt: Date.now(),
    });

    return undefined;
  }, [
    alreadySubmitted,
    attemptCreatedAt,
    currentQuestion,
    gameQuestions,
    isCorrect,
    playerName,
    questionDeadlineAt,
    quizId,
    screen,
    selectedAnswer,
    showFeedback,
    timeLeft,
    totalScore,
  ]);

  useEffect(() => {
    if (screen !== "question") return undefined;

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [screen]);

  useEffect(() => {
    if (screen === "leaderboard" || alreadySubmitted) {
      clearStoredAttempt(quizId);
    }
  }, [alreadySubmitted, quizId, screen]);

  useEffect(() => {
    if (!resumeNotice || screen !== "question") return undefined;

    const timer = setTimeout(() => setResumeNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [resumeNotice, screen]);
  const handleStart = async () => {
    const clean = sanitizeName(playerName);
    if (!NAME_REGEX.test(clean)) {
      setError("Please enter a valid name (2–30 characters).");
      return;
    }
    if (eligibilityStatus === "checking") {
      setError(ELIGIBILITY_CHECKING_MESSAGE);
      return;
    }
    if (eligibilityStatus === "error" || isStartingAttempt) {
      setError(ELIGIBILITY_ERROR_MESSAGE);
      return;
    }
    // Prevent using an existing leaderboard name (case-insensitive exact match)
    const taken = leaderboard.some(
      (e) => sanitizeName(e.name || "").toLowerCase() === clean.toLowerCase()
    );
    if (taken) {
      setError(
        "That display name is already on the leaderboard. Please make it unique (e.g., 'Chuck J.' or 'Chuck Jones')."
      );
      return;
    }
    // Initialize per-session shuffled questions/options
    let shuffledQuestions;
    try {
      shuffledQuestions = shuffleQuestionsAndOptions(questions);
    } catch (_) {
      shuffledQuestions = questions.slice();
    }

    const firstQuestionDeadlineAt = Date.now() + maxTime * 1000;
    setIsStartingAttempt(true);

    try {
      const nameSlug = toNameSlug(clean);
      try {
        const auth = await getValidAuth();
        const nameIndexOwner = await readProtectedData(
          `nameIndex/${quizId}/${nameSlug}`,
          auth.idToken
        );
        const nameConflict = classifyNameConflict({
          uid: auth.uid,
          nameIndexOwner,
        });
        if (nameConflict.reason) {
          setError(nameConflict.message);
          return;
        }
      } catch (_) {}

      const { response, attemptRecord } = await createServerAttempt({
        name: clean,
        nameSlug,
        gameQuestions: shuffledQuestions,
        questionDeadlineAt: firstQuestionDeadlineAt,
      });

      if (response.ok) {
        setGameQuestions(shuffledQuestions);
        setPlayerName(clean);
        setAttemptCreatedAt(attemptRecord.createdAt);
        setCurrentQuestion(0);
        setScreen("question");
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsCorrect(false);
        setTotalScore(0);
        setFinalScoreValue(null);
        setQuestionDeadlineAt(firstQuestionDeadlineAt);
        setTimeLeft(maxTime);
        setError("");
        setResumeNotice("");
        return;
      }

      let attemptReservationErrorBody = "";
      try {
        attemptReservationErrorBody = await response.text();
      } catch (_) {}
      console.error("Attempt reservation failed:", {
        quizId,
        status: response.status,
        body: attemptReservationErrorBody,
      });

      const auth = await getValidAuth();
      const fp = await getDeviceFingerprint(quizId);
      const [ownAttempt, fingerprintLocked] = await Promise.all([
        fetchAttemptByUid(auth.uid, auth.idToken),
        fetchFingerprintLockedAttempt(auth.idToken, fp),
      ]);

      const canonicalAttempt = chooseCanonicalAttempt([
        ownAttempt?.data
          ? { source: "server-own", attempt: ownAttempt.data, uid: ownAttempt.uid }
          : null,
        fingerprintLocked?.attemptResult?.data
          ? {
              source: "server-fingerprint",
              attempt: fingerprintLocked.attemptResult.data,
              uid: fingerprintLocked.ownerUid,
            }
          : null,
      ]);

      if (canonicalAttempt?.attempt) {
        restoreServerAttempt(canonicalAttempt.attempt);
        return;
      }

      // If the new rules have not been published yet, keep the local-only protection in place.
      if (ownAttempt.res && (ownAttempt.res.status === 401 || ownAttempt.res.status === 403)) {
        console.warn("Server-side attempt rules are not available yet; falling back to local resume only.");
        setGameQuestions(shuffledQuestions);
        setPlayerName(clean);
        setAttemptCreatedAt(Date.now());
        setCurrentQuestion(0);
        setScreen("question");
        setSelectedAnswer(null);
        setShowFeedback(false);
        setIsCorrect(false);
        setTotalScore(0);
        setFinalScoreValue(null);
        setQuestionDeadlineAt(firstQuestionDeadlineAt);
        setTimeLeft(maxTime);
        setError("");
        setResumeNotice("");
        return;
      }

      if (
        fingerprintLocked?.lookupStatus === "ok" &&
        fingerprintLocked?.ownerUid &&
        !fingerprintLocked?.attemptResult?.data
      ) {
        setError(STALE_ATTEMPT_LOCK_MESSAGE);
      } else if (fingerprintLocked?.lookupStatus === "ok" && fingerprintLocked?.ownerUid) {
        setError(
          "This browser already has an in-progress attempt for this quiz, but we couldn't restore it automatically. Please refresh once and try again."
        );
      } else {
        setError("Could not start the quiz right now. Please try again.");
      }
    } catch (err) {
      console.error("Error creating attempt:", err);
      setError("Could not start the quiz right now. Please try again.");
    } finally {
      setIsStartingAttempt(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;
    const activeQuestions = gameQuestions || questions;
    const correct = selectedAnswer === activeQuestions[currentQuestion].correctAnswer;
    const nextTotalScore = correct ? totalScore + timeLeft : totalScore;
    setQuestionDeadlineAt(null);
    setIsCorrect(correct);
    setShowFeedback(true);
    if (correct) {
      setTotalScore(nextTotalScore);
      // Fire a celebratory confetti burst when the user is correct
      try {
        if (typeof window !== "undefined" && window.confetti) {
          const fire = (ratio, opts = {}) =>
            window.confetti({
              particleCount: Math.floor(160 * ratio),
              origin: { y: 0.65 },
              ...opts,
            });

          fire(0.25, { spread: 26, startVelocity: 55 });
          fire(0.2, { spread: 60 });
          fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
          fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
          fire(0.1, { spread: 120, startVelocity: 45 });
        }
      } catch (_) {}
    }

    if (gameQuestions) {
      void syncServerAttempt({
        currentQuestion,
        totalScore: nextTotalScore,
        timeLeft,
        questionDeadlineAt: null,
        selectedAnswer,
        showFeedback: true,
        isCorrect: correct,
        updatedAt: Date.now(),
      });
    }
  };

  const handleNextQuestion = async () => {
    const activeQuestions = gameQuestions || questions;
    if (currentQuestion < activeQuestions.length - 1) {
      const nextQuestionIndex = currentQuestion + 1;
      const nextDeadlineAt = Date.now() + maxTime * 1000;
      setCurrentQuestion(nextQuestionIndex);
      setSelectedAnswer(null);
      setShowFeedback(false);
      setIsCorrect(false);
      setQuestionDeadlineAt(nextDeadlineAt);
      setTimeLeft(maxTime);
      if (gameQuestions) {
        void syncServerAttempt({
          currentQuestion: nextQuestionIndex,
          timeLeft: maxTime,
          questionDeadlineAt: nextDeadlineAt,
          selectedAnswer: null,
          showFeedback: false,
          isCorrect: false,
          updatedAt: Date.now(),
        });
      }
    } else {
      // Final score already includes the last question if correct
      const finalScore = totalScore;
      setFinalScoreValue(finalScore);
      await saveScore(playerName, finalScore);
      setScreen("leaderboard");
    }
  };

  const handleRestart = () => {
    clearStoredAttempt(quizId);
    resetGameState("intro");
  };

  const handleResetDevFingerprint = () => {
    rotateDevFingerprintSeed();
    clearStoredAttempt(quizId);
    resetGameState("intro");
    setAlreadySubmitted(false);
    setError("");
    setResumeNotice("");
    setEligibilityStatus("checking");
    setDevResetNotice(
      "Dev fingerprint reset. Cached auth and saved-attempt locks were cleared for this browser."
    );
    setIdentityRefreshNonce((value) => value + 1);
  };

  if (screen === "intro") {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={SCREEN_BACKGROUND_STYLE}
      >
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
          <div className="text-center mb-8">
            <img
              src="/images/digicert-blue-logo-large.jpg"
              alt="DigiCert"
              className="h-16 mx-auto mb-4 object-contain"
            />
            <h1
              className="text-4xl font-bold mb-2"
              style={{ color: "#0e75ba" }}
            >
              {title}
            </h1>
            {intro ? (
              <p className="text-gray-600">{intro}</p>
            ) : null}
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {alreadySubmitted && (
            <div className="bg-yellow-50 border-2 border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
              You’ve already played this quiz. Thanks for participating! You can view the leaderboard below.
            </div>
          )}

          {eligibilityStatus === "checking" && (
            <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4">
              {ELIGIBILITY_CHECKING_MESSAGE}
            </div>
          )}

          {devResetNotice && devFingerprintResetEnabled && (
            <div className="bg-slate-50 border border-slate-300 text-slate-700 px-4 py-3 rounded mb-4">
              {devResetNotice}
            </div>
          )}

          <div className="bg-blue-50 rounded-lg p-6 mb-6 shadow-lg">
            <div className="md:flex md:items-center">
              <div className="md:flex-1 md:pr-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-3">How It Works:</h2>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>Each question starts with {maxTime} points</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>You lose 1 point per second, so answer quickly!</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-600 mr-2">•</span>
                    <span>No replays, please! Only your first score counts ^_^</span>
                  </li>
                </ul>
              </div>
              <div className="hidden lg:flex lg:pl-6 justify-end">
                <img
                  src="/images/quiz_icon.png"
                  alt="Quiz icon"
                  className="w-24 h-24 object-contain"
                />
              </div>
            </div>
          </div>

          {leaderboard.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-4 mb-6 shadow-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">This Week's High Scores:</h3>
              <div className="space-y-1">
                {leaderboard.slice(0, 3).map((entry, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-3 items-center bg-white rounded-lg px-4 py-3 text-sm"
                    style={{ gridTemplateColumns: "1fr auto auto" }}
                  >
                    <span className="text-blue-600 font-bold text-base md:text-lg">
                      {index + 1}. {entry.name}
                    </span>
                    <span className="font-semibold text-blue-600 text-base md:text-lg pr-4 md:pr-6">
                      {entry.score}
                    </span>
                    <Trophy
                      className={`w-9 h-9 ${TROPHY_COLORS[index] ?? "text-blue-400"} justify-self-center`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name to start"
              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={alreadySubmitted}
            />
            <button
              onClick={handleStart}
              disabled={
                !playerName.trim() ||
                alreadySubmitted ||
                eligibilityStatus !== "ready" ||
                isStartingAttempt
              }
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {eligibilityStatus === "checking"
                ? "Checking eligibility..."
                : isStartingAttempt
                  ? "Starting securely..."
                  : "Start Quiz"}
            </button>
            <button
              onClick={() => { setFinalScoreValue(null); setScreen("leaderboard"); }}
              className="w-full border-2 border-blue-600 text-blue-700 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-all"
            >
              View the leaderboard top 25
            </button>
            {devFingerprintResetEnabled && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="mb-3">
                  Local dev helper: rotate the browser fingerprint seed and clear cached anonymous auth plus saved attempt locks.
                </p>
                <p className="mb-3 text-xs text-slate-600">
                  Current dev seed:{" "}
                  <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                    {devFingerprintSeedLabel}
                  </span>
                </p>
                <button
                  onClick={handleResetDevFingerprint}
                  className="w-full rounded-lg border border-slate-400 bg-white px-4 py-3 font-semibold text-slate-800 transition-all hover:bg-slate-100"
                >
                  Reset Dev Fingerprint
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (screen === "question") {
    const activeQuestions = gameQuestions || questions;
    const question = activeQuestions[currentQuestion];
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={SCREEN_BACKGROUND_STYLE}
      >
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Clock className="w-6 h-6 text-blue-600" />
              <span className="text-xl font-semibold text-gray-800">Time Left: {timeLeft}s</span>
            </div>
            <span className="text-xl font-semibold text-gray-800">Score: {totalScore}</span>
          </div>

          {resumeNotice && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {resumeNotice}
            </div>
          )}

          <div className="mb-6">
            <div className="text-sm text-gray-600 mb-2">
              Question {currentQuestion + 1} of {activeQuestions.length}
            </div>
            <h2 className="text-2xl font-bold text-gray-800">{question.question}</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 mb-6">
            {question.options.map((option, index) => (
              <button
                key={index}
                onClick={() => !showFeedback && setSelectedAnswer(index)}
                disabled={showFeedback}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedAnswer === index ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"
                } ${showFeedback ? "cursor-not-allowed" : "cursor-pointer"} ${
                  showFeedback && index === question.correctAnswer
                    ? "bg-green-50 border-green-500"
                    : ""
                } ${
                  showFeedback && selectedAnswer === index && !isCorrect
                    ? "bg-red-50 border-red-500"
                    : ""
                }`}
              >
                <div className="flex items-center justify-center gap-3 text-center">
                  <span className="text-gray-800 text-center">{option}</span>
                  {showFeedback && index === question.correctAnswer && (
                    <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
                  )}
                  {showFeedback && selectedAnswer === index && !isCorrect && (
                    <XCircle className="w-8 h-8 text-red-600 shrink-0" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {showFeedback && (
            <div className={`p-4 rounded-lg mb-6 ${isCorrect ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"}`}>
              <div className="flex items-center space-x-2 mb-2">
                {isCorrect ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600" />
                )}
                <span className={`font-semibold ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                  {isCorrect ? "Correct!" : "Incorrect"}
                </span>
              </div>
              {isCorrect ? (
                <p className="text-green-700">
                  You earned <span className="font-bold">{timeLeft}</span> points!
                </p>
              ) : (
                <p className="text-red-700">
                  The correct answer was: <span className="font-bold">{question.options[question.correctAnswer]}</span>
                </p>
              )}
            </div>
          )}

          {!showFeedback ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswer === null || timeLeft === 0}
              className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Submit Answer
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all"
            >
              {currentQuestion < (gameQuestions ? gameQuestions.length : questions.length) - 1 ? "Next Question" : "View Results"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (screen === "leaderboard") {
    const currentPlayerEntry =
      finalScoreValue != null && playerName
        ? leaderboard.find((entry) => entry.name === playerName && entry.score === finalScoreValue)
        : null;

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={SCREEN_BACKGROUND_STYLE}
      >
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
          {error && (
            <div className="mb-4 p-3 rounded bg-red-100 border border-red-300 text-red-800">
              {error}
            </div>
          )}
          <div className="text-center mb-8">
            <img
              src="/images/digicert-blue-logo-large.jpg"
              alt="DigiCert"
              className="h-20 mx-auto mb-4 object-contain"
            />
            {finalScoreValue != null && playerName && (
              <>
                <h1 className="text-4xl font-bold mb-4" style={{ color: "#0e75ba" }}>Quiz Complete!</h1>
                <p className="text-xl text-gray-600">
                  {playerName}, your final score: <span className="font-bold text-blue-600">{finalScoreValue}</span>
                </p>
              </>
            )}
          </div>

          <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-6 mb-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-2xl font-bold"
                style={{ color: "#0e75ba" }}
              >
                Global Leaderboard
              </h2>
              <div className="flex items-center">
                <button
                  onClick={loadLeaderboard}
                  className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                  disabled={loading}
                >
                  {loading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {loading ? (
                <p className="text-center text-gray-600">Loading leaderboard...</p>
              ) : leaderboard.length === 0 ? (
                <p className="text-center text-gray-600">Be the first to play!</p>
              ) : (
                leaderboard.slice(0, 25).map((entry, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      entry.timestamp === currentPlayerEntry?.timestamp ? "bg-blue-100 border-2 border-blue-500" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      <span
                        className={`text-2xl font-bold ${
                          index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : index === 2 ? "text-orange-600" : "text-gray-500"
                        }`}
                      >
                        #{index + 1}
                      </span>
                      <span className="font-semibold text-gray-800">{entry.name}</span>
                    </div>
                    <span className="text-xl font-bold text-blue-600">{entry.score}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={handleRestart}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Return to Start
          </button>
          {devFingerprintResetEnabled && (
            <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="mb-3 text-xs text-slate-600">
                Current dev seed:{" "}
                <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                  {devFingerprintSeedLabel}
                </span>
              </p>
              <button
                onClick={handleResetDevFingerprint}
                className="w-full rounded-lg border border-slate-400 bg-white py-3 font-semibold text-slate-800 transition-all hover:bg-slate-100"
              >
                Reset Dev Fingerprint
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
