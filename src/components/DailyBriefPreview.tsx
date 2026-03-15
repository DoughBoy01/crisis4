import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  FileText,
  RefreshCw,
  Loader,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Cpu,
  CalendarDays,
  MessageSquare,
  Mail,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceSnapshotEntry {
  label: string;
  price: number;
  change_pct: number | null;
  currency: string;
}

interface DailyBrief {
  id: string;
  brief_date: string;
  generated_at: string;
  feed_snapshot_at: string | null;
  narrative: string;
  three_things: string[];
  action_rationale: Record<string, string>;
  geopolitical_context: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  price_snapshot: PriceSnapshotEntry[] | null;
}

type PersonaId = 'general' | 'trader' | 'agri' | 'logistics' | 'analyst';

const PERSONA_META: Record<PersonaId, {
  label: string;
  subLabel: string;
  accentColor: string;
  accentClass: string;
  borderClass: string;
  sectors: string[];
}> = {
  general: {
    label: 'Business Overview',
    subLabel: 'Key impacts on UK operating costs and supply chains today.',
    accentColor: '#94a3b8',
    accentClass: 'text-slate-400',
    borderClass: 'border-slate-600',
    sectors: ['energy', 'fx', 'freight'],
  },
  trader: {
    label: 'Commodity Trader',
    subLabel: 'Review before the 07:00 standup. Energy, FX, and metals attribution below.',
    accentColor: '#f87171',
    accentClass: 'text-red-400',
    borderClass: 'border-red-900',
    sectors: ['energy', 'fx', 'metals'],
  },
  agri: {
    label: 'Agri Buyer',
    subLabel: 'Wheat, fertilizer input costs, and supply corridor status.',
    accentColor: '#34d399',
    accentClass: 'text-emerald-400',
    borderClass: 'border-emerald-900',
    sectors: ['agricultural', 'fertilizer', 'energy'],
  },
  logistics: {
    label: 'Logistics Director',
    subLabel: 'Red Sea status, rerouting signals, and freight rate context.',
    accentColor: '#38bdf8',
    accentClass: 'text-sky-400',
    borderClass: 'border-sky-900',
    sectors: ['freight', 'energy', 'policy'],
  },
  analyst: {
    label: 'Risk Analyst',
    subLabel: 'All monitored sectors with citable context for client reporting.',
    accentColor: '#fbbf24',
    accentClass: 'text-amber-400',
    borderClass: 'border-amber-900',
    sectors: ['energy', 'agricultural', 'freight', 'fertilizer', 'metals', 'fx', 'policy'],
  },
};

const PERSONA_FOCUS_LABEL: Record<PersonaId, string> = {
  general: 'What This Means for Your Business',
  trader: 'Trader Focus — Price Signals & Crisis Context',
  agri: 'Agri Buyer Focus — Grain, Fertilizer & Black Sea',
  logistics: 'Logistics Focus — Shipping Lanes & Bunker Costs',
  analyst: 'Risk Analyst Focus — Full Sector Intelligence',
};

const SECTOR_LABELS: Record<string, string> = {
  energy: 'Energy',
  agricultural: 'Agricultural / Grain',
  freight: 'Freight & Shipping',
  fertilizer: 'Fertilizers',
  metals: 'Metals',
  fx: 'FX / GBP',
  policy: 'Policy / Macro',
};

function SectorRow({ sector, text }: { sector: string; text: string }) {
  const label = SECTOR_LABELS[sector] ?? sector.charAt(0).toUpperCase() + sector.slice(1);
  const isEmpty = !text || text.length < 5 || /no significant/i.test(text);

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-800/60 last:border-0">
      <div className="w-28 shrink-0 pt-0.5">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn(
        'text-[12px] leading-relaxed flex-1',
        isEmpty ? 'text-slate-600 italic' : 'text-slate-300'
      )}>
        {text || 'No data'}
      </p>
      {isEmpty ? (
        <span className="shrink-0 w-2 h-2 rounded-full bg-slate-700 mt-1" />
      ) : (
        <CheckCircle size={11} className="shrink-0 text-emerald-500/60 mt-1" />
      )}
    </div>
  );
}

const PERSONAS: PersonaId[] = ['general', 'trader', 'agri', 'logistics', 'analyst'];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

