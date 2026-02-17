#!/usr/bin/env node
/**
 * Cumulative Leaderboard Generator
 *
 * Fetches all quiz leaderboard data and aggregates scores by nameSlug.
 * Flags potential duplicate players with similar names.
 *
 * Usage:
 *   node scripts/cumulative-leaderboard.js
 *   node scripts/cumulative-leaderboard.js --csv cumulative-leaderboard.csv
 *   node scripts/cumulative-leaderboard.js --dupes-csv potential-duplicates.csv
 *   node scripts/cumulative-leaderboard.js --merged-csv cumulative-leaderboard-merged.csv
 */

const fs = require("node:fs");

const DB_URL = "https://digicert-product-quiz-default-rtdb.firebaseio.com";

// For the CSV export we want a narrower/high-confidence list than the console's 0.6.
const POTENTIAL_DUPES_SLUG_SIM_THRESHOLD = 0.85;

const QUIZ_IDS = [
  "week-1-key-sovereignty",
  "week-2-x9-extended-key-usage",
  "week-3-protocols",
  "week-4-acme",
  "week-5-trustcore",
  "week-6-dns",
  "week-7-tlm-part-1",
  "week-8-cert-central-part-1",
  "week-9-dns-part-2",
  "week-10-software-trust",
  "week-11-tlm-part-2",
  "week-12-compliance-dates",
  "week-13-root-strategy",
];

function getArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return null;
  const next = process.argv[idx + 1];
  if (!next || next.startsWith("-")) return "";
  return next;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
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
  const n = normalizeNameForMatch(name);
  return n ? n.split(" ") : [];
}

function parseNameParts(name) {
  const tokens = nameTokens(name);
  const first = tokens[0] || "";
  const last = tokens.length >= 2 ? tokens[tokens.length - 1] : "";
  const isLastInitial = last.length === 1 && /^[a-z]$/.test(last);
  const lastInitial = last ? last[0] : "";
  return { tokens, first, last, isLastInitial, lastInitial };
}

// Levenshtein distance for fuzzy matching
function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] =
        a[i - 1] === b[j - 1]
          ? matrix[i - 1][j - 1]
          : 1 + Math.min(matrix[i - 1][j], matrix[i][j - 1], matrix[i - 1][j - 1]);
    }
  }
  return matrix[a.length][b.length];
}

// Similarity score (0-1, higher = more similar)
function similarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

function isLikelyLastInitialVsLastName(nameA, nameB) {
  const a = parseNameParts(nameA);
  const b = parseNameParts(nameB);

  if (!a.first || !b.first) return false;
  if (!a.last || !b.last) return false;

  // First-name match: exact OR small typo tolerance for longer names.
  // This catches cases like "Riaan" vs "Riann".
  const firstSim = similarity(a.first, b.first);
  const firstMatches = a.first === b.first || (a.first.length >= 4 && b.first.length >= 4 && firstSim >= 0.8);
  if (!firstMatches) return false;

  // One side is a last initial, the other is a full last name starting with that initial.
  const aIsInitial = a.isLastInitial;
  const bIsInitial = b.isLastInitial;
  if (aIsInitial === bIsInitial) return false; // we only care about initial <-> full

  const initial = aIsInitial ? a.lastInitial : b.lastInitial;
  const fullLast = aIsInitial ? b.last : a.last;

  if (!initial || !fullLast) return false;
  if (fullLast.length < 2) return false;

  return fullLast[0] === initial;
}

function mergedTotalLowestOverlap(p1, p2) {
  const overlap = [];
  let mergedTotal = 0;

  for (const qid of QUIZ_IDS) {
    const s1 = p1?.quizzes?.[qid];
    const s2 = p2?.quizzes?.[qid];
    const has1 = typeof s1 === "number";
    const has2 = typeof s2 === "number";

    if (has1 && has2) {
      overlap.push({ quizId: qid, score1: s1, score2: s2, kept: Math.min(s1, s2) });
      mergedTotal += Math.min(s1, s2);
    } else if (has1) {
      mergedTotal += s1;
    } else if (has2) {
      mergedTotal += s2;
    }
  }

  return { mergedTotal, overlap };
}

