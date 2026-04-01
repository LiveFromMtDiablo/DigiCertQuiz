import { firebaseConfig } from "./firebaseConfig";

const API_KEY = firebaseConfig.apiKey;
export const AUTH_STORAGE_KEY = "firebaseAuth";
let inFlightAuthPromise = null;

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function saveAuth(state) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state));
  } catch (_) {}
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
  const expiresAt = Date.now() + Number(data.expiresIn || 3600) * 1000 - 30_000; // 30s skew
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
  const expiresAt = Date.now() + Number(data.expires_in || 3600) * 1000 - 30_000;
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
  if (auth && auth.idToken && auth.expiresAt && auth.expiresAt > Date.now() + 5_000) {
    return auth;
  }

  if (inFlightAuthPromise) {
    return await inFlightAuthPromise;
  }

  const authRequestPromise = (async () => {
    // Re-read after taking the lock in case another caller finished first.
    let currentAuth = loadAuth();
    if (
      currentAuth &&
      currentAuth.idToken &&
      currentAuth.expiresAt &&
      currentAuth.expiresAt > Date.now() + 5_000
    ) {
      return currentAuth;
    }

    // Try refresh
    if (currentAuth && currentAuth.refreshToken) {
      try {
        currentAuth = await refreshIdToken(currentAuth.refreshToken);
        return currentAuth;
      } catch (_) {
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
