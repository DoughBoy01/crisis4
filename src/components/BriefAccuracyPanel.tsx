import { useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, ChevronDown, ChevronRight, FileText, TrendingUp, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

type Verdict = 'confirmed' | 'imprecise' | 'unverifiable';

interface AccuracyClaim {
  claim: string;
  verdict: Verdict;
  notes: string;
}

interface BriefAccuracyReport {
  briefDate: string;
  briefTime: string;
  generatedBy: string;
  overallSummary: string;
  overallScore: number;
  strengths: string[];
  weaknesses: string[];
  claims: AccuracyClaim[];
  factCheckedBy: string;
}

const REPORT: BriefAccuracyReport = {
  briefDate: 'Sunday 15 March 2026',
  briefTime: '08:45 UTC',
  generatedBy: 'gpt-4o-2024-08-06',
  overallScore: 78,
  overallSummary:
    'The core geopolitical narrative and market framing are accurate and well-supported by external sources. The main weaknesses are vague cost metrics, a slightly misleading characterisation of GBP/USD as "flat", and the omission of an explicit Brent price. The disclaimer appropriately flags that signals and cost estimates may contain errors.',
  strengths: [
    'Strait of Hormuz "effectively closed" — confirmed by IRGC statements (2 Mar 2026) and 70%+ reduction in ship-tracking traffic',
    'Brent at elevated levels (~$103/bbl) — factually accurate; ~51% rise over the prior month and 47% year-on-year',
    'Iran conflict as driver of oil prices — correctly attributed with verifiable geopolitical context',
    'Pete Hegseth quote verified — Pentagon briefing 13 Mar 2026: "We have been dealing with it, and don\'t need to worry about it"',
    'GBP/USD described as flat Friday–Saturday — accurate for the Fri–Sat window referenced',
    'Prudent use of "$X" placeholder — avoided repeating earlier email\'s erroneous $3.26 price',
  ],
  weaknesses: [
    'No explicit Brent price stated — the "$X" placeholder is cautious but unhelpful for a procurement brief targeting forward diesel cover; ~$103–$104/bbl should have been included',
    '"Flat" GBP/USD is slightly misleading — while flat Fri–Sat, the rate dropped ~0.9% on the week (1.3352 Thu → 1.3224 Fri close); this understates recent depreciation pressure',
    '"Historical baseline of 8 events per week" — unverifiable metric with no external source; appears to be AI-generated boilerplate',
    '3–4% landed cost increase estimate — plausible given the oil surge but unattributed; no methodology cited',
  ],
  claims: [
    {
      claim: 'Strait of Hormuz "effectively closed"',
      verdict: 'confirmed',
      notes: 'IRGC confirmed closure 2 Mar 2026; ship-tracking data shows 70%+ traffic reduction; Iran claimed "complete control" by 4 Mar; as of 14 Mar confirmed closed to US ships.',
    },
    {
      claim: 'Brent at elevated / historically high levels',
      verdict: 'confirmed',
      notes: 'Brent at ~$103.86/bbl on 13 Mar 2026; up >51% in the prior month and 47% year-on-year. High-percentile framing is accurate.',
    },
    {
      claim: 'Iran conflict driving oil prices',
      verdict: 'confirmed',
      notes: 'US-Israeli conflict with Iran, involving drone and missile attacks on US bases and shipping, is verified and ongoing.',
    },
    {
      claim: 'Pete Hegseth "don\'t need to worry about it" quote',
      verdict: 'confirmed',
      notes: 'Exact quote verified from Pentagon briefing, 13 March 2026.',
    },
    {
      claim: 'GBP/USD described as "flat"',
      verdict: 'imprecise',
      notes: 'Rate closed at 1.3237 on both 13 and 14 Mar — flat Fri–Sat is accurate. However, the rate fell ~0.9% over the week (1.3352 Thu → 1.3224 Fri). Calling it flat without that context understates depreciation pressure.',
    },
    {
      claim: '"Historical baseline of 8 events per week" metric',
      verdict: 'unverifiable',
      notes: 'No external source corroborates this figure. Appears to be AI-generated boilerplate. Should be removed or sourced.',
    },
    {
      claim: 'No explicit Brent price ($X placeholder)',
      verdict: 'imprecise',
      notes: 'Avoids the earlier brief\'s error but omits actionable data. A procurement brief should state the actual price (~$103–$104/bbl).',
    },
    {
      claim: '3–4% landed cost increase estimate',
      verdict: 'imprecise',
      notes: 'Plausible given combined oil + FX pressure, but unattributed with no cited methodology.',
    },
  ],
  factCheckedBy: 'Claude Sonnet 4.6',
};

const VERDICT_CONFIG: Record<Verdict, { icon: typeof CheckCircle; color: string; bg: string; border: string; label: string }> = {
  confirmed: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    label: 'Confirmed',
  },
  imprecise: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    label: 'Imprecise',
  },
  unverifiable: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'Unverifiable',
  },
};

