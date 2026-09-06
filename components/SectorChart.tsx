import type { SectorRow } from "@/lib/types";
import { fmtPct } from "@/lib/format";

/**
 * Grouped horizontal bars: average 1-month and 1-week performance of the
 * survivors in each sector. Both series are percentages on one shared axis —
 * never two scales.
 *
 * The strategy wants a theme leading on BOTH timeframes, so showing the two
 * side by side is the point: a sector long on the month but flat on the week
 * is rolling over, and that only shows up when you can see both.
 */
export default function SectorChart({ sectors }: { sectors: SectorRow[] }) {
  const rows = sectors.slice(0, 6);
  if (rows.length === 0) return <p className="empty">No sector data in this run.</p>;

  const values = rows.flatMap((r) => [r.avg_perf_1m, r.avg_perf_w]);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  // Percentage positions within the plot area.
  const zero = (-min / span) * 100;
  const barWidth = (v: number) => (Math.abs(v) / span) * 100;
  const barLeft = (v: number) => (v >= 0 ? zero : zero - barWidth(v));

  return (
    <>
      <div className="legend">
        <span className="key">
          <span
            className="swatch"
            style={{ background: "var(--series-1)" }}
            aria-hidden="true"
          />
          Avg 1-month
        </span>
        <span className="key">
          <span
            className="swatch"
            style={{ background: "var(--series-2)" }}
            aria-hidden="true"
          />
          Avg 1-week
        </span>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.sector} className="sector-row">
            <div className="sector-name">
              {r.sector}
              <span style={{ color: "var(--text-muted)" }}> · {r.count}</span>
            </div>

            <div className="sector-plot">
              {/* zero baseline */}
              <div className="sector-zero" style={{ left: `${zero}%` }} />
              <div
                className="sector-bar"
                title={`${r.sector} · avg 1-month ${fmtPct(r.avg_perf_1m)}`}
                style={{
                  top: 2,
                  left: `${barLeft(r.avg_perf_1m)}%`,
                  width: `${Math.max(barWidth(r.avg_perf_1m), 0.5)}%`,
                  background: "var(--series-1)",
                  borderRadius:
                    r.avg_perf_1m >= 0 ? "0 4px 4px 0" : "4px 0 0 4px",
                }}
              />
              <div
                className="sector-bar"
                title={`${r.sector} · avg 1-week ${fmtPct(r.avg_perf_w)}`}
                style={{
                  top: 12,
                  left: `${barLeft(r.avg_perf_w)}%`,
                  width: `${Math.max(barWidth(r.avg_perf_w), 0.5)}%`,
                  background: "var(--series-2)",
                  borderRadius: r.avg_perf_w >= 0 ? "0 4px 4px 0" : "4px 0 0 4px",
                }}
              />
            </div>

            <div className="sector-values">
              {fmtPct(r.avg_perf_1m)} / {fmtPct(r.avg_perf_w)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
