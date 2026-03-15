import { motion } from "framer-motion";

function FloatingPaths({ position }: { position: number }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    color: `rgba(14,165,233,${0.03 + i * 0.012})`,
    width: 0.4 + i * 0.025,
  }));

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 696 316"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      <title>Background paths</title>
      {paths.map((path) => (
        <motion.path
          key={path.id}
          d={path.d}
          stroke={path.color}
          strokeWidth={path.width}
          strokeOpacity={0.4 + path.id * 0.012}
          initial={{ pathLength: 0.3, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: [0, 1, 0.5, 1],
            pathOffset: [0, 1],
          }}
          transition={{
            duration: 18 + Math.random() * 8,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
            delay: path.id * 0.15,
          }}
        />
      ))}
    </svg>
  );
}

export function BackgroundPaths({ className }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className ?? ""}`}>
      <FloatingPaths position={1} />
      <FloatingPaths position={-1} />
    </div>
  );
}
