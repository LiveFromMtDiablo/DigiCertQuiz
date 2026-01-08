const fs = require("fs");
const path = require("path");

const { quizzes, currentQuizId } = require("./index");

const QUIZ_DIR = __dirname;

function loadQuizModule(fileName) {
  const modulePath = path.join(QUIZ_DIR, fileName);
  const moduleExport = require(modulePath);
  return moduleExport.default ?? moduleExport;
}

describe("Quiz registry consistency", () => {
  const quizFiles = fs
    .readdirSync(QUIZ_DIR)
    .filter((file) => /^week-\d+-.*\.js$/i.test(file));

  it("includes every quiz module in the registry", () => {
    const registeredIds = new Set(Object.keys(quizzes));

    quizFiles.forEach((file) => {
      const quiz = loadQuizModule(file);
      expect(typeof quiz.id).toBe("string");

      expect(registeredIds.has(quiz.id)).toBe(
        true,
        `Quiz id "${quiz.id}" from file ${file} is not exported in quizzes/index.js`
      );
    });
  });

  it("does not register unknown quizzes", () => {
    const fileIds = new Set(
      quizFiles.map((file) => loadQuizModule(file).id)
    );

    Object.keys(quizzes).forEach((id) => {
      expect(fileIds.has(id)).toBe(
        true,
        `Quiz id "${id}" is exported in quizzes/index.js but no matching module file exists`
      );
    });
  });

  it("ensures each quiz defines required fields", () => {
    Object.values(quizzes).forEach((quiz) => {
      expect(typeof quiz.id).toBe("string");
      expect(quiz.id.length).toBeGreaterThan(0);

      expect(typeof quiz.title).toBe("string");
      expect(quiz.title.length).toBeGreaterThan(0);

      expect(typeof quiz.maxTime).toBe("number");
      expect(quiz.maxTime).toBeGreaterThan(0);

      expect(Array.isArray(quiz.questions)).toBe(true);
      expect(quiz.questions.length).toBeGreaterThan(0);

      quiz.questions.forEach((question, index) => {
        expect(typeof question.question).toBe("string");
        expect(question.question.length).toBeGreaterThan(0);

        expect(Array.isArray(question.options)).toBe(true);
        expect(question.options.length).toBeGreaterThanOrEqual(4);
        expect(question.options.length).toBeLessThanOrEqual(6);

        question.options.forEach((option) => {
          expect(typeof option).toBe("string");
          expect(option.length).toBeGreaterThan(0);
        });

        expect(typeof question.correctAnswer).toBe("number");
        expect(question.correctAnswer).toBeGreaterThanOrEqual(0);
        expect(question.correctAnswer).toBeLessThan(question.options.length);
      });
    });
  });

  it("tracks the current quiz id within the registry", () => {
    expect(currentQuizId).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(quizzes, currentQuizId)).toBe(
      true,
      `currentQuizId "${currentQuizId}" must map to a registered quiz`
    );
  });
});
