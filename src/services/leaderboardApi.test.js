const {
  readProtectedData,
  fetchQuizLeaderboard,
  fetchAttemptByUid,
  fetchFingerprintLockedAttempt,
  createServerAttempt,
  syncServerAttempt,
  submitIndexedScore,
  submitLegacyLeaderboardScore,
  submitMachinePrintObservation,
} = require("./leaderboardApi");

const NOW = 1_710_000_000_000;

function jsonResponse(data, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => data,
  };
}

describe("leaderboardApi", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reads protected data and returns parsed JSON", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ owner: "uid-1" }));

    const data = await readProtectedData({
      path: "fingerprints/week-1/fp-1",
      idToken: "token-1",
      dbUrl: "https://example.firebaseio.com",
      fetchImpl,
    });

    expect(data).toEqual({ owner: "uid-1" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.firebaseio.com/fingerprints/week-1/fp-1.json?auth=token-1&t=1710000000000",
      { cache: "no-store" }
    );
  });

  it("returns sorted leaderboard entries from a Firebase object payload", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({
        a: { name: "Taylor", score: 120 },
        b: { name: "Chris", score: 180 },
      })
    );

    const sortEntries = jest.fn((entries) => [...entries].sort((a, b) => b.score - a.score));
    const entries = await fetchQuizLeaderboard({
      quizId: "week-1",
      idToken: "token-1",
      dbUrl: "https://example.firebaseio.com",
      fetchImpl,
      sortEntries,
    });

    expect(sortEntries).toHaveBeenCalledWith([
      { name: "Taylor", score: 120 },
      { name: "Chris", score: 180 },
    ]);
    expect(entries).toEqual([
      { name: "Chris", score: 180 },
      { name: "Taylor", score: 120 },
    ]);
  });

  it("returns an empty leaderboard array when Firebase returns null", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(null));

    const entries = await fetchQuizLeaderboard({
      quizId: "week-1",
      idToken: "token-1",
      dbUrl: "https://example.firebaseio.com",
      fetchImpl,
    });

    expect(entries).toEqual([]);
  });

  it("returns attempt metadata and data for a successful attempt lookup", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse({ status: "in_progress", totalScore: 75 })
    );

    const result = await fetchAttemptByUid({
      quizId: "week-1",
      uid: "uid-1",
      idToken: "token-1",
      dbUrl: "https://example.firebaseio.com",
      fetchImpl,
    });

    expect(result).toEqual({
      res: expect.objectContaining({ ok: true, status: 200 }),
      data: { status: "in_progress", totalScore: 75 },
      uid: "uid-1",
    });
  });

  it("returns lookupStatus ok with no owner when no fingerprint lock exists", async () => {
    const result = await fetchFingerprintLockedAttempt({
      quizId: "week-1",
      fp: "fp-1",
      idToken: "token-1",
      readProtectedDataImpl: jest.fn().mockResolvedValue(null),
      fetchAttemptByUidImpl: jest.fn(),
    });

    expect(result).toEqual({
      ownerUid: null,
      attemptResult: null,
      lookupStatus: "ok",
    });
  });

  it("returns the locked owner and attempt when a fingerprint lock exists", async () => {
    const fetchAttemptByUidImpl = jest.fn().mockResolvedValue({
      res: { ok: true, status: 200 },
      data: { status: "in_progress", totalScore: 64 },
      uid: "uid-locked",
    });

    const result = await fetchFingerprintLockedAttempt({
      quizId: "week-1",
      fp: "fp-1",
      idToken: "token-1",
      readProtectedDataImpl: jest.fn().mockResolvedValue("uid-locked"),
      fetchAttemptByUidImpl,
    });

    expect(fetchAttemptByUidImpl).toHaveBeenCalledWith(
      expect.objectContaining({
        quizId: "week-1",
        uid: "uid-locked",
        idToken: "token-1",
      })
    );
    expect(result).toEqual({
      ownerUid: "uid-locked",
      attemptResult: {
        res: { ok: true, status: 200 },
        data: { status: "in_progress", totalScore: 64 },
        uid: "uid-locked",
      },
      lookupStatus: "ok",
    });
  });

  it("returns lookupStatus unavailable when fingerprint lookup fails", async () => {
    const error = new Error("permission denied");
    error.status = 403;

    const result = await fetchFingerprintLockedAttempt({
      quizId: "week-1",
      fp: "fp-1",
      idToken: "token-1",
      readProtectedDataImpl: jest.fn().mockRejectedValue(error),
    });

    expect(result).toEqual({
      ownerUid: null,
      attemptResult: null,
      lookupStatus: "unavailable",
      error,
    });
  });

  it("writes both attempt and fingerprint reservation keys when creating a server attempt", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const attemptRecord = { status: "in_progress", totalScore: 0 };

    const result = await createServerAttempt({
      quizId: "week-1",
      uid: "uid-1",
      idToken: "token-1",
      fp: "fp-1",
      attemptRecord,
      dbUrl: "https://example.firebaseio.com",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.firebaseio.com/.json?auth=token-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "attempts/week-1/uid-1": attemptRecord,
          "attemptFingerprints/week-1/fp-1": "uid-1",
        }),
      }
    );
    expect(result.updates).toEqual({
      "attempts/week-1/uid-1": attemptRecord,
      "attemptFingerprints/week-1/fp-1": "uid-1",
    });
  });

  it("patches in-progress attempt snapshots through the attempt path", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const snapshot = { currentQuestion: 1, totalScore: 99 };

    await syncServerAttempt({
      quizId: "week-1",
      uid: "uid-1",
      idToken: "token-1",
      snapshot,
      dbUrl: "https://example.firebaseio.com",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.firebaseio.com/attempts/week-1/uid-1.json?auth=token-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      }
    );
  });

  it("submits indexed score payloads as a single root patch", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    const payload = {
      "leaderboard/week-1/uid-1": { name: "Taylor", score: 180 },
    };

    await submitIndexedScore({
      idToken: "token-1",
      payload,
      dbUrl: "https://example.firebaseio.com",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.firebaseio.com/.json?auth=token-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
  });

  it("falls back to a direct leaderboard write when needed", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    await submitLegacyLeaderboardScore({
      quizId: "week-1",
      uid: "uid-1",
      idToken: "token-1",
      entry: { name: "Taylor", score: 180 },
      dbUrl: "https://example.firebaseio.com",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.firebaseio.com/leaderboard/week-1/uid-1.json?auth=token-1",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Taylor", score: 180 }),
      }
    );
  });

  it("writes machine print observations through the shared submission helper", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200 });

    await submitMachinePrintObservation({
      quizId: "week-1",
      uid: "uid-1",
      idToken: "token-1",
      fpMachine: "machine-1",
      dbUrl: "https://example.firebaseio.com",
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.firebaseio.com/machinePrints/week-1/machine-1.json?auth=token-1",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("uid-1"),
      }
    );
  });
});
