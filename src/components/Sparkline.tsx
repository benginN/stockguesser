/** 5Y weekly price line (indexed to 100), pure SVG, no labels that spoil anything. */
interface Props {
  series: number[];
  className?: string;
}

export default function Sparkline({ series, className }: Props) {
  if (series.length < 2) return null;
  const w = 280;
  const h = 64;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series
    .map(
      (v, i) =>
        `${((i / (series.length - 1)) * w).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`,
    )
    .join(" ");
  const up = series[series.length - 1] >= series[0];
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      role="img"
      aria-label={`5-year price trend, ${up ? "up" : "down"} ${Math.abs(series[series.length - 1] - 100).toFixed(0)}% overall`}
      preserveAspectRatio="none"
    >
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "var(--color-feedback-hit)" : "var(--color-feedback-near)"}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
