import React, { useEffect, useState, useCallback } from "react";
import { AUTH_STORAGE_KEY, getValidAuth } from "../services/firebaseAuth";
import {
  readProtectedData,
  fetchQuizLeaderboard,
  fetchAttemptByUid,
  fetchFingerprintLockedAttempt,
  createServerAttempt,
  syncServerAttempt as syncServerAttemptRequest,
} from "../services/leaderboardApi";
import {
  NAME_REGEX,
  buildEligibilityState,
  sanitizeName,
  toNameSlug,
  classifyNameConflict,
  ELIGIBILITY_CHECKING_MESSAGE,
  ELIGIBILITY_ERROR_MESSAGE,
} from "../utils/quizEligibility";
import {
  isDevFingerprintResetEnabled,
  getDevFingerprintSeed,
  rotateDevFingerprintSeed,
  formatDevFingerprintSeed,
  getDeviceFingerprint,
  getMachineFingerprint,
} from "../utils/deviceFingerprint";
import {
  loadStoredAttempt,
  saveStoredAttempt,
  clearStoredAttempt,
  isValidQuestionSet,
  parseQuestionSet,
  computeRestoredTimeLeft,
  buildAttemptRecord,
  chooseCanonicalAttempt,
} from "../utils/quizAttemptState";
import {
  DEFAULT_QUIZ_MAX_TIME_SECONDS,
  QUIZ_ATTEMPT_STORAGE_VERSION,
} from "../constants/quiz";
import { logSilent } from "../utils/logging";
import { useLeaderboardSubmission } from "../hooks/useLeaderboardSubmission";
import { useQuizState } from "../hooks/useQuizState";
import IntroScreen from "./quiz-game/IntroScreen";
import QuestionScreen from "./quiz-game/QuestionScreen";
import LeaderboardScreen from "./quiz-game/LeaderboardScreen";

const STALE_ATTEMPT_LOCK_MESSAGE =
  "This browser has a stale saved-attempt lock for this quiz. Please contact the quiz organizer to clear it.";

