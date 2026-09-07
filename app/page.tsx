import { getLatestRun } from "@/lib/storage";
import { fmtDate, fmtDateTime } from "@/lib/format";
import Masthead from "@/components/Masthead";
import RegimeBanner from "@/components/RegimeBanner";
import Callouts from "@/components/Callouts";
import PicksTable from "@/components/PicksTable";
import SectorChart from "@/components/SectorChart";

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
            Nothing has been published to this dashboard.
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
      <Masthead current="latest" meta={fmtDate(run.date) + " · generated " + fmtDateTime(run.generated_at)} />

      <RegimeBanner run={run} />
      <Callouts run={run} />

      <section className="card">
        <h2>Breaking out today</h2>
        <p className="card-note">
          Every screened name currently confirmed breaking out, across all names that cleared the screen, not just the ones that scored high enough for the picks tables below.
        </p>
        <PicksTable picks={run.all_ranked.filter((p) => p.setup === "BREAKING OUT")} emptyMessage="Nothing has technically triggered yet today." />
      </section>

      <section className="card">
        <h2>Top picks — all market caps</h2>
        <p className="card-note">Highest composite score across every survivor, regardless of size.</p>
        <PicksTable picks={run.top_overall} emptyMessage="No candidates cleared the filters in this run." />
      </section>

      <section className="card">
        <h2>Top mid-cap picks — $2B to $10B</h2>
        <p className="card-note">The size band the strategy's liquid-leader rule points at.</p>
        <PicksTable picks={run.top_midcap} emptyMessage="No mid-cap candidates cleared the filters in this run." />
      </section>

      <section className="card">
        <h2>Top large-cap picks — $10B and up</h2>
        <p className="card-note">Names you can size into without the spread working against you.</p>
        <PicksTable picks={run.top_largecap} emptyMessage="No large-cap candidates cleared the filters in this run." />
      </section>

      <section className="card">
        <h2>Where money is flowing</h2>
        <p className="card-note">Average performance of the surviving stocks in each sector.</p>
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
        Full definitions live on the <a href="/legend">Legend</a> tab. Setup: BRK closed above the 20-day pivot on volume confirmation, TGT tight and near the pivot, TRN trending with no trigger yet, EXT past the trim level. Not financial advice.
      </p>
    </main>
  );
}
