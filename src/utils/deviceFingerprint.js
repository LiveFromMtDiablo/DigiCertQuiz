import { logSilent } from "./logging";

export const DEV_FINGERPRINT_SEED_KEY = "devFingerprintSeed";

function resolveStorage(storage) {
  if (storage) return storage;
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function resolveHostname(windowObj) {
  if (windowObj) {
    return windowObj.location?.hostname || "";
  }

  if (typeof window === "undefined") return "";
  return window.location?.hostname || "";
}

export function isDevFingerprintResetEnabled({
  nodeEnv = process.env.NODE_ENV,
  windowObj,
} = {}) {
  if (nodeEnv === "production") {
    return false;
  }

  const hostname = resolveHostname(windowObj);
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  );
}

export function getDevFingerprintSeed({
  storage = resolveStorage(),
  isEnabled = isDevFingerprintResetEnabled(),
  seedKey = DEV_FINGERPRINT_SEED_KEY,
} = {}) {
  if (!isEnabled) return "";

  try {
    return storage?.getItem(seedKey) || "";
  } catch (_) {
    return "";
  }
}

export function createDevFingerprintSeed({
  cryptoImpl = typeof crypto === "undefined" ? undefined : crypto,
  now = Date.now(),
  random = Math.random(),
} = {}) {
  if (typeof cryptoImpl?.randomUUID === "function") {
    return cryptoImpl.randomUUID();
  }

  return `dev-${now.toString(36)}-${random.toString(16).slice(2)}`;
}

export function rotateDevFingerprintSeed({
  storage = resolveStorage(),
  authStorageKey,
  seedKey = DEV_FINGERPRINT_SEED_KEY,
  createSeed = createDevFingerprintSeed,
} = {}) {
  const nextSeed = createSeed();

  try {
    if (!storage) return nextSeed;

    const keysToRemove = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key) continue;

      if (
        key === authStorageKey ||
        key.startsWith("submitted:") ||
        key.startsWith("quizAttempt:")
      ) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => storage.removeItem(key));
    storage.setItem(seedKey, nextSeed);
  } catch (error) {
    logSilent("deviceFingerprint.rotateDevFingerprintSeed", error, {
      authStorageKey: authStorageKey || null,
      seedKey,
    });
  }

  return nextSeed;
}

export function formatDevFingerprintSeed(seed) {
  return seed || "default (no override)";
}

export async function sha256Hex(
  input,
  {
    textEncoderCtor = TextEncoder,
    cryptoImpl = typeof crypto === "undefined" ? undefined : crypto,
  } = {}
) {
  const enc = new textEncoderCtor();
  const data = enc.encode(input);
  if (!cryptoImpl?.subtle) {
    let h = 5381;
    for (let i = 0; i < data.length; i += 1) h = ((h << 5) + h) + data[i];
    return (h >>> 0).toString(16).padStart(8, "0");
  }

  const digest = await cryptoImpl.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function resolveTimeZone(intlObj) {
  try {
    return intlObj?.DateTimeFormat?.().resolvedOptions().timeZone || "";
  } catch (_) {
    return "";
  }
}

export async function getDeviceFingerprint({
  salt,
  navigatorObj = typeof navigator === "undefined" ? {} : navigator,
  screenObj = typeof screen === "undefined" ? {} : screen,
  windowObj = typeof window === "undefined" ? {} : window,
  intlObj = typeof Intl === "undefined" ? undefined : Intl,
  devSeed = getDevFingerprintSeed(),
  devicePixelRatioValue =
    typeof devicePixelRatio === "undefined" ? 1 : devicePixelRatio,
  sha256HexImpl = sha256Hex,
  now = Date.now(),
} = {}) {
  try {
    const parts = [
      String(salt || ""),
      String(navigatorObj.userAgent || ""),
      String(navigatorObj.platform || ""),
      String(navigatorObj.language || ""),
      String(resolveTimeZone(intlObj)),
      String(screenObj.width || 0),
      String(screenObj.height || 0),
      String(screenObj.colorDepth || 0),
      String(devicePixelRatioValue),
      String(navigatorObj.hardwareConcurrency || 0),
      String(navigatorObj.deviceMemory || 0),
      String("ontouchstart" in windowObj),
      String(devSeed || ""),
    ];
    return sha256HexImpl(parts.join("|"));
  } catch (_) {
    return sha256HexImpl(`fallback|${salt}|${now}`);
  }
}

export async function getMachineFingerprint({
  salt,
  navigatorObj = typeof navigator === "undefined" ? {} : navigator,
  screenObj = typeof screen === "undefined" ? {} : screen,
  windowObj = typeof window === "undefined" ? {} : window,
  intlObj = typeof Intl === "undefined" ? undefined : Intl,
  devSeed = getDevFingerprintSeed(),
  devicePixelRatioValue =
    typeof devicePixelRatio === "undefined" ? 1 : devicePixelRatio,
  sha256HexImpl = sha256Hex,
  now = Date.now(),
} = {}) {
  try {
    const parts = [
      String(salt || ""),
      String(navigatorObj.platform || ""),
      String(navigatorObj.language || ""),
      String(resolveTimeZone(intlObj)),
      String(screenObj.width || 0),
      String(screenObj.height || 0),
      String(screenObj.colorDepth || 0),
      String(devicePixelRatioValue),
      String(navigatorObj.hardwareConcurrency || 0),
      String(navigatorObj.deviceMemory || 0),
      String("ontouchstart" in windowObj),
      String(devSeed || ""),
    ];
    return sha256HexImpl(parts.join("|"));
  } catch (_) {
    return sha256HexImpl(`fallbackMachine|${salt}|${now}`);
  }
}
