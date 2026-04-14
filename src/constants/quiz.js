// Default per-question timer and starting score when a quiz omits maxTime.
export const DEFAULT_QUIZ_MAX_TIME_SECONDS = 100;

// Persisted attempt shape version used for local resume snapshots.
export const QUIZ_ATTEMPT_STORAGE_VERSION = 1;

// Retry one transient save failure before surfacing the manual retry UI.
export const MAX_TRANSIENT_SAVE_RETRIES = 1;
export const SAVE_RETRY_DELAY_MS = 10;
