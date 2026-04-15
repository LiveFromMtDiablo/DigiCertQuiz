import React from "react";
import { Trophy } from "lucide-react";
import {
  QUIZ_SCREEN_BACKGROUND_STYLE,
  QUIZ_TROPHY_COLORS,
} from "../../constants/ui";

export default function IntroScreen({
  title,
  intro,
  error,
  alreadySubmitted,
  eligibilityStatus,
  eligibilityCheckingMessage,
  devResetNotice,
  devFingerprintResetEnabled,
  devFingerprintSeedLabel,
  maxTime,
  leaderboard,
  playerName,
  isStartingAttempt,
  onPlayerNameChange,
  onStart,
  onViewLeaderboard,
  onResetDevFingerprint,
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={QUIZ_SCREEN_BACKGROUND_STYLE}
    >
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <img
            src="/images/digicert-blue-logo-large.jpg"
            alt="DigiCert"
            className="h-16 mx-auto mb-4 object-contain"
          />
          <h1 className="text-4xl font-bold mb-2" style={{ color: "#0e75ba" }}>
            {title}
          </h1>
          {intro ? <p className="text-gray-600">{intro}</p> : null}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {alreadySubmitted && (
          <div className="bg-yellow-50 border-2 border-yellow-200 text-yellow-800 px-4 py-3 rounded mb-4">
            You’ve already played this quiz. Thanks for participating! You can view the leaderboard below.
          </div>
        )}

        {eligibilityStatus === "checking" && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded mb-4">
            {eligibilityCheckingMessage}
          </div>
        )}

        {devResetNotice && devFingerprintResetEnabled && (
          <div className="bg-slate-50 border border-slate-300 text-slate-700 px-4 py-3 rounded mb-4">
            {devResetNotice}
          </div>
        )}

        <div className="bg-blue-50 rounded-lg p-6 mb-6 shadow-lg">
          <div className="md:flex md:items-center">
            <div className="md:flex-1 md:pr-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-3">How It Works:</h2>
              <ul className="space-y-2 text-gray-700">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>Each question starts with {maxTime} points</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>You lose 1 point per second, so answer quickly!</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-2">•</span>
                  <span>No replays, please! Only your first score counts ^_^</span>
                </li>
              </ul>
            </div>
            <div className="hidden lg:flex lg:pl-6 justify-end">
              <img
                src="/images/quiz_icon.png"
                alt="Quiz icon"
                className="w-24 h-24 object-contain"
              />
            </div>
          </div>
        </div>

        {leaderboard.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-4 mb-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">This Week's High Scores:</h3>
            <div className="space-y-1">
              {leaderboard.slice(0, 3).map((entry, index) => (
                <div
                  key={index}
                  className="grid grid-cols-3 items-center bg-white rounded-lg px-4 py-3 text-sm"
                  style={{ gridTemplateColumns: "1fr auto auto" }}
                >
                  <span className="text-blue-600 font-bold text-base md:text-lg">
                    {index + 1}. {entry.name}
                  </span>
                  <span className="font-semibold text-blue-600 text-base md:text-lg pr-4 md:pr-6">
                    {entry.score}
                  </span>
                  <Trophy
                    className={`w-9 h-9 ${QUIZ_TROPHY_COLORS[index] ?? "text-blue-400"} justify-self-center`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <input
            type="text"
            value={playerName}
            onChange={(event) => onPlayerNameChange(event.target.value)}
            placeholder="Enter your name to start"
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={alreadySubmitted}
          />
          <button
            onClick={onStart}
            disabled={
              !playerName.trim() ||
              alreadySubmitted ||
              eligibilityStatus !== "ready" ||
              isStartingAttempt
            }
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {eligibilityStatus === "checking"
              ? "Checking eligibility..."
              : isStartingAttempt
                ? "Starting securely..."
                : "Start Quiz"}
          </button>
          <button
            onClick={onViewLeaderboard}
            className="w-full border-2 border-blue-600 text-blue-700 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-all"
          >
            View the leaderboard top 25
          </button>
          {devFingerprintResetEnabled && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="mb-3">
                Local dev helper: rotate the browser fingerprint seed and clear cached anonymous auth plus saved attempt locks.
              </p>
              <p className="mb-3 text-xs text-slate-600">
                Current dev seed:{" "}
                <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                  {devFingerprintSeedLabel}
                </span>
              </p>
              <button
                onClick={onResetDevFingerprint}
                className="w-full rounded-lg border border-slate-400 bg-white px-4 py-3 font-semibold text-slate-800 transition-all hover:bg-slate-100"
              >
                Reset Dev Fingerprint
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
