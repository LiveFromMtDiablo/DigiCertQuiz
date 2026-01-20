export function getLeaderboardEntryTimestamp(entry) {
  const value = entry?.timestamp;
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function compareLeaderboardEntries(a, b) {
  const scoreDelta = (b?.score ?? 0) - (a?.score ?? 0);
  if (scoreDelta !== 0) return scoreDelta;
  return getLeaderboardEntryTimestamp(a) - getLeaderboardEntryTimestamp(b);
}

export function sortLeaderboardEntries(entries) {
  const list = Array.isArray(entries) ? entries : [];
  return [...list].sort(compareLeaderboardEntries);
}
