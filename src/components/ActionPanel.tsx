import { useState } from 'react';
import { CheckSquare, Package, Clock, PoundSterling, CheckCircle2, Circle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ActionItem, SectorId } from '../types';
import SignalBadge from './SignalBadge';

interface ActionPanelProps {
  actions: ActionItem[];
  activeSector: SectorId | null;
  aiRationale?: Record<string, string>;
}

const signalOrder: Record<string, number> = { URGENT: 0, BUY: 1, WATCH: 2, HOLD: 3 };

export default function ActionPanel({ actions, activeSector, aiRationale }: ActionPanelProps) {
  const [checked, setChecked] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

  const filtered = (activeSector
    ? actions.filter(a => a.relevantSectors.includes(activeSector))
    : actions
  ).sort((a, b) => (signalOrder[a.signal] ?? 9) - (signalOrder[b.signal] ?? 9));

  const done = filtered.filter(a => checked.includes(a.id)).length;
  const remaining = filtered.length - done;

  function toggle(id: string) {
    setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function toggleExpanded(id: string) {
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  return (
    <Card className="bg-slate-800/40 overflow-hidden">
      <CardHeader className="flex-row items-center gap-2.5 px-5 py-3 pb-3 space-y-0 border-b border-border/40">
        <CheckSquare size={14} className="text-sky-400" />
        <h2 className="text-xs font-bold text-slate-200 tracking-widest uppercase">Morning Action List</h2>
        <div className="ml-auto flex items-center gap-2">
          {done > 0 && (
            <span className="text-[10px] text-emerald-400 font-mono">{done} done</span>
          )}
          <span className={cn(
            'text-[10px] font-mono font-bold',
            remaining > 0 ? 'text-amber-400' : 'text-emerald-400'
          )}>
            {remaining > 0 ? `${remaining} remaining` : 'All done'}
          </span>
        </div>
      </CardHeader>

      <CardContent className="px-0 pb-0">
        {filtered.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">No actions for your selected sector today.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((action, i) => {
              const isDone = checked.includes(action.id);
              const isExpanded = expanded.includes(action.id);
              const isUrgent = action.signal === 'URGENT';
              const isBuy = action.signal === 'BUY';

              return (
                <div
                  key={action.id}
                  className={cn(
                    'transition-colors',
                    isDone && 'opacity-50',
                    isUrgent && !isDone && 'bg-red-950/15',
                    isBuy && !isDone && 'bg-emerald-950/10',
                  )}
                >
                  {/* Primary row — always visible */}
                  <div className="flex items-start gap-3 px-4 py-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => toggle(action.id)}
                      className="shrink-0 mt-0.5 transition-colors"
                      title={isDone ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {isDone
                        ? <CheckCircle2 size={18} className="text-emerald-400" />
                        : <Circle size={18} className={cn(
                            'transition-colors',
                            isUrgent ? 'text-red-400' : isBuy ? 'text-emerald-400' : 'text-muted-foreground/40 hover:text-muted-foreground'
                          )} />
                      }
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn(
                          'text-[10px] font-bold text-muted-foreground/50 font-mono w-4 shrink-0',
                        )}>
                          {i + 1}
                        </span>
                        <SignalBadge signal={action.signal} size="sm" />
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Package size={9} />
                          {action.market}
                        </span>
                        {action.deadline && (
                          <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-300 border-red-500/30 gap-1">
                            <Clock size={8} />
                            {action.deadline}
                          </Badge>
                        )}
                      </div>
                      <p className={cn(
                        'text-sm font-semibold leading-snug',
                        isDone ? 'line-through text-muted-foreground' : 'text-slate-100'
                      )}>
                        {action.title}
                      </p>
                    </div>

                    {/* Expand toggle */}
                    <button
                      onClick={() => toggleExpanded(action.id)}
                      className="shrink-0 mt-1 text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
                    >
                      {isExpanded
                        ? <ChevronUp size={13} />
                        : <ChevronDown size={13} />
                      }
                    </button>
                  </div>

                  {/* Detail — progressive disclosure */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 sm:pl-[52px] space-y-3">
                      <p className="text-sm text-slate-400 leading-relaxed">{action.detail}</p>

                      {(() => {
                        const sectorKey = action.relevantSectors[0] ?? null;
                        const aiNote = sectorKey && aiRationale ? aiRationale[sectorKey] : null;
                        if (!aiNote) return null;
                        return (
                          <div className="flex items-start gap-2 bg-sky-950/20 border border-sky-500/20 rounded px-3 py-2.5">
                            <Sparkles size={11} className="text-sky-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-sky-300/80 leading-relaxed">{aiNote}</p>
                          </div>
                        );
                      })()}

                      {action.roi && (
                        <div className="flex items-center gap-3 bg-emerald-950/30 border border-emerald-500/20 rounded px-3 py-2">
                          <PoundSterling size={13} className="text-emerald-400 shrink-0" />
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-base font-bold text-emerald-400 font-mono">
                              £{action.roi.savingAmount.toLocaleString('en-GB')}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {action.roi.tonnage.toLocaleString()} {action.roi.unit} @ £{action.roi.priceMove}{action.roi.unit === 'litres' ? '/L' : '/t'} move
                            </span>
                            <span className="text-[10px] text-emerald-500/60 ml-auto">
                              {action.roi.multiplier}× sub ROI
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="bg-slate-900/50 border border-border/30 rounded px-3 py-2.5">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Evidence</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{action.evidence}</p>
                        <p className="text-[10px] text-sky-500/60 mt-1 font-mono">Source: {action.source}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {done > 0 && done === filtered.length && (
          <div className="px-5 py-4 text-center border-t border-border/30">
            <p className="text-sm text-emerald-400 font-semibold">All actions complete for today.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
