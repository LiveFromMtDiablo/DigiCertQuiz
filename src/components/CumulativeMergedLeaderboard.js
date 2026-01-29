import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";

const SCREEN_BACKGROUND_STYLE = {
  backgroundImage:
    'url("/images/quiz_background2.png"), linear-gradient(to bottom right, #3b82f6, #9333ea)',
  backgroundRepeat: "no-repeat, no-repeat",
  backgroundAttachment: "fixed, fixed",
  backgroundPosition: "top left, center",
  backgroundSize: "auto, cover",
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (ch === "\n") {
      row.push(field);
      field = "";
      // Ignore completely empty trailing line(s).
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }

    if (ch === "\r") continue;

    field += ch;
  }

  // Flush last row if file doesn't end with newline.
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);

  return rows;
}

function toNumber(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

export default function CumulativeMergedLeaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const csvUrl = useMemo(() => `/cumulative-leaderboard-merged.csv?t=${Date.now()}`, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch(csvUrl, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const text = await res.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error("CSV had no data rows");

      const header = rows[0];
      const idxName = header.indexOf("Name");
      const idxTotal = header.indexOf("Total");
      if (idxName === -1 || idxTotal === -1) {
        throw new Error('CSV header missing required columns ("Name", "Total")');
      }

      const parsed = rows
        .slice(1)
        .map((r) => ({
          name: r[idxName] || "",
          total: toNumber(r[idxTotal]) ?? 0,
        }))
        .filter((r) => r.name.trim().length > 0)
        .sort((a, b) => b.total - a.total);

      setEntries(parsed);
    } catch (e) {
      console.error(e);
      setEntries([]);
      setError(
        `Failed to load cumulative leaderboard CSV. Make sure the merged file is at public/cumulative-leaderboard-merged.csv (so it loads from /cumulative-leaderboard-merged.csv).`
      );
    } finally {
      setLoading(false);
    }
  }, [csvUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const top30 = useMemo(() => entries.slice(0, 30), [entries]);
  const columns = useMemo(
    () => [top30.slice(0, 10), top30.slice(10, 20), top30.slice(20, 30)],
    [top30]
  );

  const TROPHY_COLORS = ["text-yellow-500", "text-gray-400", "text-orange-500"];

  const today = useMemo(() => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(new Date());
    } catch (_) {
      return new Date().toLocaleDateString();
    }
  }, []);

  return (
    <div className="min-h-screen overflow-hidden p-6" style={SCREEN_BACKGROUND_STYLE}>
      <div className="mx-auto w-full max-w-6xl bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl p-8">
        <div className="flex items-center justify-between border-b pb-4 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src="/images/digicert-blue-logo-large.jpg"
              alt="DigiCert"
              className="h-10 w-auto object-contain"
            />
            <div className="min-w-0">
              <h1 className="text-2xl font-bold truncate" style={{ color: "#0e75ba" }}>
                Cumulative Leaderboard
              </h1>
              <p className="text-gray-600 text-sm">
                Last refreshed: {today}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-800">Top 30 — Total Points</p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 p-3 rounded bg-red-100 border border-red-300 text-red-800">
            <div className="font-semibold mb-1">{error}</div>
            <div className="text-sm">
              Generate it with:{" "}
              <code className="font-mono">
                node scripts/cumulative-leaderboard.js --merged-csv
                public/cumulative-leaderboard-merged.csv
              </code>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="text-center text-gray-600">Loading leaderboard…</p>
        ) : top30.length === 0 ? (
          <p className="text-center text-gray-600">No scores yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-x-8">
            {columns.map((col, colIdx) => (
              <div key={colIdx} className="divide-y divide-gray-100">
                {col.map((entry, rowIdx) => {
                  const rank = colIdx * 10 + rowIdx + 1;
                  const accent =
                    rank === 1
                      ? "text-yellow-500"
                      : rank === 2
                      ? "text-gray-400"
                      : rank === 3
                      ? "text-orange-500"
                      : "text-gray-500";
                  return (
                    <div
                      key={`${entry.name}-${rank}`}
                      className="flex items-center justify-between h-9 px-2"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-8 text-right font-semibold ${accent}`}>{rank}.</span>
                        <span className="truncate font-medium text-gray-800">{entry.name}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {rank <= 3 ? (
                          <Trophy
                            className={`w-5 h-5 ${TROPHY_COLORS[rank - 1]}`}
                            aria-hidden="true"
                          />
                        ) : null}
                        <span className="font-bold text-blue-600">{entry.total}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
