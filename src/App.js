import React from "react";
import { Routes, Route, Navigate, useParams, Link } from "react-router-dom";
import QuizGame from "./components/QuizGame";
import FullLeaderboard from "./components/FullLeaderboard";
import CumulativeMergedLeaderboard from "./components/CumulativeMergedLeaderboard";
import { getQuiz, currentQuizId } from "./quizzes";

function QuizPage() {
  const { quizId } = useParams();
  const quiz = getQuiz(quizId);

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl p-8 max-w-xl w-full text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Quiz not found</h1>
          <p className="text-gray-600 mb-6">The quiz you’re looking for doesn’t exist.</p>
          <Link
            to={`/quiz/${currentQuizId}`}
            className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            Go to current quiz
          </Link>
        </div>
      </div>
    );
  }

  return (
    <QuizGame
      quizId={quiz.id}
      title={quiz.title}
      questions={quiz.questions}
      maxTime={quiz.maxTime}
      intro={quiz.intro}
    />
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-xl w-full text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Page not found</h1>
        <Link
          to={`/quiz/${currentQuizId}`}
          className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          Go to current quiz
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/quiz/${currentQuizId}`} replace />} />
      <Route path="/quiz/:quizId" element={<QuizPage />} />
      <Route path="/leaderboard/full" element={<FullLeaderboard />} />
      <Route path="/leaderboard/full/:quizId" element={<FullLeaderboard />} />
      <Route path="/leaderboard/cumulative" element={<CumulativeMergedLeaderboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
