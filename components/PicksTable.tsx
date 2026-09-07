import type { Pick } from "@/lib/types";
import { fmtCap, fmtPct, fmtPrice, sectorEmoji, setupClass, setupEmoji } from "@/lib/format";
import { SETUP_ABBREV } from "@/lib/persistence";
import RiskBar from "./RiskBar";

const ACTIONABLE_SETUPS = new Set(["BREAKING OUT", "TIGHT / SETTING UP"]);

function rewardPct(p: Pick): number {
  return ((p.extension_trim_level - p.entry_trigger) / p.entry_trigger) * 100;
}

function riskReward(p: Pick): string {
  const reward = rewardPct(p);
  if (!p.risk_pct || p.risk_pct <= 0) return "—";
  return `1 : ${(reward / p.risk_pct).toFixed(1)}`;
}

function scoreClass(score: number): string {
  if (score >= 80) return "score-high";
  if (score >= 60) return "score-mid";
  return "score-low";
}

export default function PicksTable({
  picks,
  emptyMessage,
}: {
  picks: Pick[];
  emptyMessage: string;
}) {
  if (picks.length === 0) {
    return <p className="empty">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Ticker</th>
              <th scope="col">Sector</th>
              <th scope="col">Setup</th>
              <th scope="col">Price</th>
              <th scope="col">Mkt cap</th>
              <th scope="col">1M</th>
              <th scope="col">Rel vol</th>
              <th scope="col">From high</th>
              <th scope="col">Entry</th>
              <th scope="col">Stop</th>
              <th scope="col">Risk / Reward</th>
              <th scope="col">Earnings</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => {
              const actionable = ACTIONABLE_SETUPS.has(p.setup);
              const reward = rewardPct(p);
              return (
                <tr key={p.ticker}>
                  <td className="ticker">
                    {p.ticker}
                    {actionable && (
                      <span
                        aria-hidden="true"
                        title="Actionable now — breaking out or tight and near the pivot"
                      >
                        {" "}
                        ⚡
                      </span>
                    )}
                    {p.score >= 85 && (
                      <span aria-hidden="true" title="Score 85+">
                        {" "}
                        🔥
                      </span>
                    )}
                  </td>
                  <td className="sector">
                    <span aria-hidden="true">{sectorEmoji(p.sector)}</span> {p.sector}
                  </td>
                  <td>
                    <span className={`chip chip-${setupClass(p.setup)}`} title={p.setup}>
                      <span className="dot" aria-hidden="true" />
                      <span aria-hidden="true">{setupEmoji(p.setup)}</span>
                      {SETUP_ABBREV[p.setup] ?? p.setup}
                    </span>
                  </td>
                  <td>{fmtPrice(p.price)}</td>
                  <td>{fmtCap(p.market_cap)}</td>
                  <td>{fmtPct(p.perf_1m_pct)}</td>
                  <td>{p.rel_volume.toFixed(2)}x</td>
                  <td>{fmtPct(p.dist_from_52w_high_pct)}</td>
                  <td>{fmtPrice(p.entry_trigger)}</td>
                  <td>{fmtPrice(p.stop)}</td>
                  <td className="rr-cell">
                    <RiskBar
                      stop={p.stop}
                      entry={p.entry_trigger}
                      trim={p.extension_trim_level}
                      price={p.price}
                    />
                    <div className="rr-caption">
                      <span className="rr-risk">−{p.risk_pct.toFixed(1)}%</span>
                      <span className="rr-sep" aria-hidden="true">
                        ·
                      </span>
                      <span className="rr-reward">+{reward.toFixed(1)}%</span>
                      <span className="rr-ratio" title="Reward-to-risk ratio: potential gain to the trim level per unit of risk to the stop">
                        {riskReward(p)}
                      </span>
                    </div>
                  </td>
                  <td>
                    {p.days_to_earnings === null ? (
                      <span title="No earnings date published — unknown, not safe">❓</span>
                    ) : p.earnings_risk ? (
                      <span className="flag flag-warning">
                        <span className="dot" aria-hidden="true" />
                        <span aria-hidden="true">📅</span>
                        {p.days_to_earnings}d
                      </span>
                    ) : (
                      `${p.days_to_earnings}d`
                    )}
                  </td>
                  <td>
                    <span className={`score-badge ${scoreClass(p.score)}`}>{p.score.toFixed(1)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="tableview">
        <summary>All metrics</summary>
        <div className="table-wrap" style={{ marginTop: 10 }}>
          <table>
            <thead>
              <tr>
                <th scope="col">Ticker</th>
                <th scope="col">Industry</th>
                <th scope="col">1W</th>
                <th scope="col">1M</th>
                <th scope="col">3M</th>
                <th scope="col">ADR%</th>
                <th scope="col">Tight</th>
                <th scope="col">Vol dry-up</th>
                <th scope="col">Trim</th>
                <th scope="col">Leading sector</th>
                <th scope="col">Levels from</th>
              </tr>
            </thead>
            <tbody>
              {picks.map((p) => (
                <tr key={p.ticker}>
                  <td className="ticker">{p.ticker}</td>
                  <td className="sector">{p.industry}</td>
                  <td>{fmtPct(p.perf_w_pct)}</td>
                  <td>{fmtPct(p.perf_1m_pct)}</td>
                  <td>{fmtPct(p.perf_3m_pct)}</td>
                  <td>{fmtPct(p.adr_pct, 2)}</td>
                  <td>{p.tightness_ratio ?? "—"}</td>
                  <td>{p.vol_dryup_ratio ?? "—"}</td>
                  <td>{fmtPrice(p.extension_trim_level)}</td>
                  <td>{p.in_leading_sector ? "yes" : "no"}</td>
                  <td>
                    {p.levels_source === "yfinance" ? "daily bars" : "approximated"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
