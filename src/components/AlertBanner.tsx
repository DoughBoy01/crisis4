import { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, X, ArrowRight } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { MorningAlert } from '../types';
import { convertGmtTimeStringToTz } from '@/lib/timezone';

interface AlertBannerProps {
  alerts: MorningAlert[];
  timezone?: string;
  variant?: 'default' | 'critical-strip';
}

const severityConfig = {
  critical: {
    wrapperClass: 'border-red-500/60 bg-red-950/50',
    icon: AlertTriangle,
    iconClass: 'text-red-400',
    badgeClass: 'bg-red-500/25 text-red-300 border-red-500/50',
    label: 'CRITICAL',
    titleColor: 'text-red-100',
    expandByDefault: true,
  },
  high: {
    wrapperClass: 'border-amber-500/40 bg-amber-950/30',
    icon: AlertCircle,
    iconClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    label: 'HIGH',
    titleColor: 'text-slate-200',
    expandByDefault: false,
  },
  medium: {
    wrapperClass: 'border-slate-600/40 bg-slate-800/30',
    icon: Info,
    iconClass: 'text-sky-400',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    label: 'MEDIUM',
    titleColor: 'text-slate-300',
    expandByDefault: false,
  },
};

function CriticalStrip({ alerts, timezone }: { alerts: MorningAlert[]; timezone: string }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(alerts[0]?.id ?? null);

  const visible = alerts.filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map(alert => {
        const isExpanded = expandedId === alert.id;
        return (
          <div
            key={alert.id}
            className="rounded-lg border-2 border-red-500/70 bg-red-950/60 overflow-hidden"
          >
            <div
              className="flex items-start gap-3 px-4 py-3 cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : alert.id)}
            >
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <AlertTriangle size={15} className="text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] font-bold tracking-wider px-2 py-0.5 bg-red-500/30 text-red-200 border-red-400/60">
                    CRITICAL
                  </Badge>
                  <span className="text-[10px] text-red-300/60 font-mono">
                    {convertGmtTimeStringToTz(alert.timestamp, timezone)}
                  </span>
                  {alert.affectedMarkets.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {alert.affectedMarkets.map(m => (
                        <span key={m} className="text-[9px] bg-red-900/50 border border-red-500/30 rounded px-1.5 py-0.5 text-red-300">{m}</span>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-sm font-bold text-red-100 leading-snug">{alert.title}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); setDismissed(prev => [...prev, alert.id]); }}
                  className="text-red-400/50 hover:text-red-300 transition-colors p-1"
                  title="Dismiss"
                >
                  <X size={13} />
                </button>
                {isExpanded ? <ChevronUp size={13} className="text-red-400/60" /> : <ChevronDown size={13} className="text-red-400/60" />}
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-red-500/20 px-4 pb-3 pt-2.5 space-y-2">
                <p className="text-sm text-red-100/90 leading-relaxed">{alert.body}</p>
                {alert.geopoliticalContext && (
                  <div className="flex items-start gap-2 bg-red-900/30 border border-red-500/20 rounded px-2.5 py-2">
                    <ArrowRight size={11} className="text-red-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-200/80 leading-relaxed">{alert.geopoliticalContext}</p>
                  </div>
                )}
                <p className="text-[10px] text-red-400/50 font-mono">Source: {alert.source}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AlertBanner({ alerts, timezone = "Europe/London", variant = 'default' }: AlertBannerProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const defaultExpanded = alerts
    .filter(a => severityConfig[a.severity].expandByDefault)
    .map(a => a.id);
  const [expanded, setExpanded] = useState<string[]>(defaultExpanded);

  if (variant === 'critical-strip') {
    return <CriticalStrip alerts={alerts} timezone={timezone} />;
  }

  const visible = alerts.filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      {visible.map(alert => {
        const cfg = severityConfig[alert.severity];
        const Icon = cfg.icon;
        const isExpanded = expanded.includes(alert.id);

        return (
          <Alert
            key={alert.id}
            className={cn(
              'cursor-pointer transition-all duration-200',
              cfg.wrapperClass,
              alert.severity === 'critical' && 'ring-1 ring-red-500/20',
            )}
            onClick={() =>
              setExpanded(prev =>
                isExpanded ? prev.filter(id => id !== alert.id) : [...prev, alert.id]
              )
            }
          >
            <Icon className={cn('h-4 w-4 shrink-0', cfg.iconClass)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className={cn('text-[10px] font-bold tracking-wider px-1.5 py-0', cfg.badgeClass)}>
                  {cfg.label}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {convertGmtTimeStringToTz(alert.timestamp, timezone)}
                </span>
                {!isExpanded && alert.affectedMarkets.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/60 hidden sm:inline truncate">
                    {alert.affectedMarkets.slice(0, 2).join(' · ')}
                    {alert.affectedMarkets.length > 2 && ` +${alert.affectedMarkets.length - 2}`}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); setDismissed(prev => [...prev, alert.id]); }}
                    className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    <X size={12} />
                  </button>
                  {isExpanded
                    ? <ChevronUp size={12} className="text-muted-foreground/50" />
                    : <ChevronDown size={12} className="text-muted-foreground/50" />
                  }
                </div>
              </div>
              <AlertTitle className={cn('text-sm font-semibold mb-0 leading-snug', cfg.titleColor)}>
                {alert.title}
              </AlertTitle>
              {isExpanded && (
                <AlertDescription className="mt-2.5 space-y-2">
                  <p className="text-sm text-slate-300 leading-relaxed">{alert.body}</p>
                  {alert.geopoliticalContext && (
                    <div className="flex items-start gap-2 bg-slate-900/50 border border-border/40 rounded px-2.5 py-2">
                      <ArrowRight size={10} className="text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground leading-relaxed">{alert.geopoliticalContext}</p>
                    </div>
                  )}
                  {alert.affectedMarkets.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {alert.affectedMarkets.map(m => (
                        <span key={m} className="text-[9px] bg-slate-800 border border-border rounded px-1.5 py-0.5 text-muted-foreground">{m}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground/50 font-mono">Source: {alert.source}</p>
                </AlertDescription>
              )}
            </div>
          </Alert>
        );
      })}
    </div>
  );
}
