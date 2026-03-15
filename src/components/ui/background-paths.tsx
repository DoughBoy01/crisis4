export function BackgroundPaths({ className }: { className?: string }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5} -${189 + i * 6}C-${380 - i * 5} -${189 + i * 6} -${312 - i * 5} ${216 - i * 6} ${152 - i * 5} ${343 - i * 6}C${616 - i * 5} ${470 - i * 6} ${684 - i * 5} ${875 - i * 6} ${684 - i * 5} ${875 - i * 6}`,
    opacity: 0.04 + i * 0.013,
    width: 0.5 + i * 0.028,
    duration: 22 + i * 0.6,
    delay: -(i * 0.55),
  }));

  const mirroredPaths = Array.from({ length: 36 }, (_, i) => ({
    id: i + 36,
    d: `M-${380 + i * 5} -${189 + i * 6}C-${380 + i * 5} -${189 + i * 6} -${312 + i * 5} ${216 - i * 6} ${152 + i * 5} ${343 - i * 6}C${616 + i * 5} ${470 - i * 6} ${684 + i * 5} ${875 - i * 6} ${684 + i * 5} ${875 - i * 6}`,
    opacity: 0.03 + i * 0.01,
    width: 0.4 + i * 0.022,
    duration: 26 + i * 0.5,
    delay: -(i * 0.45 + 3),
  }));

  const allPaths = [...paths, ...mirroredPaths];

  const styleBlock = allPaths.map((p) => `
    @keyframes flow-${p.id} {
      0%   { stroke-dashoffset: 1400; opacity: 0; }
      8%   { opacity: ${p.opacity * 0.4}; }
      25%  { opacity: ${p.opacity}; }
      75%  { opacity: ${p.opacity}; }
      92%  { opacity: ${p.opacity * 0.4}; }
      100% { stroke-dashoffset: -1400; opacity: 0; }
    }
    .fp-${p.id} {
      stroke-dasharray: 320 1080;
      stroke-dashoffset: 1400;
      animation: flow-${p.id} ${p.duration}s ease-in-out ${p.delay}s infinite;
    }
  `).join('');

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ""}`}>
      <style>{styleBlock}</style>
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 696 316"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {paths.map((p) => (
          <path
            key={p.id}
            className={`fp-${p.id}`}
            d={p.d}
            stroke={`rgba(14,165,233,${p.opacity})`}
            strokeWidth={p.width}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {mirroredPaths.map((p) => (
          <path
            key={p.id}
            className={`fp-${p.id}`}
            d={p.d}
            stroke={`rgba(56,189,248,${p.opacity})`}
            strokeWidth={p.width}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </svg>
    </div>
  );
}