export default function QuizGame({
  quizId,
  title,
  questions,
  maxTime = DEFAULT_QUIZ_MAX_TIME_SECONDS,
  intro,
}) {
  const devFingerprintResetEnabled = isDevFingerprintResetEnabled();
  const devFingerprintSeed = getDevFingerprintSeed();
  const devFingerprintSeedLabel = formatDevFingerprintSeed(devFingerprintSeed);
  const {
    screen,
    playerName,
    currentQuestion,
    timeLeft,
    questionDeadlineAt,
    selectedAnswer,
    showFeedback,
    isCorrect,
    totalScore,
    error,
    finalScoreValue,
    gameQuestions,
    resumeNotice,
    attemptCreatedAt,
    isStartingAttempt,
    devResetNotice,
    setScreen,
    setPlayerName,
    setCurrentQuestion,
    setTimeLeft,
    setQuestionDeadlineAt,
    setSelectedAnswer,
    setShowFeedback,
    setIsCorrect,
    setTotalScore,
    setError,
    setFinalScoreValue,
    setGameQuestions,
    setResumeNotice,
    setAttemptCreatedAt,
    setIsStartingAttempt,
    setDevResetNotice,
    mergeQuizState,
    resetQuizState,
  } = useQuizState(maxTime);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [eligibilityStatus, setEligibilityStatus] = useState("checking");
  const [identityRefreshNonce, setIdentityRefreshNonce] = useState(0);

  function markQuizSubmitted() {
    setAlreadySubmitted(true);
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(`submitted:${quizId}`, "1");
      }
    } catch (error) {
      logSilent("quiz.save.markSubmitted", error, { quizId });
    }
  }

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
    if (!isValidQuestionSet(activeQuestions, { expectedLength: questions.length })) {
      clearStoredAttempt(quizId);
      return false;
    }

    const safeQuestionIndex = Math.min(
      Math.max(0, Number(attempt.currentQuestion) || 0),
      activeQuestions.length - 1
    );
    const storedDeadlineAt =
      typeof attempt.questionDeadlineAt === "number" ? attempt.questionDeadlineAt : null;
    const restoredTimeLeft = computeRestoredTimeLeft({
      showFeedback: attempt.showFeedback,
      timeLeft: attempt.timeLeft,
      questionDeadlineAt: storedDeadlineAt,
      maxTime,
    });

    mergeQuizState({
      playerName: typeof attempt.playerName === "string" ? attempt.playerName : "",
      gameQuestions: activeQuestions,
      currentQuestion: safeQuestionIndex,
      selectedAnswer:
        typeof attempt.selectedAnswer === "number" ? attempt.selectedAnswer : null,
      showFeedback: Boolean(attempt.showFeedback),
      isCorrect: Boolean(attempt.isCorrect),
      totalScore: Math.max(0, Number(attempt.totalScore) || 0),
      finalScoreValue: null,
      attemptCreatedAt:
        typeof attempt.createdAt === "number" ? attempt.createdAt : Date.now(),
      questionDeadlineAt: attempt.showFeedback ? null : storedDeadlineAt,
      timeLeft: restoredTimeLeft,
      screen: "question",
      error: "",
      resumeNotice: "Your in-progress quiz was restored. Refreshing will not restart it.",
    });
    return true;
  }

  function resetGameState(nextScreen = "intro") {
    resetQuizState(nextScreen);
  }

  function restoreServerAttempt(attempt) {
    const activeQuestions = parseQuestionSet(attempt?.questionSet, {
      expectedLength: questions.length,
    });
    if (!activeQuestions) return false;

    const safeQuestionIndex = Math.min(
      Math.max(0, Number(attempt.currentQuestion) || 0),
      activeQuestions.length - 1
    );
    const storedDeadlineAt =
      typeof attempt.questionDeadlineAt === "number" ? attempt.questionDeadlineAt : null;
    const restoredTimeLeft = computeRestoredTimeLeft({
      showFeedback: Boolean(attempt.showFeedback),
      timeLeft: attempt.timeLeft,
      questionDeadlineAt: storedDeadlineAt,
      maxTime,
    });

    mergeQuizState({
      playerName: typeof attempt.name === "string" ? attempt.name : "",
      gameQuestions: activeQuestions,
      currentQuestion: safeQuestionIndex,
      selectedAnswer:
        typeof attempt.selectedAnswer === "number" ? attempt.selectedAnswer : null,
      showFeedback: Boolean(attempt.showFeedback),
      isCorrect: Boolean(attempt.isCorrect),
      totalScore: Math.max(0, Number(attempt.totalScore) || 0),
      finalScoreValue: null,
      attemptCreatedAt:
        typeof attempt.createdAt === "number" ? attempt.createdAt : Date.now(),
      questionDeadlineAt: Boolean(attempt.showFeedback) ? null : storedDeadlineAt,
      timeLeft: restoredTimeLeft,
      screen: "question",
      error: "",
      resumeNotice: "Your in-progress quiz was restored from the server.",
    });
    return true;
  }

  async function getAttemptIdentity() {
    const { uid, idToken } = await getValidAuth();
    const [fp, fpMachine] = await Promise.all([
      getDeviceFingerprint({ salt: quizId }),
      getMachineFingerprint({ salt: quizId }),
    ]);
    return { uid, idToken, fp, fpMachine };
  }

  async function syncCurrentServerAttempt(snapshot) {
    try {
      const { uid, idToken } = await getValidAuth();
      const res = await syncServerAttemptRequest({
        quizId,
        uid,
        idToken,
        snapshot,
      });
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
      const leaderboardArray = await fetchQuizLeaderboard({
        quizId,
        idToken,
      });
      try { console.debug('[leaderboard]', quizId, 'entries:', leaderboardArray.length); } catch (_) {}
      setLeaderboard(leaderboardArray);
      setLoading(false);
    } catch (err) {
      console.error("Error loading leaderboard:", err);
      setError(
        "Failed to load leaderboard. Please check your Firebase configuration."
      );
      setLoading(false);
    }
  }, [quizId]);

  const saveScore = useLeaderboardSubmission({
    quizId,
    questions,
    maxTime,
    gameQuestions,
    timeLeft,
    selectedAnswer,
    isCorrect,
    attemptCreatedAt,
    loadLeaderboard,
    markQuizSubmitted,
    setError,
  });

  useEffect(() => {
    if (screen === "intro" || screen === "leaderboard") {
      loadLeaderboard();
    }
  }, [screen, loadLeaderboard]);

  useEffect(() => {
    setEligibilityStatus("checking");
    const preservedDevResetNotice = devResetNotice;
    resetGameState("intro");
    if (preservedDevResetNotice) {
      setDevResetNotice(preservedDevResetNotice);
    }
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
        const fp = await getDeviceFingerprint({ salt: quizId });
        if (cancelled) return;

        const completedFingerprintOwnerPromise = readProtectedData({
          path: `fingerprints/${quizId}/${fp}`,
          idToken,
        }).catch((error) => {
          if (error?.status === 401 || error?.status === 403) {
            logSilent("quiz.eligibility.completedFingerprintLookup", error, {
              quizId,
              status: error.status,
            });
            return null;
          }
          throw error;
        });

        const [leaderboardRes, ownAttemptResult, fingerprintLocked, completedFingerprintOwner] =
          await Promise.all([
            readProtectedData({
              path: `leaderboard/${quizId}/${uid}`,
              idToken,
            })
              .then((data) => ({
                ok: true,
                data,
              }))
              .catch((error) => {
                if (error?.status === 401 || error?.status === 403 || error?.status === 404) {
                  return { ok: false, data: null, status: error.status };
                }
                throw error;
              }),
            fetchAttemptByUid({ quizId, uid, idToken }),
            fetchFingerprintLockedAttempt({ quizId, idToken, fp }),
            completedFingerprintOwnerPromise,
          ]);

        if (cancelled) return;

        if (fingerprintLocked?.lookupStatus === "unavailable") {
          console.warn("Fingerprint-locked attempt lookup failed; continuing without it.", {
            quizId,
            status: fingerprintLocked.error?.status || null,
            message: fingerprintLocked.error?.message || String(fingerprintLocked.error),
          });
        }

        let existingSubmission = null;
        if (leaderboardRes.ok) {
          existingSubmission = leaderboardRes.data;
          if (existingSubmission) setAlreadySubmitted(true);
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
        ], {
          expectedQuestionCount: questions.length,
        });

        if (canonicalAttempt && [localAttempt, ownAttemptResult?.data, fingerprintLocked?.attemptResult?.data].filter(Boolean).length > 1) {
          console.warn("Multiple attempt snapshots found; restoring the most recent one.", {
            quizId,
            sources: [localAttempt ? "local" : null, ownAttemptResult?.data ? "server-own" : null, fingerprintLocked?.attemptResult?.data ? "server-fingerprint" : null].filter(Boolean),
          });
        }

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

        const eligibility = buildEligibilityState({
          uid,
          existingSubmission,
          fingerprintOwner: completedFingerprintOwner,
        });

        if (eligibility.status === "blocked") {
          if (eligibility.reason === "already_submitted") {
            setAlreadySubmitted(true);
            setError("");
          } else {
            setError(eligibility.message);
          }
          setEligibilityStatus("blocked");
          return;
        }

        if (!cancelled) {
          setError("");
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
    void syncCurrentServerAttempt({
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
        const nameIndexOwner = await readProtectedData({
          path: `nameIndex/${quizId}/${nameSlug}`,
          idToken: auth.idToken,
        });
        const nameConflict = classifyNameConflict({
          uid: auth.uid,
          nameIndexOwner,
        });
        if (nameConflict.reason) {
          setError(nameConflict.message);
          return;
        }
      } catch (error) {
        logSilent("quiz.start.nameIndexLookup", error, { quizId, nameSlug });
      }

      const { uid, idToken, fp, fpMachine } = await getAttemptIdentity();
      const attemptRecord = buildAttemptRecord({
        name: clean,
        nameSlug,
        fp,
        fpMachine,
        currentQuestion: 0,
        totalScore: 0,
        timeLeft: maxTime,
        questionDeadlineAt: firstQuestionDeadlineAt,
        selectedAnswer: null,
        showFeedback: false,
        isCorrect: false,
        gameQuestions: shuffledQuestions,
      });

      const { response } = await createServerAttempt({
        quizId,
        uid,
        idToken,
        fp,
        attemptRecord,
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
      } catch (error) {
        logSilent("quiz.start.readReservationResponseBody", error, {
          quizId,
          responseStatus: response.status,
        });
      }
      console.error("Attempt reservation failed:", {
        quizId,
        status: response.status,
        body: attemptReservationErrorBody,
      });

      const auth = await getValidAuth();
      const fingerprint = await getDeviceFingerprint({ salt: quizId });
      const [ownAttempt, fingerprintLocked] = await Promise.all([
        fetchAttemptByUid({ quizId, uid: auth.uid, idToken: auth.idToken }),
        fetchFingerprintLockedAttempt({ quizId, idToken: auth.idToken, fp: fingerprint }),
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
      ], {
        expectedQuestionCount: questions.length,
      });

      if (canonicalAttempt && [ownAttempt?.data, fingerprintLocked?.attemptResult?.data].filter(Boolean).length > 1) {
        console.warn("Multiple attempt snapshots found; restoring the most recent one.", {
          quizId,
          sources: [
            ownAttempt?.data ? "server-own" : null,
            fingerprintLocked?.attemptResult?.data ? "server-fingerprint" : null,
          ].filter(Boolean),
        });
      }

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
      void syncCurrentServerAttempt({
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
        void syncCurrentServerAttempt({
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
      const saveResult = await saveScore(playerName, finalScore);
      if (saveResult?.ok) {
        setScreen("leaderboard");
      }
    }
  };

  const handleRestart = () => {
    clearStoredAttempt(quizId);
    resetGameState("intro");
  };

  const handleResetDevFingerprint = () => {
    rotateDevFingerprintSeed({ authStorageKey: AUTH_STORAGE_KEY });
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
    const handleViewLeaderboard = () => {
      setFinalScoreValue(null);
      setScreen("leaderboard");
    };

    return (
      <IntroScreen
        title={title}
        intro={intro}
        error={error}
        alreadySubmitted={alreadySubmitted}
        eligibilityStatus={eligibilityStatus}
        eligibilityCheckingMessage={ELIGIBILITY_CHECKING_MESSAGE}
        devResetNotice={devResetNotice}
        devFingerprintResetEnabled={devFingerprintResetEnabled}
        devFingerprintSeedLabel={devFingerprintSeedLabel}
        maxTime={maxTime}
        leaderboard={leaderboard}
        playerName={playerName}
        isStartingAttempt={isStartingAttempt}
        onPlayerNameChange={setPlayerName}
        onStart={handleStart}
        onViewLeaderboard={handleViewLeaderboard}
        onResetDevFingerprint={handleResetDevFingerprint}
      />
    );
  }

  if (screen === "question") {
    const activeQuestions = gameQuestions || questions;
    return (
      <QuestionScreen
        activeQuestions={activeQuestions}
        currentQuestion={currentQuestion}
        timeLeft={timeLeft}
        totalScore={totalScore}
        resumeNotice={resumeNotice}
        error={error}
        selectedAnswer={selectedAnswer}
        showFeedback={showFeedback}
        isCorrect={isCorrect}
        onSelectAnswer={setSelectedAnswer}
        onSubmitAnswer={handleSubmitAnswer}
        onNextQuestion={handleNextQuestion}
      />
    );
  }

  if (screen === "leaderboard") {
    return (
      <LeaderboardScreen
        error={error}
        finalScoreValue={finalScoreValue}
        playerName={playerName}
        leaderboard={leaderboard}
        loading={loading}
        onRefresh={loadLeaderboard}
        onRestart={handleRestart}
        devFingerprintResetEnabled={devFingerprintResetEnabled}
        devFingerprintSeedLabel={devFingerprintSeedLabel}
        onResetDevFingerprint={handleResetDevFingerprint}
      />
    );
  }

  return null;
}
