#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DB_URL = "https://digicert-product-quiz-default-rtdb.firebaseio.com";
const DEFAULT_TIME_WINDOW_MINUTES = 5;
const AUTH_TOKEN = process.env.AUTH_TOKEN || "";
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || "";

function getArgValue(flag) {
  const inlinePrefix = `${flag}=`;
  const inlineArg = process.argv.find((arg) => arg.startsWith(inlinePrefix));
  if (inlineArg) return inlineArg.slice(inlinePrefix.length);

  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("-")) return "";
  return next;
}

function parsePositiveIntArg(flag, defaultValue) {
  const raw = getArgValue(flag);
  if (raw == null) return defaultValue;

  const value = String(raw).trim();
  if (!/^\d+$/.test(value) || Number(value) < 1) {
    console.error(`Invalid ${flag} value "${raw}". Expected a positive integer.`);
    process.exit(1);
  }

  return Number(value);
}

function resolveCurrentQuizId() {
  const indexPath = path.join(__dirname, "..", "src", "quizzes", "index.js");
  const source = fs.readFileSync(indexPath, "utf8");
  const currentMatch = source.match(/export const currentQuizId = (\w+)\.id;/);
  if (!currentMatch) {
    throw new Error("Could not determine currentQuizId from src/quizzes/index.js");
  }

  const importName = currentMatch[1];
  const importPattern = new RegExp(`import\\s+${importName}\\s+from\\s+"\\.\\/([^"]+)"`);
  const importMatch = source.match(importPattern);
  if (!importMatch) {
    throw new Error(`Could not resolve quiz module for ${importName}`);
  }

  return importMatch[1];
}

function resolveFirebaseApiKey() {
  const envKey =
    process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY;
  if (envKey) return envKey;

  const configPath = path.join(__dirname, "..", "src", "services", "firebaseConfig.js");
  const source = fs.readFileSync(configPath, "utf8");
  const match = source.match(/apiKey:\s*"([^"]+)"/);
  if (match) return match[1];

  throw new Error(
    "Could not resolve Firebase API key. Set FIREBASE_API_KEY (or REACT_APP_FIREBASE_API_KEY)."
  );
}

function normalizeNameForMatch(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name) {
  const normalized = normalizeNameForMatch(name);
  return normalized ? normalized.split(" ") : [];
}

function parseNameParts(name) {
  const tokens = nameTokens(name);
  const first = tokens[0] || "";
  const last = tokens.length >= 2 ? tokens[tokens.length - 1] : "";
  const isLastInitial = last.length === 1 && /^[a-z]$/.test(last);
  const lastInitial = last ? last[0] : "";
  return { first, last, isLastInitial, lastInitial };
}

