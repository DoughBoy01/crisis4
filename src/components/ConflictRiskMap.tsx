import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Shield, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ConflictZone, ConflictRiskLevel } from '@/types';

interface ConflictRiskMapProps {
  zones: ConflictZone[];
  loading?: boolean;
}

const RISK_CONFIG: Record<ConflictRiskLevel, { label: string; bar: string; text: string; border: string; bg: string }> = {
  CRITICAL: { label: 'CRITICAL', bar: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/40', bg: 'bg-red-500/8' },
  HIGH:     { label: 'HIGH',     bar: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/6' },
  ELEVATED: { label: 'ELEVATED', bar: 'bg-amber-500', text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/6' },
  MODERATE: { label: 'MODERATE', bar: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-500/6' },
  LOW:      { label: 'LOW',      bar: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/20', bg: 'bg-emerald-500/4' },
};

const RISK_WIDTH: Record<ConflictRiskLevel, string> = {
  CRITICAL: 'w-full',
  HIGH: 'w-4/5',
  ELEVATED: 'w-3/5',
  MODERATE: 'w-2/5',
  LOW: 'w-1/5',
};

function ZoneCard({ zone }: { zone: ConflictZone }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = RISK_CONFIG[zone.riskLevel];

  return (
    <div
      className={cn('rounded-lg border p-3 cursor-pointer transition-all duration-150', cfg.border, cfg.bg)}
      onClick={() => setExpanded(v => !v)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('text-[10px] font-bold tracking-wider', cfg.text)}>{cfg.label}</span>
            {(zone.riskLevel === 'CRITICAL' || zone.riskLevel === 'HIGH') && (
              <Zap size={9} className={cn('shrink-0', cfg.text)} />
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">{zone.evidenceCount} signal{zone.evidenceCount !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-xs font-semibold text-slate-200 leading-tight">{zone.region}</p>
          {zone.subRegion && (
            <p className="text-[10px] text-muted-foreground mt-0.5">{zone.subRegion}</p>
          )}
          <div className="mt-2 h-1 rounded-full bg-slate-700/50 overflow-hidden">
            <div className={cn('h-full rounded-full transition-all', cfg.bar, RISK_WIDTH[zone.riskLevel])} />
          </div>
        </div>
        <span className="text-muted-foreground/50 mt-0.5 shrink-0">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </span>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-slate-700/40 pt-2">
          <div>
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">Affected commodities</p>
            <div className="flex flex-wrap gap-1">
              {zone.affectedCommodities.map(c => (
                <span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300 border border-slate-600/40">{c}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">Affected routes</p>
            <div className="flex flex-wrap gap-1">
              {zone.affectedRoutes.map(r => (
                <span key={r} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-400 border border-slate-600/30">{r}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider mb-1">Supply impact</p>
            <p className="text-[10px] text-slate-300 leading-relaxed">{zone.supplyImpact}</p>
          </div>
          <div className="border-t border-slate-700/30 pt-2">
            <p className="text-[10px] text-muted-foreground/60 mb-1">Latest signal</p>
            <p className="text-[10px] text-slate-300 leading-snug line-clamp-2">{zone.latestHeadline}</p>
            {zone.headlineLink && (
              <a
                href={zone.headlineLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 mt-1 text-[9px] text-sky-400/70 hover:text-sky-400 transition-colors"
              >
                <ExternalLink size={9} />
                {zone.headlineSource}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConflictRiskMap({ zones, loading }: ConflictRiskMapProps) {
  const criticalCount = zones.filter(z => z.riskLevel === 'CRITICAL' || z.riskLevel === 'HIGH').length;

  return (
    <Card className="bg-slate-900/60 border-slate-700/50 overflow-hidden">
      <CardHeader className="px-4 pt-3 pb-0 space-y-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className={criticalCount > 0 ? 'text-red-400' : 'text-amber-400/60'} />
            <div>
              <p className="text-xs font-bold text-slate-200">Conflict Risk Register</p>
              <p className="text-[10px] text-muted-foreground">Active zones affecting UK procurement</p>
            </div>
          </div>
          {zones.length > 0 && (
            <div className="flex items-center gap-1.5">
              {criticalCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30 font-semibold">
                  {criticalCount} HIGH+
                </span>
              )}
              <span className="text-[10px] text-muted-foreground/50">{zones.length} zones</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-4 py-3">
        {loading && zones.length === 0 ? (
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-4 py-6 text-center">
            <Shield size={20} className="text-muted-foreground/30 mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-muted-foreground/50">Scanning intelligence feeds…</p>
          </div>
        ) : zones.length === 0 ? (
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-4 py-6 text-center">
            <Shield size={20} className="text-emerald-500/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground/50">No active conflict signals detected</p>
            <p className="text-[10px] text-muted-foreground/30 mt-1">Monitoring 17 sources across 6 zone configurations</p>
          </div>
        ) : (
          <div className="space-y-2">
            {zones.map(zone => (
              <ZoneCard key={zone.id} zone={zone} />
            ))}
          </div>
        )}

        <div className="border-t border-border/30 pt-2 mt-3 flex items-start gap-1.5">
          <ExternalLink size={9} className="text-muted-foreground/40 shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground/40 leading-relaxed">
            Sources: Reuters · Al Jazeera · BBC · ReliefWeb · Guardian · MarketWatch · Shipping feeds
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
