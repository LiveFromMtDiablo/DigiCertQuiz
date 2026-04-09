import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import FullLeaderboard from "./FullLeaderboard";
import { getValidAuth } from "../services/firebaseAuth";
import { getQuiz } from "../quizzes";
import { DB_URL } from "../services/firebaseConfig";

jest.mock("../services/firebaseAuth", () => ({
  getValidAuth: jest.fn(),
}));

jest.mock("../quizzes", () => ({
  currentQuizId: "week-current",
  getQuiz: jest.fn(),
}));

const AUTH = {
  idToken: "token-1",
};

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

let container;
let root;
let previousActEnvironment;

async function flushAsync(iterations = 6) {
  for (let index = 0; index < iterations; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function waitFor(check, iterations = 30) {
  for (let index = 0; index < iterations; index += 1) {
    await flushAsync();
    if (check()) return;
  }

  throw new Error(`Condition not met. Current DOM: ${container.textContent}`);
}

async function renderAt(route) {
  await act(async () => {
    root.render(
      <MemoryRouter
        initialEntries={[route]}
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          <Route path="/leaderboard/full" element={<FullLeaderboard />} />
          <Route path="/leaderboard/full/:quizId" element={<FullLeaderboard />} />
        </Routes>
      </MemoryRouter>
    );
  });
}

describe("FullLeaderboard", () => {
  beforeAll(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    getValidAuth.mockResolvedValue(AUTH);
    getQuiz.mockImplementation((quizId) => ({
      id: quizId,
      title: `Quiz ${quizId}`,
      intro: "This week's focus: hardened routing coverage",
    }));
    jest.spyOn(console, "error").mockImplementation(() => {});
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
    jest.restoreAllMocks();
    delete global.fetch;
  });

  afterAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("loads the requested quiz leaderboard and sanitizes the intro preface", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({
        third: { name: "Casey", score: 220, timestamp: 1 },
        first: { name: "Alex", score: 410, timestamp: 2 },
        second: { name: "Brooke", score: 315, timestamp: 3 },
      })
    );

    await renderAt("/leaderboard/full/week-42");

    await waitFor(() => container.textContent.includes("Quiz week-42"));

    expect(getQuiz).toHaveBeenCalledWith("week-42");
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        `${DB_URL}/leaderboard/week-42.json?auth=${AUTH.idToken}`
      ),
      { cache: "no-store" }
    );
    expect(container.textContent).toContain("hardened routing coverage");
    expect(container.textContent).not.toContain("This week's focus:");

    const fullText = container.textContent;
    expect(fullText.indexOf("Alex")).toBeLessThan(fullText.indexOf("Brooke"));
    expect(fullText.indexOf("Brooke")).toBeLessThan(fullText.indexOf("Casey"));
  });

  it("shows an error when the leaderboard request fails", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      jsonResponse({}, { ok: false, status: 500 })
    );

    await renderAt("/leaderboard/full");

    await waitFor(() =>
      container.textContent.includes("Failed to load leaderboard.")
    );

    expect(container.textContent).toContain("Failed to load leaderboard.");
    expect(console.error).toHaveBeenCalled();
  });
});
