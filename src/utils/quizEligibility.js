export const NAME_REGEX = /^[A-Za-z0-9 .,'_-]{2,30}$/;

export const ELIGIBILITY_CHECKING_MESSAGE = "Checking quiz eligibility...";
export const ELIGIBILITY_ERROR_MESSAGE =
  "We couldn't verify quiz eligibility right now. Please refresh and try again.";
export const ALREADY_PLAYED_MESSAGE =
  "You've already played this quiz. Thanks for participating! You can view the leaderboard below.";
export const DUPLICATE_NAME_MESSAGE =
  "That display name conflicts with an existing leaderboard entry after name normalization. Please make it unique (e.g., 'Chuck J.' or 'Chuck Jones').";
export const DUPLICATE_FINGERPRINT_MESSAGE =
  "This device appears to have already been used for this quiz. If you believe this is a mistake, please contact the quiz organizer.";
export const AUTH_SAVE_ERROR_MESSAGE =
  "We couldn't verify your session while saving your score. Please refresh and try again.";
export const PERMISSION_SAVE_ERROR_MESSAGE =
  "We couldn't save your score because this entry did not pass the quiz eligibility checks.";
export const GENERIC_SAVE_ERROR_MESSAGE = "Could not save score. Please try again.";

function buildSaveFailure(reason, message, { severity = "fatal", retryable = false } = {}) {
  return {
    reason,
    message,
    severity,
    retryable,
  };
}

export function sanitizeName(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

export function toNameSlug(value = "") {
  const clean = sanitizeName(value).toLowerCase();
  const stripped = clean.replace(/[^a-z0-9 ]+/g, "");
  return stripped.replace(/\s+/g, "-");
}

export function buildEligibilityState({ uid, existingSubmission, fingerprintOwner }) {
  if (existingSubmission) {
    return {
      status: "blocked",
      reason: "already_submitted",
      message: ALREADY_PLAYED_MESSAGE,
    };
  }

  if (fingerprintOwner && fingerprintOwner !== uid) {
    return {
      status: "blocked",
      reason: "duplicate_fingerprint",
      message: DUPLICATE_FINGERPRINT_MESSAGE,
    };
  }

  return {
    status: "ready",
    reason: null,
    message: "",
  };
}

export function classifyNameConflict({ uid, nameIndexOwner }) {
  if (nameIndexOwner && nameIndexOwner !== uid) {
    return {
      reason: "duplicate_name",
      message: DUPLICATE_NAME_MESSAGE,
    };
  }

  return {
    reason: null,
    message: "",
  };
}

export function classifySaveFailure({
  uid,
  existingSubmission,
  nameIndexOwner,
  fingerprintOwner,
  responseStatus,
}) {
  if (existingSubmission) {
    return buildSaveFailure("already_submitted", ALREADY_PLAYED_MESSAGE);
  }

  if (nameIndexOwner && nameIndexOwner !== uid) {
    return buildSaveFailure("duplicate_name", DUPLICATE_NAME_MESSAGE);
  }

  if (fingerprintOwner && fingerprintOwner !== uid) {
    return buildSaveFailure("duplicate_fingerprint", DUPLICATE_FINGERPRINT_MESSAGE);
  }

  if (responseStatus === 401) {
    return buildSaveFailure("auth", AUTH_SAVE_ERROR_MESSAGE);
  }

  if (responseStatus === 403) {
    return buildSaveFailure("permissions", PERMISSION_SAVE_ERROR_MESSAGE);
  }

  if (responseStatus === 0 || responseStatus >= 500) {
    return buildSaveFailure("generic", GENERIC_SAVE_ERROR_MESSAGE, {
      severity: "transient",
      retryable: true,
    });
  }

  return buildSaveFailure("generic", GENERIC_SAVE_ERROR_MESSAGE);
}
