import { useCallback } from "react";
import { getValidAuth } from "../services/firebaseAuth";
import {
  readProtectedData,
  submitIndexedScore,
  submitLegacyLeaderboardScore,
  submitMachinePrintObservation,
} from "../services/leaderboardApi";
import { toNameSlug, classifySaveFailure } from "../utils/quizEligibility";
import { clampQuizScore, buildIndexedScorePayload } from "../utils/quizSubmission";
import { buildAttemptRecord, ATTEMPT_STATUS_COMPLETED } from "../utils/quizAttemptState";
import { getDeviceFingerprint, getMachineFingerprint } from "../utils/deviceFingerprint";
import { MAX_TRANSIENT_SAVE_RETRIES, SAVE_RETRY_DELAY_MS } from "../constants/quiz";
import { logSilent } from "../utils/logging";

async function waitForTransientSaveRetry() {
  await new Promise((resolve) => setTimeout(resolve, SAVE_RETRY_DELAY_MS));
}

export function useLeaderboardSubmission({
  quizId,
  questions,
  maxTime,
  gameQuestions,
  timeLeft,
  selectedAnswer,
  isCorrect,
  attemptCreatedAt,
  loadLeaderboard,
  markQuizSubmitted,
  setError,
}) {
  return useCallback(
    async (name, score) => {
      let auth = null;
      let fp = null;
      const nameSlug = toNameSlug(name);

      function commitSaveFailure(failure) {
        if (failure.reason === "already_submitted") {
          markQuizSubmitted();
        }
        setError(failure.message);
      }

      async function classifySaveFailureState({
        responseStatus,
        responseBody = "",
        sourceError = null,
      }) {
        let existingSubmission = null;
        let nameIndexOwner = null;
        let fingerprintOwner = null;

        try {
          auth = auth || (await getValidAuth());
          fp = fp || (await getDeviceFingerprint({ salt: quizId }));
          [existingSubmission, nameIndexOwner, fingerprintOwner] = await Promise.all([
            readProtectedData({
              path: `leaderboard/${quizId}/${auth.uid}`,
              idToken: auth.idToken,
            }),
            readProtectedData({
              path: `nameIndex/${quizId}/${nameSlug}`,
              idToken: auth.idToken,
            }),
            readProtectedData({
              path: `fingerprints/${quizId}/${fp}`,
              idToken: auth.idToken,
            }),
          ]);
        } catch (classificationError) {
          console.error("Error classifying save failure:", classificationError);
        }

        const failure = classifySaveFailure({
          uid: auth?.uid,
          existingSubmission,
          nameIndexOwner,
          fingerprintOwner,
          responseStatus,
        });

        console.error("Save failed:", {
          quizId,
          responseStatus,
          responseBody,
          failure,
          existingSubmission: Boolean(existingSubmission),
          nameIndexOwner,
          fingerprintOwner,
          uid: auth?.uid,
          nameSlug,
          sourceError: sourceError?.message || null,
        });
        return failure;
      }

      async function attemptSave(retryCount = 0) {
        try {
          const activeQuestions = gameQuestions || questions;
          const maxPossible = maxTime * activeQuestions.length;
          const safeScore = clampQuizScore(score, maxPossible);

          auth = await getValidAuth();
          const { idToken, uid } = auth;
          fp = await getDeviceFingerprint({ salt: quizId });
          const fpMachine = await getMachineFingerprint({ salt: quizId });

          const updates = buildIndexedScorePayload({
            quizId,
            uid,
            name,
            nameSlug,
            score: safeScore,
            fp,
          });
          updates[`machinePrints/${quizId}/${fpMachine}`] = uid;

          if (gameQuestions) {
            updates[`attempts/${quizId}/${uid}`] = buildAttemptRecord({
              name,
              nameSlug,
              fp,
              fpMachine,
              currentQuestion: activeQuestions.length - 1,
              totalScore: safeScore,
              timeLeft,
              questionDeadlineAt: null,
              selectedAnswer,
              showFeedback: true,
              isCorrect,
              gameQuestions,
              createdAt: attemptCreatedAt || Date.now(),
              status: ATTEMPT_STATUS_COMPLETED,
              completedAt: Date.now(),
            });
            updates[`attemptFingerprints/${quizId}/${fp}`] = uid;
          }

          let response = await submitIndexedScore({
            idToken,
            payload: updates,
          });

          if (!response.ok && (response.status === 401 || response.status === 403)) {
            response = await submitLegacyLeaderboardScore({
              quizId,
              uid,
              idToken,
              entry: updates[`leaderboard/${quizId}/${uid}`],
            });
          }

          if (response.ok) {
            await loadLeaderboard();
            markQuizSubmitted();
            setError("");

            try {
              const machinePrintResponse = await submitMachinePrintObservation({
                idToken,
                quizId,
                uid,
                fpMachine,
              });
              if (!machinePrintResponse.ok) {
                console.warn("Machine print observation failed:", {
                  quizId,
                  uid,
                  status: machinePrintResponse.status,
                });
              }
            } catch (machinePrintError) {
              console.warn("Machine print observation failed:", {
                quizId,
                uid,
                error: machinePrintError?.message || String(machinePrintError),
              });
            }

            return { ok: true, failure: null };
          }

          let errText = "";
          try {
            errText = await response.text();
          } catch (error) {
            logSilent("quiz.save.readResponseBody", error, {
              quizId,
              responseStatus: response.status,
            });
          }

          const failure = await classifySaveFailureState({
            responseStatus: response.status,
            responseBody: errText,
          });
          if (failure.retryable && retryCount < MAX_TRANSIENT_SAVE_RETRIES) {
            console.warn("Transient score save failed; retrying once.", {
              quizId,
              responseStatus: response.status,
              retryCount,
            });
            await waitForTransientSaveRetry();
            return attemptSave(retryCount + 1);
          }

          commitSaveFailure(failure);
          return {
            ok: failure.reason === "already_submitted",
            failure,
          };
        } catch (err) {
          const failure = await classifySaveFailureState({
            responseStatus: err?.status || 0,
            sourceError: err,
          });
          if (failure.retryable && retryCount < MAX_TRANSIENT_SAVE_RETRIES) {
            console.warn("Transient score save failed; retrying once.", {
              quizId,
              responseStatus: err?.status || 0,
              retryCount,
              error: err?.message || String(err),
            });
            await waitForTransientSaveRetry();
            return attemptSave(retryCount + 1);
          }

          commitSaveFailure(failure);
          return {
            ok: failure.reason === "already_submitted",
            failure,
          };
        }
      }

      return attemptSave();
    },
    [
      attemptCreatedAt,
      gameQuestions,
      isCorrect,
      loadLeaderboard,
      markQuizSubmitted,
      maxTime,
      questions,
      quizId,
      selectedAnswer,
      setError,
      timeLeft,
    ]
  );
}
