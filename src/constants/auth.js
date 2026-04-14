// Refresh slightly early so requests do not begin with a nearly expired token.
export const AUTH_EXPIRY_SKEW_MS = 30_000;

// Treat tokens expiring within the next few seconds as stale to avoid edge races.
export const AUTH_MIN_VALIDITY_MS = 5_000;
