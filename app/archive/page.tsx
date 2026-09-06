import { getHistory, HISTORY_ROWS_PER_DAY } from "@/lib/storage";
import { buildPersistence, SETUP_ABBREV } from "@/lib/persistence";
import { fmtCap, fmtPrice, fmtSigned, setupClass } from "@/lib/format";
import Masthead from "@/components/Masthead";

export const revalidate = 60;

const WINDOWS = [7, 14, 30] as const;

export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.days);
  const days = (WINDOWS as readonly number[]).includes(requested) ? requested : 7;

  const history = await getHistory();
  const { window, rows } = buildPersistence(history, days);

  return (
    <main className="shell">
      <Masthead
        current="archive"
        meta={
          window.length > 0
            ? `${window.length} run${window.length === 1 ? "" : "s"} · ${
                window[0].date
              } to ${window.at(-1)!.date}`
            : undefined
        }
      />

      <div className="filters">
        <span className="filter-label">Window</span>
        {WINDOWS.map((w) => (
          <a
            key={w}
            href={`/archive?days=${w}`}
            aria-current={w === days ? "true" : undefined}
          >
            {w} days
          </a>
        ))}
      </div>

      {window.length === 0 ? (
        <div className="card">
          <h2>No history yet</h2>
          <p className="card-note">
            The archive fills in as the scheduled task publishes. Each run adds a
            column; persistence becomes meaningful after three or four sessions.
          </p>
        </div>
      ) : (
        <>
          <section className="card">
            <h2>Persistence</h2>
            <p className="card-note">
              Grouped by ticker rather than by day. A name that keeps reappearing
              while tightening is the pattern a single day&rsquo;s report cannot
              show you — and the one the strategy is actually looking for.
            </p>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Ticker</th>
                    <th scope="col">Sector</th>
                    <th scope="col">Days</th>
                    <th scope="col">Streak</th>
                    <th scope="col">Best rank</th>
                    <th scope="col">Latest setup</th>
                    <th scope="col">Score</th>
                    <th scope="col">&Delta; Score</th>
                    <th scope="col">Price</th>
                    <th scope="col">&Delta; Price</th>
                    <th scope="col" style={{ textAlign: "right" }}>
                      {window.length}-run timeline
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.ticker}>
                      <td className="ticker">
                        {r.ticker}
                        {r.everPublished && (
                          <span
                            title="Appeared in a published picks table"
                            style={{ color: "var(--text-muted)" }}
                          >
                            {" "}
                            &bull;
                          </span>
                        )}
                      </td>
                      <td className="sector">{r.sector}</td>
                      <td>
                        {r.appearances}/{window.length}
                      </td>
                      <td>{r.streak}</td>
                      <td>#{r.bestRank}</td>
                      <td>
                        <span
                          className={`chip chip-${setupClass(r.latestSetup)}`}
                          title={r.latestSetup}
                        >
                          <span className="dot" aria-hidden="true" />
                          {SETUP_ABBREV[r.latestSetup] ?? r.latestSetup}
                        </span>
                      </td>
                      <td>{r.latestScore.toFixed(1)}</td>
                      <td className={deltaClass(r.scoreDelta)}>
                        {fmtSigned(r.scoreDelta)}
                      </td>
                      <td>{fmtPrice(r.latestPrice)}</td>
                      <td className={deltaClass(r.priceChangePct)}>
                        {r.priceChangePct === null
                          ? "—"
                          : `${fmtSigned(r.priceChangePct)}%`}
                      </td>
                      <td>
                        <div className="timeline">
                          {r.timeline.map((slot, i) => {
                            const date = window[i].date;
                            if (!slot) {
                              return (
                                <span
                                  key={date}
                                  className="cell cell-empty"
                                  title={`${date} — not on the list`}
                                >
                                  ·
                                </span>
                              );
                            }
                            return (
                              <span
                                key={date}
                                className={`cell cell-${setupClass(slot.setup)}`}
                                title={`${date} — ${slot.setup}, rank #${slot.rank}, score ${slot.score.toFixed(1)}`}
                              >
                                {SETUP_ABBREV[slot.setup] ?? "?"}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>Runs in this window</h2>
            <p className="card-note">
              Regime on each day the screener published, oldest first.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Regime</th>
                    <th scope="col">Screened</th>
                    <th scope="col">Cleared 8 EMA</th>
                    <th scope="col">Tracked</th>
                  </tr>
                </thead>
                <tbody>
                  {window.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td>
                        <span className="flag">
                          <span
                            className={`dot ${
                              d.overall === "FAVORABLE"
                                ? "dot-good"
                                : d.overall === "MIXED"
                                  ? "dot-warning"
                                  : "dot-critical"
                            }`}
                            aria-hidden="true"
                          />
                          {d.overall}
                        </span>
                      </td>
                      <td>{d.screened_n}</td>
                      <td>{d.ranked_n}</td>
                      <td>{d.rows.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="footnote">
        Each run stores its top {HISTORY_ROWS_PER_DAY} ranked names, so a ticker dropping off the
        timeline means it fell out of that depth — not necessarily out of the
        screen entirely. A bullet beside a ticker means it appeared in a
        published picks table that day. Setup codes: BRK breaking out, TGT tight
        and setting up, TRN trending, EXT extended past the trim level.
      </p>
    </main>
  );
}

function deltaClass(n: number | null): string | undefined {
  if (n === null || n === 0) return undefined;
  return n > 0 ? "delta-up" : "delta-down";
}
