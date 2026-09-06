// Shape of the data the screener publishes. Mirrors the keys that
// swing_screener.py already writes into screener_results.json, so the
// publish step is a straight POST of what the script already computes.

export type SetupLabel =
  | "BREAKING OUT"
  | "TIGHT / SETTING UP"
  | "TRENDING"
  | "EXTENDED";

export type RegimeOverall = "FAVORABLE" | "MIXED" | "UNFAVORABLE";

export interface RegimeIndex {
  price: number;
  ema8: number;
  ema21: number;
  ema50: number;
  status: string;
}

/**
 * The screener emits the index rows and the `_overall` verdict side by side in
 * one object ({ SPY: {...}, QQQ: {...}, _overall: "FAVORABLE" }), so the map
 * holds two different value shapes. `regimeIndices()` is the safe way to read
 * the index rows out of it.
 */
export interface RegimeMap {
  _overall: RegimeOverall;
  [index: string]: RegimeIndex | RegimeOverall;
}

export function regimeIndices(regime: RegimeMap): Array<[string, RegimeIndex]> {
  return Object.entries(regime).filter(
    (entry): entry is [string, RegimeIndex] =>
      !entry[0].startsWith("_") &&
      typeof entry[1] === "object" &&
      entry[1] !== null &&
      "price" in entry[1],
  );
}

export interface Pick {
  ticker: string;
  sector: string;
  industry: string;
  price: number;
  market_cap: number;
  perf_w_pct: number;
  perf_1m_pct: number;
  perf_3m_pct: number;
  rel_volume: number;
  adr_pct: number;
  tightness_ratio: number | null;
  dist_from_52w_high_pct: number;
  vol_dryup_ratio: number | null;
  in_leading_sector: boolean;
  setup: SetupLabel | string;
  days_to_earnings: number | null;
  earnings_risk: boolean;
  levels_source: string;
  entry_trigger: number;
  stop: number;
  risk_pct: number;
  extension_trim_level: number;
  score: number;
}

export interface SectorRow {
  sector: string;
  count: number;
  avg_perf_1m: number;
  avg_perf_w: number;
}

/** One screener run, exactly as stored at runs/<date>.json */
export interface Run {
  /** Trading date this run covers, YYYY-MM-DD (UTC). */
  date: string;
  generated_at: string;
  regime: RegimeMap;
  sectors: SectorRow[];
  screened_n: number;
  ranked_n: number;
  midcap_n: number;
  largecap_n: number;
  top_overall: Pick[];
  top_midcap: Pick[];
  top_largecap: Pick[];
  /** Trimmed leaderboard kept for the persistence view. */
  all_ranked: Pick[];
}

/** Compact per-day entry inside history.json. */
export interface HistoryDay {
  date: string;
  generated_at: string;
  overall: RegimeOverall;
  screened_n: number;
  ranked_n: number;
  rows: HistoryRow[];
}

export interface HistoryRow {
  ticker: string;
  sector: string;
  setup: string;
  score: number;
  price: number;
  market_cap: number;
  entry_trigger: number;
  stop: number;
  rank: number;
  /** Which published sections this ticker appeared in that day. */
  sections: Array<"overall" | "midcap" | "largecap">;
}

export interface History {
  updated_at: string;
  days: HistoryDay[];
}

/** A ticker rolled up across the window, for the archive page. */
export interface Persistence {
  ticker: string;
  sector: string;
  appearances: number;
  firstSeen: string;
  lastSeen: string;
  /** Consecutive days appearing, counting back from the newest run. */
  streak: number;
  bestRank: number;
  latestScore: number;
  scoreDelta: number | null;
  latestSetup: string;
  latestPrice: number;
  priceChangePct: number | null;
  everPublished: boolean;
  /** One slot per day in the window, oldest first. null = absent that day. */
  timeline: Array<{ date: string; setup: string; score: number; rank: number } | null>;
}
