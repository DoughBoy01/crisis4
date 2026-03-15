import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Bot,
  Clock,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineLog {
  step: string;
  status: 'ok' | 'error' | 'warn' | string;
  detail: string;
  duration_ms?: number;
}

interface PipelineRun {
  id: string;
  run_date: string;
  triggered_at: string;
  total_duration_ms: number | null;
  logs: PipelineLog[];
  forced: boolean;
  created_at: string;
}

const STEP_LABELS: Record<string, string> = {
  'market-feeds': 'Market Feeds',
  'ai-brief': 'AI Brief',
  'send-morning-brief': 'Send Emails',
};

function StepIcon({ status }: { status: string }) {
  if (status === 'ok') return <CheckCircle size={12} className="text-emerald-400 shrink-0" />;
  if (status === 'error') return <XCircle size={12} className="text-red-400 shrink-0" />;
  if (status === 'warn') return <AlertTriangle size={12} className="text-amber-400 shrink-0" />;
  return <Clock size={12} className="text-slate-500 shrink-0" />;
}

function overallRunStatus(logs: PipelineLog[]): 'ok' | 'warn' | 'error' {
  if (logs.some(l => l.status === 'error')) return 'error';
  if (logs.some(l => l.status === 'warn')) return 'warn';
  return 'ok';
}

function RunStatusBadge({ status }: { status: 'ok' | 'warn' | 'error' }) {
  if (status === 'ok') return <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-500/25 px-2 py-0.5 rounded-full">PASSED</span>;
  if (status === 'warn') return <span className="text-[10px] font-bold text-amber-400 bg-amber-950/50 border border-amber-500/25 px-2 py-0.5 rounded-full">PARTIAL</span>;
  return <span className="text-[10px] font-bold text-red-400 bg-red-950/50 border border-red-500/25 px-2 py-0.5 rounded-full">FAILED</span>;
}

function RunRow({ run }: { run: PipelineRun }) {
  const [open, setOpen] = useState(false);
  const status = overallRunStatus(run.logs ?? []);
  const triggeredAt = new Date(run.triggered_at);
  const rowColors: Record<string, string> = {
    ok: 'border-emerald-500/15 bg-emerald-950/10',
    warn: 'border-amber-500/20 bg-amber-950/10',
    error: 'border-red-500/20 bg-red-950/15',
  };

  return (
    <div className={cn('rounded-lg border transition-colors', rowColors[status])}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <Bot size={14} className={cn(
          'shrink-0',
          status === 'ok' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-amber-400'
        )} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-100">
              {triggeredAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              {triggeredAt.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' })} UTC
            </span>
            {run.forced && (
              <span className="text-[10px] text-slate-500 bg-slate-800/60 border border-slate-700/40 px-1.5 py-0.5 rounded">
                manual
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {(run.logs ?? []).map((log, i) => (
              <span key={i} className="flex items-center gap-1 text-[10px] text-slate-500">
                <StepIcon status={log.status} />
                {STEP_LABELS[log.step] ?? log.step}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <RunStatusBadge status={status} />
          {run.total_duration_ms != null && (
            <span className="text-[10px] font-mono text-slate-500 hidden sm:block">
              {(run.total_duration_ms / 1000).toFixed(1)}s
            </span>
          )}
          {open ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-800/50 pt-3 space-y-2">
          {(run.logs ?? []).map((log, i) => (
            <div key={i} className={cn(
              'flex items-start gap-2.5 rounded-lg px-3 py-2 border',
              log.status === 'ok' ? 'bg-emerald-950/20 border-emerald-500/15' :
              log.status === 'error' ? 'bg-red-950/20 border-red-500/20' :
              'bg-amber-950/20 border-amber-500/20'
            )}>
              <StepIcon status={log.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-slate-200">
                    {STEP_LABELS[log.step] ?? log.step}
                  </span>
                  {log.duration_ms != null && (
                    <span className="text-[10px] font-mono text-slate-500">{log.duration_ms}ms</span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{log.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentRunHistory() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('pipeline_runs')
      .select('*')
      .order('triggered_at', { ascending: false })
      .limit(10);
    setRuns((data ?? []) as PipelineRun[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const lastRun = runs[0];
  const lastRunStatus = lastRun ? overallRunStatus(lastRun.logs ?? []) : null;
  const hasError = lastRunStatus === 'error';
  const isStale = lastRun
    ? Date.now() - new Date(lastRun.triggered_at).getTime() > 26 * 60 * 60 * 1000
    : false;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Bot size={13} className="text-slate-400" />
        <h2 className="text-xs font-bold text-slate-400 tracking-widest uppercase">Overnight Agent Runs</h2>
        <div className="flex-1 h-px bg-slate-800" />
        <button
          onClick={fetchRuns}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {(hasError || isStale) && (
        <div className={cn(
          'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 mb-3 text-sm',
          hasError ? 'border-red-500/30 bg-red-950/20 text-red-300' : 'border-amber-500/30 bg-amber-950/20 text-amber-300'
        )}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span className="text-[12px] leading-relaxed">
            {hasError
              ? 'Last overnight run completed with errors — one or more pipeline steps failed. Check the step details below.'
              : 'No agent run detected in the last 26 hours. The overnight pipeline may not have fired.'}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-6 justify-center text-slate-500 text-sm">
          <Loader size={14} className="animate-spin" />
          Loading run history...
        </div>
      ) : runs.length === 0 ? (
        <div className="text-sm text-slate-500 py-6 text-center border border-slate-800 rounded-lg">
          No pipeline runs recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => <RunRow key={run.id} run={run} />)}
        </div>
      )}

      {!loading && runs.length > 0 && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600">
          <Zap size={9} />
          Showing last {runs.length} pipeline run{runs.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
