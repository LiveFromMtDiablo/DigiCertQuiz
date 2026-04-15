import { DB_URL } from "./firebaseConfig";
import { sortLeaderboardEntries } from "../utils/leaderboardSort";
import {
  writeIndexedScoreSubmission,
  writeMachinePrintObservation as writeMachinePrintObservationRequest,
} from "../utils/quizSubmission";

function buildDbUrl(path, idToken, dbUrl = DB_URL) {
  return `${dbUrl}/${path}.json?auth=${encodeURIComponent(idToken)}&t=${Date.now()}`;
}

export async function readProtectedData({
  path,
  idToken,
  dbUrl = DB_URL,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(buildDbUrl(path, idToken, dbUrl), {
    cache: "no-store",
  });

  if (!response.ok) {
    const error = new Error(`Failed to read ${path}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export async function fetchQuizLeaderboard({
  quizId,
  idToken,
  dbUrl = DB_URL,
  fetchImpl = fetch,
  sortEntries = sortLeaderboardEntries,
}) {
  const response = await fetchImpl(buildDbUrl(`leaderboard/${quizId}`, idToken, dbUrl), {
    cache: "no-store",
  });

  if (!response.ok) {
    const error = new Error(`Failed to load leaderboard: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const entries = data && typeof data === "object" ? Object.values(data) : [];
  return sortEntries(entries);
}

export async function fetchAttemptByUid({
  quizId,
  uid,
  idToken,
  dbUrl = DB_URL,
  fetchImpl = fetch,
}) {
  if (!uid) {
    return { res: null, data: null, uid: null };
  }

  const res = await fetchImpl(buildDbUrl(`attempts/${quizId}/${uid}`, idToken, dbUrl), {
    cache: "no-store",
  });
  if (!res.ok) return { res, data: null, uid };
  const data = await res.json();
  return { res, data, uid };
}

export async function fetchFingerprintLockedAttempt({
  quizId,
  fp,
  idToken,
  dbUrl = DB_URL,
  fetchImpl = fetch,
  readProtectedDataImpl = readProtectedData,
  fetchAttemptByUidImpl = fetchAttemptByUid,
}) {
  if (!fp) {
    return { ownerUid: null, attemptResult: null, lookupStatus: "skipped" };
  }

  try {
    const ownerUid = await readProtectedDataImpl({
      path: `attemptFingerprints/${quizId}/${fp}`,
      idToken,
      dbUrl,
      fetchImpl,
    });
    if (!ownerUid) {
      return { ownerUid: null, attemptResult: null, lookupStatus: "ok" };
    }

    const attemptResult = await fetchAttemptByUidImpl({
      quizId,
      uid: ownerUid,
      idToken,
      dbUrl,
      fetchImpl,
    });
    return { ownerUid, attemptResult, lookupStatus: "ok" };
  } catch (error) {
    return {
      ownerUid: null,
      attemptResult: null,
      lookupStatus: "unavailable",
      error,
    };
  }
}

export async function createServerAttempt({
  quizId,
  uid,
  idToken,
  fp,
  attemptRecord,
  dbUrl = DB_URL,
  fetchImpl = fetch,
}) {
  const updates = {
    [`attempts/${quizId}/${uid}`]: attemptRecord,
    [`attemptFingerprints/${quizId}/${fp}`]: uid,
  };

  const response = await fetchImpl(`${dbUrl}/.json?auth=${encodeURIComponent(idToken)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });

  return { response, updates };
}

export async function syncServerAttempt({
  quizId,
  uid,
  idToken,
  snapshot,
  dbUrl = DB_URL,
  fetchImpl = fetch,
}) {
  return fetchImpl(`${dbUrl}/attempts/${quizId}/${uid}.json?auth=${encodeURIComponent(idToken)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  });
}

export async function submitIndexedScore({
  idToken,
  payload,
  dbUrl = DB_URL,
  fetchImpl = fetch,
}) {
  return writeIndexedScoreSubmission({
    dbUrl,
    idToken,
    payload,
    fetchImpl,
  });
}

export async function submitLegacyLeaderboardScore({
  quizId,
  uid,
  idToken,
  entry,
  dbUrl = DB_URL,
  fetchImpl = fetch,
}) {
  return fetchImpl(`${dbUrl}/leaderboard/${quizId}/${uid}.json?auth=${encodeURIComponent(idToken)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  });
}

export async function submitMachinePrintObservation({
  quizId,
  uid,
  idToken,
  fpMachine,
  dbUrl = DB_URL,
  fetchImpl = fetch,
}) {
  return writeMachinePrintObservationRequest({
    dbUrl,
    idToken,
    quizId,
    uid,
    fpMachine,
    fetchImpl,
  });
}
