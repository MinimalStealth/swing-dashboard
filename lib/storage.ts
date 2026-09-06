import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { put, get, list } from "@vercel/blob";
import type { History, HistoryDay, Run } from "./types";

// Vercel Blob is the store: first-party, available on Hobby, no Marketplace
// database to provision. Two kinds of object live in it:
//
//   runs/<YYYY-MM-DD>.json  full run, one per day (what the home page reads)
//   history.json            rolling compact index (what the archive page reads)
//
// The store is created as PRIVATE, so blob URLs are not world-readable and
// every read goes through get() with the project's credentials.
//
// With no Blob credentials present the same interface falls back to a local
// .data/ directory, so `npm run dev` and `npm run seed` work before the store
// exists. Production always has credentials, so the fallback never runs there.

const ACCESS = "private" as const;
const HISTORY_PATH = "history.json";
const HISTORY_DAYS = 30;
/** Leaderboard depth kept per day — enough for a meaningful persistence view. */
export const HISTORY_ROWS_PER_DAY = 40;

const LOCAL_DIR = path.join(process.cwd(), ".data");

const usingBlob = () =>
  Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

export const runPath = (date: string) => `runs/${date}.json`;

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

async function readJson<T>(pathname: string): Promise<T | null> {
  try {
    if (!usingBlob()) {
      const raw = await fs.readFile(path.join(LOCAL_DIR, pathname), "utf8");
      return JSON.parse(raw) as T;
    }
    const res = await get(pathname, { access: ACCESS, useCache: false });
    if (!res || res.statusCode !== 200 || !res.stream) return null;
    return JSON.parse(await new Response(res.stream).text()) as T;
  } catch {
    // Missing blob/file, no store configured yet, or malformed JSON — the
    // pages treat all of these the same way: "no data yet".
    return null;
  }
}

async function writeJson(pathname: string, value: unknown): Promise<void> {
  const body = JSON.stringify(value);
  if (!usingBlob()) {
    const target = path.join(LOCAL_DIR, pathname);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, body, "utf8");
    return;
  }
  await put(pathname, body, {
    access: ACCESS,
    contentType: "application/json",
    allowOverwrite: true,
    addRandomSuffix: false,
    cacheControlMaxAge: 0,
  });
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export async function saveRun(run: Run): Promise<void> {
  await writeJson(runPath(run.date), run);
}

export async function getRun(date: string): Promise<Run | null> {
  return readJson<Run>(runPath(date));
}

/** Dates of stored runs, newest first. */
export async function listRunDates(limit = 60): Promise<string[]> {
  try {
    const names = usingBlob()
      ? (await list({ prefix: "runs/", limit })).blobs.map((b) => b.pathname)
      : (await fs.readdir(path.join(LOCAL_DIR, "runs"))).map((f) => `runs/${f}`);

    return names
      .map((p) => p.replace(/^runs\//, "").replace(/\.json$/, ""))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort()
      .reverse()
      .slice(0, limit);
  } catch {
    return [];
  }
}

/** The most recent run, or null before the first ingest. */
export async function getLatestRun(): Promise<Run | null> {
  const history = await getHistory();
  const newest = history?.days.at(-1)?.date ?? (await listRunDates(1))[0];
  return newest ? getRun(newest) : null;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export async function getHistory(): Promise<History | null> {
  return readJson<History>(HISTORY_PATH);
}

/**
 * Fold one run into history.json, replacing any existing entry for the same
 * date so a re-run overwrites rather than duplicates. Only one writer (the
 * scheduled task, once a day) touches this, so a read-modify-write is safe.
 */
export async function appendToHistory(run: Run): Promise<History> {
  const existing = await getHistory();
  const day = toHistoryDay(run);
  const days = (existing?.days ?? [])
    .filter((d) => d.date !== day.date)
    .concat(day)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-HISTORY_DAYS);

  const history: History = { updated_at: new Date().toISOString(), days };
  await writeJson(HISTORY_PATH, history);
  return history;
}

function toHistoryDay(run: Run): HistoryDay {
  const sectionsFor = (ticker: string) => {
    const s: Array<"overall" | "midcap" | "largecap"> = [];
    if (run.top_overall.some((p) => p.ticker === ticker)) s.push("overall");
    if (run.top_midcap.some((p) => p.ticker === ticker)) s.push("midcap");
    if (run.top_largecap.some((p) => p.ticker === ticker)) s.push("largecap");
    return s;
  };

  return {
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
      sections: sectionsFor(p.ticker),
    })),
  };
}
