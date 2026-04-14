function buildLogPayload(error, details = {}) {
  return {
    ...details,
    error: error?.message || String(error),
  };
}

export function logSilent(channel, error, details = {}) {
  if (process.env.NODE_ENV === "test") return;

  try {
    console.warn(`[silent] ${channel}`, buildLogPayload(error, details));
  } catch (_) {}
}
