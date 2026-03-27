const {
  normalizeNameForMatch,
  areNamesLikelySamePerson,
  classifySuspiciousPair,
  analyzeQuizIntegrity,
} = require("./quizAudit");

describe("quizAudit", () => {
  it("normalizes names for audit comparisons", () => {
    expect(normalizeNameForMatch(" Valerie  E. ")).toBe("valerie e");
    expect(normalizeNameForMatch("O'Brien")).toBe("o brien");
  });

  it("recognizes likely alias-style name variants", () => {
    expect(areNamesLikelySamePerson("Valerie E", "Valerie Ekegbo")).toBe(true);
    expect(areNamesLikelySamePerson("Anne-Marie", "Anne Marie")).toBe(true);
    expect(areNamesLikelySamePerson("Valerie E", "Raju Muke")).toBe(false);
  });

  it("classifies suspicious pairs into useful triage buckets", () => {
    expect(
      classifySuspiciousPair(["shared_fingerprint", "alias_like_names", "rapid_repeat"])
    ).toEqual({
      level: "high_confidence",
      label: "High confidence",
    });

    expect(classifySuspiciousPair(["shared_fingerprint", "rapid_repeat"])).toEqual({
      level: "needs_review",
      label: "Needs review",
    });

    expect(classifySuspiciousPair(["shared_fingerprint"])).toEqual({
      level: "needs_review",
      label: "Needs review",
    });
  });

  it("flags shared fingerprints, rapid repeats, and missing index rows", () => {
    const report = analyzeQuizIntegrity({
      entriesByUid: {
        uid1: {
          name: "Valerie Ekegbo",
          nameSlug: "valerie-ekegbo",
          score: 360,
          timestamp: 1774566850466,
          fp: "fp-1",
        },
        uid2: {
          name: "Valerie E",
          nameSlug: "valerie-e",
          score: 480,
          timestamp: 1774566964444,
          fp: "fp-1",
        },
        uid3: {
          name: "Temmi Kalua",
          nameSlug: "temmi-kalua",
          score: 473,
          timestamp: 1774637519193,
          fp: "fp-2",
        },
      },
      nameIndexBySlug: {
        "valerie-e": null,
        "temmi-kalua": "uid3",
      },
      fingerprintIndexByFp: {
        "fp-2": "uid3",
      },
      timeWindowMs: 2 * 60 * 1000,
    });

    expect(report.leaderboardCount).toBe(3);
    expect(report.missingNameIndex.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["Valerie Ekegbo", "Valerie E"])
    );
    expect(report.missingFingerprintIndex.map((entry) => entry.name)).toEqual(
      expect.arrayContaining(["Valerie Ekegbo", "Valerie E"])
    );
    expect(report.sharedFingerprintGroups).toHaveLength(1);
    expect(report.sharedFingerprintGroups[0].names).toEqual([
      "Valerie Ekegbo",
      "Valerie E",
    ]);
    expect(report.suspiciousPairCounts.high_confidence).toBe(1);
    expect(report.suspiciousPairs[0].reasons).toEqual(
      expect.arrayContaining(["shared_fingerprint", "rapid_repeat", "alias_like_names"])
    );
    expect(report.suspiciousPairs[0].classification).toEqual({
      level: "high_confidence",
      label: "High confidence",
    });
  });
});
