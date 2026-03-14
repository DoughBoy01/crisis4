import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, CheckCircle, Circle, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ContingencyScenario, PlaybookTrigger } from '@/types';

interface ContingencyPlaybookProps {
  scenarios: ContingencyScenario[];
  loading?: boolean;
}

const TRIGGER_LABELS: Record<PlaybookTrigger, string> = {
  PRICE_SPIKE: 'Price Spike',
  SUPPLY_DISRUPTION: 'Supply Disruption',
  GEOPOLITICAL: 'Geopolitical',
  FX_STRESS: 'FX Stress',
  FREIGHT_SURGE: 'Freight Surge',
};

const SEVERITY_CONFIG = {
  critical: { badge: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-500' },
  high:     { badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: 'bg-orange-500' },
  medium:   { badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-500' },
};

function ScenarioCard({ scenario }: { scenario: ContingencyScenario }) {
  const [expanded, setExpanded] = useState(scenario.active);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const sev = SEVERITY_CONFIG[scenario.severity];

  function toggleStep(order: number) {
    setCheckedSteps(prev => {
      const next = new Set(prev);
      next.has(order) ? next.delete(order) : next.add(order);
      return next;
    });
  }

  return (
    <div
      className={cn(
        'rounded-lg border transition-all duration-150',
        scenario.active
          ? scenario.severity === 'critical'
            ? 'border-red-500/40 bg-red-500/5'
            : 'border-orange-500/30 bg-orange-500/4'
          : 'border-slate-700/40 bg-slate-800/20',
      )}
    >
      <div
        className="p-3 cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {scenario.active && (
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-bold animate-pulse bg-red-500/20 text-red-300 border-red-500/40">
                  <Zap size={8} />
                  ACTIVE
                </span>
              )}
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold', sev.badge)}>
                {scenario.severity.toUpperCase()}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400 border border-slate-600/30">
                {TRIGGER_LABELS[scenario.trigger]}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-200 leading-tight">{scenario.title}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              Trigger: {scenario.condition}
            </p>
            {scenario.active && scenario.activationEvidence && (
              <p className="text-[10px] text-orange-300/80 mt-1 leading-snug">
                Evidence: {scenario.activationEvidence}
              </p>
            )}
          </div>
          <span className="text-muted-foreground/50 mt-0.5 shrink-0">
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-700/30 px-3 pb-3 pt-2 space-y-1.5">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-2">Response steps</p>
          {scenario.steps.map(step => {
            const checked = checkedSteps.has(step.order);
            return (
              <div
                key={step.order}
                className={cn(
                  'flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors',
                  checked ? 'bg-emerald-500/8 border border-emerald-500/20' : 'hover:bg-slate-700/30',
                )}
                onClick={e => { e.stopPropagation(); toggleStep(step.order); }}
              >
                <span className="mt-0.5 shrink-0">
                  {checked
                    ? <CheckCircle size={12} className="text-emerald-400" />
                    : <Circle size={12} className="text-slate-600" />
                  }
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[10px] leading-snug', checked ? 'text-slate-500 line-through' : 'text-slate-300')}>
                    {step.action}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500">{step.owner}</span>
                    <span className="text-[10px] text-muted-foreground/40">·</span>
                    <span className="text-[10px] text-sky-400/60">{step.deadline}</span>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="pt-1 flex flex-wrap gap-1">
            {scenario.affectedMarkets.map(m => (
              <span key={m} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400 border border-slate-600/30">{m}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContingencyPlaybook({ scenarios, loading }: ContingencyPlaybookProps) {
  const activeCount = scenarios.filter(s => s.active).length;

  return (
    <Card className="bg-slate-900/60 border-slate-700/50 overflow-hidden">
      <CardHeader className="px-4 pt-3 pb-0 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className={activeCount > 0 ? 'text-orange-400' : 'text-teal-400'} />
            <div>
              <p className="text-xs font-bold text-slate-200">Contingency Playbook</p>
              <p className="text-[10px] text-muted-foreground">Scenario response plans — step-by-step</p>
            </div>
          </div>
          {scenarios.length > 0 && (
            <div className="flex items-center gap-1.5">
              {activeCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-bold animate-pulse">
                  {activeCount} ACTIVE
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/50">{scenarios.length} plans</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 py-3">
        {loading && scenarios.length === 0 ? (
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-4 py-6 text-center">
            <BookOpen size={20} className="text-muted-foreground/30 mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-muted-foreground/50">Loading scenario triggers…</p>
          </div>
        ) : scenarios.length === 0 ? (
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-4 py-6 text-center">
            <BookOpen size={20} className="text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/50">No playbooks loaded</p>
          </div>
        ) : (
          <div className="space-y-2">
            {scenarios.map(scenario => (
              <ScenarioCard key={scenario.id} scenario={scenario} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
