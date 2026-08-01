import express, { Request, Response } from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const app = express();
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:4173"] }));
app.use(express.json());

// Lazily construct the Anthropic client so the server still boots (and the
// Finnhub-backed /api/prices endpoint still works) when only FINNHUB_API_KEY
// is configured. `new Anthropic()` throws when ANTHROPIC_API_KEY is missing.
let _anthropic: Anthropic | null = null;
const anthropic = () => (_anthropic ??= new Anthropic());

const FINNHUB_BASE = "https://finnhub.io/api/v1";

const TICKERS = ["NET", "AVGO", "LRCX", "AMAT"] as const;
type Ticker = (typeof TICKERS)[number];

const textOf = (content: Anthropic.Message["content"]) =>
  content.reduce((acc, b) => acc + (b.type === "text" ? b.text : ""), "");

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  pc: number; // previous close
}

// Real-time quotes from Finnhub. Returns a { ticker: price } map so the
// existing front end ("Update Prices" button) keeps working unchanged.
app.get("/api/prices", async (_req: Request, res: Response): Promise<void> => {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    res.status(500).json({ error: "FINNHUB_API_KEY is not set (see .env.example)" });
    return;
  }

  try {
    const results = await Promise.all(
      TICKERS.map(async (t): Promise<[Ticker, number | null]> => {
        const r = await fetch(`${FINNHUB_BASE}/quote?symbol=${t}&token=${key}`);
        if (!r.ok) throw new Error(`Finnhub returned ${r.status} for ${t}`);
        const q = (await r.json()) as FinnhubQuote;
        return [t, typeof q.c === "number" && q.c > 0 ? q.c : null];
      })
    );

    const updates: Partial<Record<Ticker, number>> = {};
    for (const [t, price] of results) if (price !== null) updates[t] = price;

    if (!Object.keys(updates).length) {
      res.status(502).json({ error: "Finnhub returned no valid prices" });
      return;
    }
    res.json(updates);
  } catch (err) {
    res.status(502).json({ error: `Failed to fetch prices: ${String(err)}` });
  }
});

app.get("/api/stock/:ticker", async (req: Request, res: Response): Promise<void> => {
  const ticker = req.params.ticker.toUpperCase();
  if (!(TICKERS as readonly string[]).includes(ticker)) {
    res.status(400).json({ error: `Unknown ticker: ${ticker}` });
    return;
  }

  try {
    const response = await anthropic().messages.create({
      model: "claude-opus-4-7",
      max_tokens: 2048,
      tools: [{ type: "web_search_20260209", name: "web_search" }],
      messages: [
        {
          role: "user",
          content:
            `Search the web for current analyst data on ${ticker} and return ONLY a valid JSON object with these fields: ` +
            `analystTarget (number), high52 (number), low52 (number), marketCap (string), peRatio (string), ` +
            `dividend (string), earningsDate (string), entryRange ([number, number]), entryLabel (string like "$180–$200"), ` +
            `firstTrim (number), secondTrim (number), stopLossVal (number), thesis (string, 1-2 sentences), ` +
            `risks (string[3]), metrics ({label,value,target,status:"good"|"watch"|"risk"}[]), ` +
            `watchlist (string[5-7]), strategy ({action,level,note,rationale,color:Tailwind-bg-class}[4]). ` +
            `Base levels on current price and technicals. Return ONLY the JSON, no markdown.`,
        },
      ],
    });

    const text = textOf(response.content);
    const clean = text.replace(/```json|```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");

    if (start === -1 || end === -1) {
      res.status(502).json({ error: "No JSON in AI response" });
      return;
    }

    res.json(JSON.parse(clean.slice(start, end + 1)));
  } catch (err) {
    if (err instanceof Anthropic.APIError) {
      res.status(err.status ?? 500).json({ error: err.message });
    } else if (err instanceof SyntaxError) {
      res.status(502).json({ error: "Failed to parse JSON from AI response" });
    } else {
      res.status(500).json({ error: String(err) });
    }
  }
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);
app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`));
