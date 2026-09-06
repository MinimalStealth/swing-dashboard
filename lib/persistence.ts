import type { History, HistoryDay, Persistence } from "./types";

/**
 * Roll the last `days` runs up by ticker rather than by date.
 *
 * This is the whole point of the archive page: a single day's report can't
 * tell you that a name has been tightening on the list for six sessions
 * running, and that pattern is more informative than any one snapshot.
 */
export function buildPersistence(
  history: History | null,
  days: number,
): { window: HistoryDay[]; rows: Persistence[] } {
  const window = (history?.days ?? []).slice(-days);
  if (window.length === 0) return { window, rows: [] };

  const dates = window.map((d) => d.date);
  const byTicker = new Map<string, Persistence>();

  window.forEach((day, dayIndex) => {
    for (const row of day.rows) {
      let entry = byTicker.get(row.ticker);
      if (!entry) {
        entry = {
          ticker: row.ticker,
          sector: row.sector,
          appearances: 0,
          firstSeen: day.date,
          lastSeen: day.date,
          streak: 0,
          bestRank: row.rank,
          latestScore: row.score,
          scoreDelta: null,
          latestSetup: row.setup,
          latestPrice: row.price,
          priceChangePct: null,
          everPublished: false,
          timeline: dates.map(() => null),
        };
        byTicker.set(row.ticker, entry);
      }

      entry.appearances += 1;
      entry.lastSeen = day.date;
      entry.sector = row.sector;
      entry.bestRank = Math.min(entry.bestRank, row.rank);
      entry.everPublished ||= row.sections.length > 0;
      entry.timeline[dayIndex] = {
        date: day.date,
        setup: row.setup,
        score: row.score,
        rank: row.rank,
      };
    }
  });

  for (const entry of byTicker.values()) {
    const seen = entry.timeline.filter((t) => t !== null) as NonNullable<
      Persistence["timeline"][number]
    >[];
    const latest = seen.at(-1)!;
    const earliest = seen[0]!;

    entry.latestScore = latest.score;
    entry.latestSetup = latest.setup;
    entry.scoreDelta = seen.length > 1 ? round1(latest.score - earliest.score) : null;

    // Consecutive days present, counting back from the newest run in the window.
    let streak = 0;
    for (let i = entry.timeline.length - 1; i >= 0; i--) {
      if (entry.timeline[i]) streak++;
      else break;
    }
    entry.streak = streak;

    const firstPrice = priceOn(window, entry.ticker, entry.firstSeen);
    const lastPrice = priceOn(window, entry.ticker, entry.lastSeen);
    entry.latestPrice = lastPrice ?? entry.latestPrice;
    entry.priceChangePct =
      firstPrice && lastPrice && seen.length > 1
        ? round1(((lastPrice - firstPrice) / firstPrice) * 100)
        : null;
  }

  const rows = [...byTicker.values()].sort(
    (a, b) =>
      b.appearances - a.appearances ||
      b.streak - a.streak ||
      a.bestRank - b.bestRank ||
      a.ticker.localeCompare(b.ticker),
  );

  return { window, rows };
}

function priceOn(window: HistoryDay[], ticker: string, date: string): number | null {
  const day = window.find((d) => d.date === date);
  return day?.rows.find((r) => r.ticker === ticker)?.price ?? null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Setup labels ordered by how close the strategy is to an actual entry. */
export const SETUP_ORDER: Record<string, number> = {
  TRENDING: 1,
  "TIGHT / SETTING UP": 2,
  "BREAKING OUT": 3,
  EXTENDED: 0,
};

export const SETUP_ABBREV: Record<string, string> = {
  TRENDING: "TRN",
  "TIGHT / SETTING UP": "TGT",
  "BREAKING OUT": "BRK",
  EXTENDED: "EXT",
};
