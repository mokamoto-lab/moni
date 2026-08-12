import type { TrendPoint } from "../types";

interface Props {
  points: TrendPoint[];
  color?: string;
}

/**
 * Minimal dependency-free sparkline. Renders nothing meaningful for <2 points,
 * which keeps empty/edge states clean.
 */
export function Sparkline({ points, color = "#2f6feb" }: Props) {
  if (points.length < 2) {
    return <div style={{ height: 40 }} />;
  }

  const width = 240;
  const height = 40;
  const pad = 3;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((p.value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1][0].toFixed(1)},${height} L${coords[0][0].toFixed(1)},${height} Z`;
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg className="spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-hidden="true">
      <path d={area} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} />
    </svg>
  );
}
