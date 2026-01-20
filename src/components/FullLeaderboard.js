import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { DB_URL } from "../services/firebaseConfig";
import { getValidAuth } from "../services/firebaseAuth";
import { currentQuizId, getQuiz } from "../quizzes";
import { Trophy } from "lucide-react";
import { sortLeaderboardEntries } from "../utils/leaderboardSort";

const SCREEN_BACKGROUND_STYLE = {
  backgroundImage:
    'url("/images/quiz_background2.png"), linear-gradient(to bottom right, #3b82f6, #9333ea)',
  backgroundRepeat: "no-repeat, no-repeat",
  backgroundAttachment: "fixed, fixed",
  backgroundPosition: "top left, center",
  backgroundSize: "auto, cover",
};

export default function FullLeaderboard() {
  const { quizId: paramQuizId } = useParams();
  const quizId = paramQuizId || currentQuizId;
  const quiz = getQuiz(quizId);

  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { idToken } = await getValidAuth();
      const url = `${DB_URL}/leaderboard/${quizId}.json?auth=${encodeURIComponent(
        idToken
      )}&t=${Date.now()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load leaderboard: ${res.status}`);
      const data = await res.json();
      const entries = data && typeof data === "object" ? Object.values(data) : [];
      const sorted = sortLeaderboardEntries(entries);
      setLeaderboard(sorted);
      setError("");
    } catch (e) {
      console.error(e);
      setError("Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    load();
  }, [load]);

  const top30 = useMemo(() => leaderboard.slice(0, 30), [leaderboard]);
  const columns = useMemo(() => [
    top30.slice(0, 10),
    top30.slice(10, 20),
    top30.slice(20, 30),
  ], [top30]);

  const TROPHY_COLORS = ["text-yellow-500", "text-gray-400", "text-orange-500"];

  const today = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date());
    } catch (_) {
      return new Date().toLocaleDateString();
    }
  }, []);

  // Strip the repetitive preface from quiz intros like: "This week's focus: ..."
  const sanitizedIntro = useMemo(() => {
    const raw = quiz?.intro || "";
    return raw.replace(/^\s*This\s+week['’]s\s+focus:\s*/i, "").trim();
  }, [quiz]);

  return (
    <div className="min-h-screen overflow-hidden p-6" style={SCREEN_BACKGROUND_STYLE}>
      <div className="mx-auto w-full max-w-6xl bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src="/images/digicert-blue-logo-large.jpg"
              alt="DigiCert"
              className="h-10 w-auto object-contain"
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate" style={{ color: "#0e75ba" }}>
                {quiz?.title || "Quiz Leaderboard"}
              </h1>
              <p className="text-gray-600 text-sm">
                Last refreshed: {today}
                {sanitizedIntro ? (
                  <>
                    {" "}• {sanitizedIntro}
                  </>
                ) : null}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-800">Top 30 — Global Leaderboard</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded bg-red-100 border border-red-300 text-red-800">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-center text-gray-600">Loading leaderboard…</p>
        ) : top30.length === 0 ? (
          <p className="text-center text-gray-600">No scores yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-x-8">
            {columns.map((col, colIdx) => (
              <div key={colIdx} className="divide-y divide-gray-100">
                {col.map((entry, rowIdx) => {
                  const rank = colIdx * 10 + rowIdx + 1;
                  const accent =
                    rank === 1
                      ? "text-yellow-500"
                      : rank === 2
                      ? "text-gray-400"
                      : rank === 3
                      ? "text-orange-500"
                      : "text-gray-500";
                  return (
                    <div
                      key={`${entry.name}-${rank}`}
                      className="flex items-center justify-between h-9 px-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-8 text-right font-semibold ${accent}`}>{rank}.</span>
                        <span className="truncate font-medium text-gray-800">
                          {entry.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {rank <= 3 ? (
                          <Trophy
                            className={`w-5 h-5 ${TROPHY_COLORS[rank - 1]}`}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="font-bold text-blue-600">{entry.score}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
