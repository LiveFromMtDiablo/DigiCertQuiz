#!/usr/bin/env node
/**
 * Cumulative Leaderboard Generator
 *
 * Fetches all quiz leaderboard data and aggregates scores by nameSlug.
 * Flags potential duplicate players with similar names.
 *
 * Usage: node scripts/cumulative-leaderboard.js
 */

const DB_URL = "https://digicert-product-quiz-default-rtdb.firebaseio.com";

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
];

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

  leaderboard.forEach((player, idx) => {
    const row = [
      idx + 1,
      `"${(player.displayName || "").replace(/"/g, '""')}"`,
      player.nameSlug,
      player.total,
      ...QUIZ_IDS.map((qid) => player.quizzes[qid] ?? ""),
    ].join(",");
    console.log(row);
  });
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
