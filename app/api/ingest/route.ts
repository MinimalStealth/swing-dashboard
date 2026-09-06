import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { appendToHistory, saveRun, HISTORY_ROWS_PER_DAY } from "@/lib/storage";
import type { Pick, Run } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Leaderboard depth stored in the full run blob. */
const MAX_RANKED = 200;

export async function POST(request: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "INGEST_SECRET is not configured on this deployment." },
      { status: 500 },
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body is not valid JSON." }, { status: 400 });
  }

  let run: Run;
  try {
    run = normalize(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload." },
      { status: 422 },
    );
  }

  await saveRun(run);
  const history = await appendToHistory(run);

  return NextResponse.json({
    ok: true,
    date: run.date,
    stored: {
      ranked: run.all_ranked.length,
      overall: run.top_overall.length,
      midcap: run.top_midcap.length,
      largecap: run.top_largecap.length,
    },
    history_days: history.days.length,
  });
}

function authorized(request: Request, secret: string): boolean {
  const header =
    request.headers.get("x-ingest-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  // timingSafeEqual throws on length mismatch, so compare lengths first.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Accept what swing_screener.py already produces and coerce it into the
 * stored shape. Deliberately forgiving about extra keys — the screener can
 * add fields without breaking ingest — but strict about the ones the
 * dashboard actually renders.
 */
function normalize(payload: unknown): Run {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Payload must be a JSON object.");
  }
  const p = payload as Record<string, unknown>;

  const generated_at =
    typeof p.generated_at === "string" ? p.generated_at : new Date().toISOString();
  const date =
    typeof p.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.date)
      ? p.date
      : generated_at.slice(0, 10);

  const regime = (p.regime ?? {}) as Run["regime"];
  if (!regime._overall) {
    throw new Error("regime._overall is required.");
  }

  const all_ranked = asPicks(p.all_ranked).slice(0, MAX_RANKED);
  if (all_ranked.length === 0) {
    throw new Error("all_ranked is empty — nothing to store.");
  }
  if (all_ranked.length < HISTORY_ROWS_PER_DAY) {
    // Not an error: a thin day is still a valid day.
  }

  return {
    date,
    generated_at,
    regime,
    sectors: Array.isArray(p.sectors) ? (p.sectors as Run["sectors"]) : [],
    screened_n: num(p.screened_n) ?? 0,
    ranked_n: num(p.ranked_n) ?? all_ranked.length,
    midcap_n: num(p.midcap_n) ?? 0,
    largecap_n: num(p.largecap_n) ?? 0,
    top_overall: asPicks(p.top_overall),
    top_midcap: asPicks(p.top_midcap),
    top_largecap: asPicks(p.top_largecap),
    all_ranked,
  };
}

function asPicks(value: unknown): Pick[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is Pick =>
      typeof row === "object" &&
      row !== null &&
      typeof (row as Pick).ticker === "string" &&
      typeof (row as Pick).score === "number",
  );
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
