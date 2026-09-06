import { fmtPrice } from "@/lib/format";

/**
 * Stop → entry → 3x-ATR trim as one thin bar, with today's price marked.
 * Shows at a glance how much room the plan gives you above the trigger
 * relative to what you're risking below it.
 */
export default function RiskBar({
  stop,
  entry,
  trim,
  price,
}: {
  stop: number;
  entry: number;
  trim: number;
  price: number;
}) {
  const lo = Math.min(stop, entry, trim, price);
  const hi = Math.max(stop, entry, trim, price);
  const span = hi - lo;

  if (!Number.isFinite(span) || span <= 0) {
    return <span aria-hidden="true">—</span>;
  }

  const W = 96;
  const H = 14;
  const pad = 1;
  const inner = W - pad * 2;
  const x = (v: number) => pad + ((v - lo) / span) * inner;

  const riskW = Math.max(0, x(entry) - x(stop));
  const runwayStart = x(entry) + 2; // 2px surface gap between fills
  const runwayW = Math.max(0, x(trim) - runwayStart);

  const label = `Stop ${fmtPrice(stop)} · entry ${fmtPrice(entry)} · trim ${fmtPrice(
    trim,
  )} · now ${fmtPrice(price)}`;

  return (
    <svg
      className="riskbar"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <rect
        x={x(stop)}
        y={H / 2 - 3}
        width={riskW}
        height={6}
        rx={3}
        fill="var(--critical)"
        opacity={0.42}
      />
      <rect
        x={runwayStart}
        y={H / 2 - 3}
        width={runwayW}
        height={6}
        rx={3}
        fill="var(--series-1)"
        opacity={0.75}
      />
      <line
        x1={x(price)}
        x2={x(price)}
        y1={1}
        y2={H - 1}
        stroke="var(--surface)"
        strokeWidth={4}
      />
      <line
        x1={x(price)}
        x2={x(price)}
        y1={1.5}
        y2={H - 1.5}
        stroke="var(--text-primary)"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}
