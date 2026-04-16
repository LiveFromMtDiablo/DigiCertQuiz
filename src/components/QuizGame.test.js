import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { webcrypto } from "crypto";
import { TextDecoder, TextEncoder } from "util";
import QuizGame from "./QuizGame";
import { AUTH_STORAGE_KEY, getValidAuth } from "../services/firebaseAuth";
import { DB_URL } from "../services/firebaseConfig";

jest.mock("../services/firebaseAuth", () => ({
  AUTH_STORAGE_KEY: "firebaseAuth",
  getValidAuth: jest.fn(),
}));

const AUTH = {
  uid: "uid-1",
  idToken: "token-1",
};

const QUIZ_ID = "week-99-hardening-test";
const DEV_FINGERPRINT_SEED_KEY = "devFingerprintSeed";
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
let currentNow = NOW;

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () =>
      typeof data === "string" ? data : JSON.stringify(data ?? null),
  };
}

function buildServerAttempt(overrides = {}) {
  return {
    name: "Taylor",
    nameSlug: "taylor",
    fp: "fp-1",
    fpMachine: "machine-1",
    questionSet: JSON.stringify(QUESTIONS),
    currentQuestion: 0,
    totalScore: 42,
    timeLeft: 55,
    questionDeadlineAt: NOW + 55_000,
    selectedAnswer: null,
    showFeedback: false,
    isCorrect: false,
    status: "in_progress",
    createdAt: NOW - 5_000,
    updatedAt: NOW - 2_000,
    completedAt: null,
    ...overrides,
  };
}

function buildLocalAttempt(overrides = {}) {
  return {
    version: 1,
    playerName: "Taylor",
    currentQuestion: 0,
    timeLeft: 55,
    questionDeadlineAt: NOW + 55_000,
    selectedAnswer: null,
    showFeedback: false,
    isCorrect: false,
    totalScore: 42,
    createdAt: NOW - 5_000,
    gameQuestions: QUESTIONS,
    updatedAt: NOW - 2_000,
    ...overrides,
  };
}

