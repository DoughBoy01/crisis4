import { AlertCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SupplyExposureItem } from '@/types';

interface SupplyChainExposureProps {
  items: SupplyExposureItem[];
  loading?: boolean;
}

function scoreColor(score: number) {
  if (score >= 80) return { bar: 'bg-red-500', text: 'text-red-400', label: 'CRITICAL' };
  if (score >= 65) return { bar: 'bg-orange-500', text: 'text-orange-400', label: 'HIGH' };
  if (score >= 50) return { bar: 'bg-amber-500', text: 'text-amber-400', label: 'ELEVATED' };
  if (score >= 35) return { bar: 'bg-yellow-500', text: 'text-yellow-400', label: 'MODERATE' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-400', label: 'LOW' };
}

function ExposureRow({ item }: { item: SupplyExposureItem }) {
  const { bar, text, label } = scoreColor(item.exposureScore);

  return (
    <div className="py-2.5 border-b border-slate-700/30 last:border-0">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-200 truncate">{item.market}</p>
          <p className="text-[10px] text-muted-foreground/70 leading-snug mt-0.5 line-clamp-1">{item.topRisk}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className={cn('text-sm font-bold tabular-nums', text)}>{item.exposureScore}</span>
          <span className={cn('text-[10px] font-semibold ml-1', text)}>{label}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', bar)}
            style={{ width: `${item.exposureScore}%` }}
          />
        </div>
      </div>

      <div className="flex items-start gap-1.5 mt-1.5">
        <TrendingUp size={9} className="text-sky-400/60 mt-0.5 shrink-0" />
        <p className="text-[10px] text-sky-400/70 leading-snug">{item.mitigationNote}</p>
      </div>
    </div>
  );
}

export default function SupplyChainExposure({ items, loading }: SupplyChainExposureProps) {
  const highCount = items.filter(i => i.exposureScore >= 65).length;

  return (
    <Card className="bg-slate-900/60 border-slate-700/50 overflow-hidden">
      <CardHeader className="px-4 pt-3 pb-0 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className={highCount > 0 ? 'text-orange-400' : 'text-amber-400/60'} />
            <div>
              <p className="text-xs font-bold text-slate-200">Supply Chain Exposure</p>
              <p className="text-[10px] text-muted-foreground">Conflict-adjusted vulnerability per market</p>
            </div>
          </div>
          {items.length > 0 && highCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/30 font-semibold">
              {highCount} HIGH+
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 py-3">
        {loading && items.length === 0 ? (
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-4 py-6 text-center">
            <AlertCircle size={20} className="text-muted-foreground/30 mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-muted-foreground/50">Calculating exposure scores…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-4 py-6 text-center">
            <AlertCircle size={20} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/50">No exposure data available</p>
          </div>
        ) : (
          <div>
            {items.map(item => (
              <ExposureRow key={item.market} item={item} />
            ))}
          </div>
        )}

        <div className="border-t border-border/30 pt-2 mt-3">
          <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
            Score (0–100) = conflict proximity × supply concentration × UK import dependency + live price signals. Recalculated each refresh.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