function computePotentialDuplicateEdges(players, slugs) {
  const edges = [];

  // Slug-similarity pairs at a higher threshold.
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const sim = similarity(slugs[i], slugs[j]);
      if (sim >= POTENTIAL_DUPES_SLUG_SIM_THRESHOLD && sim < 1) {
        edges.push({
          method: "slug_similarity",
          score: sim,
          slug1: slugs[i],
          slug2: slugs[j],
        });
      }
    }
  }

  // Name-based: first name matches and last initial matches full last name initial.
  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const p1 = players[slugs[i]];
      const p2 = players[slugs[j]];
      if (!p1 || !p2) continue;
      if (isLikelyLastInitialVsLastName(p1.displayName, p2.displayName)) {
        edges.push({
          method: "last_initial_vs_lastname",
          score: null,
          slug1: slugs[i],
          slug2: slugs[j],
        });
      }
    }
  }

  // De-dupe (same pair may match both rules).
  const uniq = new Map(); // key => record
  for (const d of edges) {
    const a = d.slug1 < d.slug2 ? d.slug1 : d.slug2;
    const b = d.slug1 < d.slug2 ? d.slug2 : d.slug1;
    const key = `${a}__${b}`;
    const existing = uniq.get(key);
    if (!existing) {
      uniq.set(key, d);
      continue;
    }
    // Prefer whichever has a score (slug similarity), or higher score if both.
    if (existing.score == null && d.score != null) uniq.set(key, d);
    else if (existing.score != null && d.score != null && d.score > existing.score) uniq.set(key, d);
    else {
      // Merge method tags for extra context (works regardless of score presence).
      const merged = { ...existing };
      if (!String(merged.method).includes(d.method)) merged.method = `${merged.method}+${d.method}`;
      uniq.set(key, merged);
    }
  }

  return Array.from(uniq.values());
}

function buildUnionFind(items) {
  const parent = new Map();
  const rank = new Map();

  for (const it of items) {
    parent.set(it, it);
    rank.set(it, 0);
  }

  function find(x) {
    let p = parent.get(x);
    if (p === undefined) {
      parent.set(x, x);
      rank.set(x, 0);
      return x;
    }
    while (p !== parent.get(p)) {
      parent.set(p, parent.get(parent.get(p)));
      p = parent.get(p);
    }
    // Path compression
    let cur = x;
    while (parent.get(cur) !== p) {
      const next = parent.get(cur);
      parent.set(cur, p);
      cur = next;
    }
    return p;
  }

  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const rka = rank.get(ra) || 0;
    const rkb = rank.get(rb) || 0;
    if (rka < rkb) parent.set(ra, rb);
    else if (rka > rkb) parent.set(rb, ra);
    else {
      parent.set(rb, ra);
      rank.set(ra, rka + 1);
    }
  }

  return { find, union };
}

function chooseCanonicalDisplayName(members) {
  // Prefer a "fuller" name for the merged row (more tokens, non-initial last name, longer).
  let best = members[0]?.displayName || members[0]?.nameSlug || "";
  let bestScore = -Infinity;

  for (const m of members) {
    const name = m?.displayName || "";
    const { tokens, last, isLastInitial } = parseNameParts(name);
    const tokenCount = tokens.length;
    const hasFullLast = tokenCount >= 2 && !isLastInitial && String(last).length >= 2;
    const score =
      (hasFullLast ? 1000 : 0) +
      tokenCount * 10 +
      (name.length || 0) +
      (Object.keys(m?.quizzes || {}).length || 0) * 2 +
      (m?.total || 0) / 1000;

    if (score > bestScore) {
      bestScore = score;
      best = name || best;
    }
  }

  return best;
}

const AUTH_TOKEN = process.env.AUTH_TOKEN || "";

