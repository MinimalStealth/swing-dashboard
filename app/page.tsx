import { getLatestRun } from "@/lib/storage";
import { fmtDate, fmtDateTime } from "@/lib/format";
import Masthead from "@/components/Masthead";
import RegimeBanner from "@/components/RegimeBanner";
import Callouts from "@/components/Callouts";
import PicksTable from "@/components/PicksTable";
import SectorChart from "@/components/SectorChart";

// Re-read at most once a minute. The screener publishes once a day, so this
// is fresh in practice while keeping blob reads off every request.
export const revalidate = 60;

export default async function LatestPage() {
  const run = await getLatestRun();

  if (!run) {
    return (
      <main className="shell">
        <Masthead current="latest" />
        <div className="card">
          <h2>No runs yet</h2>
          <p className="card-note">
            Nothing has been published to this dashboard. Run the screener with{" "}
            <code>--publish</code> pointed at <code>/api/ingest</code>, or check that{" "}
            <code>INGEST_SECRET</code> and the Blob store are configured on the
            deployment.
          </p>
        </div>
      </main>
    );
  }

  const approximate = run.all_ranked.some(
    (p) => p.levels_source === "tradingview-approx",
  );

  return (
    <main className="shell">
      <Masthead
        current="latest"
        meta={`${fmtDate(run.date)} · generated ${fmtDateTime(run.generated_at)}`}
      />

      <RegimeBanner run={run} />
      <Callouts run={run} />

      <section className="card">
        <h2>Top picks — all market caps</h2>
        <p className="card-note">
          Highest composite score across every survivor, regardless of size.
        </p>
        <PicksTable
          picks={run.top_overall}
          emptyMessage="No candidates cleared the filters in this run."
        />
      </section>

      <section className="card">
        <h2>Top mid-cap picks — $2B to $10B</h2>
        <p className="card-note">
          The size band the strategy&rsquo;s liquid-leader rule points at.
        </p>
        <PicksTable
          picks={run.top_midcap}
          emptyMessage="No mid-cap candidates cleared the filters in this run."
        />
      </section>

      <section className="card">
        <h2>Top large-cap picks — $10B and up</h2>
        <p className="card-note">
          Names you can size into without the spread working against you.
        </p>
        <PicksTable
          picks={run.top_largecap}
          emptyMessage="No large-cap candidates cleared the filters in this run."
        />
      </section>

      <section className="card">
        <h2>Where money is flowing</h2>
        <p className="card-note">
          Average performance of the surviving stocks in each sector. A theme
          leading on the month but flat on the week is already rolling over.
        </p>
        <SectorChart sectors={run.sectors} />

        <details className="tableview">
          <summary>Table view</summary>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Sector</th>
                  <th scope="col">Survivors</th>
                  <th scope="col">Avg 1M</th>
                  <th scope="col">Avg 1W</th>
                </tr>
              </thead>
              <tbody>
                {run.sectors.map((s) => (
                  <tr key={s.sector}>
                    <td>{s.sector}</td>
                    <td>{s.count}</td>
                    <td>{s.avg_perf_1m.toFixed(1)}%</td>
                    <td>{s.avg_perf_w.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <p className="footnote">
        <strong>Setup</strong> — BRK: closed above the 20-day pivot on volume
        confirmation. TGT: tight and within 8% of the pivot; set an alert at the
        entry. TRN: healthy trend, no trigger yet. EXT: past the 3&times;ATR
        extension where the strategy trims rather than buys.{" "}
        <strong>Plan</strong> shows the stop-to-entry risk in red and the runway
        to the trim level in blue, with today&rsquo;s price marked.{" "}
        <strong>Earnings</strong> marked <em>?</em> means no date was published —
        that is unknown, not safe.
        {approximate && (
          <>
            {" "}
            <strong>Levels in this run are TradingView approximations</strong> —
            yfinance was unavailable, so pivots and stops are estimated rather
            than taken from daily bars. Verify before acting on them.
          </>
        )}{" "}
        This screens quantifiable trend, momentum, volume and volatility criteria
        only. It cannot judge chart quality, news or catalysts, and both data
        sources are unofficial wrappers that can break without notice. Not
        financial advice.
      </p>
    </main>
  );
}
