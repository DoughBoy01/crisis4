interface SparkLineProps {
  data: { value: number }[];
  width?: number;
  height?: number;
  positive: boolean;
}

export default function SparkLine({ data, width = 96, height = 36, positive }: SparkLineProps) {
  if (data.length < 2) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const color = positive ? '#22c55e' : '#ef4444';

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <path d={pathD} stroke={color} strokeWidth="1.5" fill="none" opacity="0.8" />
      <circle
        cx={parseFloat(points[points.length - 1].split(',')[0])}
        cy={parseFloat(points[points.length - 1].split(',')[1])}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}
