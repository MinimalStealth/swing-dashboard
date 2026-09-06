import { regimeIndices, type Run } from "@/lib/types";

const VERDICT = {
  FAVORABLE: {
    dot: "dot-good",
    line: "Stage 2 advance — breakouts have the tailwind the strategy wants.",
  },
  MIXED: {
    dot: "dot-warning",
    line: "Not cleanly stacked. The strategy's own rule is to be selective and size down here.",
  },
  UNFAVORABLE: {
    dot: "dot-critical",
    line: "Below the 50 EMA. The strategy says sit in cash — treat everything below as a watchlist, not a buy list.",
  },
} as const;

export default function RegimeBanner({ run }: { run: Run }) {
  const overall = run.regime._overall;
  const verdict = VERDICT[overall] ?? VERDICT.MIXED;
  const indices = regimeIndices(run.regime);

  return (
    <div className="card">
      <h2>Market regime</h2>
      <div className="regime">
        <div style={{ flex: "1 1 300px" }}>
          <div className="regime-verdict">
            <span className={`dot ${verdict.dot}`} aria-hidden="true" />
            {overall}
          </div>
          <p className="regime-line">{verdict.line}</p>
        </div>

        <div className="index-grid">
          {indices.map(([name, v]) => (
            <div className="index-block" key={name}>
              <div className="sym">{name}</div>
              <div className="px">${v.price.toFixed(2)}</div>
              <div className="emas">
                8 {v.ema8.toFixed(2)} · 21 {v.ema21.toFixed(2)} · 50{" "}
                {v.ema50.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
