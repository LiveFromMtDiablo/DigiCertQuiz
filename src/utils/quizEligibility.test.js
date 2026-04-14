const {
  sanitizeName,
  toNameSlug,
  buildEligibilityState,
  classifyNameConflict,
  classifySaveFailure,
  ALREADY_PLAYED_MESSAGE,
  DUPLICATE_NAME_MESSAGE,
  DUPLICATE_FINGERPRINT_MESSAGE,
  AUTH_SAVE_ERROR_MESSAGE,
  GENERIC_SAVE_ERROR_MESSAGE,
} = require("./quizEligibility");

describe("quizEligibility", () => {
  it("sanitizes and normalizes names into the same slug rules used by production", () => {
    expect(sanitizeName("  Anne   Marie ")).toBe("Anne Marie");
    expect(toNameSlug("Anne-Marie")).toBe("annemarie");
    expect(toNameSlug("Anne Marie")).toBe("anne-marie");
    expect(toNameSlug("O'Brien")).toBe("obrien");
    expect(toNameSlug(" OBrien ")).toBe("obrien");
  });

  it("blocks eligibility when the current uid already has a submission", () => {
    expect(
      buildEligibilityState({
        uid: "uid-1",
        existingSubmission: { score: 400 },
        fingerprintOwner: null,
      })
    ).toEqual({
      status: "blocked",
      reason: "already_submitted",
      message: ALREADY_PLAYED_MESSAGE,
    });
  });

  it("blocks eligibility when another uid already owns the fingerprint", () => {
    expect(
      buildEligibilityState({
        uid: "uid-1",
        existingSubmission: null,
        fingerprintOwner: "uid-2",
      })
    ).toEqual({
      status: "blocked",
      reason: "duplicate_fingerprint",
      message: DUPLICATE_FINGERPRINT_MESSAGE,
    });
  });

  it("allows the same uid to reuse its own fingerprint during classification", () => {
    expect(
      buildEligibilityState({
        uid: "uid-1",
        existingSubmission: null,
        fingerprintOwner: "uid-1",
      })
    ).toEqual({
      status: "ready",
      reason: null,
      message: "",
    });
  });

  it("detects normalized name conflicts before quiz start", () => {
    expect(
      classifyNameConflict({
        uid: "uid-1",
        nameIndexOwner: "uid-2",
      })
    ).toEqual({
      reason: "duplicate_name",
      message: DUPLICATE_NAME_MESSAGE,
    });
  });

  it("classifies save failures by the enforced uniqueness rules before generic auth errors", () => {
    expect(
      classifySaveFailure({
        uid: "uid-1",
        existingSubmission: null,
        nameIndexOwner: "uid-2",
        fingerprintOwner: "uid-3",
        responseStatus: 403,
      })
    ).toEqual({
      reason: "duplicate_name",
      message: DUPLICATE_NAME_MESSAGE,
      severity: "fatal",
      retryable: false,
    });
  });

  it("falls back to auth and generic messages when no rule conflict is found", () => {
    expect(
      classifySaveFailure({
        uid: "uid-1",
        existingSubmission: null,
        nameIndexOwner: null,
        fingerprintOwner: null,
        responseStatus: 401,
      })
    ).toEqual({
      reason: "auth",
      message: AUTH_SAVE_ERROR_MESSAGE,
      severity: "fatal",
      retryable: false,
    });

    expect(
      classifySaveFailure({
        uid: "uid-1",
        existingSubmission: null,
        nameIndexOwner: null,
        fingerprintOwner: null,
        responseStatus: 500,
      })
    ).toEqual({
      reason: "generic",
      message: GENERIC_SAVE_ERROR_MESSAGE,
      severity: "transient",
      retryable: true,
    });

    expect(
      classifySaveFailure({
        uid: "uid-1",
        existingSubmission: null,
        nameIndexOwner: null,
        fingerprintOwner: null,
        responseStatus: 400,
      })
    ).toEqual({
      reason: "generic",
      message: GENERIC_SAVE_ERROR_MESSAGE,
      severity: "fatal",
      retryable: false,
    });
  });
});
