import type { Pick } from "@/lib/types";
import { fmtCap, fmtPct, fmtPrice, setupClass } from "@/lib/format";
import { SETUP_ABBREV } from "@/lib/persistence";
import RiskBar from "./RiskBar";

/**
 * The compact table carries what you decide from. Everything the screener
 * computed is still reachable in the "All metrics" table below it, so no
 * value lives only in a tooltip.
 */
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
              <th scope="col">Risk</th>
              <th scope="col">Plan</th>
              <th scope="col">Earnings</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {picks.map((p) => (
              <tr key={p.ticker}>
                <td className="ticker">{p.ticker}</td>
                <td className="sector">{p.sector}</td>
                <td>
                  <span className={`chip chip-${setupClass(p.setup)}`} title={p.setup}>
                    <span className="dot" aria-hidden="true" />
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
                <td>{fmtPct(p.risk_pct)}</td>
                <td>
                  <RiskBar
                    stop={p.stop}
                    entry={p.entry_trigger}
                    trim={p.extension_trim_level}
                    price={p.price}
                  />
                </td>
                <td>
                  {p.days_to_earnings === null ? (
                    <span title="No earnings date published — unknown, not safe">?</span>
                  ) : p.earnings_risk ? (
                    <span className="flag flag-warning">
                      <span className="dot" aria-hidden="true" />
                      {p.days_to_earnings}d
                    </span>
                  ) : (
                    `${p.days_to_earnings}d`
                  )}
                </td>
                <td>{p.score.toFixed(1)}</td>
              </tr>
            ))}
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
