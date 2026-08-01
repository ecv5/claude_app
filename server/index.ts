import express, { Request, Response } from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors({ origin: ["http://localhost:5173", "http://localhost:4173"] }));
app.use(express.json());

const FINNHUB_BASE = "https://finnhub.io/api/v1";

const TICKERS = ["NET", "AVGO", "LRCX", "AMAT"] as const;
type Ticker = (typeof TICKERS)[number];

interface FinnhubQuote {
  c: number; // current price
  d: number; // change
  dp: number; // percent change
  pc: number; // previous close
}

// Fetch JSON, returning null on any non-2xx or network/parse error so callers
// can degrade gracefully (some Finnhub endpoints are premium-gated).
async function fetchJSON<T = unknown>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

const round = (n: number) => Math.round(n);

// Finnhub reports market cap in millions of USD.
function fmtMarketCap(millions?: number): string {
  if (!millions || millions <= 0) return "—";
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`;
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
  return `$${Math.round(millions)}M`;
}

// "2026-09-02" -> "Sep 2, 2026"
function fmtDate(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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

interface FinnhubProfile {
  name?: string;
  marketCapitalization?: number; // millions USD
  finnhubIndustry?: string;
}
interface FinnhubMetricResp {
  metric?: Record<string, number>;
}
interface FinnhubEarnings {
  earningsCalendar?: { date?: string }[];
}

// Per-ticker fundamentals from Finnhub: profile (market cap), basic financials
// (52-week range, P/E, dividend yield, beta), and the next earnings date.
// Entry / trim / stop levels are derived from the live price and 52-week range
// (they are heuristics, not investment advice). Anthropic is no longer used —
// Finnhub's free tier has no analyst price targets or written analysis, so
// those qualitative fields are left to the front-end's static/editable data.
app.get("/api/stock/:ticker", async (req: Request, res: Response): Promise<void> => {
  const ticker = req.params.ticker.toUpperCase();
  if (!(TICKERS as readonly string[]).includes(ticker)) {
    res.status(400).json({ error: `Unknown ticker: ${ticker}` });
    return;
  }

  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    res.status(500).json({ error: "FINNHUB_API_KEY is not set (see .env.example)" });
    return;
  }

  const q = `symbol=${encodeURIComponent(ticker)}&token=${key}`;
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 400 * 86_400_000).toISOString().slice(0, 10);

  const [quote, profile, metricResp, earnings] = await Promise.all([
    fetchJSON<FinnhubQuote>(`${FINNHUB_BASE}/quote?${q}`),
    fetchJSON<FinnhubProfile>(`${FINNHUB_BASE}/stock/profile2?${q}`),
    fetchJSON<FinnhubMetricResp>(`${FINNHUB_BASE}/stock/metric?${q}&metric=all`),
    fetchJSON<FinnhubEarnings>(`${FINNHUB_BASE}/calendar/earnings?${q}&from=${from}&to=${to}`),
  ]);

  const price = quote && typeof quote.c === "number" && quote.c > 0 ? quote.c : null;
  if (price === null) {
    res.status(502).json({ error: `Finnhub returned no quote for ${ticker}` });
    return;
  }

  const m = metricResp?.metric ?? {};
  const high52 = m["52WeekHigh"];
  const low52 = m["52WeekLow"];
  const pe = m["peTTM"] ?? m["peBasicExclExtraTTM"];
  const divYield = m["dividendYieldIndicatedAnnual"] ?? m["currentDividendYieldTTM"];
  const beta = m["beta"];
  const marketCap = fmtMarketCap(profile?.marketCapitalization);

  // Next upcoming earnings date (earliest calendar entry on/after today).
  const upcoming = (earnings?.earningsCalendar ?? [])
    .map((e) => e.date)
    .filter((d): d is string => typeof d === "string" && d >= from)
    .sort()[0];
  const earningsDate = fmtDate(upcoming);

  // Technical levels derived from price + 52-week range (fallbacks when a
  // metric is missing). These are mechanical reference points, not advice.
  const hi = typeof high52 === "number" ? high52 : price * 1.2;
  const lo = typeof low52 === "number" ? low52 : price * 0.8;
  const entryLow = round(Math.max(lo, price * 0.93));
  const entryHigh = round(price * 0.99);
  const firstTrim = round(Math.max(hi, price * 1.08));
  const secondTrim = round(Math.max(hi * 1.12, price * 1.2));
  const stopLossVal = round(Math.max(lo, price * 0.85));

  const peStr = typeof pe === "number" && pe > 0 ? `${pe.toFixed(1)}x` : "N/A";
  const metrics: { label: string; value: string; target: string; status: "good" | "watch" | "risk" }[] = [
    { label: "Market Cap", value: marketCap, target: "—", status: "good" },
    { label: "P/E (TTM)", value: peStr, target: "—", status: typeof pe === "number" ? (pe < 40 ? "good" : pe < 80 ? "watch" : "risk") : "watch" },
    { label: "Dividend Yield", value: divYield ? `${divYield.toFixed(2)}%` : "None", target: "—", status: "good" },
    {
      label: "52-Wk Range",
      value: typeof low52 === "number" && typeof high52 === "number" ? `$${round(low52)}–$${round(high52)}` : "—",
      target: `Now $${round(price)}`,
      status: "good",
    },
  ];
  if (typeof beta === "number") {
    metrics.push({ label: "Beta", value: beta.toFixed(2), target: "—", status: beta < 1.2 ? "good" : "watch" });
  }

  const strategy = [
    { action: "Buy", level: `$${entryLow}–$${entryHigh}`, note: "Accumulation zone", rationale: "Just below current price", color: "bg-green-600" },
    { action: "Trim 25%", level: `$${firstTrim}`, note: "First target", rationale: "At/above the 52-week high", color: "bg-yellow-600" },
    { action: "Trim 25%", level: `$${secondTrim}`, note: "Extended target", rationale: "Breakout extension above range", color: "bg-orange-600" },
    { action: "Stop Loss", level: `Below $${stopLossVal}`, note: "Risk control", rationale: "~15% below current / near 52-week low", color: "bg-red-600" },
  ];

  res.json({
    ...(typeof high52 === "number" ? { high52: round(high52) } : {}),
    ...(typeof low52 === "number" ? { low52: round(low52) } : {}),
    marketCap,
    peRatio: peStr,
    dividend: divYield ? `${divYield.toFixed(2)}%` : "None",
    ...(earningsDate ? { earningsDate } : {}),
    entryRange: [entryLow, entryHigh],
    entryLabel: `$${entryLow}–$${entryHigh}`,
    firstTrim,
    secondTrim,
    stopLossVal,
    metrics,
    strategy,
  });
});

const PORT = parseInt(process.env.PORT ?? "3001", 10);
app.listen(PORT, () => console.log(`API server → http://localhost:${PORT}`));
