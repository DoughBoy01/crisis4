import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Signal } from '../types';

interface SignalBadgeProps {
  signal: Signal;
  size?: 'sm' | 'md' | 'lg';
}

const config: Record<Signal, { label: string; className: string }> = {
  URGENT: {
    label: 'URGENT',
    className: 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30 animate-pulse',
  },
  BUY: {
    label: 'BUY',
    className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30',
  },
  WATCH: {
    label: 'WATCH',
    className: 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30',
  },
  HOLD: {
    label: 'HOLD',
    className: 'bg-slate-500/20 text-slate-300 border-slate-500/30 hover:bg-slate-500/30',
  },
};

const dots: Record<Signal, string> = {
  URGENT: 'bg-red-400',
  BUY: 'bg-emerald-400',
  WATCH: 'bg-amber-400',
  HOLD: 'bg-slate-400',
};

const sizes = {
  sm: 'text-[10px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
  lg: 'text-sm px-3 py-1.5 gap-2',
};

export default function SignalBadge({ signal, size = 'md' }: SignalBadgeProps) {
  const c = config[signal];
  return (
    <Badge
      variant="outline"
      className={cn('font-bold tracking-widest inline-flex items-center', c.className, sizes[size])}
    >
      <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', dots[signal])} />
      {c.label}
    </Badge>
  );
}
