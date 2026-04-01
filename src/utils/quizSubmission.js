export function clampQuizScore(score, maxPossible) {
  return Math.max(0, Math.min(score, maxPossible));
}

export function buildIndexedScorePayload({
  quizId,
  uid,
  name,
  nameSlug,
  score,
  fp,
}) {
  return {
    [`leaderboard/${quizId}/${uid}`]: {
      name,
      nameSlug,
      score,
      timestamp: { ".sv": "timestamp" },
      fp,
    },
    [`nameIndex/${quizId}/${nameSlug}`]: uid,
    [`fingerprints/${quizId}/${fp}`]: uid,
  };
}

export function buildMachinePrintPath({ quizId, fpMachine }) {
  return `machinePrints/${quizId}/${fpMachine}`;
}

export async function writeIndexedScoreSubmission({
  dbUrl,
  idToken,
  payload,
  fetchImpl = fetch,
}) {
  return fetchImpl(`${dbUrl}/.json?auth=${encodeURIComponent(idToken)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function writeMachinePrintObservation({
  dbUrl,
  idToken,
  quizId,
  uid,
  fpMachine,
  fetchImpl = fetch,
}) {
  return fetchImpl(
    `${dbUrl}/${buildMachinePrintPath({ quizId, fpMachine })}.json?auth=${encodeURIComponent(
      idToken
    )}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uid),
    }
  );
}
