import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  CheckCircle,
  XCircle,
  Loader,
  RefreshCw,
  Database,
  Zap,
  Rss,
  TrendingUp,
  DollarSign,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Activity,
  Server,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import DevControlsPanel from './DevControlsPanel';
import AgentRunHistory from './AgentRunHistory';
import DailyBriefPreview from './DailyBriefPreview';

interface ServiceResult {
  id: string;
  name: string;
  category: 'infrastructure' | 'api' | 'rss';
  url: string;
  status: 'idle' | 'testing' | 'ok' | 'error' | 'warn';
  latencyMs?: number;
  detail?: string;
  meta?: Record<string, unknown>;
  testedAt?: string;
}

const INITIAL_SERVICES: ServiceResult[] = [
  { id: 'supabase-db', name: 'Supabase Database', category: 'infrastructure', url: import.meta.env.VITE_SUPABASE_URL + '/rest/v1/', status: 'idle' },
  { id: 'supabase-auth', name: 'Supabase Auth', category: 'infrastructure', url: import.meta.env.VITE_SUPABASE_URL + '/auth/v1/health', status: 'idle' },
  { id: 'supabase-edge', name: 'market-feeds Edge Function', category: 'infrastructure', url: import.meta.env.VITE_SUPABASE_URL + '/functions/v1/market-feeds', status: 'idle' },
  { id: 'yahoo', name: 'Yahoo Finance (Real-time Quotes)', category: 'api', url: 'query1.finance.yahoo.com/v7/finance/quote', status: 'idle' },
  { id: 'eia', name: 'EIA Brent Crude API', category: 'api', url: 'https://api.eia.gov/v2/petroleum/pri/spt/data/', status: 'idle' },
  { id: 'fx', name: 'ExchangeRate.host (GBP FX)', category: 'api', url: 'https://open.er-api.com/v6/latest/GBP', status: 'idle' },
  { id: 'ahdb', name: 'AHDB RSS', category: 'rss', url: 'ahdb.org.uk → farminguk.com → agriland.co.uk → farmersguide.co.uk', status: 'idle' },
  { id: 'bbc', name: 'BBC Business RSS', category: 'rss', url: 'https://feeds.bbci.co.uk/news/business/rss.xml', status: 'idle' },
  { id: 'aljazeera', name: 'Al Jazeera RSS', category: 'rss', url: 'https://www.aljazeera.com/xml/rss/all.xml', status: 'idle' },
  { id: 'fwi', name: 'Farmers Weekly RSS', category: 'rss', url: 'https://www.fwi.co.uk/feed', status: 'idle' },
  { id: 'boe', name: 'Bank of England RSS', category: 'rss', url: 'https://www.bankofengland.co.uk/rss/publications', status: 'idle' },
  { id: 'obr', name: 'OBR RSS', category: 'rss', url: 'https://obr.uk/feed/', status: 'idle' },
  { id: 'guardian', name: 'Guardian Business RSS', category: 'rss', url: 'https://www.theguardian.com/business/rss', status: 'idle' },
  { id: 'marketwatch', name: 'MarketWatch RSS', category: 'rss', url: 'https://www.marketwatch.com/rss/topstories → cnbc.com', status: 'idle' },
  { id: 'usda', name: 'USDA RSS', category: 'rss', url: 'https://www.usda.gov/rss/latest-releases.xml → ers.usda.gov → nass.usda.gov', status: 'idle' },
  { id: 'ft', name: 'Financial Times RSS', category: 'rss', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=19836768', status: 'idle' },
];

interface DiagnosticsPageProps {
  onBack: () => void;
  onHome: () => void;
}

export default function DiagnosticsPage({ onBack, onHome }: DiagnosticsPageProps) {
  const [services, setServices] = useState<ServiceResult[]>(INITIAL_SERVICES);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [edgeFeedData, setEdgeFeedData] = useState<Record<string, unknown> | null>(null);

  const setServiceStatus = useCallback((id: string, patch: Partial<ServiceResult>) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s));
  }, []);

  const testSupabaseDb = useCallback(async () => {
    setServiceStatus('supabase-db', { status: 'testing' });
    const t0 = Date.now();
    try {
      const { error } = await supabase.from('user_settings').select('session_id').limit(1);
      const latencyMs = Date.now() - t0;
      if (error) throw new Error(error.message);
      setServiceStatus('supabase-db', {
        status: 'ok',
        latencyMs,
        detail: 'user_settings table reachable',
        testedAt: new Date().toISOString(),
      });
    } catch (e) {
      setServiceStatus('supabase-db', {
        status: 'error',
        latencyMs: Date.now() - t0,
        detail: String(e),
        testedAt: new Date().toISOString(),
      });
    }
  }, [setServiceStatus]);

  const testSupabaseAuth = useCallback(async () => {
    setServiceStatus('supabase-auth', { status: 'testing' });
    const t0 = Date.now();
    try {
      const res = await fetch(import.meta.env.VITE_SUPABASE_URL + '/auth/v1/health', {
        headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      });
      const latencyMs = Date.now() - t0;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as { status?: string };
      setServiceStatus('supabase-auth', {
        status: 'ok',
        latencyMs,
        detail: json.status ?? 'healthy',
        testedAt: new Date().toISOString(),
      });
    } catch (e) {
      setServiceStatus('supabase-auth', {
        status: 'error',
        latencyMs: Date.now() - t0,
        detail: String(e),
        testedAt: new Date().toISOString(),
      });
    }
  }, [setServiceStatus]);

  const testEdgeFunction = useCallback(async () => {
    setServiceStatus('supabase-edge', { status: 'testing' });
    const t0 = Date.now();
    try {
      const res = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/market-feeds', {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      const latencyMs = Date.now() - t0;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as Record<string, unknown>;
      setEdgeFeedData(json);
      const ok = json.sources_ok as number;
      const total = json.sources_total as number;
      const allOk = ok === total;
      setServiceStatus('supabase-edge', {
        status: allOk ? 'ok' : 'warn',
        latencyMs,
        detail: `${ok}/${total} sources responded. Overall accuracy: ${json.overall_accuracy_score}%`,
        meta: { sources_ok: ok, sources_total: total, overall_accuracy_score: json.overall_accuracy_score },
        testedAt: new Date().toISOString(),
      });

      const sources = json.sources as Record<string, unknown>[];
      const sourceIdMap: Record<string, string> = {
        'Yahoo Finance': 'yahoo',
        'EIA Brent Crude': 'eia',
        'ExchangeRate.host FX': 'fx',
        'AHDB RSS': 'ahdb',
        'BBC Business RSS': 'bbc',
        'Al Jazeera RSS': 'aljazeera',
        'Farmers Weekly RSS': 'fwi',
        'Bank of England RSS': 'boe',
        'OBR RSS': 'obr',
        'Guardian Business RSS': 'guardian',
        'MarketWatch RSS': 'marketwatch',
        'USDA RSS': 'usda',
        'Financial Times RSS': 'ft',
      };

      for (const source of sources) {
        const id = sourceIdMap[source.source_name as string];
        if (!id) continue;
        const success = source.success as boolean;
        const accuracy = source.accuracy_score as number;
        const ageMin = source.data_age_minutes as number | null;
        const items = source.items as unknown[] | undefined;
        const note = source.note as string | undefined;
        const errMsg = source.error as string | null;

        const quotesCount = source.quotes_count as number | undefined;
        let detail = '';
        if (!success) {
          detail = errMsg ?? 'Failed';
        } else {
          const parts: string[] = [];
          if (accuracy !== undefined) parts.push(`Accuracy: ${accuracy}%`);
          if (ageMin !== null && ageMin !== undefined) parts.push(`Data age: ${ageMin < 60 ? `${ageMin}m` : `${Math.round(ageMin / 60)}h`}`);
          if (quotesCount !== undefined) parts.push(`${quotesCount} instruments`);
          else if (items !== undefined) parts.push(`${items.length} matched items`);
          if (note) parts.push(note);
          detail = parts.join(' · ');
        }

        setServiceStatus(id, {
          status: !success ? 'error' : accuracy < 50 ? 'warn' : 'ok',
          detail,
          meta: source,
          testedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      setServiceStatus('supabase-edge', {
        status: 'error',
        latencyMs: Date.now() - t0,
        detail: String(e),
        testedAt: new Date().toISOString(),
      });
    }
  }, [setServiceStatus]);

  const testEIABrentCrude = useCallback(async () => {
    setServiceStatus('eia', { status: 'testing' });
    const t0 = Date.now();
    try {
      const res = await fetch(import.meta.env.VITE_SUPABASE_URL + '/functions/v1/market-feeds', {
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as Record<string, unknown>;
      const sources = json.sources as Record<string, unknown>[] | undefined;
      const eiaSource = sources?.find(s => s.source_name === 'EIA Brent Crude');
      if (!eiaSource) throw new Error('EIA Brent Crude not found in response');
      const success = eiaSource.success as boolean;
      const accuracy = eiaSource.accuracy_score as number;
      const currentPrice = eiaSource.current_price as number | undefined;
      const period = eiaSource.data_period as string | undefined;
      const changePct = eiaSource.change_pct as number | undefined;
      const note = eiaSource.note as string | undefined;
      const errMsg = eiaSource.error as string | null;
      const latencyMs = Date.now() - t0;
      if (!success) throw new Error(errMsg ?? 'EIA returned failure');
      const detail = [
        currentPrice !== undefined ? `$${currentPrice.toFixed(2)}/bbl` : null,
        changePct !== undefined ? `${changePct > 0 ? '+' : ''}${changePct.toFixed(2)}%` : null,
        period ? `Period: ${period}` : null,
        `Accuracy: ${accuracy}%`,
        note,
      ].filter(Boolean).join(' · ');
      setServiceStatus('eia', {
        status: accuracy < 50 ? 'warn' : 'ok',
        latencyMs,
        detail,
        meta: eiaSource,
        testedAt: new Date().toISOString(),
      });
    } catch (e) {
      setServiceStatus('eia', {
        status: 'error',
        latencyMs: Date.now() - t0,
        detail: String(e),
        testedAt: new Date().toISOString(),
      });
    }
  }, [setServiceStatus]);

  const runAll = useCallback(async () => {
    setRunning(true);
    setStartedAt(new Date().toISOString());
    setEdgeFeedData(null);
    setServices(INITIAL_SERVICES.map(s => ({ ...s, status: 'idle' })));

    await Promise.all([
      testSupabaseDb(),
      testSupabaseAuth(),
      testEdgeFunction(),
    ]);

    setRunning(false);
  }, [testSupabaseDb, testSupabaseAuth, testEdgeFunction]);

  useEffect(() => {
    runAll();
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const okCount = services.filter(s => s.status === 'ok').length;
  const warnCount = services.filter(s => s.status === 'warn').length;
  const errCount = services.filter(s => s.status === 'error').length;
  const totalTested = services.filter(s => s.status !== 'idle' && s.status !== 'testing').length;

  const overallStatus = errCount > 0 ? 'error' : warnCount > 0 ? 'warn' : okCount === services.length ? 'ok' : 'idle';

  const categories: { id: string; label: string; icon: React.ReactNode; filter: ServiceResult['category'] }[] = [
    { id: 'infrastructure', label: 'Infrastructure', icon: <Server size={13} />, filter: 'infrastructure' },
    { id: 'api', label: 'Data APIs', icon: <TrendingUp size={13} />, filter: 'api' },
    { id: 'rss', label: 'RSS News Feeds', icon: <Rss size={13} />, filter: 'rss' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to Dashboard
            </button>
            <span className="text-slate-700">·</span>
            <button
              onClick={onHome}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors"
            >
              Home
            </button>
          </div>

          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <Activity size={18} className="text-sky-400" />
                <h1 className="text-2xl font-bold tracking-tight">Service Diagnostics</h1>
              </div>
              <p className="text-sm text-slate-400">
                Live connectivity and health check for every external service and data source.
              </p>
              {startedAt && (
                <p className="text-[11px] text-slate-500 mt-1.5 font-mono">
                  Last run: {new Date(startedAt).toLocaleTimeString('en-GB', { hour12: false })} GMT
                </p>
              )}
            </div>

            <button
              onClick={runAll}
              disabled={running}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all',
                running
                  ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20 hover:border-sky-400/50'
              )}
            >
              <RefreshCw size={13} className={running ? 'animate-spin' : ''} />
              {running ? 'Running...' : 'Re-run All'}
            </button>
          </div>
        </div>

        {/* Dev Controls */}
        <div className="mb-6">
          <DevControlsPanel />
        </div>

        {/* Summary bar */}
        <div className={cn(
          'rounded-xl border p-5 mb-8 flex items-center gap-6 flex-wrap',
          overallStatus === 'ok' ? 'border-emerald-500/25 bg-emerald-950/20' :
          overallStatus === 'warn' ? 'border-amber-500/25 bg-amber-950/20' :
          overallStatus === 'error' ? 'border-red-500/25 bg-red-950/20' :
          'border-slate-700/50 bg-slate-900/40'
        )}>
          <div className="flex-1 min-w-0">
            <div className={cn(
              'text-lg font-bold font-mono',
              overallStatus === 'ok' ? 'text-emerald-400' :
              overallStatus === 'warn' ? 'text-amber-400' :
              overallStatus === 'error' ? 'text-red-400' :
              'text-slate-300'
            )}>
              {running ? 'Running checks...' :
               totalTested === 0 ? 'Awaiting tests' :
               overallStatus === 'ok' ? 'All systems operational' :
               overallStatus === 'warn' ? 'Partial degradation detected' :
               `${errCount} service${errCount !== 1 ? 's' : ''} unreachable`}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {totalTested}/{services.length} services tested
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-5 flex-wrap">
            <Stat label="OK" value={okCount} color="text-emerald-400" />
            <Stat label="Warn" value={warnCount} color="text-amber-400" />
            <Stat label="Error" value={errCount} color="text-red-400" />
          </div>
        </div>

        {/* Category sections */}
        {categories.map(cat => {
          const catServices = services.filter(s => s.category === cat.filter);
          const catOk = catServices.filter(s => s.status === 'ok').length;
          const catErr = catServices.filter(s => s.status === 'error').length;
          const catWarn = catServices.filter(s => s.status === 'warn').length;

          return (
            <div key={cat.id} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-slate-400">{cat.icon}</span>
                <h2 className="text-xs font-bold text-slate-400 tracking-widest uppercase">{cat.label}</h2>
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-[10px] font-mono text-slate-500">
                  {catOk} ok{catWarn > 0 ? ` · ${catWarn} warn` : ''}{catErr > 0 ? ` · ${catErr} err` : ''}
                </span>
              </div>

              <div className="space-y-2">
                {catServices.map(svc => (
                  <ServiceRow
                    key={svc.id}
                    service={svc}
                    expanded={expanded.has(svc.id)}
                    onToggle={() => toggleExpand(svc.id)}
                    onRetest={
                      svc.id === 'supabase-db' ? testSupabaseDb :
                      svc.id === 'supabase-auth' ? testSupabaseAuth :
                      svc.id === 'supabase-edge' ? testEdgeFunction :
                      svc.id === 'eia' ? testEIABrentCrude :
                      undefined
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Raw edge function payload */}
        {edgeFeedData && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <Database size={13} className="text-slate-400" />
              <h2 className="text-xs font-bold text-slate-400 tracking-widest uppercase">Raw Edge Function Response</h2>
              <div className="flex-1 h-px bg-slate-800" />
            </div>
            <div className="rounded-xl border border-slate-700/50 bg-slate-900/60 p-4 overflow-auto max-h-64 sm:max-h-96">
              <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap break-all leading-relaxed">
                {JSON.stringify(edgeFeedData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Agent run history */}
        <div className="mt-8">
          <AgentRunHistory />
        </div>

        {/* Daily brief preview */}
        <div className="mt-8 pb-8">
          <DailyBriefPreview />
        </div>

      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={cn('text-xl font-bold font-mono', color)}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function StatusIcon({ status }: { status: ServiceResult['status'] }) {
  if (status === 'testing') return <Loader size={14} className="animate-spin text-sky-400" />;
  if (status === 'ok') return <CheckCircle size={14} className="text-emerald-400" />;
  if (status === 'warn') return <AlertTriangle size={14} className="text-amber-400" />;
  if (status === 'error') return <XCircle size={14} className="text-red-400" />;
  return <Clock size={14} className="text-slate-600" />;
}

function CategoryIcon({ category }: { category: ServiceResult['category'] }) {
  if (category === 'infrastructure') return <Zap size={11} className="text-slate-500" />;
  if (category === 'api') return <DollarSign size={11} className="text-slate-500" />;
  return <Rss size={11} className="text-slate-500" />;
}

function ServiceRow({ service, expanded, onToggle, onRetest }: {
  service: ServiceResult;
  expanded: boolean;
  onToggle: () => void;
  onRetest?: () => void;
}) {
  const hasDetail = !!service.detail || !!service.meta;
  const isTesting = service.status === 'testing';
  const statusColors: Record<ServiceResult['status'], string> = {
    idle: 'border-slate-800 bg-slate-900/40',
    testing: 'border-sky-500/20 bg-sky-950/20',
    ok: 'border-emerald-500/15 bg-emerald-950/10',
    warn: 'border-amber-500/20 bg-amber-950/15',
    error: 'border-red-500/20 bg-red-950/15',
  };

  return (
    <div className={cn('rounded-lg border transition-colors', statusColors[service.status])}>
      <div className="flex items-center gap-3 px-4 py-3">
        <StatusIcon status={service.status} />

        <div className="flex items-center gap-1.5 shrink-0">
          <CategoryIcon category={service.category} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-100">{service.name}</span>
            {service.latencyMs !== undefined && (
              <span className="text-[10px] font-mono text-slate-500 bg-slate-800/60 px-1.5 py-0.5 rounded">
                {service.latencyMs}ms
              </span>
            )}
          </div>
          {service.detail && (
            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xl">{service.detail}</div>
          )}
          {!service.detail && service.status === 'idle' && (
            <div className="text-[11px] text-slate-600 mt-0.5">Awaiting test...</div>
          )}
        </div>

        <div className="shrink-0 text-[10px] font-mono text-slate-600 hidden sm:block truncate max-w-xs">
          {service.url}
        </div>

        {onRetest && (
          <button
            onClick={onRetest}
            disabled={isTesting}
            className={cn(
              'shrink-0 flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold border transition-all',
              isTesting
                ? 'opacity-40 cursor-not-allowed border-slate-700 text-slate-500'
                : 'border-slate-700/60 bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 hover:border-slate-600'
            )}
          >
            <RefreshCw size={9} className={isTesting ? 'animate-spin' : ''} />
            Test
          </button>
        )}

        {hasDetail && (
          <button
            onClick={onToggle}
            className="shrink-0 text-slate-600 hover:text-slate-400 transition-colors"
          >
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
        )}
      </div>

      {expanded && service.meta && (
        <div className="px-4 pb-4 border-t border-slate-800/60 pt-3">
          <div className="text-[10px] font-mono text-slate-400 leading-relaxed whitespace-pre-wrap break-all bg-slate-950/60 rounded-lg p-3 max-h-64 overflow-auto">
            {JSON.stringify(service.meta, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
}