async function fetchLeaderboard(quizId) {
  let url = `${DB_URL}/leaderboard/${quizId}.json`;
  if (AUTH_TOKEN) {
    url += `?auth=${encodeURIComponent(AUTH_TOKEN)}`;
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.error(`Auth required for ${quizId} - see instructions below`);
        return null;
      }
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch ${quizId}:`, err.message);
    return null;
  }
}

async function main() {
  console.log("Fetching leaderboard data from all quizzes...\n");

  // Fetch all quiz data
  const allData = {};
  let authRequired = false;

  for (const quizId of QUIZ_IDS) {
    process.stdout.write(`  ${quizId}... `);
    const data = await fetchLeaderboard(quizId);
    if (data === null) {
      authRequired = true;
      console.log("❌ (auth required)");
    } else {
      const count = data ? Object.keys(data).length : 0;
      console.log(`✓ (${count} entries)`);
      allData[quizId] = data || {};
    }
  }

  if (authRequired) {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║  AUTH REQUIRED - The database requires authentication.         ║
║                                                                ║
║  Option 1: Temporarily allow public reads in Firebase Console  ║
║  Option 2: Export data manually from Firebase Console          ║
║  Option 3: Add auth token to this script (see below)           ║
╚════════════════════════════════════════════════════════════════╝

To add auth, get a token from browser DevTools while on the quiz:
  1. Open quiz in browser, open DevTools → Application → Local Storage
  2. Find 'firebaseAuth' and copy the idToken value
  3. Run: AUTH_TOKEN="your-token" node scripts/cumulative-leaderboard.js
`);
    process.exit(1);
  }

  // Aggregate by nameSlug
  const players = {}; // nameSlug -> { displayName, quizzes: { quizId: score }, total }

  for (const quizId of QUIZ_IDS) {
    const entries = allData[quizId];
    if (!entries) continue;

    for (const [uid, entry] of Object.entries(entries)) {
      const slug = entry.nameSlug || entry.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || uid;

      if (!players[slug]) {
        players[slug] = {
          displayName: entry.name,
          nameSlug: slug,
          quizzes: {},
          total: 0,
          uids: new Set(),
        };
      }

      players[slug].quizzes[quizId] = entry.score;
      players[slug].total += entry.score || 0;
      players[slug].uids.add(uid);

      // Keep the most recent display name (or longest, as a heuristic)
      if ((entry.name?.length || 0) > (players[slug].displayName?.length || 0)) {
        players[slug].displayName = entry.name;
      }
    }
  }

  // Convert to sorted array
  const leaderboard = Object.values(players)
    .map((p) => ({ ...p, uids: Array.from(p.uids) }))
    .sort((a, b) => b.total - a.total);

  // Find similar names (potential duplicates)
  const similarPairs = [];
  const slugs = Object.keys(players);

  for (let i = 0; i < slugs.length; i++) {
    for (let j = i + 1; j < slugs.length; j++) {
      const sim = similarity(slugs[i], slugs[j]);
      if (sim >= 0.6 && sim < 1) {
        similarPairs.push({
          name1: players[slugs[i]].displayName,
          slug1: slugs[i],
          name2: players[slugs[j]].displayName,
          slug2: slugs[j],
          similarity: (sim * 100).toFixed(0) + "%",
        });
      }
    }
  }

  // Output report
  console.log("\n" + "═".repeat(80));
  console.log("                    CUMULATIVE LEADERBOARD REPORT");
  console.log("═".repeat(80) + "\n");

  console.log(`Total unique players (by nameSlug): ${leaderboard.length}`);
  console.log(`Total quizzes: ${QUIZ_IDS.length}\n`);

  // Top scores table
  console.log("┌─────┬────────────────────────────┬─────────┬────────────────────────────────┐");
  console.log("│ Rank│ Player                     │ Total   │ Quizzes Played                 │");
  console.log("├─────┼────────────────────────────┼─────────┼────────────────────────────────┤");

  leaderboard.forEach((player, idx) => {
    const rank = String(idx + 1).padStart(3);
    const name = (player.displayName || player.nameSlug).slice(0, 26).padEnd(26);
    const total = String(player.total).padStart(7);
    const quizCount = `${Object.keys(player.quizzes).length}/${QUIZ_IDS.length} quizzes`.padEnd(30);
    console.log(`│ ${rank} │ ${name} │ ${total} │ ${quizCount} │`);
  });

  console.log("└─────┴────────────────────────────┴─────────┴────────────────────────────────┘");

  // Detailed breakdown
  console.log("\n\nDETAILED SCORES BY PLAYER:\n");

  leaderboard.forEach((player, idx) => {
    console.log(`${idx + 1}. ${player.displayName} (${player.nameSlug})`);
    console.log(`   Total: ${player.total} points across ${Object.keys(player.quizzes).length} quizzes`);

    const quizScores = QUIZ_IDS.map((qid) => {
      const score = player.quizzes[qid];
      const weekNum = qid.match(/week-(\d+)/)?.[1] || "?";
      return score !== undefined ? `W${weekNum}:${score}` : `W${weekNum}:-`;
    }).join(" ");
    console.log(`   ${quizScores}`);

    if (player.uids.length > 1) {
      console.log(`   ⚠️  Multiple UIDs detected (${player.uids.length}) - same name, different devices`);
    }
    console.log();
  });

  // Similar names warning
  if (similarPairs.length > 0) {
    console.log("\n" + "═".repeat(80));
    console.log("⚠️  POTENTIAL DUPLICATES (similar names - may be same person)");
    console.log("═".repeat(80) + "\n");

    similarPairs.forEach((pair) => {
      console.log(`  "${pair.name1}" ↔ "${pair.name2}" (${pair.similarity} similar)`);
      console.log(`     slugs: ${pair.slug1} / ${pair.slug2}\n`);
    });
  }

  // CSV output option
  console.log("\n" + "═".repeat(80));
  console.log("CSV FORMAT (copy below for spreadsheet import):");
  console.log("═".repeat(80) + "\n");

  const csvHeader = ["Rank", "Name", "NameSlug", "Total", ...QUIZ_IDS.map((q) => q.replace("week-", "W"))].join(",");
  console.log(csvHeader);

  const csvLines = [csvHeader];

  leaderboard.forEach((player, idx) => {
    const row = [
      idx + 1,
      `"${(player.displayName || "").replace(/"/g, '""')}"`,
      player.nameSlug,
      player.total,
      ...QUIZ_IDS.map((qid) => player.quizzes[qid] ?? ""),
    ].join(",");
    console.log(row);
    csvLines.push(row);
  });

  const csvPathArg = getArgValue("--csv");
  const shouldWriteCsv = csvPathArg !== null;
  if (shouldWriteCsv) {
    const outPath = csvPathArg || "cumulative-leaderboard.csv";
    fs.writeFileSync(outPath, csvLines.join("\n") + "\n", "utf8");
    console.log(`\nWrote CSV file: ${outPath}`);
  }

  // Potential duplicates CSV output option (high confidence list for cleanup/review).
  const dupesCsvArg = getArgValue("--dupes-csv");
  const shouldWriteDupesCsv = dupesCsvArg !== null;
  if (shouldWriteDupesCsv) {
    const outPath = dupesCsvArg || "potential-duplicates.csv";
    const dupesEdges = computePotentialDuplicateEdges(players, slugs);

    const dupesList = dupesEdges.map((d) => {
      const p1 = players[d.slug1];
      const p2 = players[d.slug2];
      const merged = mergedTotalLowestOverlap(p1, p2);
      return {
        method: d.method,
        score: d.score,
        name1: p1?.displayName || d.slug1,
        slug1: d.slug1,
        total1: p1?.total ?? 0,
        quizzes1: p1 ? Object.keys(p1.quizzes || {}).length : 0,
        name2: p2?.displayName || d.slug2,
        slug2: d.slug2,
        total2: p2?.total ?? 0,
        quizzes2: p2 ? Object.keys(p2.quizzes || {}).length : 0,
        overlapCount: merged.overlap.length,
        mergedTotalLowestOverlap: merged.mergedTotal,
        overlapDetails: merged.overlap
          .map((o) => {
            const weekNum = o.quizId.match(/week-(\d+)/)?.[1] || "?";
            // Example: W9: 300/250 -> 250
            return `W${weekNum}:${o.score1}/${o.score2}->${o.kept}`;
          })
          .join(" | "),
      };
    });

    dupesList.sort((a, b) => {
      const methodWeight = (m) => (m.includes("last_initial_vs_lastname") ? 0 : 1);
      const aw = methodWeight(a.method);
      const bw = methodWeight(b.method);
      if (aw !== bw) return aw - bw;
      const as = a.score ?? -1;
      const bs = b.score ?? -1;
      if (bs !== as) return bs - as;
      // Tie-breaker: higher combined total first.
      return (b.total1 + b.total2) - (a.total1 + a.total2);
    });

    const dupesHeader = [
      "Method",
      "Score",
      "Name1",
      "NameSlug1",
      "Total1",
      "QuizzesPlayed1",
      "Name2",
      "NameSlug2",
      "Total2",
      "QuizzesPlayed2",
      "OverlapQuizzes",
      "MergedTotalLowestOverlap",
      "SumTotals",
      "SumMinusMerged",
      "OverlapDetails",
    ].join(",");

    const dupesLines = [dupesHeader];
    for (const d of dupesList) {
      const sumTotals = (d.total1 || 0) + (d.total2 || 0);
      const sumMinusMerged = sumTotals - (d.mergedTotalLowestOverlap || 0);
      const row = [
        d.method,
        d.score == null ? "" : (d.score * 100).toFixed(0) + "%",
        `"${String(d.name1).replace(/"/g, '""')}"`,
        d.slug1,
        d.total1,
        d.quizzes1,
        `"${String(d.name2).replace(/"/g, '""')}"`,
        d.slug2,
        d.total2,
        d.quizzes2,
        d.overlapCount,
        d.mergedTotalLowestOverlap,
        sumTotals,
        sumMinusMerged,
        `"${String(d.overlapDetails || "").replace(/"/g, '""')}"`,
      ].join(",");
      dupesLines.push(row);
    }

    fs.writeFileSync(outPath, dupesLines.join("\n") + "\n", "utf8");
    console.log(`\nWrote potential duplicates CSV: ${outPath} (${dupesList.length} pairs)`);
  }

  // Fully merged cumulative leaderboard CSV output option.
  // Accepts all "likely duplicate" edges and merges connected components.
  const mergedCsvArg = getArgValue("--merged-csv");
  const shouldWriteMergedCsv = mergedCsvArg !== null;
  if (shouldWriteMergedCsv) {
    const outPath = mergedCsvArg || "cumulative-leaderboard-merged.csv";
    const dupesEdges = computePotentialDuplicateEdges(players, slugs);

    const uf = buildUnionFind(slugs);
    for (const e of dupesEdges) uf.union(e.slug1, e.slug2);

    const groupsByRoot = new Map(); // rootSlug -> member slugs
    for (const slug of slugs) {
      const root = uf.find(slug);
      if (!groupsByRoot.has(root)) groupsByRoot.set(root, []);
      groupsByRoot.get(root).push(slug);
    }

    const usedOutputSlugs = new Set();
    const mergedEntries = [];

    for (const memberSlugs of groupsByRoot.values()) {
      const members = memberSlugs.map((s) => players[s]).filter(Boolean);
      if (members.length === 0) continue;

      const mergedQuizzes = {};
      for (const qid of QUIZ_IDS) {
        const scores = [];
        for (const m of members) {
          const s = m?.quizzes?.[qid];
          if (typeof s === "number") scores.push(s);
        }
        if (scores.length > 0) mergedQuizzes[qid] = Math.min(...scores);
      }

      const total = Object.values(mergedQuizzes).reduce((sum, v) => sum + (v || 0), 0);
      const displayName = chooseCanonicalDisplayName(members);

      let outSlug = slugify(displayName) || members[0].nameSlug;
      if (!outSlug) outSlug = memberSlugs[0];
      // Ensure uniqueness in the output CSV.
      if (usedOutputSlugs.has(outSlug)) {
        let i = 2;
        while (usedOutputSlugs.has(`${outSlug}-${i}`)) i++;
        outSlug = `${outSlug}-${i}`;
      }
      usedOutputSlugs.add(outSlug);

      mergedEntries.push({
        displayName,
        nameSlug: outSlug,
        quizzes: mergedQuizzes,
        total,
      });
    }

    mergedEntries.sort((a, b) => b.total - a.total);

    const header = ["Rank", "Name", "NameSlug", "Total", ...QUIZ_IDS.map((q) => q.replace("week-", "W"))].join(",");
    const lines = [header];

    mergedEntries.forEach((p, idx) => {
      const row = [
        idx + 1,
        `"${String(p.displayName || "").replace(/"/g, '""')}"`,
        p.nameSlug,
        p.total,
        ...QUIZ_IDS.map((qid) => (p.quizzes[qid] ?? "")),
      ].join(",");
      lines.push(row);
    });

    fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
    console.log(`\nWrote merged cumulative leaderboard CSV: ${outPath} (${mergedEntries.length} players)`);
  }
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
