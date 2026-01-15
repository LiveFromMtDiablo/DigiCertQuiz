const { sortLeaderboardEntries } = require("./leaderboardSort");

describe("leaderboardSort", () => {
  it("sorts by score descending", () => {
    const entries = [
      { name: "A", score: 100, timestamp: 1 },
      { name: "B", score: 200, timestamp: 2 },
      { name: "C", score: 150, timestamp: 3 },
    ];

    const sorted = sortLeaderboardEntries(entries);
    expect(sorted.map((e) => e.name)).toEqual(["B", "C", "A"]);
  });

  it("breaks score ties by earliest timestamp first", () => {
    const entries = [
      { name: "First", score: 360, timestamp: 1000 },
      { name: "Second", score: 360, timestamp: 2000 },
      { name: "Third", score: 360, timestamp: 1500 },
    ];

    const sorted = sortLeaderboardEntries(entries);
    expect(sorted.map((e) => e.name)).toEqual(["First", "Third", "Second"]);
  });

  it("pushes missing timestamps below known ones for equal scores", () => {
    const entries = [
      { name: "Known", score: 360, timestamp: 1000 },
      { name: "Unknown", score: 360 },
    ];

    const sorted = sortLeaderboardEntries(entries);
    expect(sorted.map((e) => e.name)).toEqual(["Known", "Unknown"]);
  });
});

