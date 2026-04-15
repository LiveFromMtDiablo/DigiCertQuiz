const {
  DEV_FINGERPRINT_SEED_KEY,
  createDevFingerprintSeed,
  formatDevFingerprintSeed,
  getDevFingerprintSeed,
  getDeviceFingerprint,
  getMachineFingerprint,
  isDevFingerprintResetEnabled,
  rotateDevFingerprintSeed,
} = require("./deviceFingerprint");

describe("deviceFingerprint", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("enables the dev reset control only for local development hosts", () => {
    expect(
      isDevFingerprintResetEnabled({
        nodeEnv: "development",
        windowObj: { location: { hostname: "localhost" } },
      })
    ).toBe(true);

    expect(
      isDevFingerprintResetEnabled({
        nodeEnv: "development",
        windowObj: { location: { hostname: "quiz.example.com" } },
      })
    ).toBe(false);

    expect(
      isDevFingerprintResetEnabled({
        nodeEnv: "production",
        windowObj: { location: { hostname: "localhost" } },
      })
    ).toBe(false);
  });

  it("reads the dev seed only when the reset flow is enabled", () => {
    localStorage.setItem(DEV_FINGERPRINT_SEED_KEY, "seed-1");

    expect(getDevFingerprintSeed({ isEnabled: true })).toBe("seed-1");
    expect(getDevFingerprintSeed({ isEnabled: false })).toBe("");
  });

  it("creates a seed from crypto.randomUUID when available and falls back otherwise", () => {
    expect(
      createDevFingerprintSeed({
        cryptoImpl: { randomUUID: () => "uuid-seed" },
      })
    ).toBe("uuid-seed");

    expect(
      createDevFingerprintSeed({
        cryptoImpl: {},
        now: 12345,
        random: 0.5,
      })
    ).toBe("dev-9ix-8");
  });

  it("rotates the seed while clearing auth and saved attempt keys but preserving unrelated storage", () => {
    localStorage.setItem("firebaseAuth", '{"uid":"1"}');
    localStorage.setItem("submitted:week-1", "1");
    localStorage.setItem("quizAttempt:week-1", '{"version":1}');
    localStorage.setItem("keep-me", "yes");

    const nextSeed = rotateDevFingerprintSeed({
      authStorageKey: "firebaseAuth",
      createSeed: () => "seed-2",
    });

    expect(nextSeed).toBe("seed-2");
    expect(localStorage.getItem("firebaseAuth")).toBeNull();
    expect(localStorage.getItem("submitted:week-1")).toBeNull();
    expect(localStorage.getItem("quizAttempt:week-1")).toBeNull();
    expect(localStorage.getItem("keep-me")).toBe("yes");
    expect(localStorage.getItem(DEV_FINGERPRINT_SEED_KEY)).toBe("seed-2");
  });

  it("formats the seed label for the default state and explicit seed values", () => {
    expect(formatDevFingerprintSeed("")).toBe("default (no override)");
    expect(formatDevFingerprintSeed("seed-1")).toBe("seed-1");
  });

  it("includes the dev seed in the device fingerprint and changes the value when the seed changes", async () => {
    const baseArgs = {
      salt: "week-1",
      navigatorObj: {
        userAgent: "Agent/1",
        platform: "MacIntel",
        language: "en-US",
        hardwareConcurrency: 8,
        deviceMemory: 16,
      },
      screenObj: {
        width: 1440,
        height: 900,
        colorDepth: 24,
      },
      windowObj: {},
      intlObj: {
        DateTimeFormat: () => ({
          resolvedOptions: () => ({ timeZone: "America/Los_Angeles" }),
        }),
      },
      devicePixelRatioValue: 2,
      sha256HexImpl: async (value) => value,
    };

    const first = await getDeviceFingerprint({
      ...baseArgs,
      devSeed: "seed-a",
    });
    const second = await getDeviceFingerprint({
      ...baseArgs,
      devSeed: "seed-b",
    });

    expect(first).toContain("seed-a");
    expect(second).toContain("seed-b");
    expect(second).not.toBe(first);
  });

  it("excludes userAgent from the machine fingerprint while the device fingerprint still includes it", async () => {
    const commonArgs = {
      salt: "week-1",
      navigatorObj: {
        userAgent: "Agent/1",
        platform: "MacIntel",
        language: "en-US",
        hardwareConcurrency: 8,
        deviceMemory: 16,
      },
      screenObj: {
        width: 1440,
        height: 900,
        colorDepth: 24,
      },
      windowObj: {},
      intlObj: {
        DateTimeFormat: () => ({
          resolvedOptions: () => ({ timeZone: "America/Los_Angeles" }),
        }),
      },
      devicePixelRatioValue: 2,
      devSeed: "seed-a",
      sha256HexImpl: async (value) => value,
    };

    const deviceWithFirstAgent = await getDeviceFingerprint(commonArgs);
    const deviceWithSecondAgent = await getDeviceFingerprint({
      ...commonArgs,
      navigatorObj: {
        ...commonArgs.navigatorObj,
        userAgent: "Agent/2",
      },
    });
    const machineWithFirstAgent = await getMachineFingerprint(commonArgs);
    const machineWithSecondAgent = await getMachineFingerprint({
      ...commonArgs,
      navigatorObj: {
        ...commonArgs.navigatorObj,
        userAgent: "Agent/2",
      },
    });

    expect(deviceWithSecondAgent).not.toBe(deviceWithFirstAgent);
    expect(machineWithSecondAgent).toBe(machineWithFirstAgent);
    expect(machineWithFirstAgent).not.toContain("Agent/1");
  });
});
