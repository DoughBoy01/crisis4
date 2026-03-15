import { useState } from 'react';
import { Play, CheckCircle, XCircle, Loader, ChevronDown, ChevronUp, Terminal, RefreshCw, Mail, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface StepLog {
  step: string;
  status: 'ok' | 'error' | 'skipped';
  detail?: string;
  duration_ms?: number;
}

interface PipelineResult {
  success: boolean;
  run_date?: string;
  total_duration_ms?: number;
  logs?: StepLog[];
  error?: string;
  skipped?: boolean;
  reason?: string;
}

type RunStatus = 'idle' | 'running' | 'done' | 'error';

async function callEdge(slug: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${slug}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json().catch(() => ({}));
}

export default function DevControlsPanel() {
  const [open, setOpen] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus>('idle');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);

  async function runPipeline() {
    setRunStatus('running');
    setResult(null);
    setLogsOpen(false);
    try {
      const data = await callEdge('overnight-pipeline', { force: true }) as PipelineResult;
      setResult(data);
      setRunStatus(data.success ? 'done' : 'error');
      if (data.logs) setLogsOpen(true);
    } catch (e) {
      setResult({ success: false, error: String(e) });
      setRunStatus('error');
    }
  }

  async function runFeedsOnly() {
    setRunStatus('running');
    setResult(null);
    try {
      const data = await callEdge('market-feeds') as Record<string, unknown>;
      const ok = (data.sources_ok as number) ?? 0;
      const total = (data.sources_total as number) ?? 0;
      setResult({
        success: true,
        logs: [{ step: 'market-feeds', status: 'ok', detail: `${ok}/${total} sources responded` }],
      });
      setRunStatus('done');
      setLogsOpen(true);
    } catch (e) {
      setResult({ success: false, error: String(e) });
      setRunStatus('error');
    }
  }

  async function sendEmailOnly() {
    setRunStatus('running');
    setResult(null);
    const logs: StepLog[] = [];
    try {
      const t0 = Date.now();
      const briefCheck = await callEdge('ai-brief', {}) as Record<string, unknown>;
      const briefErr = briefCheck.error as string | undefined;
      const briefCached = briefCheck.cached as boolean | undefined;
      const hasBrief = !!briefCheck.brief;
      if (briefErr || !hasBrief) {
        const detail = briefErr ?? 'ai-brief returned no brief';
        logs.push({ step: 'ai-brief', status: 'error', detail, duration_ms: Date.now() - t0 });
        setResult({ success: false, logs, error: detail });
        setRunStatus('error');
        setLogsOpen(true);
        return;
      }
      logs.push({
        step: 'ai-brief',
        status: 'ok',
        detail: briefCached ? 'Using cached brief for today' : 'Brief generated',
        duration_ms: Date.now() - t0,
      });

      const t1 = Date.now();
      const sendData = await callEdge('send-morning-brief', { action: 'send_now' }) as Record<string, unknown>;
      const sent = sendData.sent as number | undefined;
      const failed = sendData.failed as number | undefined;
      const sendErr = sendData.error as string | undefined;
      const msg = sendData.message as string | undefined;
      const sendOk = !sendErr;
      logs.push({
        step: 'send-morning-brief',
        status: sendOk ? 'ok' : 'error',
        detail: sendErr ?? msg ?? `Sent ${sent ?? 0}, failed ${failed ?? 0}`,
        duration_ms: Date.now() - t1,
      });
      setResult({ success: sendOk, logs, error: sendErr });
      setRunStatus(sendOk ? 'done' : 'error');
      setLogsOpen(true);
    } catch (e) {
      setResult({ success: false, error: String(e), logs });
      setRunStatus('error');
    }
  }

  const isRunning = runStatus === 'running';

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-950/20 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <Terminal size={12} className="text-amber-400/70" />
          <span className="text-xs font-bold text-amber-400/80 tracking-wider uppercase">Dev Controls</span>
          <span className="text-[10px] text-amber-400/40">— testing only</span>
        </div>
        {open
          ? <ChevronUp size={12} className="text-amber-400/40" />
          : <ChevronDown size={12} className="text-amber-400/40" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 border-t border-amber-500/10 space-y-3">
          <p className="text-[11px] text-amber-400/50">
            Force-run pipeline steps without waiting for the cron schedule.
          </p>

          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={<RefreshCw size={11} />}
              label="Refresh Feeds"
              disabled={isRunning}
              onClick={runFeedsOnly}
            />
            <ActionButton
              icon={<Zap size={11} />}
              label="Run Full Pipeline"
              primary
              disabled={isRunning}
              onClick={runPipeline}
            />
            <ActionButton
              icon={<Mail size={11} />}
              label="Send Email Now"
              disabled={isRunning}
              onClick={sendEmailOnly}
            />
          </div>

          {isRunning && (
            <div className="flex items-center gap-2 text-xs text-amber-400/60">
              <Loader size={11} className="animate-spin" />
              <span>Running...</span>
            </div>
          )}

          {result && !isRunning && (
            <div className={cn(
              'rounded-lg border px-3 py-2.5 text-xs space-y-1.5',
              result.success
                ? 'border-emerald-500/20 bg-emerald-950/20'
                : 'border-red-500/20 bg-red-950/20'
            )}>
              <div className="flex items-center gap-2">
                {result.success
                  ? <CheckCircle size={12} className="text-emerald-400 shrink-0" />
                  : <XCircle size={12} className="text-red-400 shrink-0" />
                }
                <span className={result.success ? 'text-emerald-300' : 'text-red-300'}>
                  {result.success ? 'Success' : 'Failed'}
                </span>
                {result.total_duration_ms && (
                  <span className="text-slate-500 font-mono">{result.total_duration_ms}ms</span>
                )}
                {result.logs && (
                  <button
                    onClick={() => setLogsOpen(o => !o)}
                    className="ml-auto text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {logsOpen ? 'hide logs' : 'show logs'}
                  </button>
                )}
              </div>

              {result.error && !result.logs && (
                <p className="text-red-300/70 font-mono text-[11px] break-all">{result.error}</p>
              )}

              {result.reason && (
                <p className="text-amber-300/70 text-[11px]">{result.reason}</p>
              )}

              {logsOpen && result.logs && (
                <div className="mt-2 space-y-1.5 pt-2 border-t border-white/5">
                  {result.logs.map((log, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {log.status === 'ok'
                        ? <CheckCircle size={10} className="text-emerald-400 mt-0.5 shrink-0" />
                        : log.status === 'skipped'
                          ? <Play size={10} className="text-slate-500 mt-0.5 shrink-0" />
                          : <XCircle size={10} className="text-red-400 mt-0.5 shrink-0" />
                      }
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] text-slate-300">{log.step}</span>
                        {log.duration_ms !== undefined && (
                          <span className="text-slate-600 font-mono text-[10px] ml-1.5">{log.duration_ms}ms</span>
                        )}
                        {log.detail && (
                          <p className="text-[10px] text-slate-400 mt-0.5 break-all">{log.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon, label, onClick, disabled, primary,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-semibold border transition-all',
        disabled
          ? 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
          : primary
            ? 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 hover:border-amber-400/60'
            : 'border-slate-700/60 bg-slate-800/40 text-slate-300 hover:bg-slate-700/50 hover:border-slate-600'
      )}
    >
      {icon}
      {label}
    </button>
  );
}
