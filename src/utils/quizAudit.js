import { sortLeaderboardEntries } from "./leaderboardSort";

export function normalizeNameForMatch(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function nameTokens(name) {
  const normalized = normalizeNameForMatch(name);
  return normalized ? normalized.split(" ") : [];
}

export function parseNameParts(name) {
  const tokens = nameTokens(name);
  const first = tokens[0] || "";
  const last = tokens.length >= 2 ? tokens[tokens.length - 1] : "";
  const isLastInitial = last.length === 1 && /^[a-z]$/.test(last);
  const lastInitial = last ? last[0] : "";
  return { tokens, first, last, isLastInitial, lastInitial };
}

export function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }

  return matrix[a.length][b.length];
}

export function similarity(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(left, right) / maxLen;
}

export function isLikelyLastInitialVsLastName(nameA, nameB) {
  const a = parseNameParts(nameA);
  const b = parseNameParts(nameB);

  if (!a.first || !b.first || !a.last || !b.last) return false;

  const firstSim = similarity(a.first, b.first);
  const firstMatches =
    a.first === b.first ||
    (a.first.length >= 4 && b.first.length >= 4 && firstSim >= 0.8);
  if (!firstMatches) return false;

  if (a.isLastInitial === b.isLastInitial) return false;

  const initial = a.isLastInitial ? a.lastInitial : b.lastInitial;
  const fullLast = a.isLastInitial ? b.last : a.last;

  if (!initial || !fullLast || fullLast.length < 2) return false;
  return fullLast[0] === initial;
}

export function areNamesLikelySamePerson(nameA, nameB) {
  const normalizedA = normalizeNameForMatch(nameA);
  const normalizedB = normalizeNameForMatch(nameB);

  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  if (isLikelyLastInitialVsLastName(nameA, nameB)) return true;

  const collapsedA = normalizedA.replace(/\s+/g, "");
  const collapsedB = normalizedB.replace(/\s+/g, "");
  return similarity(collapsedA, collapsedB) >= 0.9;
}

export function classifySuspiciousPair(reasons) {
  const set = new Set(reasons || []);

  if (
    set.has("shared_fingerprint") &&
    set.has("alias_like_names") &&
    set.has("rapid_repeat")
  ) {
    return {
      level: "high_confidence",
      label: "High confidence",
    };
  }

  if (set.has("shared_fingerprint") && set.has("alias_like_names")) {
    return {
      level: "high_confidence",
      label: "High confidence",
    };
  }

  if (set.has("shared_fingerprint") && set.has("rapid_repeat")) {
    return {
      level: "needs_review",
      label: "Needs review",
    };
  }

  if (set.has("shared_fingerprint")) {
    return {
      level: "needs_review",
      label: "Needs review",
    };
  }

  return {
    level: "informational",
    label: "Informational",
  };
}

function toAuditEntries(entriesByUid) {
  const list = Object.entries(entriesByUid || {}).map(([uid, entry]) => ({
    uid,
    ...entry,
  }));
  return sortLeaderboardEntries(list);
}

export function analyzeQuizIntegrity({
  entriesByUid,
  nameIndexBySlug = {},
  fingerprintIndexByFp = {},
  timeWindowMs = 5 * 60 * 1000,
} = {}) {
  const entries = toAuditEntries(entriesByUid);
  const missingNameIndex = [];
  const missingFingerprintIndex = [];
  const byFingerprint = new Map();

  for (const entry of entries) {
    if (entry.nameSlug && nameIndexBySlug?.[entry.nameSlug] !== entry.uid) {
      missingNameIndex.push({
        uid: entry.uid,
        name: entry.name,
        nameSlug: entry.nameSlug,
        mappedUid: nameIndexBySlug?.[entry.nameSlug] || null,
      });
    }

    if (entry.fp && fingerprintIndexByFp?.[entry.fp] !== entry.uid) {
      missingFingerprintIndex.push({
        uid: entry.uid,
        name: entry.name,
        fp: entry.fp,
        mappedUid: fingerprintIndexByFp?.[entry.fp] || null,
      });
    }

    if (!entry.fp) continue;
    const group = byFingerprint.get(entry.fp) || [];
    group.push(entry);
    byFingerprint.set(entry.fp, group);
  }

  const sharedFingerprintGroups = [];
  const suspiciousPairs = [];

  for (const [fp, groupEntries] of byFingerprint.entries()) {
    if (groupEntries.length < 2) continue;
    const sorted = [...groupEntries].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    sharedFingerprintGroups.push({
      fp,
      entryCount: sorted.length,
      names: sorted.map((entry) => entry.name),
      entries: sorted,
    });

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const left = sorted[i];
        const right = sorted[j];
        const diffMs = Math.abs((right.timestamp || 0) - (left.timestamp || 0));
        const reasons = ["shared_fingerprint"];

        if (diffMs <= timeWindowMs) {
          reasons.push("rapid_repeat");
        }

        if (areNamesLikelySamePerson(left.name, right.name)) {
          reasons.push("alias_like_names");
        }

        suspiciousPairs.push({
          fp,
          left,
          right,
          diffMs,
          reasons,
          classification: classifySuspiciousPair(reasons),
        });
      }
    }
  }

  suspiciousPairs.sort((a, b) => {
    const scoreA =
      (a.classification.level === "high_confidence" ? 100 : 0) +
      (a.reasons.includes("alias_like_names") ? 10 : 0) +
      (a.reasons.includes("rapid_repeat") ? 5 : 0);
    const scoreB =
      (b.classification.level === "high_confidence" ? 100 : 0) +
      (b.reasons.includes("alias_like_names") ? 10 : 0) +
      (b.reasons.includes("rapid_repeat") ? 5 : 0);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.diffMs - b.diffMs;
  });

  const suspiciousPairCounts = suspiciousPairs.reduce(
    (acc, pair) => {
      acc[pair.classification.level] = (acc[pair.classification.level] || 0) + 1;
      return acc;
    },
    {
      high_confidence: 0,
      needs_review: 0,
      informational: 0,
    }
  );

  return {
    leaderboardCount: entries.length,
    missingNameIndex,
    missingFingerprintIndex,
    sharedFingerprintGroups,
    suspiciousPairs,
    suspiciousPairCounts,
  };
}