function levenshtein(a, b) {
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

function similarity(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  const maxLen = Math.max(left.length, right.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(left, right) / maxLen;
}

function isLikelyLastInitialVsLastName(nameA, nameB) {
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

function areNamesLikelySamePerson(nameA, nameB) {
  const normalizedA = normalizeNameForMatch(nameA);
  const normalizedB = normalizeNameForMatch(nameB);

  if (!normalizedA || !normalizedB) return false;
  if (normalizedA === normalizedB) return true;
  if (isLikelyLastInitialVsLastName(nameA, nameB)) return true;

  return similarity(
    normalizedA.replace(/\s+/g, ""),
    normalizedB.replace(/\s+/g, "")
  ) >= 0.9;
}

function classifySuspiciousPair(reasons) {
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

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const scoreDelta = (b.score || 0) - (a.score || 0);
    if (scoreDelta !== 0) return scoreDelta;
    return (a.timestamp || Number.POSITIVE_INFINITY) - (b.timestamp || Number.POSITIVE_INFINITY);
  });
}

function analyzeQuizIntegrity({
  entriesByUid,
  nameIndexBySlug = {},
  fingerprintIndexByFp = {},
  timeWindowMs,
}) {
  const entries = sortEntries(
    Object.entries(entriesByUid || {}).map(([uid, entry]) => ({ uid, ...entry }))
  );

  const missingNameIndex = [];
  const missingFingerprintIndex = [];
  const fpGroups = new Map();

  for (const entry of entries) {
    if (entry.nameSlug && nameIndexBySlug[entry.nameSlug] !== entry.uid) {
      missingNameIndex.push({
        uid: entry.uid,
        name: entry.name,
        nameSlug: entry.nameSlug,
        mappedUid: nameIndexBySlug[entry.nameSlug] || null,
      });
    }

    if (entry.fp && fingerprintIndexByFp[entry.fp] !== entry.uid) {
      missingFingerprintIndex.push({
        uid: entry.uid,
        name: entry.name,
        fp: entry.fp,
        mappedUid: fingerprintIndexByFp[entry.fp] || null,
      });
    }

    if (!entry.fp) continue;
    const group = fpGroups.get(entry.fp) || [];
    group.push(entry);
    fpGroups.set(entry.fp, group);
  }

  const sharedFingerprintGroups = [];
  const suspiciousPairs = [];

  for (const [fp, group] of fpGroups.entries()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    sharedFingerprintGroups.push({
      fp,
      entries: sorted,
    });

    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const left = sorted[i];
        const right = sorted[j];
        const diffMs = Math.abs((right.timestamp || 0) - (left.timestamp || 0));
        const reasons = ["shared_fingerprint"];
        if (diffMs <= timeWindowMs) reasons.push("rapid_repeat");
        if (areNamesLikelySamePerson(left.name, right.name)) reasons.push("alias_like_names");
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
    const weight = (pair) =>
      (pair.classification.level === "high_confidence" ? 100 : 0) +
      (pair.reasons.includes("alias_like_names") ? 10 : 0) +
      (pair.reasons.includes("rapid_repeat") ? 5 : 0);
    const scoreDelta = weight(b) - weight(a);
    if (scoreDelta !== 0) return scoreDelta;
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

async function signInAnonymously() {
  const apiKey = resolveFirebaseApiKey();
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );

  if (!response.ok) {
    throw new Error(`Anonymous sign-in failed (${response.status})`);
  }

  return response.json();
}

async function fetchProtectedJson(pathname, idToken) {
  const url = ACCESS_TOKEN
    ? `${DB_URL}/${pathname}.json`
    : `${DB_URL}/${pathname}.json?auth=${encodeURIComponent(idToken)}`;
  const response = await fetch(url, ACCESS_TOKEN
    ? {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
        },
      }
    : undefined);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${pathname} (${response.status})`);
  }
  return response.json();
}

function formatTimestamp(ms, timeZone) {
  if (!Number.isFinite(ms)) return "unknown";
  return new Date(ms).toLocaleString("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

function shortFingerprint(fp) {
  if (!fp) return "none";
  if (fp.length <= 16) return fp;
  return `${fp.slice(0, 8)}...${fp.slice(-6)}`;
}

async function main() {
  const quizId = getArgValue("--quiz-id") || resolveCurrentQuizId();
  const timeWindowMinutes = parsePositiveIntArg("--window-minutes", DEFAULT_TIME_WINDOW_MINUTES);
  const jsonMode = process.argv.includes("--json");

  const auth = AUTH_TOKEN ? { idToken: AUTH_TOKEN } : await signInAnonymously();
  const [leaderboard, nameIndex, fingerprints] = await Promise.all([
    fetchProtectedJson(`leaderboard/${quizId}`, auth.idToken),
    fetchProtectedJson(`nameIndex/${quizId}`, auth.idToken),
    fetchProtectedJson(`fingerprints/${quizId}`, auth.idToken),
  ]);

  const report = analyzeQuizIntegrity({
    entriesByUid: leaderboard || {},
    nameIndexBySlug: nameIndex || {},
    fingerprintIndexByFp: fingerprints || {},
    timeWindowMs: timeWindowMinutes * 60 * 1000,
  });

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          quizId,
          timeWindowMinutes,
          ...report,
        },
        null,
        2
      )
    );
    return;
  }

  console.log("");
  console.log("Quiz Integrity Audit");
  console.log(`Quiz: ${quizId}`);
  console.log(`Rapid-repeat window: ${timeWindowMinutes} minute(s)`);
  console.log("");
  console.log(`Leaderboard entries: ${report.leaderboardCount}`);
  console.log(`Missing nameIndex rows: ${report.missingNameIndex.length}`);
  console.log(`Missing fingerprint rows: ${report.missingFingerprintIndex.length}`);
  console.log(`Shared fingerprint groups: ${report.sharedFingerprintGroups.length}`);
  console.log(`Suspicious pairs: ${report.suspiciousPairs.length}`);
  console.log(`High confidence pairs: ${report.suspiciousPairCounts.high_confidence}`);
  console.log(`Needs review pairs: ${report.suspiciousPairCounts.needs_review}`);
  console.log(`Index gaps: ${report.missingNameIndex.length + report.missingFingerprintIndex.length}`);

  if (report.suspiciousPairs.length > 0) {
    console.log("");
    console.log("Top suspicious pairs");
    report.suspiciousPairs.slice(0, 10).forEach((pair, index) => {
      const seconds = (pair.diffMs / 1000).toFixed(1);
      console.log(
        `${index + 1}. ${pair.left.name} (${pair.left.score}) <-> ${pair.right.name} (${pair.right.score})`
      );
      console.log(`   Classification: ${pair.classification.label}`);
      console.log(`   Reasons: ${pair.reasons.join(", ")}`);
      console.log(`   Fingerprint: ${shortFingerprint(pair.fp)}`);
      console.log(`   Time gap: ${seconds}s`);
      console.log(`   Earlier: ${formatTimestamp(pair.left.timestamp, "America/Los_Angeles")}`);
      console.log(`   Later:   ${formatTimestamp(pair.right.timestamp, "America/Los_Angeles")}`);
    });
  }

  const highConfidencePairs = report.suspiciousPairs.filter(
    (pair) => pair.classification.level === "high_confidence"
  );
  if (highConfidencePairs.length > 0) {
    console.log("");
    console.log("High confidence");
    highConfidencePairs.slice(0, 10).forEach((pair, index) => {
      console.log(
        `${index + 1}. ${pair.left.name} <-> ${pair.right.name} | ${shortFingerprint(pair.fp)} | ${(pair.diffMs / 1000).toFixed(1)}s`
      );
    });
  }

  const needsReviewPairs = report.suspiciousPairs.filter(
    (pair) => pair.classification.level === "needs_review"
  );
  if (needsReviewPairs.length > 0) {
    console.log("");
    console.log("Needs review");
    needsReviewPairs.slice(0, 10).forEach((pair, index) => {
      console.log(
        `${index + 1}. ${pair.left.name} <-> ${pair.right.name} | ${shortFingerprint(pair.fp)} | reasons: ${pair.reasons.join(", ")}`
      );
    });
  }

  if (report.sharedFingerprintGroups.length > 0) {
    console.log("");
    console.log("Shared fingerprint groups");
    report.sharedFingerprintGroups.slice(0, 10).forEach((group, index) => {
      console.log(`${index + 1}. ${shortFingerprint(group.fp)} (${group.entries.length} entries)`);
      group.entries.forEach((entry) => {
        console.log(
          `   - ${entry.name} | score ${entry.score} | ${formatTimestamp(entry.timestamp, "America/Los_Angeles")}`
        );
      });
    });
  }

  if (report.missingNameIndex.length > 0 || report.missingFingerprintIndex.length > 0) {
    console.log("");
    console.log("Index gaps");
    report.missingNameIndex.slice(0, 10).forEach((entry) => {
      console.log(`- Missing nameIndex: ${entry.name} (${entry.nameSlug}) uid=${entry.uid}`);
    });
    report.missingFingerprintIndex.slice(0, 10).forEach((entry) => {
      console.log(`- Missing fingerprint index: ${entry.name} fp=${shortFingerprint(entry.fp)} uid=${entry.uid}`);
    });
  }
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
