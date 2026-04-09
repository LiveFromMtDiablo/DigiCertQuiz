const { firebaseConfig } = require("./firebaseConfig");
const { getValidAuth } = require("./firebaseAuth");

const API_KEY = firebaseConfig.apiKey;
const AUTH_STORAGE_KEY = "firebaseAuth";
const NOW = 1_710_000_000_000;

function jsonResponse(data, { ok = true } = {}) {
  return {
    ok,
    json: async () => data,
  };
}

describe("firebaseAuth", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(NOW);
    global.fetch = jest.fn();
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    localStorage.clear();
    delete global.fetch;
  });

  it("returns a still-valid cached auth session without network calls", async () => {
    const cachedAuth = {
      uid: "uid-cached",
      idToken: "token-cached",
      refreshToken: "refresh-cached",
      expiresAt: NOW + 60_000,
    };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(cachedAuth));

    const auth = await getValidAuth();

    expect(auth).toEqual(cachedAuth);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("refreshes an expired cached token and persists the refreshed auth", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        uid: "uid-old",
        idToken: "token-old",
        refreshToken: "refresh-old",
        expiresAt: NOW,
      })
    );

    global.fetch.mockResolvedValueOnce(
      jsonResponse({
        user_id: "uid-refreshed",
        id_token: "token-refreshed",
        refresh_token: "refresh-refreshed",
        expires_in: "7200",
      })
    );

    const auth = await getValidAuth();

    expect(global.fetch).toHaveBeenCalledWith(
      `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: "refresh-old",
        }),
      }
    );
    expect(auth).toEqual({
      uid: "uid-refreshed",
      idToken: "token-refreshed",
      refreshToken: "refresh-refreshed",
      expiresAt: NOW + 7_200_000 - 30_000,
    });
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY))).toEqual(auth);
  });

  it("falls back to anonymous sign-in when token refresh fails", async () => {
    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        uid: "uid-old",
        idToken: "token-old",
        refreshToken: "refresh-old",
        expiresAt: NOW,
      })
    );

    global.fetch
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(
        jsonResponse({
          localId: "uid-anon",
          idToken: "token-anon",
          refreshToken: "refresh-anon",
          expiresIn: "3600",
        })
      );

    const auth = await getValidAuth();

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      `https://securetoken.googleapis.com/v1/token?key=${API_KEY}`,
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      }
    );
    expect(auth).toEqual({
      uid: "uid-anon",
      idToken: "token-anon",
      refreshToken: "refresh-anon",
      expiresAt: NOW + 3_600_000 - 30_000,
    });
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY))).toEqual(auth);
  });

  it("ignores malformed stored auth and performs a fresh anonymous sign-in", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "{bad-json");

    global.fetch.mockResolvedValueOnce(
      jsonResponse({
        localId: "uid-fresh",
        idToken: "token-fresh",
        refreshToken: "refresh-fresh",
        expiresIn: "1800",
      })
    );

    const auth = await getValidAuth();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnSecureToken: true }),
      }
    );
    expect(auth).toEqual({
      uid: "uid-fresh",
      idToken: "token-fresh",
      refreshToken: "refresh-fresh",
      expiresAt: NOW + 1_800_000 - 30_000,
    });
  });

  it("surfaces anonymous sign-in failure when no auth path succeeds", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false });

    await expect(getValidAuth()).rejects.toThrow("Anonymous sign-in failed");
  });

  it("deduplicates concurrent anonymous sign-in requests", async () => {
    let resolveFetch;
    global.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const firstAuthPromise = getValidAuth();
    const secondAuthPromise = getValidAuth();

    expect(global.fetch).toHaveBeenCalledTimes(1);

    resolveFetch(
      jsonResponse({
        localId: "uid-shared",
        idToken: "token-shared",
        refreshToken: "refresh-shared",
        expiresIn: "3600",
      })
    );

    const [firstAuth, secondAuth] = await Promise.all([firstAuthPromise, secondAuthPromise]);

    expect(firstAuth).toEqual({
      uid: "uid-shared",
      idToken: "token-shared",
      refreshToken: "refresh-shared",
      expiresAt: NOW + 3_600_000 - 30_000,
    });
    expect(secondAuth).toEqual(firstAuth);
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY))).toEqual(firstAuth);
  });
});
