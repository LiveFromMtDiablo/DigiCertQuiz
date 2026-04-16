import React from "react";
import { CheckCircle, Clock, XCircle } from "lucide-react";
import { QUIZ_SCREEN_BACKGROUND_STYLE } from "../../constants/ui";

export default function QuestionScreen({
  activeQuestions,
  currentQuestion,
  timeLeft,
  totalScore,
  resumeNotice,
  error,
  selectedAnswer,
  showFeedback,
  isCorrect,
  onSelectAnswer,
  onSubmitAnswer,
  onNextQuestion,
}) {
  const question = activeQuestions[currentQuestion];
  const hasNextQuestion = currentQuestion < activeQuestions.length - 1;
  const questionHeadingId = `quiz-question-${currentQuestion}`;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={QUIZ_SCREEN_BACKGROUND_STYLE}
    >
      <div className="bg-white rounded-lg shadow-2xl p-8 max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2" aria-live="polite" aria-atomic="true">
            <Clock className="w-6 h-6 text-blue-600" aria-hidden="true" />
            <span className="text-xl font-semibold text-gray-800">Time Left: {timeLeft}s</span>
          </div>
          <span className="text-xl font-semibold text-gray-800">Score: {totalScore}</span>
        </div>

        {resumeNotice && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            {resumeNotice}
          </div>
        )}

        <div className="mb-6">
          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-red-800">
              {error}
            </div>
          )}
          <div className="text-sm text-gray-600 mb-2">
            Question {currentQuestion + 1} of {activeQuestions.length}
          </div>
          <h2 id={questionHeadingId} className="text-2xl font-bold text-gray-800">
            {question.question}
          </h2>
        </div>

        <div
          className="grid grid-cols-1 gap-4 mb-6"
          role="radiogroup"
          aria-labelledby={questionHeadingId}
        >
          {question.options.map((option, index) => (
            <button
              key={index}
              type="button"
              onClick={() => !showFeedback && onSelectAnswer(index)}
              disabled={showFeedback}
              role="radio"
              aria-checked={selectedAnswer === index}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedAnswer === index ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-blue-300"
              } ${showFeedback ? "cursor-not-allowed" : "cursor-pointer"} ${
                showFeedback && index === question.correctAnswer
                  ? "bg-green-50 border-green-500"
                  : ""
              } ${
                showFeedback && selectedAnswer === index && !isCorrect
                  ? "bg-red-50 border-red-500"
                  : ""
              }`}
            >
              <div className="flex items-center justify-center gap-3 text-center">
                <span className="text-gray-800 text-center">{option}</span>
                {showFeedback && index === question.correctAnswer && (
                  <CheckCircle className="w-8 h-8 text-green-600 shrink-0" aria-hidden="true" />
                )}
                {showFeedback && selectedAnswer === index && !isCorrect && (
                  <XCircle className="w-8 h-8 text-red-600 shrink-0" aria-hidden="true" />
                )}
              </div>
            </button>
          ))}
        </div>

        {showFeedback && (
          <div
            role="status"
            aria-live="polite"
            className={`p-4 rounded-lg mb-6 ${
              isCorrect ? "bg-green-50 border-2 border-green-200" : "bg-red-50 border-2 border-red-200"
            }`}
          >
            <div className="flex items-center space-x-2 mb-2">
              {isCorrect ? (
                <CheckCircle className="w-6 h-6 text-green-600" aria-hidden="true" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" aria-hidden="true" />
              )}
              <span className={`font-semibold ${isCorrect ? "text-green-700" : "text-red-700"}`}>
                {isCorrect ? "Correct!" : "Incorrect"}
              </span>
            </div>
            {isCorrect ? (
              <p className="text-green-700">
                You earned <span className="font-bold">{timeLeft}</span> points!
              </p>
            ) : (
              <p className="text-red-700">
                The correct answer was:{" "}
                <span className="font-bold">{question.options[question.correctAnswer]}</span>
              </p>
            )}
          </div>
        )}

        {!showFeedback ? (
          <button
            type="button"
            onClick={onSubmitAnswer}
            disabled={selectedAnswer === null || timeLeft === 0}
            className="w-full bg-blue-600 text-white py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Submit Answer
          </button>
        ) : (
          <button
            type="button"
            onClick={onNextQuestion}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all"
          >
            {hasNextQuestion ? "Next Question" : error ? "Try Saving Again" : "View Results"}
          </button>
        )}
      </div>
    </div>
  );
}
