import React from "react";
import { QUIZ_SCREEN_BACKGROUND_STYLE } from "../../constants/ui";

export default function LeaderboardScreen({
  error,
  finalScoreValue,
  playerName,
  leaderboard,
  loading,
  onRefresh,
  onRestart,
  devFingerprintResetEnabled,
  devFingerprintSeedLabel,
  onResetDevFingerprint,
}) {
  const currentPlayerEntry =
    finalScoreValue != null && playerName
      ? leaderboard.find(
          (entry) => entry.name === playerName && entry.score === finalScoreValue
        )
      : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={QUIZ_SCREEN_BACKGROUND_STYLE}
    >
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
        {error && (
          <div className="mb-4 p-3 rounded bg-red-100 border border-red-300 text-red-800">
            {error}
          </div>
        )}
        <div className="text-center mb-8">
          <img
            src="/images/digicert-blue-logo-large.jpg"
            alt="DigiCert"
            className="h-20 mx-auto mb-4 object-contain"
          />
          {finalScoreValue != null && playerName && (
            <>
              <h1 className="text-4xl font-bold mb-4" style={{ color: "#0e75ba" }}>
                Quiz Complete!
              </h1>
              <p className="text-xl text-gray-600">
                {playerName}, your final score:{" "}
                <span className="font-bold text-blue-600">{finalScoreValue}</span>
              </p>
            </>
          )}
        </div>

        <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-lg p-6 mb-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold" style={{ color: "#0e75ba" }}>
              Global Leaderboard
            </h2>
            <div className="flex items-center">
              <button
                onClick={onRefresh}
                className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {loading ? (
              <p className="text-center text-gray-600">Loading leaderboard...</p>
            ) : leaderboard.length === 0 ? (
              <p className="text-center text-gray-600">Be the first to play!</p>
            ) : (
              leaderboard.slice(0, 25).map((entry, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-4 rounded-lg ${
                    entry.timestamp === currentPlayerEntry?.timestamp
                      ? "bg-blue-100 border-2 border-blue-500"
                      : "bg-white"
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <span
                      className={`text-2xl font-bold ${
                        index === 0
                          ? "text-yellow-500"
                          : index === 1
                            ? "text-gray-400"
                            : index === 2
                              ? "text-orange-600"
                              : "text-gray-500"
                      }`}
                    >
                      #{index + 1}
                    </span>
                    <span className="font-semibold text-gray-800">{entry.name}</span>
                  </div>
                  <span className="text-xl font-bold text-blue-600">{entry.score}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <button
          onClick={onRestart}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          Return to Start
        </button>
        {devFingerprintResetEnabled && (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <p className="mb-3 text-xs text-slate-600">
              Current dev seed:{" "}
              <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                {devFingerprintSeedLabel}
              </span>
            </p>
            <button
              onClick={onResetDevFingerprint}
              className="w-full rounded-lg border border-slate-400 bg-white py-3 font-semibold text-slate-800 transition-all hover:bg-slate-100"
            >
              Reset Dev Fingerprint
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
