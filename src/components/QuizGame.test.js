import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { webcrypto } from "crypto";
import { TextDecoder, TextEncoder } from "util";
import QuizGame from "./QuizGame";
import { getValidAuth } from "../services/firebaseAuth";
import { DB_URL } from "../services/firebaseConfig";

jest.mock("../services/firebaseAuth", () => ({
  getValidAuth: jest.fn(),
}));

const AUTH = {
  uid: "uid-1",
  idToken: "token-1",
};

const QUIZ_ID = "week-99-hardening-test";
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

    await renderQuizGame();
    await waitFor(() => Boolean(getButton("Start Quiz")));

    await changeName("Taylor");
    await waitFor(() => {
      const button = getButton("Start Quiz");
      return Boolean(button && !button.disabled);
    });

    await clickButton("Start Quiz");

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

  it("restores an in-progress local attempt after a refresh with time already deducted", async () => {
    installFetchMock();

    await renderQuizGame();
    await waitFor(() => Boolean(getButton("Start Quiz")));

    await changeName("Taylor");
    await waitFor(() => {
      const button = getButton("Start Quiz");
      return Boolean(button && !button.disabled);
    });

    await clickButton("Start Quiz");
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

    await renderQuizGame();
    await waitFor(() => Boolean(getButton("Start Quiz")));

    await changeName("Taylor");
    await waitFor(() => {
      const button = getButton("Start Quiz");
      return Boolean(button && !button.disabled);
    });

    await clickButton("Start Quiz");
    await waitFor(() => container.textContent.includes("Question 1 of 2"));

    await clickOption("Bravo");
    await clickButton("Submit Answer");
    await waitFor(() => container.textContent.includes("Correct!"));
    expect(container.textContent).toContain("You earned 100 points!");

    await clickButton("Next Question");
    await waitFor(() => container.textContent.includes("Question 2 of 2"));
    expect(container.textContent).toContain("Score: 100");

    await clickOption("Three");
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
});