function installFetchMock(override = () => undefined) {
  global.fetch = jest.fn().mockImplementation((url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    const overridden = override({ url, method, options });
    if (overridden) {
      return Promise.resolve(overridden);
    }

    if (method === "GET" && url.includes(`/leaderboard/${QUIZ_ID}.json?`)) {
      return Promise.resolve(jsonResponse({}));
    }

    if (
      method === "GET" &&
      url.includes(`/leaderboard/${QUIZ_ID}/${AUTH.uid}.json?`)
    ) {
      return Promise.resolve(jsonResponse(null));
    }

    if (
      method === "GET" &&
      url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?`)
    ) {
      return Promise.resolve(jsonResponse(null));
    }

    if (method === "GET" && url.includes(`/attemptFingerprints/${QUIZ_ID}/`)) {
      return Promise.resolve(jsonResponse(null));
    }

    if (method === "GET" && url.includes(`/fingerprints/${QUIZ_ID}/`)) {
      return Promise.resolve(jsonResponse(null));
    }

    if (method === "GET" && url.includes(`/nameIndex/${QUIZ_ID}/`)) {
      return Promise.resolve(jsonResponse(null));
    }

    if (method === "PATCH" && url === `${DB_URL}/.json?auth=${AUTH.idToken}`) {
      return Promise.resolve(jsonResponse({}));
    }

    throw new Error(`Unhandled fetch: ${method} ${url}`);
  });
}

async function flushAsync(iterations = 6) {
  for (let index = 0; index < iterations; index += 1) {
    // Let queued promise continuations, effects, and DOM events settle.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

let container;
let root;
let originalCrypto;
let originalTextEncoder;
let originalTextDecoder;

function getButton(label) {
  return Array.from(container.querySelectorAll("button")).find((button) =>
    button.textContent.includes(label)
  );
}

async function waitFor(check, iterations = 30) {
  for (let index = 0; index < iterations; index += 1) {
    await flushAsync();
    if (check()) return;
  }

  const fetchCalls =
    global.fetch && global.fetch.mock
      ? global.fetch.mock.calls.map(([url]) => String(url)).join("\n")
      : "no fetch mock installed";
  throw new Error(
    `Condition not met. Current DOM: ${container.textContent}\nFetch calls:\n${fetchCalls}`
  );
}

async function changeName(value) {
  const input = container.querySelector('input[placeholder="Enter your name to start"]');
  if (!input) {
    throw new Error("Name input not found");
  }

  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    )?.set;
    valueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function clickButton(label) {
  const button = getButton(label);
  if (!button) {
    throw new Error(`Button "${label}" not found`);
  }

  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function clickOption(label) {
  const optionButton = Array.from(container.querySelectorAll("button")).find(
    (button) =>
      button.textContent.trim() === label ||
      button.textContent.includes(label)
  );

  if (!optionButton) {
    throw new Error(`Option "${label}" not found`);
  }

  await act(async () => {
    optionButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function getCurrentQuestionText() {
  const title = container.querySelector("h2.text-2xl");
  return title ? title.textContent : "";
}

async function answerCurrentQuestionCorrectly() {
  const currentQuestionText = getCurrentQuestionText();
  const currentQuestion = QUESTIONS.find(
    (question) => question.question === currentQuestionText
  );

  if (!currentQuestion) {
    throw new Error(`Unknown question on screen: ${currentQuestionText}`);
  }

  const correctOption = currentQuestion.options[currentQuestion.correctAnswer];
  await waitFor(() => container.textContent.includes(correctOption));
  await clickOption(correctOption);
}

async function renderQuizGame() {
  await act(async () => {
    root.render(
      <QuizGame
        quizId={QUIZ_ID}
        title="Hardening Test Quiz"
        questions={QUESTIONS}
        maxTime={100}
        intro="A tiny quiz for component testing."
      />
    );
  });
}

async function waitForStartButtonEnabled() {
  await waitFor(() => {
    const button = getButton("Start Quiz");
    return Boolean(button && !button.disabled);
  });
}

async function startQuiz(name = "Taylor") {
  await renderQuizGame();
  await waitFor(() => Boolean(getButton("Start Quiz")));
  await changeName(name);
  await waitForStartButtonEnabled();
  await clickButton("Start Quiz");
}

async function completeQuizPerfectly(name = "Taylor") {
  await startQuiz(name);
  await waitFor(() => container.textContent.includes("Question 1 of 2"));

  await answerCurrentQuestionCorrectly();
  await clickButton("Submit Answer");
  await waitFor(() => container.textContent.includes("Correct!"));

  await clickButton("Next Question");
  await waitFor(() => container.textContent.includes("Question 2 of 2"));

  await answerCurrentQuestionCorrectly();
  await clickButton("Submit Answer");
  await waitFor(() => container.textContent.includes("Correct!"));
}

async function remountQuizGame() {
  await act(async () => {
    root.unmount();
  });
  container.remove();

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  await renderQuizGame();
}

describe("QuizGame", () => {
  beforeAll(() => {
    originalTextEncoder = global.TextEncoder;
    originalTextDecoder = global.TextDecoder;
    global.TextEncoder = TextEncoder;
    global.TextDecoder = TextDecoder;

    originalCrypto = global.crypto;
    Object.defineProperty(global, "crypto", {
      configurable: true,
      value: webcrypto,
    });
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "crypto", {
        configurable: true,
        value: global.crypto,
      });
    }
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    currentNow = NOW;
    jest.spyOn(Date, "now").mockImplementation(() => currentNow);
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "debug").mockImplementation(() => {});

    localStorage.clear();
    getValidAuth.mockResolvedValue(AUTH);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container) {
      container.remove();
    }
    localStorage.clear();
    jest.restoreAllMocks();
    delete global.fetch;
  });

  afterAll(() => {
    global.TextEncoder = originalTextEncoder;
    global.TextDecoder = originalTextDecoder;
    Object.defineProperty(global, "crypto", {
      configurable: true,
      value: originalCrypto,
    });
    if (typeof window !== "undefined") {
      Object.defineProperty(window, "crypto", {
        configurable: true,
        value: originalCrypto,
      });
    }
  });

  it("starts a fresh quiz and reserves the attempt on the server", async () => {
    installFetchMock();

    await startQuiz("Taylor");

    await waitFor(() =>
      container.textContent.includes("Question 1 of 2")
    );

    const reservationCall = global.fetch.mock.calls.find(
      ([url, options]) =>
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        options?.method === "PATCH"
    );

    expect(reservationCall).toBeDefined();

    const payload = JSON.parse(reservationCall[1].body);
    const reservationKey = `attempts/${QUIZ_ID}/${AUTH.uid}`;
    const fingerprintKey = Object.keys(payload).find((key) =>
      key.startsWith(`attemptFingerprints/${QUIZ_ID}/`)
    );

    expect(payload[reservationKey]).toMatchObject({
      name: "Taylor",
      nameSlug: "taylor",
      status: "in_progress",
      currentQuestion: 0,
      totalScore: 0,
    });
    expect(fingerprintKey).toBeDefined();
    expect(payload[fingerprintKey]).toBe(AUTH.uid);
  });

  it("shows a localhost-only reset control that clears cached auth and quiz locks", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(AUTH));
    localStorage.setItem(`submitted:${QUIZ_ID}`, "1");
    localStorage.setItem(
      `quizAttempt:${QUIZ_ID}`,
      JSON.stringify({ version: 999, stale: true })
    );
    localStorage.setItem(DEV_FINGERPRINT_SEED_KEY, "seed-before");
    installFetchMock();

    await renderQuizGame();
    await waitFor(() => Boolean(getButton("Reset Dev Fingerprint")));
    expect(container.textContent).toContain("Current dev seed:");
    expect(container.textContent).toContain("seed-before");

    await clickButton("Reset Dev Fingerprint");

    await waitFor(() =>
      container.textContent.includes("Dev fingerprint reset.")
    );

    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(`submitted:${QUIZ_ID}`)).toBeNull();
    expect(localStorage.getItem(`quizAttempt:${QUIZ_ID}`)).toBeNull();
    expect(localStorage.getItem(DEV_FINGERPRINT_SEED_KEY)).toBeTruthy();
    expect(localStorage.getItem(DEV_FINGERPRINT_SEED_KEY)).not.toBe("seed-before");
    expect(container.textContent).toContain(localStorage.getItem(DEV_FINGERPRINT_SEED_KEY));
  });

  it("changes the derived fingerprint when the dev seed changes", async () => {
    localStorage.setItem(DEV_FINGERPRINT_SEED_KEY, "seed-a");
    installFetchMock();

    await startQuiz("Taylor");
    await waitFor(() => container.textContent.includes("Question 1 of 2"));

    const firstReservationCall = global.fetch.mock.calls.find(
      ([url, options]) =>
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        options?.method === "PATCH"
    );
    const firstPayload = JSON.parse(firstReservationCall[1].body);
    const firstFingerprintKey = Object.keys(firstPayload).find((key) =>
      key.startsWith(`attemptFingerprints/${QUIZ_ID}/`)
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();

    localStorage.clear();
    localStorage.setItem(DEV_FINGERPRINT_SEED_KEY, "seed-b");

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    installFetchMock();
    await startQuiz("Taylor");
    await waitFor(() => container.textContent.includes("Question 1 of 2"));

    const reservationCalls = global.fetch.mock.calls.filter(
      ([url, options]) =>
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        options?.method === "PATCH"
    );
    const secondPayload = JSON.parse(reservationCalls[0][1].body);
    const secondFingerprintKey = Object.keys(secondPayload).find((key) =>
      key.startsWith(`attemptFingerprints/${QUIZ_ID}/`)
    );

    expect(firstFingerprintKey).toBeTruthy();
    expect(secondFingerprintKey).toBeTruthy();
    expect(secondFingerprintKey).not.toBe(firstFingerprintKey);
  });

  it("restores an in-progress local attempt after a refresh with time already deducted", async () => {
    installFetchMock();

    await startQuiz("Taylor");
    await waitFor(() => container.textContent.includes("Question 1 of 2"));
    await waitFor(() =>
      Boolean(localStorage.getItem(`quizAttempt:${QUIZ_ID}`))
    );

    currentNow = NOW + 15_000;
    await remountQuizGame();

    await waitFor(() =>
      container.textContent.includes("Your in-progress quiz was restored. Refreshing will not restart it.")
    );

    expect(container.textContent).toContain("Question 1 of 2");
    expect(container.textContent).toContain("Time Left: 85s");
  });

  it("auto-shows incorrect feedback when a restored question has already timed out", async () => {
    localStorage.setItem(
      `quizAttempt:${QUIZ_ID}`,
      JSON.stringify(
        buildLocalAttempt({
          timeLeft: 12,
          questionDeadlineAt: NOW - 1_000,
          totalScore: 0,
        })
      )
    );
    installFetchMock();

    await renderQuizGame();

    await waitFor(() => container.textContent.includes("Incorrect"));

    expect(container.textContent).toContain("The correct answer was:");
    expect(container.textContent).toContain("Bravo");
    expect(getButton("Next Question")).toBeDefined();
  });

  it("restores an in-progress server attempt during eligibility check", async () => {
    const attempt = buildServerAttempt();
    installFetchMock(({ url, method }) => {
      if (
        method === "GET" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?`)
      ) {
        return jsonResponse(attempt);
      }
      return undefined;
    });

    await renderQuizGame();

    await waitFor(() =>
      container.textContent.includes("Your in-progress quiz was restored from the server.")
    );

    expect(container.textContent).toContain("Question 1 of 2");
    expect(container.textContent).toContain(QUESTIONS[0].question);
    expect(container.textContent).toContain("Score: 42");
  });

  it("blocks quiz start when the current uid already has a saved leaderboard score", async () => {
    installFetchMock(({ url, method }) => {
      if (
        method === "GET" &&
        url.includes(`/leaderboard/${QUIZ_ID}/${AUTH.uid}.json?`)
      ) {
        return jsonResponse({
          name: "Taylor",
          score: 375,
        });
      }
      return undefined;
    });

    await renderQuizGame();

    await waitFor(() =>
      container.textContent.includes("already played this quiz")
    );

    const input = container.querySelector('input[placeholder="Enter your name to start"]');
    const button = getButton("Start Quiz");

    expect(input.disabled).toBe(true);
    expect(button.disabled).toBe(true);
    expect(
      (container.textContent.match(/already played this quiz/gi) || []).length
    ).toBe(1);
  });

  it("blocks quiz start when another uid already owns the completed fingerprint", async () => {
    installFetchMock(({ url, method }) => {
      if (method === "GET" && url.includes(`/fingerprints/${QUIZ_ID}/`)) {
        return jsonResponse("uid-other");
      }
      return undefined;
    });

    await renderQuizGame();

    await waitFor(() =>
      container.textContent.includes("This device appears to have already been used for this quiz.")
    );

    await changeName("Taylor");
    await flushAsync();

    expect(getButton("Start Quiz").disabled).toBe(true);
    expect(container.textContent).not.toContain("Question 1 of 2");
  });

  it("completes the quiz, saves the final score, and returns to the leaderboard", async () => {
    const leaderboardAfterSave = {
      [AUTH.uid]: {
        name: "Taylor",
        score: 200,
        timestamp: NOW,
        fp: "fp-1",
      },
    };

    installFetchMock(({ url, method, options }) => {
      if (
        method === "GET" &&
        url.includes(`/leaderboard/${QUIZ_ID}.json?`)
      ) {
        const hasSavedScore = global.fetch.mock.calls.some(
          ([calledUrl, calledOptions]) =>
            calledUrl === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
            calledOptions?.method === "PATCH" &&
            JSON.parse(calledOptions.body || "{}")[
              `leaderboard/${QUIZ_ID}/${AUTH.uid}`
            ]
        );
        return jsonResponse(hasSavedScore ? leaderboardAfterSave : {});
      }

      if (
        method === "PATCH" &&
        url === `${DB_URL}/machinePrints/${QUIZ_ID}/machine-1.json?auth=${AUTH.idToken}`
      ) {
        return jsonResponse("uid-1");
      }

      if (
        method === "PUT" &&
        url === `${DB_URL}/machinePrints/${QUIZ_ID}/machine-1.json?auth=${AUTH.idToken}`
      ) {
        return jsonResponse("uid-1");
      }

      if (
        method === "PATCH" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`)
      ) {
        return jsonResponse({});
      }

      return undefined;
    });

    await startQuiz("Taylor");
    await waitFor(() => container.textContent.includes("Question 1 of 2"));

    await answerCurrentQuestionCorrectly();
    await clickButton("Submit Answer");
    await waitFor(() => container.textContent.includes("Correct!"));
    expect(container.textContent).toContain("You earned 100 points!");

    await clickButton("Next Question");
    await waitFor(() => container.textContent.includes("Question 2 of 2"));
    expect(container.textContent).toContain("Score: 100");

    await answerCurrentQuestionCorrectly();
    await clickButton("Submit Answer");
    await waitFor(() => container.textContent.includes("Correct!"));

    await clickButton("View Results");
    await waitFor(() => container.textContent.includes("Quiz Complete!"));

    expect(container.textContent).toContain("Taylor, your final score:");
    expect(container.textContent).toContain("200");
    expect(localStorage.getItem(`submitted:${QUIZ_ID}`)).toBe("1");

    const rootPatchCalls = global.fetch.mock.calls.filter(
      ([url, options]) =>
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        options?.method === "PATCH"
    );

    expect(rootPatchCalls).toHaveLength(2);

    const savePayload = JSON.parse(rootPatchCalls[1][1].body);
    expect(savePayload[`leaderboard/${QUIZ_ID}/${AUTH.uid}`]).toMatchObject({
      name: "Taylor",
      score: 200,
    });
    expect(savePayload[`attempts/${QUIZ_ID}/${AUTH.uid}`]).toMatchObject({
      status: "completed",
      totalScore: 200,
      currentQuestion: 1,
    });
    expect(container.textContent).toContain("Global Leaderboard");
  });

  it("shows the stale-lock message when the browser fingerprint lock points to a missing attempt", async () => {
    installFetchMock(({ url, method }) => {
      if (method === "GET" && url.includes(`/attemptFingerprints/${QUIZ_ID}/`)) {
        return jsonResponse("locked-uid");
      }
      if (method === "GET" && url.includes(`/attempts/${QUIZ_ID}/locked-uid.json?`)) {
        return jsonResponse(null);
      }
      return undefined;
    });

    await renderQuizGame();
    await waitFor(() =>
      global.fetch.mock.calls.some(([url]) =>
        String(url).includes(`/attemptFingerprints/${QUIZ_ID}/`)
      )
    );

    await waitFor(() =>
      container.textContent.includes("stale saved-attempt lock")
    );

    expect(container.textContent).toContain(
      "This browser has a stale saved-attempt lock for this quiz."
    );
    expect(getButton("Start Quiz").disabled).toBe(true);
  });

  it("degrades gracefully when fingerprint lock lookup is unavailable", async () => {
    installFetchMock(({ url, method }) => {
      if (method === "GET" && url.includes(`/attemptFingerprints/${QUIZ_ID}/`)) {
        return jsonResponse("permission denied", { ok: false, status: 403 });
      }
      return undefined;
    });

    await renderQuizGame();
    await waitFor(() =>
      global.fetch.mock.calls.some(([url]) =>
        String(url).includes(`/attemptFingerprints/${QUIZ_ID}/`)
      )
    );
    await waitFor(() => Boolean(getButton("Start Quiz")));

    expect(container.textContent).not.toContain(
      "We couldn't verify quiz eligibility right now."
    );

    await changeName("Taylor");
    await waitFor(() => {
      const button = getButton("Start Quiz");
      return Boolean(button && !button.disabled);
    });

    await clickButton("Start Quiz");

    await waitFor(() =>
      container.textContent.includes("Question 1 of 2")
    );

    expect(console.warn).toHaveBeenCalledWith(
      "Fingerprint-locked attempt lookup failed; continuing without it.",
      expect.objectContaining({
        quizId: QUIZ_ID,
        status: 403,
      })
    );
  });

  it("rejects invalid player names before starting", async () => {
    installFetchMock();

    await renderQuizGame();
    await waitFor(() => Boolean(getButton("Start Quiz")));

    await changeName("x");
    await waitForStartButtonEnabled();
    await clickButton("Start Quiz");

    expect(container.textContent).toContain(
      "Please enter a valid name (2–30 characters)."
    );
    expect(container.textContent).not.toContain("Question 1 of 2");

    const reservationCall = global.fetch.mock.calls.find(
      ([url, options]) =>
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        options?.method === "PATCH"
    );
    expect(reservationCall).toBeUndefined();
  });

  it("blocks names that already exist on the leaderboard after normalization", async () => {
    installFetchMock(({ url, method }) => {
      if (method === "GET" && url.includes(`/leaderboard/${QUIZ_ID}.json?`)) {
        return jsonResponse({
          existing: {
            name: "Taylor",
            score: 320,
            timestamp: NOW,
          },
        });
      }
      return undefined;
    });

    await renderQuizGame();
    await waitFor(() => Boolean(getButton("Start Quiz")));

    await changeName("  Taylor  ");
    await waitForStartButtonEnabled();
    await clickButton("Start Quiz");

    expect(container.textContent).toContain(
      "That display name is already on the leaderboard. Please make it unique"
    );
    expect(container.textContent).not.toContain("Question 1 of 2");
  });

  it("blocks names that conflict with the server-side normalized name index", async () => {
    installFetchMock(({ url, method }) => {
      if (method === "GET" && url.includes(`/nameIndex/${QUIZ_ID}/taylor.json?`)) {
        return jsonResponse("another-uid");
      }
      return undefined;
    });

    await startQuiz("Taylor");

    expect(container.textContent).toContain(
      "That display name conflicts with an existing leaderboard entry after name normalization."
    );
    expect(container.textContent).not.toContain("Question 1 of 2");

    const reservationCall = global.fetch.mock.calls.find(
      ([url, options]) =>
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        options?.method === "PATCH"
    );
    expect(reservationCall).toBeUndefined();
  });

  it("prefers the most recent server snapshot over a stale local attempt and clears the local copy", async () => {
    localStorage.setItem(
      `quizAttempt:${QUIZ_ID}`,
      JSON.stringify(
        buildLocalAttempt({
          totalScore: 10,
          currentQuestion: 0,
          updatedAt: NOW - 10_000,
        })
      )
    );

    installFetchMock(({ url, method }) => {
      if (
        method === "GET" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?`)
      ) {
        return jsonResponse(
          buildServerAttempt({
            totalScore: 77,
            currentQuestion: 1,
            updatedAt: NOW - 1_000,
          })
        );
      }
      return undefined;
    });

    await renderQuizGame();

    await waitFor(() =>
      container.textContent.includes("Your in-progress quiz was restored from the server.")
    );

    const storedAttempt = JSON.parse(
      localStorage.getItem(`quizAttempt:${QUIZ_ID}`)
    );

    expect(container.textContent).toContain("Question 2 of 2");
    expect(container.textContent).toContain("Score: 77");
    expect(storedAttempt).toMatchObject({
      currentQuestion: 1,
      totalScore: 77,
    });
    expect(console.warn).toHaveBeenCalledWith(
      "Multiple attempt snapshots found; restoring the most recent one.",
      expect.objectContaining({
        quizId: QUIZ_ID,
        sources: expect.arrayContaining(["local", "server-own"]),
      })
    );
  });

  it("restores an existing server attempt when secure attempt reservation fails", async () => {
    const restoredAttempt = buildServerAttempt({
      totalScore: 58,
      currentQuestion: 1,
      updatedAt: NOW - 500,
    });

    installFetchMock(({ url, method, options }) => {
      if (
        method === "PATCH" &&
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        JSON.parse(options.body || "{}")[`attempts/${QUIZ_ID}/${AUTH.uid}`]
      ) {
        return jsonResponse("write failed", { ok: false, status: 409 });
      }

      if (
        method === "GET" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?`)
      ) {
        const reservationFailed = global.fetch.mock.calls.some(
          ([calledUrl, calledOptions]) =>
            calledUrl === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
            calledOptions?.method === "PATCH" &&
            JSON.parse(calledOptions.body || "{}")[`attempts/${QUIZ_ID}/${AUTH.uid}`]
        );
        return jsonResponse(reservationFailed ? restoredAttempt : null);
      }

      return undefined;
    });

    await startQuiz("Taylor");

    await waitFor(() =>
      container.textContent.includes("Your in-progress quiz was restored from the server.")
    );

    expect(container.textContent).toContain("Question 2 of 2");
    expect(container.textContent).toContain("Score: 58");
  });

  it("falls back to a local-only start when server-side attempt rules are unavailable", async () => {
    installFetchMock(({ url, method, options }) => {
      if (
        method === "PATCH" &&
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        JSON.parse(options.body || "{}")[`attempts/${QUIZ_ID}/${AUTH.uid}`]
      ) {
        return jsonResponse("permission denied", { ok: false, status: 403 });
      }

      if (
        method === "GET" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?`)
      ) {
        const reservationFailed = global.fetch.mock.calls.some(
          ([calledUrl, calledOptions]) =>
            calledUrl === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
            calledOptions?.method === "PATCH" &&
            JSON.parse(calledOptions.body || "{}")[`attempts/${QUIZ_ID}/${AUTH.uid}`]
        );
        return reservationFailed
          ? jsonResponse("forbidden", { ok: false, status: 403 })
          : jsonResponse(null);
      }

      return undefined;
    });

    await startQuiz("Taylor");

    await waitFor(() => container.textContent.includes("Question 1 of 2"));

    expect(container.textContent).not.toContain(
      "Your in-progress quiz was restored from the server."
    );
    expect(console.warn).toHaveBeenCalledWith(
      "Server-side attempt rules are not available yet; falling back to local resume only."
    );
    expect(localStorage.getItem(`quizAttempt:${QUIZ_ID}`)).toBeTruthy();
  });

  it("falls back to a direct leaderboard write when indexed score submission is forbidden", async () => {
    const leaderboardAfterSave = {
      [AUTH.uid]: {
        name: "Taylor",
        score: 200,
        timestamp: NOW,
        fp: "fp-1",
      },
    };

    installFetchMock(({ url, method, options }) => {
      if (
        method === "PATCH" &&
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        JSON.parse(options.body || "{}")[`leaderboard/${QUIZ_ID}/${AUTH.uid}`]
      ) {
        return jsonResponse("forbidden", { ok: false, status: 403 });
      }

      if (
        method === "PUT" &&
        url === `${DB_URL}/leaderboard/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`
      ) {
        return jsonResponse({});
      }

      if (
        method === "GET" &&
        url.includes(`/leaderboard/${QUIZ_ID}.json?`)
      ) {
        const usedFallbackPut = global.fetch.mock.calls.some(
          ([calledUrl, calledOptions]) =>
            calledUrl ===
              `${DB_URL}/leaderboard/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}` &&
            calledOptions?.method === "PUT"
        );
        return jsonResponse(usedFallbackPut ? leaderboardAfterSave : {});
      }

      if (
        method === "PATCH" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`)
      ) {
        return jsonResponse({});
      }

      if (
        method === "PUT" &&
        url === `${DB_URL}/machinePrints/${QUIZ_ID}/machine-1.json?auth=${AUTH.idToken}`
      ) {
        return jsonResponse("uid-1");
      }

      return undefined;
    });

    await completeQuizPerfectly("Taylor");
    await clickButton("View Results");

    await waitFor(() => container.textContent.includes("Quiz Complete!"));

    const fallbackWrite = global.fetch.mock.calls.find(
      ([url, options]) =>
        url === `${DB_URL}/leaderboard/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}` &&
        options?.method === "PUT"
    );

    expect(fallbackWrite).toBeDefined();
    expect(JSON.parse(fallbackWrite[1].body)).toMatchObject({
      name: "Taylor",
      score: 200,
    });
    expect(container.textContent).toContain("Taylor, your final score:");
    expect(container.textContent).toContain("200");
  });

  it("automatically retries one transient score save failure before completing", async () => {
    const leaderboardAfterSave = {
      [AUTH.uid]: {
        name: "Taylor",
        score: 200,
        timestamp: NOW,
        fp: "fp-1",
      },
    };
    let saveAttempts = 0;

    installFetchMock(({ url, method, options }) => {
      if (
        method === "PATCH" &&
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        JSON.parse(options.body || "{}")[`leaderboard/${QUIZ_ID}/${AUTH.uid}`]
      ) {
        saveAttempts += 1;
        return saveAttempts === 1
          ? jsonResponse("server exploded", { ok: false, status: 500 })
          : jsonResponse({});
      }

      if (method === "GET" && url.includes(`/fingerprints/${QUIZ_ID}/`)) {
        return jsonResponse(null);
      }

      if (
        method === "GET" &&
        url.includes(`/leaderboard/${QUIZ_ID}.json?`)
      ) {
        return jsonResponse(saveAttempts >= 2 ? leaderboardAfterSave : {});
      }

      if (
        method === "PATCH" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`)
      ) {
        return jsonResponse({});
      }

      if (
        method === "PUT" &&
        url === `${DB_URL}/machinePrints/${QUIZ_ID}/machine-1.json?auth=${AUTH.idToken}`
      ) {
        return jsonResponse("uid-1");
      }

      return undefined;
    });

    await completeQuizPerfectly("Taylor");
    await clickButton("View Results");

    await waitFor(() => container.textContent.includes("Quiz Complete!"));

    expect(saveAttempts).toBe(2);
    expect(container.textContent).toContain("Taylor, your final score:");
    expect(container.textContent).not.toContain("Try Saving Again");
  });

  it("surfaces auth-specific save failures when both save writes are unauthorized", async () => {
    installFetchMock(({ url, method, options }) => {
      if (
        method === "PATCH" &&
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        JSON.parse(options.body || "{}")[`leaderboard/${QUIZ_ID}/${AUTH.uid}`]
      ) {
        return jsonResponse("unauthorized", { ok: false, status: 401 });
      }

      if (
        method === "PUT" &&
        url === `${DB_URL}/leaderboard/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`
      ) {
        return jsonResponse("unauthorized", { ok: false, status: 401 });
      }

      if (method === "GET" && url.includes(`/fingerprints/${QUIZ_ID}/`)) {
        return jsonResponse(null);
      }

      if (
        method === "PATCH" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`)
      ) {
        return jsonResponse({});
      }

      return undefined;
    });

    await completeQuizPerfectly("Taylor");
    await clickButton("View Results");

    await waitFor(() =>
      container.textContent.includes("We couldn't verify your session while saving your score.")
    );

    expect(container.textContent).toContain("Try Saving Again");
    expect(container.textContent).not.toContain("Quiz Complete!");
  });

  it("surfaces permissions-specific save failures when both save writes are forbidden", async () => {
    installFetchMock(({ url, method, options }) => {
      if (
        method === "PATCH" &&
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        JSON.parse(options.body || "{}")[`leaderboard/${QUIZ_ID}/${AUTH.uid}`]
      ) {
        return jsonResponse("forbidden", { ok: false, status: 403 });
      }

      if (
        method === "PUT" &&
        url === `${DB_URL}/leaderboard/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`
      ) {
        return jsonResponse("forbidden", { ok: false, status: 403 });
      }

      if (method === "GET" && url.includes(`/fingerprints/${QUIZ_ID}/`)) {
        return jsonResponse(null);
      }

      if (
        method === "PATCH" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`)
      ) {
        return jsonResponse({});
      }

      return undefined;
    });

    await completeQuizPerfectly("Taylor");
    await clickButton("View Results");

    await waitFor(() =>
      container.textContent.includes(
        "We couldn't save your score because this entry did not pass the quiz eligibility checks."
      )
    );

    expect(container.textContent).toContain("Try Saving Again");
    expect(container.textContent).not.toContain("Quiz Complete!");
  });

  it("keeps the final question recoverable when automatic retry still cannot save the score", async () => {
    const leaderboardAfterSave = {
      [AUTH.uid]: {
        name: "Taylor",
        score: 200,
        timestamp: NOW,
        fp: "fp-1",
      },
    };
    let saveAttempts = 0;

    installFetchMock(({ url, method, options }) => {
      if (
        method === "PATCH" &&
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        JSON.parse(options.body || "{}")[`leaderboard/${QUIZ_ID}/${AUTH.uid}`]
      ) {
        saveAttempts += 1;
        return saveAttempts <= 2
          ? jsonResponse("server exploded", { ok: false, status: 500 })
          : jsonResponse({});
      }

      if (method === "GET" && url.includes(`/fingerprints/${QUIZ_ID}/`)) {
        return jsonResponse(null);
      }

      if (
        method === "GET" &&
        url.includes(`/leaderboard/${QUIZ_ID}.json?`)
      ) {
        return jsonResponse(saveAttempts >= 2 ? leaderboardAfterSave : {});
      }

      if (
        method === "PATCH" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`)
      ) {
        return jsonResponse({});
      }

      if (
        method === "PUT" &&
        url === `${DB_URL}/machinePrints/${QUIZ_ID}/machine-1.json?auth=${AUTH.idToken}`
      ) {
        return jsonResponse("uid-1");
      }

      return undefined;
    });

    await completeQuizPerfectly("Taylor");
    await clickButton("View Results");

    await waitFor(() =>
      container.textContent.includes("Could not save score. Please try again.")
    );

    expect(saveAttempts).toBe(2);
    expect(container.textContent).toContain("Question 2 of 2");
    expect(container.textContent).toContain("Try Saving Again");
    expect(container.textContent).not.toContain("Quiz Complete!");
    expect(localStorage.getItem(`quizAttempt:${QUIZ_ID}`)).toBeTruthy();

    await clickButton("Try Saving Again");
    await waitFor(() => container.textContent.includes("Quiz Complete!"));

    expect(container.textContent).toContain("Taylor, your final score:");
    expect(container.textContent).toContain("200");
    expect(saveAttempts).toBe(3);
  });

  it("surfaces already-submitted save failures and stores the submitted flag", async () => {
    installFetchMock(({ url, method, options }) => {
      if (
        method === "PATCH" &&
        url === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
        JSON.parse(options.body || "{}")[`leaderboard/${QUIZ_ID}/${AUTH.uid}`]
      ) {
        return jsonResponse("server exploded", { ok: false, status: 500 });
      }

      if (
        method === "GET" &&
        url.includes(`/leaderboard/${QUIZ_ID}/${AUTH.uid}.json?`)
      ) {
        const attemptedSave = global.fetch.mock.calls.some(
          ([calledUrl, calledOptions]) =>
            calledUrl === `${DB_URL}/.json?auth=${AUTH.idToken}` &&
            calledOptions?.method === "PATCH" &&
            JSON.parse(calledOptions.body || "{}")[`leaderboard/${QUIZ_ID}/${AUTH.uid}`]
        );

        return jsonResponse(
          attemptedSave
            ? {
                name: "Taylor",
                score: 200,
                timestamp: NOW,
              }
            : null
        );
      }

      if (method === "GET" && url.includes(`/fingerprints/${QUIZ_ID}/`)) {
        return jsonResponse(null);
      }

      if (
        method === "PATCH" &&
        url.includes(`/attempts/${QUIZ_ID}/${AUTH.uid}.json?auth=${AUTH.idToken}`)
      ) {
        return jsonResponse({});
      }

      return undefined;
    });

    await completeQuizPerfectly("Taylor");
    await clickButton("View Results");

    await waitFor(() =>
      container.textContent.includes("You've already played this quiz")
    );

    expect(localStorage.getItem(`submitted:${QUIZ_ID}`)).toBe("1");
    expect(container.textContent).toContain("Global Leaderboard");
  });
});
