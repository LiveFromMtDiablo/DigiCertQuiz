import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import IntroScreen from "./IntroScreen";

function renderIntroScreen(overrides = {}) {
  const props = {
    title: "Hardening Test Quiz",
    intro: "A tiny quiz for component testing.",
    error: "",
    alreadySubmitted: false,
    eligibilityStatus: "ready",
    eligibilityCheckingMessage: "Checking quiz eligibility...",
    devResetNotice: "",
    devFingerprintResetEnabled: false,
    devFingerprintSeedLabel: "seed-a",
    maxTime: 100,
    leaderboard: [],
    playerName: "",
    isStartingAttempt: false,
    onPlayerNameChange: () => {},
    onStart: () => {},
    onViewLeaderboard: () => {},
    onResetDevFingerprint: () => {},
    ...overrides,
  };

  return renderToStaticMarkup(<IntroScreen {...props} />);
}

describe("IntroScreen", () => {
  it("suppresses the duplicate already-played error when the dedicated notice is visible", () => {
    const markup = renderIntroScreen({
      alreadySubmitted: true,
      error:
        "You've already played this quiz. Thanks for participating! You can view the leaderboard below.",
    });

    expect((markup.match(/already played this quiz/gi) || []).length).toBe(1);
  });

  it("suppresses the duplicate eligibility-checking error when the checking banner is visible", () => {
    const markup = renderIntroScreen({
      error: "Checking quiz eligibility...",
      eligibilityStatus: "checking",
    });

    expect((markup.match(/checking quiz eligibility/gi) || []).length).toBe(1);
  });

  it("renders a proper label for the player name input", () => {
    const markup = renderIntroScreen();

    expect(markup).toContain('for="quiz-player-name"');
    expect(markup).toContain('id="quiz-player-name"');
    expect(markup).toContain("Display name");
  });
});
