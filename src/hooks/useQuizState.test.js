const { buildInitialQuizState, quizStateReducer } = require("./useQuizState");

describe("useQuizState", () => {
  it("builds the expected initial runtime state", () => {
    expect(buildInitialQuizState(100)).toEqual({
      screen: "intro",
      playerName: "",
      currentQuestion: 0,
      timeLeft: 100,
      questionDeadlineAt: null,
      selectedAnswer: null,
      showFeedback: false,
      isCorrect: false,
      totalScore: 0,
      error: "",
      finalScoreValue: null,
      gameQuestions: null,
      resumeNotice: "",
      attemptCreatedAt: null,
      isStartingAttempt: false,
      devResetNotice: "",
    });
  });

  it("updates individual fields through set_field actions", () => {
    const state = buildInitialQuizState(100);

    expect(
      quizStateReducer(state, {
        type: "set_field",
        field: "playerName",
        value: "Taylor",
      })
    ).toMatchObject({
      playerName: "Taylor",
      screen: "intro",
    });
  });

  it("supports functional updates for individual fields", () => {
    const state = {
      ...buildInitialQuizState(100),
      totalScore: 40,
    };

    expect(
      quizStateReducer(state, {
        type: "set_field",
        field: "totalScore",
        value: (current) => current + 20,
      })
    ).toMatchObject({
      totalScore: 60,
    });
  });

  it("merges partial state patches for restore and transition flows", () => {
    const state = buildInitialQuizState(100);

    expect(
      quizStateReducer(state, {
        type: "merge_state",
        patch: {
          screen: "question",
          currentQuestion: 1,
          totalScore: 80,
          showFeedback: true,
        },
      })
    ).toMatchObject({
      screen: "question",
      currentQuestion: 1,
      totalScore: 80,
      showFeedback: true,
    });
  });

  it("resets runtime state while honoring the target screen", () => {
    const dirtyState = {
      ...buildInitialQuizState(100),
      screen: "question",
      playerName: "Taylor",
      totalScore: 99,
      showFeedback: true,
      devResetNotice: "Cleared",
    };

    expect(
      quizStateReducer(dirtyState, {
        type: "reset_runtime_state",
        maxTime: 80,
        nextScreen: "leaderboard",
      })
    ).toEqual({
      ...buildInitialQuizState(80),
      screen: "leaderboard",
    });
  });
});
