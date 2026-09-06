/**
 * Seed the local .data/ store from a screener_results.json so you can run the
 * dashboard before wiring up Vercel Blob.
 *
 *   node scripts/seed.mjs ../screener/screener_results.json
 *   node scripts/seed.mjs ../screener/screener_results.json --synth 6
 *
 * --synth N additionally fabricates N earlier days by perturbing the real run,
 * purely so the archive/persistence view has something to render locally. Do
 * not read anything into those numbers — they are shaped noise, not history.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--")) ?? "../screener/screener_results.json";
const synthIdx = args.indexOf("--synth");
const synthDays = synthIdx >= 0 ? Number(args[synthIdx + 1] ?? 6) : 0;

const DATA = path.join(process.cwd(), ".data");
const HISTORY_ROWS_PER_DAY = 40;
const HISTORY_DAYS = 30;

const raw = JSON.parse(await fs.readFile(source, "utf8"));

const baseRun = {
  date: raw.date ?? raw.generated_at.slice(0, 10),
  generated_at: raw.generated_at,
  regime: raw.regime,
  sectors: raw.sectors ?? [],
  screened_n: raw.screened_n ?? 0,
  ranked_n: raw.ranked_n ?? (raw.all_ranked?.length ?? 0),
  midcap_n: raw.midcap_n ?? 0,
  largecap_n: raw.largecap_n ?? 0,
  top_overall: raw.top_overall ?? [],
  top_midcap: raw.top_midcap ?? [],
  top_largecap: raw.top_largecap ?? [],
  all_ranked: (raw.all_ranked ?? []).slice(0, 200),
};

const runs = [baseRun];

// Fabricate earlier sessions so the persistence view has shape locally.
const SETUPS = ["TRENDING", "TIGHT / SETTING UP", "BREAKING OUT", "EXTENDED"];
let seed = 20260906;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};

for (let back = 1; back <= synthDays; back++) {
  const d = new Date(`${baseRun.date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - back);
  const date = d.toISOString().slice(0, 10);

  // Drop a slice of names and jitter the rest, so tickers appear and vanish.
  const ranked = baseRun.all_ranked
    .filter(() => rand() > 0.22)
    .map((p) => ({
      ...p,
      price: round2(p.price * (1 - back * 0.006 + (rand() - 0.5) * 0.03)),
      score: round1(Math.max(0, Math.min(100, p.score + (rand() - 0.5) * 9))),
      setup: rand() > 0.72 ? SETUPS[Math.floor(rand() * SETUPS.length)] : p.setup,
    }))
    .sort((a, b) => b.score - a.score);

  runs.push({
    ...baseRun,
    date,
    generated_at: `${date}T21:45:00+00:00`,
    ranked_n: ranked.length,
    all_ranked: ranked,
    top_overall: ranked.slice(0, 3),
    top_midcap: ranked.filter((p) => p.market_cap >= 2e9 && p.market_cap <= 1e10).slice(0, 3),
    top_largecap: ranked.filter((p) => p.market_cap >= 1e10).slice(0, 3),
  });
}

runs.sort((a, b) => a.date.localeCompare(b.date));

await fs.mkdir(path.join(DATA, "runs"), { recursive: true });
for (const run of runs) {
  await fs.writeFile(
    path.join(DATA, "runs", `${run.date}.json`),
    JSON.stringify(run),
    "utf8",
  );
}

const history = {
  updated_at: new Date().toISOString(),
  days: runs.slice(-HISTORY_DAYS).map((run) => ({
    date: run.date,
    generated_at: run.generated_at,
    overall: run.regime._overall,
    screened_n: run.screened_n,
    ranked_n: run.ranked_n,
    rows: run.all_ranked.slice(0, HISTORY_ROWS_PER_DAY).map((p, i) => ({
      ticker: p.ticker,
      sector: p.sector,
      setup: p.setup,
      score: p.score,
      price: p.price,
      market_cap: p.market_cap,
      entry_trigger: p.entry_trigger,
      stop: p.stop,
      rank: i + 1,
      sections: [
        run.top_overall.some((x) => x.ticker === p.ticker) && "overall",
        run.top_midcap.some((x) => x.ticker === p.ticker) && "midcap",
        run.top_largecap.some((x) => x.ticker === p.ticker) && "largecap",
      ].filter(Boolean),
    })),
  })),
};

await fs.writeFile(path.join(DATA, "history.json"), JSON.stringify(history), "utf8");

console.log(
  `Seeded ${runs.length} run(s) into .data/ (${runs[0].date} → ${runs.at(-1).date})` +
    (synthDays ? `, ${synthDays} of them synthetic` : ""),
);

function round1(n) {
  return Math.round(n * 10) / 10;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