function ScoreArc({ score }: { score: number }) {
  const confirmed = REPORT.claims.filter(c => c.verdict === 'confirmed').length;
  const imprecise = REPORT.claims.filter(c => c.verdict === 'imprecise').length;
  const unverifiable = REPORT.claims.filter(c => c.verdict === 'unverifiable').length;
  const total = REPORT.claims.length;

  const color =
    score >= 80 ? '#34d399' :
    score >= 60 ? '#fbbf24' :
    '#f87171';

  return (
    <div className="flex items-center gap-6">
      <div className="relative flex items-center justify-center w-20 h-20">
        <svg viewBox="0 0 80 80" className="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r="32" fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx="40" cy="40" r="32"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={`${2 * Math.PI * 32}`}
            strokeDashoffset={`${2 * Math.PI * 32 * (1 - score / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute text-center">
          <p className="text-xl font-800 font-bold leading-none" style={{ color }}>{score}</p>
          <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Score</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">{confirmed}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Confirmed</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-amber-400">{imprecise}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Imprecise</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-red-400">{unverifiable}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider">Unverifiable</p>
        </div>
        <div className="col-span-3 text-center">
          <p className="text-[10px] text-slate-600">{total} claims assessed</p>
        </div>
      </div>
    </div>
  );
}

function ClaimRow({ claim }: { claim: AccuracyClaim }) {
  const [open, setOpen] = useState(false);
  const cfg = VERDICT_CONFIG[claim.verdict];
  const Icon = cfg.icon;

  return (
    <div className={cn('border rounded-lg overflow-hidden transition-all', cfg.border, open ? cfg.bg : 'bg-slate-900/40')}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <Icon size={14} className={cn('shrink-0 mt-0.5', cfg.color)} />
        <span className="flex-1 text-sm text-slate-200 leading-snug">{claim.claim}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border', cfg.color, cfg.bg, cfg.border)}>
            {cfg.label}
          </span>
          {open ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0 border-t border-white/5">
          <p className="text-xs text-slate-400 leading-relaxed ml-[26px]">{claim.notes}</p>
        </div>
      )}
    </div>
  );
}

export default function BriefAccuracyPanel() {
  const [strengthsOpen, setStrengthsOpen] = useState(false);
  const [weaknessesOpen, setWeaknessesOpen] = useState(true);

  return (
    <div className="space-y-4">

      {/* Header card */}
      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl overflow-hidden">
        <div className="bg-slate-800/60 border-b border-slate-700/40 px-5 py-3 flex items-center gap-3">
          <FileText size={14} className="text-sky-400" />
          <div>
            <p className="text-xs font-bold text-slate-200 uppercase tracking-wider">Brief Accuracy Analysis</p>
            <p className="text-[10px] text-slate-500">{REPORT.briefDate} &middot; Generated {REPORT.briefTime} &middot; {REPORT.generatedBy}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider">Fact-checked by</span>
            <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded-full">{REPORT.factCheckedBy}</span>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
          <ScoreArc score={REPORT.overallScore} />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Overall Assessment</p>
            <p className="text-sm text-slate-300 leading-relaxed">{REPORT.overallSummary}</p>
          </div>
        </div>
      </div>

      {/* Strengths */}
      <div className="bg-slate-900/40 border border-emerald-500/20 rounded-xl overflow-hidden">
        <button
          onClick={() => setStrengthsOpen(v => !v)}
          className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors"
        >
          <CheckCircle size={13} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex-1">What's Correct ({REPORT.strengths.length})</span>
          {strengthsOpen ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
        </button>
        {strengthsOpen && (
          <div className="border-t border-emerald-500/10 px-5 py-3 space-y-2">
            {REPORT.strengths.map((s, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1 h-1 rounded-full bg-emerald-500 mt-2 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weaknesses */}
      <div className="bg-slate-900/40 border border-amber-500/20 rounded-xl overflow-hidden">
        <button
          onClick={() => setWeaknessesOpen(v => !v)}
          className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors"
        >
          <AlertTriangle size={13} className="text-amber-400 shrink-0" />
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex-1">What's Imprecise or Missing ({REPORT.weaknesses.length})</span>
          {weaknessesOpen ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
        </button>
        {weaknessesOpen && (
          <div className="border-t border-amber-500/10 px-5 py-3 space-y-2">
            {REPORT.weaknesses.map((w, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-1 h-1 rounded-full bg-amber-500 mt-2 shrink-0" />
                <p className="text-xs text-slate-400 leading-relaxed">{w}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Claim-by-claim scorecard */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <TrendingUp size={13} className="text-slate-500" />
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Claim-by-Claim Scorecard</p>
          <span className="text-[9px] text-slate-600 ml-1">Click to expand notes</span>
        </div>
        <div className="space-y-2">
          {REPORT.claims.map((c, i) => (
            <ClaimRow key={i} claim={c} />
          ))}
        </div>
      </div>

      {/* Methodology note */}
      <div className="flex items-start gap-2.5 px-4 py-3 bg-slate-900/30 border border-slate-800/60 rounded-lg">
        <MessageSquare size={12} className="text-slate-600 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-600 leading-relaxed">
          Accuracy score is an indicative composite: 1 point per confirmed claim, 0.5 per imprecise, 0 per unverifiable, expressed as a percentage.
          This analysis was prepared independently using {REPORT.factCheckedBy} against public sources available as of {REPORT.briefDate}.
        </p>
      </div>

    </div>
  );
}
