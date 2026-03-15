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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

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
    <div className={cn(
      'flex items-start gap-3 py-2.5 border-b border-slate-800/60 last:border-0',
    )}>
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
        <span className="shrink-0 w-2 h-2 rounded-full bg-slate-700 mt-1" title="No significant movement" />
      ) : (
        <CheckCircle size={11} className="shrink-0 text-emerald-500/60 mt-1" />
      )}
    </div>
  );
}

export default function DailyBriefPreview() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [rationalOpen, setRationalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const fetchDates = useCallback(async () => {
    const { data } = await supabase
      .from('daily_brief')
      .select('brief_date')
      .order('brief_date', { ascending: false })
      .limit(14);
    const dates = (data ?? []).map((d: { brief_date: string }) => d.brief_date);
    setAvailableDates(dates);
    if (dates.length > 0 && !selectedDate) setSelectedDate(dates[0]);
  }, [selectedDate]);

  const fetchBrief = useCallback(async (date: string) => {
    if (!date) return;
    setLoading(true);
    const { data } = await supabase
      .from('daily_brief')
      .select('*')
      .eq('brief_date', date)
      .maybeSingle();
    setBrief(data as DailyBrief | null);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDates(); }, []);
  useEffect(() => { if (selectedDate) fetchBrief(selectedDate); }, [selectedDate, fetchBrief]);

  const generatedAt = brief ? new Date(brief.generated_at) : null;
  const totalTokens = brief ? (brief.prompt_tokens ?? 0) + (brief.completion_tokens ?? 0) : 0;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <FileText size={13} className="text-slate-400" />
        <h2 className="text-xs font-bold text-slate-400 tracking-widest uppercase">Daily Brief Preview</h2>
        <div className="flex-1 h-px bg-slate-800" />
        <button
          onClick={() => fetchBrief(selectedDate)}
          disabled={loading}
          className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-300 transition-colors"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {availableDates.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
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
      ) : (
        <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 overflow-hidden">

          {/* Brief header */}
          <div className="border-b border-slate-800/80 px-5 py-4 flex items-start gap-3 justify-between flex-wrap bg-slate-900/60">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-0.5">Morning Brief</p>
              <h3 className="text-base font-bold text-slate-100">
                {new Date(brief.brief_date + 'T12:00:00Z').toLocaleDateString('en-GB', {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
                })}
              </h3>
              {generatedAt && (
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Generated at {generatedAt.toLocaleTimeString('en-GB', { hour12: false })} UTC
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
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
          <div className="px-5 py-4 border-b border-slate-800/60">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Headline Narrative</p>
            <p className="text-[14px] text-slate-200 leading-relaxed font-medium">{brief.narrative}</p>
            {brief.geopolitical_context && (
              <p className="text-[12px] text-slate-400 mt-3 leading-relaxed pl-3 border-l-2 border-slate-700">
                {brief.geopolitical_context}
              </p>
            )}
          </div>

          {/* Three things */}
          {brief.three_things?.length > 0 && (
            <div className="px-5 py-4 border-b border-slate-800/60">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">3 Things That Matter Today</p>
              <div className="space-y-2">
                {brief.three_things.map((thing, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-sky-500/20 border border-sky-500/30 text-sky-400 text-[10px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-[13px] text-slate-300 leading-relaxed">{thing}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action rationale (collapsible) */}
          {brief.action_rationale && Object.keys(brief.action_rationale).length > 0 && (
            <div className="border-b border-slate-800/60">
              <button
                className="w-full flex items-center gap-2 px-5 py-3 text-left hover:bg-slate-800/20 transition-colors"
                onClick={() => setRationalOpen(o => !o)}
              >
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex-1">
                  Sector Rationale
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
            <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
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
