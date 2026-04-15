import { QUIZ_ATTEMPT_STORAGE_VERSION } from "../constants/quiz";

export const ATTEMPT_STATUS_IN_PROGRESS = "in_progress";
export const ATTEMPT_STATUS_COMPLETED = "completed";

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function getAttemptStorageKey(quizId) {
  return `quizAttempt:${quizId}`;
}

export function loadStoredAttempt(
  quizId,
  {
    storage = resolveStorage(),
    version = QUIZ_ATTEMPT_STORAGE_VERSION,
  } = {}
) {
  try {
    if (!storage) return null;
    const raw = storage.getItem(getAttemptStorageKey(quizId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.version === version ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function saveStoredAttempt(quizId, attempt, { storage = resolveStorage() } = {}) {
  try {
    if (!storage) return false;
    storage.setItem(getAttemptStorageKey(quizId), JSON.stringify(attempt));
    return true;
  } catch (_) {
    return false;
  }
}

export function clearStoredAttempt(quizId, { storage = resolveStorage() } = {}) {
  try {
    if (!storage) return false;
    storage.removeItem(getAttemptStorageKey(quizId));
    return true;
  } catch (_) {
    return false;
  }
}

export function isValidQuestionSet(activeQuestions, { expectedLength } = {}) {
  return (
    Array.isArray(activeQuestions) &&
    (typeof expectedLength !== "number" || activeQuestions.length === expectedLength) &&
    activeQuestions.every(
      (question) =>
        question &&
        typeof question.question === "string" &&
        Array.isArray(question.options) &&
        typeof question.correctAnswer === "number"
    )
  );
}

export function serializeQuestionSet(activeQuestions) {
  return JSON.stringify(activeQuestions);
}

export function parseQuestionSet(serialized, { expectedLength } = {}) {
  try {
    const parsed = JSON.parse(serialized);
    return isValidQuestionSet(parsed, { expectedLength }) ? parsed : null;
  } catch (_) {
    return null;
  }
}

export function computeRestoredTimeLeft({
  showFeedback,
  timeLeft,
  questionDeadlineAt,
  maxTime,
  now = Date.now(),
}) {
  if (showFeedback) {
    return Math.max(0, Number(timeLeft) || 0);
  }

  if (typeof questionDeadlineAt === "number") {
    return Math.max(0, Math.ceil((questionDeadlineAt - now) / 1000));
  }

  return maxTime;
}

export function buildAttemptRecord({
  name,
  nameSlug,
  fp,
  fpMachine,
  currentQuestion,
  totalScore,
  timeLeft,
  questionDeadlineAt,
  selectedAnswer,
  showFeedback,
  isCorrect,
  gameQuestions,
  createdAt = Date.now(),
  status = ATTEMPT_STATUS_IN_PROGRESS,
  completedAt = null,
  now = Date.now(),
}) {
  return {
    name,
    nameSlug,
    fp,
    fpMachine,
    questionSet: serializeQuestionSet(gameQuestions),
    currentQuestion,
    totalScore,
    timeLeft,
    questionDeadlineAt,
    selectedAnswer,
    showFeedback,
    isCorrect,
    status,
    createdAt,
    updatedAt: now,
    completedAt,
  };
}

export function isRestorableServerAttempt(attempt) {
  return Boolean(attempt && attempt.status !== ATTEMPT_STATUS_COMPLETED);
}

export function chooseCanonicalAttempt(
  candidates,
  { expectedQuestionCount } = {}
) {
  const validCandidates = (candidates || []).filter((candidate) => {
    if (!candidate?.attempt) return false;

    if (candidate.source === "local") {
      return isValidQuestionSet(candidate.attempt.gameQuestions, {
        expectedLength: expectedQuestionCount,
      });
    }

    return (
      isRestorableServerAttempt(candidate.attempt) &&
      Boolean(
        parseQuestionSet(candidate.attempt.questionSet, {
          expectedLength: expectedQuestionCount,
        })
      )
    );
  });

  if (validCandidates.length === 0) return null;

  validCandidates.sort((left, right) => {
    const leftUpdatedAt =
      Number(left.attempt.updatedAt) || Number(left.attempt.createdAt) || 0;
    const rightUpdatedAt =
      Number(right.attempt.updatedAt) || Number(right.attempt.createdAt) || 0;
    return rightUpdatedAt - leftUpdatedAt;
  });

  return validCandidates[0];
}
