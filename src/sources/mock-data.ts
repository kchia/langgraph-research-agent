import type { ResearchFindings } from "../graph/state.js";

type MockDataEntry = Omit<ResearchFindings, "sources" | "rawData">;

export const MOCK_RESEARCH_DATA: Record<string, MockDataEntry> = {
  apple: {
    company: "Apple Inc.",
    recentNews:
      "Launched Vision Pro, expanding services revenue. Q4 earnings beat expectations with $89.5B revenue.",
    stockInfo:
      "AAPL trading at $195, up 45% YTD. Market cap: $3.0T. P/E ratio: 31.2.",
    keyDevelopments:
      "AI integration across product line with Apple Intelligence. M3 chip family rollout complete. Services revenue hit all-time high."
  },
  tesla: {
    company: "Tesla, Inc.",
    recentNews:
      "Cybertruck deliveries ramping up to 2,500/week. Q3 deliveries exceeded 435,000 vehicles.",
    stockInfo:
      "TSLA trading at $242, volatile quarter with 15% swings. Market cap: $770B.",
    keyDevelopments:
      "FSD v12 rollout with end-to-end neural networks. Energy storage deployments up 90% YoY. Megapack demand exceeds supply."
  },
  microsoft: {
    company: "Microsoft Corporation",
    recentNews:
      "Copilot integration across Office 365 suite. Azure revenue growth of 29% YoY.",
    stockInfo:
      "MSFT trading at $378, up 52% YTD. Market cap: $2.8T. Dividend yield: 0.8%.",
    keyDevelopments:
      "OpenAI partnership deepening with exclusive cloud deal. GitHub Copilot reached 1.3M paid subscribers. Xbox Game Pass at 34M subscribers."
  },
  amazon: {
    company: "Amazon.com, Inc.",
    recentNews:
      "AWS re:Invent announced new AI services. Prime membership exceeded 200M globally.",
    stockInfo: "AMZN trading at $153, up 68% YTD. Market cap: $1.6T.",
    keyDevelopments:
      "Bedrock AI platform gaining enterprise traction. One Medical integration complete. Drone delivery expanding to new markets."
  },
  google: {
    company: "Alphabet Inc. (Google)",
    recentNews:
      "Gemini Ultra launched as GPT-4 competitor. Antitrust ruling impact being assessed.",
    stockInfo: "GOOGL trading at $141, up 55% YTD. Market cap: $1.8T.",
    keyDevelopments:
      "Bard rebranded to Gemini. Cloud revenue crossed $10B/quarter. Waymo expanding robotaxi service."
  }
};
