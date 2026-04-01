import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { currentQuizId, getQuiz } from "./quizzes";

jest.mock("./components/QuizGame", () => (props) => (
  <div data-testid="quiz-game">
    <div>QuizGame Mock</div>
    <div data-quiz-id={props.quizId}>quizId:{props.quizId}</div>
    <div>title:{props.title}</div>
    <div>maxTime:{props.maxTime}</div>
    <div>questionCount:{props.questions.length}</div>
  </div>
));

jest.mock("./components/FullLeaderboard", () => () => (
  <div data-testid="full-leaderboard">Full Leaderboard Mock</div>
));

jest.mock("./components/CumulativeMergedLeaderboard", () => () => (
  <div data-testid="cumulative-leaderboard">Cumulative Leaderboard Mock</div>
));

let container;
let root;
let previousActEnvironment;

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
        <App />
      </MemoryRouter>
    );
  });
}

describe("App routing", () => {
  beforeAll(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
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
  });

  afterAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("redirects the root path to the current quiz", async () => {
    const quiz = getQuiz(currentQuizId);

    await renderAt("/");

    expect(container.textContent).toContain("QuizGame Mock");
    expect(container.textContent).toContain(`quizId:${quiz.id}`);
    expect(container.textContent).toContain(`title:${quiz.title}`);
    expect(container.textContent).toContain(`maxTime:${quiz.maxTime}`);
    expect(container.textContent).toContain(
      `questionCount:${quiz.questions.length}`
    );
  });

  it("renders the requested quiz route when the quiz exists", async () => {
    const quiz = getQuiz(currentQuizId);

    await renderAt(`/quiz/${currentQuizId}`);

    expect(container.textContent).toContain("QuizGame Mock");
    expect(container.textContent).toContain(`quizId:${quiz.id}`);
  });

  it("shows the quiz-not-found screen for an unknown quiz id", async () => {
    await renderAt("/quiz/not-a-real-quiz");

    expect(container.textContent).toContain("Quiz not found");
    expect(container.textContent).toContain(
      "The quiz you’re looking for doesn’t exist."
    );

    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe(`/quiz/${currentQuizId}`);
    expect(link.textContent).toContain("Go to current quiz");
  });

  it("renders the full leaderboard routes", async () => {
    await renderAt("/leaderboard/full");
    expect(container.textContent).toContain("Full Leaderboard Mock");

    await renderAt(`/leaderboard/full/${currentQuizId}`);
    expect(container.textContent).toContain("Full Leaderboard Mock");
  });

  it("renders the cumulative leaderboard route", async () => {
    await renderAt("/leaderboard/cumulative");

    expect(container.textContent).toContain("Cumulative Leaderboard Mock");
  });

  it("shows the not-found screen for unknown routes", async () => {
    await renderAt("/totally/unknown/path");

    expect(container.textContent).toContain("Page not found");

    const link = container.querySelector("a");
    expect(link).toBeTruthy();
    expect(link.getAttribute("href")).toBe(`/quiz/${currentQuizId}`);
  });
});