async function fetchEmailPreviewHtml(brief: DailyBrief, persona: PersonaId): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-morning-brief`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'preview', brief, persona }),
  });
  if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
  const json = await res.json();
  return json.html ?? '';
}

export default function DailyBriefPreview() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [rationalOpen, setRationalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [persona, setPersona] = useState<PersonaId>('general');
  const [viewMode, setViewMode] = useState<'data' | 'email'>('data');
  const [emailHtml, setEmailHtml] = useState<string>('');
  const [emailLoading, setEmailLoading] = useState(false);

  const fetchDates = useCallback(async () => {
    const { data } = await supabase
      .from('daily_brief')
      .select('brief_date')
      .order('brief_date', { ascending: false })
      .limit(70);
    const seen = new Set<string>();
    const dates: string[] = [];
    for (const d of (data ?? []) as { brief_date: string }[]) {
      if (!seen.has(d.brief_date)) { seen.add(d.brief_date); dates.push(d.brief_date); }
      if (dates.length >= 14) break;
    }
    setAvailableDates(dates);
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0]);
  }, [selectedDate]);

  const fetchBrief = useCallback(async (date: string, p: PersonaId = persona) => {
    if (!date) return;
    setLoading(true);
    const { data } = await supabase
      .from('daily_brief')
      .select('*')
      .eq('brief_date', date)
      .eq('persona', p)
      .maybeSingle();
    setBrief(data as DailyBrief | null);
    setLoading(false);
  }, [persona]);

  useEffect(() => { fetchDates(); }, []);
  useEffect(() => { if (selectedDate) fetchBrief(selectedDate); }, [selectedDate, fetchBrief]);

  useEffect(() => {
    if (viewMode !== 'email' || !brief) return;
    setEmailLoading(true);
    setEmailHtml('');
    fetchEmailPreviewHtml(brief, persona)
      .then(html => setEmailHtml(html))
      .catch(() => setEmailHtml('<p style="color:#f87171;padding:24px;font-family:sans-serif;">Failed to load email preview.</p>'))
      .finally(() => setEmailLoading(false));
  }, [viewMode, brief, persona]);

  const generatedAt = brief ? new Date(brief.generated_at) : null;
  const totalTokens = brief ? (brief.prompt_tokens ?? 0) + (brief.completion_tokens ?? 0) : 0;
  const meta = PERSONA_META[persona];

  const personaSectors = persona === 'analyst'
    ? Object.keys(brief?.action_rationale ?? {})
    : meta.sectors;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <FileText size={13} className="text-slate-400" />
        <h2 className="text-xs font-bold text-slate-400 tracking-widest uppercase">Daily Brief Preview</h2>
        <div className="flex-1 h-px bg-slate-800" />
        <div className="flex items-center gap-1 bg-slate-800/60 border border-slate-700/50 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('data')}
            className={cn(
              'flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors',
              viewMode === 'data' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <FileText size={9} />
            Data
          </button>
          <button
            onClick={() => setViewMode('email')}
            className={cn(
              'flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors',
              viewMode === 'email' ? 'bg-slate-700 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            <Eye size={9} />
            Email
          </button>
        </div>
        <button
          onClick={() => fetchBrief(selectedDate)}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {availableDates.length > 1 && (
          <div className="flex items-center gap-2">
            <CalendarDays size={11} className="text-slate-500 shrink-0" />
            <select
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-[11px] font-mono bg-slate-800/60 border border-slate-700/60 text-slate-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500/50"
            >
              {availableDates.map(d => (
                <option key={d} value={d}>
                  {new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                  })}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Mail size={11} className="text-slate-500 shrink-0" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mr-1">Edition:</span>
          {PERSONAS.map(p => (
            <button
              key={p}
              onClick={() => setPersona(p)}
              className={cn(
                'text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all',
                persona === p
                  ? 'border-current bg-slate-800'
                  : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-600'
              )}
              style={persona === p ? { color: PERSONA_META[p].accentColor, borderColor: PERSONA_META[p].accentColor } : {}}
            >
              {PERSONA_META[p].label.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500 text-sm">
          <Loader size={14} className="animate-spin" />
          Loading brief...
        </div>
      ) : !brief ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 border border-slate-800 rounded-xl text-slate-500">
          <AlertTriangle size={18} className="text-amber-500/60" />
          <p className="text-sm">No brief found for {selectedDate || 'today'}.</p>
          <p className="text-[11px] text-slate-600">The overnight pipeline may not have run yet.</p>
        </div>
      ) : viewMode === 'email' ? (
        <div className="rounded-xl border border-slate-700/50 overflow-hidden bg-slate-950">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center gap-2">
              <Eye size={11} className="text-slate-500" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email Preview</span>
              <span className="text-[10px] text-slate-600">— {PERSONA_META[persona].label} edition</span>
            </div>
            {emailLoading && <Loader size={11} className="animate-spin text-slate-500" />}
          </div>
          {emailLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-slate-500 text-sm">
              <Loader size={14} className="animate-spin" />
              Rendering email...
            </div>
          ) : emailHtml ? (
            <iframe
              srcDoc={emailHtml}
              title="Email Preview"
              className="w-full border-0"
              style={{ height: '900px', background: '#060d1a' }}
              sandbox="allow-same-origin"
            />
          ) : (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
              <span>No preview available — brief data may be missing.</span>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: meta.accentColor + '33' }}>

          {/* Persona accent bar */}
          <div className="h-0.5" style={{ background: meta.accentColor }} />

          {/* Brief header */}
          <div className="px-5 py-4 border-b border-slate-800/80 flex items-start gap-3 justify-between flex-wrap bg-slate-900/80">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Procurement Intelligence</p>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-slate-100">Morning Brief</h3>
                {persona !== 'general' && (
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-slate-900"
                    style={{ background: meta.accentColor }}
                  >
                    {meta.label}
                  </span>
                )}
              </div>
              <p className="text-[12px] text-slate-500 mt-0.5">
                {new Date(brief.brief_date + 'T12:00:00Z').toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </p>
              {generatedAt && (
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Generated {generatedAt.toLocaleTimeString('en-GB', { hour12: false })} UTC
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                LIVE DATA
              </span>
              {brief.model && brief.model !== 'none' && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 bg-slate-800/60 border border-slate-700/40 px-2 py-1 rounded-lg">
                  <Cpu size={9} />
                  {brief.model}
                </span>
              )}
              {totalTokens > 0 && (
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 bg-slate-800/60 border border-slate-700/40 px-2 py-1 rounded-lg">
                  <MessageSquare size={9} />
                  {totalTokens.toLocaleString()} tokens
                </span>
              )}
            </div>
          </div>

          {/* Narrative */}
          <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/40">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Headline Narrative</p>
            <p className="text-[14px] text-slate-200 leading-relaxed font-medium">{brief.narrative}</p>
            {brief.geopolitical_context && (
              <p
                className="text-[12px] text-slate-400 mt-3 leading-relaxed pl-3 border-l-2"
                style={{ borderColor: meta.accentColor + '55' }}
              >
                {brief.geopolitical_context}
              </p>
            )}
          </div>

          {/* Three things */}
          {brief.three_things?.length > 0 && (
            <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/40">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">3 Things That Matter Today</p>
              <div className="space-y-2 bg-slate-950/60 border border-slate-800 rounded-lg p-3">
                {brief.three_things.map((thing, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-[13px] text-slate-300 leading-relaxed">{thing}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Persona focus section */}
          {personaSectors.length > 0 && brief.action_rationale && (
            <div className="px-5 py-4 border-b border-slate-800/60 bg-slate-900/40">
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: meta.accentColor }}
              >
                {PERSONA_FOCUS_LABEL[persona]}
              </p>
              <p className="text-[11px] text-slate-600 mb-3">{meta.subLabel}</p>
              <div className="border border-slate-800 rounded-lg overflow-hidden">
                {personaSectors.map(sector => {
                  const text = brief.action_rationale[sector] ?? '';
                  return <SectorRow key={sector} sector={sector} text={text} />;
                })}
              </div>
            </div>
          )}

          {/* Full sector rationale (collapsible, analyst-style all sectors) */}
          {persona !== 'analyst' && brief.action_rationale && Object.keys(brief.action_rationale).length > 0 && (
            <div className="border-b border-slate-800/60">
              <button
                className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-slate-800/20 transition-colors"
                onClick={() => setRationalOpen(o => !o)}
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-1">
                  All Sector Rationale
                </p>
                <span className="text-[10px] text-slate-600">
                  {Object.keys(brief.action_rationale).length} sectors
                </span>
                {rationalOpen
                  ? <ChevronDown size={12} className="text-slate-500" />
                  : <ChevronRight size={12} className="text-slate-500" />}
              </button>
              {rationalOpen && (
                <div className="px-5 pb-4">
                  {Object.entries(brief.action_rationale).map(([sector, text]) => (
                    <SectorRow key={sector} sector={sector} text={text} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Token breakdown */}
          {(brief.prompt_tokens || brief.completion_tokens) ? (
            <div className="px-5 py-3 flex items-center gap-4 flex-wrap bg-slate-900/20">
              <span className="text-[10px] font-mono text-slate-600">
                Prompt: {(brief.prompt_tokens ?? 0).toLocaleString()} tokens
              </span>
              <span className="text-slate-800">·</span>
              <span className="text-[10px] font-mono text-slate-600">
                Completion: {(brief.completion_tokens ?? 0).toLocaleString()} tokens
              </span>
              <span className="text-slate-800">·</span>
              <span className="text-[10px] font-mono text-slate-600">
                Total: {totalTokens.toLocaleString()} tokens
              </span>
            </div>
          ) : null}

        </div>
      )}
    </div>
  );
}
