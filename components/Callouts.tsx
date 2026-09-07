import type { Pick, Run } from "@/lib/types";

export default function Callouts({ run }: { run: Run }) {
  const published = dedupe([
    ...run.top_overall,
    ...run.top_midcap,
    ...run.top_largecap,
  ]);

  const actionable = published.filter(
    (p) => p.setup === "BREAKING OUT" || p.setup === "TIGHT / SETTING UP",
  );
  const breakingOut = published.filter((p) => p.setup === "BREAKING OUT");
  const earnings = published.filter((p) => p.earnings_risk);
  const unknownEarnings = published.filter((p) => p.days_to_earnings === null);

  const sectorCounts = new Map<string, number>();
  for (const p of published) {
    sectorCounts.set(p.sector, (sectorCounts.get(p.sector) ?? 0) + 1);
  }
  const [topSector, topSectorCount] = [...sectorCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0] ?? ["—", 0];
  const concentrated = published.length > 1 && topSectorCount / published.length >= 0.5;

  return (
    <div className="callouts">
      <div className="callout">
        <div className="label">⚡ Actionable now</div>
        <div className="value">{actionable.length}</div>
        <div className="sub">
          {actionable.length === 0
            ? "Nothing triggering — everything published is still just trending. See ⚡ in the tables below."
            : `${breakingOut.length} breaking out, ${
                actionable.length - breakingOut.length
              } tight and near the pivot — marked ⚡ in the tables below.`}
        </div>
      </div>

      <div className="callout">
        <div className="label">📋 Published picks</div>
        <div className="value">{published.length}</div>
        <div className="sub">
          {run.ranked_n} of {run.screened_n} screened names cleared the 8 EMA check.
        </div>
      </div>

      <div className="callout">
        <div className="label">
          {concentrated && <span className="dot dot-warning" aria-hidden="true" />}
          🧭 Sector concentration
        </div>
        <div className="value">
          {topSectorCount}/{published.length}
        </div>
        <div className="sub">
          {concentrated
            ? `Half or more sit in ${topSector} — that's one bet, not ${published.length}.`
            : `Most crowded: ${topSector}.`}
        </div>
      </div>

      <div className="callout">
        <div className="label">
          {earnings.length > 0 && (
            <span className="dot dot-warning" aria-hidden="true" />
          )}
          📅 Earnings inside the hold
        </div>
        <div className="value">{earnings.length}</div>
        <div className="sub">
          {earnings.length > 0
            ? `${earnings.map((p) => p.ticker).join(", ")} report within 7 days.`
            : unknownEarnings.length > 0
              ? `None flagged, but ${unknownEarnings.length} have no published date — unknown, not safe.`
              : "No reports within 7 days."}
        </div>
      </div>
    </div>
  );
}

function dedupe(picks: Pick[]): Pick[] {
  const seen = new Map<string, Pick>();
  for (const p of picks) if (!seen.has(p.ticker)) seen.set(p.ticker, p);
  return [...seen.values()];
}