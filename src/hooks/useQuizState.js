import { useCallback, useReducer } from "react";

export function buildInitialQuizState(maxTime) {
  return {
    screen: "intro",
    playerName: "",
    currentQuestion: 0,
    timeLeft: maxTime,
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
  };
}

export function quizStateReducer(state, action) {
  switch (action.type) {
    case "set_field": {
      const nextValue =
        typeof action.value === "function"
          ? action.value(state[action.field])
          : action.value;
      return {
        ...state,
        [action.field]: nextValue,
      };
    }
    case "merge_state":
      return {
        ...state,
        ...action.patch,
      };
    case "reset_runtime_state":
      return {
        ...buildInitialQuizState(action.maxTime),
        screen: action.nextScreen ?? "intro",
      };
    default:
      return state;
  }
}

function useFieldSetter(dispatch, field) {
  return useCallback(
    (value) => {
      dispatch({
        type: "set_field",
        field,
        value,
      });
    },
    [dispatch, field]
  );
}

export function useQuizState(maxTime) {
  const [state, dispatch] = useReducer(
    quizStateReducer,
    maxTime,
    buildInitialQuizState
  );

  const mergeQuizState = useCallback((patch) => {
    dispatch({
      type: "merge_state",
      patch,
    });
  }, []);

  const resetQuizState = useCallback(
    (nextScreen = "intro") => {
      dispatch({
        type: "reset_runtime_state",
        maxTime,
        nextScreen,
      });
    },
    [maxTime]
  );

  return {
    ...state,
    mergeQuizState,
    resetQuizState,
    setScreen: useFieldSetter(dispatch, "screen"),
    setPlayerName: useFieldSetter(dispatch, "playerName"),
    setCurrentQuestion: useFieldSetter(dispatch, "currentQuestion"),
    setTimeLeft: useFieldSetter(dispatch, "timeLeft"),
    setQuestionDeadlineAt: useFieldSetter(dispatch, "questionDeadlineAt"),
    setSelectedAnswer: useFieldSetter(dispatch, "selectedAnswer"),
    setShowFeedback: useFieldSetter(dispatch, "showFeedback"),
    setIsCorrect: useFieldSetter(dispatch, "isCorrect"),
    setTotalScore: useFieldSetter(dispatch, "totalScore"),
    setError: useFieldSetter(dispatch, "error"),
    setFinalScoreValue: useFieldSetter(dispatch, "finalScoreValue"),
    setGameQuestions: useFieldSetter(dispatch, "gameQuestions"),
    setResumeNotice: useFieldSetter(dispatch, "resumeNotice"),
    setAttemptCreatedAt: useFieldSetter(dispatch, "attemptCreatedAt"),
    setIsStartingAttempt: useFieldSetter(dispatch, "isStartingAttempt"),
    setDevResetNotice: useFieldSetter(dispatch, "devResetNotice"),
  };
}
