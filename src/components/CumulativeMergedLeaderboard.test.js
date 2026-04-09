import React, { act } from "react";
import { createRoot } from "react-dom/client";
import CumulativeMergedLeaderboard from "./CumulativeMergedLeaderboard";

function textResponse(text, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => text,
  };
}

let container;
let root;
let previousActEnvironment;

async function flushAsync(iterations = 6) {
  for (let index = 0; index < iterations; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function waitFor(check, iterations = 30) {
  for (let index = 0; index < iterations; index += 1) {
    await flushAsync();
    if (check()) return;
  }

  throw new Error(`Condition not met. Current DOM: ${container.textContent}`);
}

async function renderComponent() {
  await act(async () => {
    root.render(<CumulativeMergedLeaderboard />);
  });
}

describe("CumulativeMergedLeaderboard", () => {
  beforeAll(() => {
    previousActEnvironment = globalThis.IS_REACT_ACT_ENVIRONMENT;
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root.unmount();
      });
    }
    if (container) {
      container.remove();
    }
    jest.restoreAllMocks();
    delete global.fetch;
  });

  afterAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  it("parses quoted CSV rows and sorts total scores descending", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      textResponse(
        'Name,Total\n"Lee, Jr.",12\nAvery,30\n"Pat ""PJ"" Jones",20'
      )
    );

    await renderComponent();

    await waitFor(() => container.textContent.includes("Cumulative Leaderboard"));

    expect(container.textContent).toContain('Pat "PJ" Jones');
    expect(container.textContent).toContain("Lee, Jr.");

    const fullText = container.textContent;
    expect(fullText.indexOf("Avery")).toBeLessThan(
      fullText.indexOf('Pat "PJ" Jones')
    );
    expect(fullText.indexOf('Pat "PJ" Jones')).toBeLessThan(
      fullText.indexOf("Lee, Jr.")
    );
  });

  it("shows a helpful error when the CSV header is invalid", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      textResponse("Player,Points\nAlex,30")
    );

    await renderComponent();

    await waitFor(() =>
      container.textContent.includes("Failed to load cumulative leaderboard CSV.")
    );

    expect(container.textContent).toContain(
      "Generate it with: node scripts/cumulative-leaderboard.js --merged-csv public/cumulative-leaderboard-merged.csv"
    );
    expect(console.error).toHaveBeenCalled();
  });
});
