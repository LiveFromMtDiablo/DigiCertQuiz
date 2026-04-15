const {
  ATTEMPT_STATUS_COMPLETED,
  buildAttemptRecord,
  chooseCanonicalAttempt,
  clearStoredAttempt,
  computeRestoredTimeLeft,
  getAttemptStorageKey,
  isRestorableServerAttempt,
  isValidQuestionSet,
  loadStoredAttempt,
  parseQuestionSet,
  saveStoredAttempt,
  serializeQuestionSet,
} = require("./quizAttemptState");
const { QUIZ_ATTEMPT_STORAGE_VERSION } = require("../constants/quiz");

const NOW = 1_710_000_000_000;
const QUESTIONS = [
  {
    question: "Which option is correct?",
    options: ["Alpha", "Bravo", "Charlie", "Delta"],
    correctAnswer: 1,
  },
  {
    question: "Which choice comes next?",
    options: ["One", "Two", "Three", "Four"],
    correctAnswer: 2,
  },
];

describe("quizAttemptState", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
  });

  it("round-trips a stored attempt using the versioned quiz storage key", () => {
    const attempt = {
      version: QUIZ_ATTEMPT_STORAGE_VERSION,
      playerName: "Taylor",
      currentQuestion: 1,
    };

    expect(getAttemptStorageKey("week-1")).toBe("quizAttempt:week-1");
    expect(saveStoredAttempt("week-1", attempt)).toBe(true);
    expect(loadStoredAttempt("week-1")).toEqual(attempt);
  });

  it("returns null for mismatched attempt versions or malformed JSON", () => {
    localStorage.setItem(
      getAttemptStorageKey("week-1"),
      JSON.stringify({ version: QUIZ_ATTEMPT_STORAGE_VERSION + 1 })
    );
    expect(loadStoredAttempt("week-1")).toBeNull();

    localStorage.setItem(getAttemptStorageKey("week-1"), "{bad-json");
    expect(loadStoredAttempt("week-1")).toBeNull();
  });

  it("clears saved attempts from local storage", () => {
    localStorage.setItem(
      getAttemptStorageKey("week-1"),
      JSON.stringify({ version: QUIZ_ATTEMPT_STORAGE_VERSION })
    );

    expect(clearStoredAttempt("week-1")).toBe(true);
    expect(localStorage.getItem(getAttemptStorageKey("week-1"))).toBeNull();
  });

  it("validates question sets against the expected shape and length", () => {
    expect(isValidQuestionSet(QUESTIONS, { expectedLength: 2 })).toBe(true);
    expect(isValidQuestionSet(QUESTIONS, { expectedLength: 3 })).toBe(false);
    expect(
      isValidQuestionSet([{ question: "Broken", options: "not-an-array", correctAnswer: 0 }], {
        expectedLength: 1,
      })
    ).toBe(false);
  });

  it("parses serialized question sets only when they remain valid", () => {
    expect(
      parseQuestionSet(serializeQuestionSet(QUESTIONS), { expectedLength: 2 })
    ).toEqual(QUESTIONS);

    expect(parseQuestionSet(JSON.stringify([{ question: "Broken" }]), { expectedLength: 1 })).toBeNull();
    expect(parseQuestionSet("{bad-json", { expectedLength: 2 })).toBeNull();
  });

  it("computes restored time left for feedback, active timers, and expired timers", () => {
    expect(
      computeRestoredTimeLeft({
        showFeedback: true,
        timeLeft: 12,
        questionDeadlineAt: NOW + 12_000,
        maxTime: 100,
        now: NOW,
      })
    ).toBe(12);

    expect(
      computeRestoredTimeLeft({
        showFeedback: false,
        timeLeft: 12,
        questionDeadlineAt: NOW + 15_000,
        maxTime: 100,
        now: NOW,
      })
    ).toBe(15);

    expect(
      computeRestoredTimeLeft({
        showFeedback: false,
        timeLeft: 12,
        questionDeadlineAt: NOW - 1_000,
        maxTime: 100,
        now: NOW,
      })
    ).toBe(0);
  });

  it("builds attempt records with serialized question sets and tracked timestamps", () => {
    const record = buildAttemptRecord({
      name: "Taylor",
      nameSlug: "taylor",
      fp: "fp-1",
      fpMachine: "machine-1",
      currentQuestion: 1,
      totalScore: 88,
      timeLeft: 33,
      questionDeadlineAt: NOW + 33_000,
      selectedAnswer: 2,
      showFeedback: true,
      isCorrect: true,
      gameQuestions: QUESTIONS,
      createdAt: NOW - 5_000,
      completedAt: NOW,
      status: ATTEMPT_STATUS_COMPLETED,
      now: NOW,
    });

    expect(record).toEqual({
      name: "Taylor",
      nameSlug: "taylor",
      fp: "fp-1",
      fpMachine: "machine-1",
      questionSet: JSON.stringify(QUESTIONS),
      currentQuestion: 1,
      totalScore: 88,
      timeLeft: 33,
      questionDeadlineAt: NOW + 33_000,
      selectedAnswer: 2,
      showFeedback: true,
      isCorrect: true,
      status: ATTEMPT_STATUS_COMPLETED,
      createdAt: NOW - 5_000,
      updatedAt: NOW,
      completedAt: NOW,
    });
  });

  it("recognizes which server attempts remain restorable", () => {
    expect(isRestorableServerAttempt({ status: "in_progress" })).toBe(true);
    expect(isRestorableServerAttempt({ status: ATTEMPT_STATUS_COMPLETED })).toBe(false);
    expect(isRestorableServerAttempt(null)).toBe(false);
  });

  it("chooses the newest valid candidate and ignores invalid snapshots", () => {
    const localCandidate = {
      source: "local",
      attempt: {
        gameQuestions: QUESTIONS,
        updatedAt: NOW - 10_000,
      },
    };
    const invalidLocalCandidate = {
      source: "local",
      attempt: {
        gameQuestions: [{ question: "Broken" }],
        updatedAt: NOW,
      },
    };
    const serverCandidate = {
      source: "server-own",
      attempt: {
        questionSet: JSON.stringify(QUESTIONS),
        status: "in_progress",
        updatedAt: NOW - 1_000,
      },
    };

    expect(
      chooseCanonicalAttempt([invalidLocalCandidate, localCandidate, serverCandidate], {
        expectedQuestionCount: QUESTIONS.length,
      })
    ).toEqual(serverCandidate);
  });
});
