import { firebaseConfig } from "./firebaseConfig";
import { AUTH_EXPIRY_SKEW_MS, AUTH_MIN_VALIDITY_MS } from "../constants/auth";
import { logSilent } from "../utils/logging";

const API_KEY = firebaseConfig.apiKey;
export const AUTH_STORAGE_KEY = "firebaseAuth";
let inFlightAuthPromise = null;

function isAuthFresh(auth) {
  return Boolean(
    auth &&
      auth.idToken &&
      auth.expiresAt &&
      auth.expiresAt > Date.now() + AUTH_MIN_VALIDITY_MS
  );
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    logSilent("auth.loadAuth", error);
    return null;
  }
}

function saveAuth(state) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    logSilent("auth.saveAuth", error);
  }
}

async function signInAnonymously() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error("Anonymous sign-in failed");
  const data = await res.json();
  const expiresAt = Date.now() + Number(data.expiresIn || 3600) * 1000 - AUTH_EXPIRY_SKEW_MS;
  const auth = {
    uid: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt,
  };
  saveAuth(auth);
  return auth;
}

async function refreshIdToken(refreshToken) {
  const res = await fetch(
    `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken }),
    }
  );
  if (!res.ok) throw new Error("Token refresh failed");
  const data = await res.json();
  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000 - AUTH_EXPIRY_SKEW_MS;
  const auth = {
    uid: data.user_id,
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
  saveAuth(auth);
  return auth;
}

export async function getValidAuth() {
  // Try cached
  let auth = loadAuth();
  if (isAuthFresh(auth)) {
    return auth;
  }

  if (inFlightAuthPromise) {
    return await inFlightAuthPromise;
  }

  const authRequestPromise = (async () => {
    // Re-read after taking the lock in case another caller finished first.
    let currentAuth = loadAuth();
    if (isAuthFresh(currentAuth)) {
      return currentAuth;
    }

    // Try refresh
    if (currentAuth && currentAuth.refreshToken) {
      try {
        currentAuth = await refreshIdToken(currentAuth.refreshToken);
        return currentAuth;
      } catch (error) {
        logSilent("auth.refreshIdToken", error, {
          action: "fall_back_to_anonymous_sign_in",
        });
        // fall through to sign-in
      }
    }

    // Fresh anonymous sign-in
    return await signInAnonymously();
  })();

  inFlightAuthPromise = authRequestPromise;

  try {
    return await authRequestPromise;
  } finally {
    if (inFlightAuthPromise === authRequestPromise) {
      inFlightAuthPromise = null;
    }
  }
}
