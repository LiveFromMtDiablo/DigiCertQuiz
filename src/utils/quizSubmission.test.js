const {
  clampQuizScore,
  buildIndexedScorePayload,
  buildMachinePrintPath,
  writeIndexedScoreSubmission,
  writeMachinePrintObservation,
} = require("./quizSubmission");

describe("quizSubmission", () => {
  it("clamps scores to the valid quiz range", () => {
    expect(clampQuizScore(-5, 500)).toBe(0);
    expect(clampQuizScore(275, 500)).toBe(275);
    expect(clampQuizScore(999, 500)).toBe(500);
  });

  it("builds the indexed score payload without machine prints in the critical write path", () => {
    const payload = buildIndexedScorePayload({
      quizId: "week-21-cert-central-part-3",
      uid: "uid-123",
      name: "Valerie Ekegbo",
      nameSlug: "valerie-ekegbo",
      score: 360,
      fp: "fingerprint-123",
    });

    expect(payload).toEqual({
      "leaderboard/week-21-cert-central-part-3/uid-123": {
        name: "Valerie Ekegbo",
        nameSlug: "valerie-ekegbo",
        score: 360,
        timestamp: { ".sv": "timestamp" },
        fp: "fingerprint-123",
      },
      "nameIndex/week-21-cert-central-part-3/valerie-ekegbo": "uid-123",
      "fingerprints/week-21-cert-central-part-3/fingerprint-123": "uid-123",
    });
    expect(Object.keys(payload).some((key) => key.startsWith("machinePrints/"))).toBe(
      false
    );
  });

  it("writes the indexed payload as a single root PATCH", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const payload = {
      "leaderboard/week-21-cert-central-part-3/uid-123": { score: 360 },
    };

    await writeIndexedScoreSubmission({
      dbUrl: "https://example.firebaseio.com",
      idToken: "token-123",
      payload,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.firebaseio.com/.json?auth=token-123",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
  });

  it("writes machine prints separately as a best-effort observation", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 403 });

    await writeMachinePrintObservation({
      dbUrl: "https://example.firebaseio.com",
      idToken: "token-123",
      quizId: "week-21-cert-central-part-3",
      uid: "uid-123",
      fpMachine: "machine-fingerprint-123",
      fetchImpl,
    });

    expect(buildMachinePrintPath({
      quizId: "week-21-cert-central-part-3",
      fpMachine: "machine-fingerprint-123",
    })).toBe("machinePrints/week-21-cert-central-part-3/machine-fingerprint-123");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://example.firebaseio.com/machinePrints/week-21-cert-central-part-3/machine-fingerprint-123.json?auth=token-123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify("uid-123"),
      }
    );
  });
});
