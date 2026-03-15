import { useEffect, useState } from 'react';
import { Wifi, TrendingUp, RefreshCw, Moon, Activity } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import TimezoneSelector from './TimezoneSelector';
import EmailSubscribe from './EmailSubscribe';
import { getTzAbbreviation } from '@/lib/timezone';

interface FxRate {
  pair: string;
  rate: number;
  change: number;
}

interface HeaderProps {
  lastFetchedAt: string | null;
  fxRates: FxRate[] | null;
  overallAccuracy: number | null;
  feedsLoading: boolean;
  secondsSinceRefresh?: number;
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  onOpenDiagnostics?: () => void;
}

function accuracyColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-orange-400';
}

function getMorningGreeting(timezone: string): { greeting: string; subtext: string } {
  const hour = parseInt(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: timezone })
      .format(new Date()),
    10
  );

  if (hour >= 4 && hour < 8) return { greeting: 'Good morning', subtext: "Your overnight brief is ready." };
  if (hour >= 8 && hour < 12) return { greeting: 'Morning', subtext: "Markets open soon — check your actions." };
  if (hour >= 12 && hour < 17) return { greeting: 'Good afternoon', subtext: "Monitoring continues through the day." };
  return { greeting: 'Late session', subtext: "Overnight monitoring is active." };
}

export default function Header({
  lastFetchedAt,
  fxRates,
  overallAccuracy,
  feedsLoading,
  secondsSinceRefresh = 0,
  timezone,
  onTimezoneChange,
  onOpenDiagnostics,
}: HeaderProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const timeStr = currentTime.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
    hour12: false,
  });

  const dateStr = currentTime.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: timezone,
  });

  const tzAbbr = getTzAbbreviation(timezone);
  const { greeting, subtext } = getMorningGreeting(timezone);

  return (
    <header className="border-b border-border bg-card/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-2 h-14 min-w-0">

          {/* Left: logo + morning greeting */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 bg-primary/10 border border-primary/30 rounded flex items-center justify-center shrink-0">
                <TrendingUp size={14} className="text-primary" />
              </div>
              <div>
                <span className="text-sm font-bold text-foreground tracking-tight">ClearBid</span>
                <span className="hidden sm:inline text-xs text-muted-foreground ml-2">Procurement Intelligence</span>
              </div>
            </div>

            <Separator orientation="vertical" className="h-5 bg-border hidden lg:block" />

            <div className="hidden lg:flex items-center gap-1.5 min-w-0">
              <Moon size={11} className="text-amber-400/70 shrink-0" />
              <span className="text-xs text-slate-300 font-medium truncate">{greeting}.</span>
              <span className="hidden xl:inline text-xs text-muted-foreground/60 truncate">{subtext}</span>
            </div>
          </div>

          {/* Right: live data + time */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">

            {fxRates && fxRates.length > 0 ? (
              <div className="hidden lg:flex items-center gap-3">
                {fxRates.map(fx => (
                  <div key={fx.pair} className="text-xs">
                    <span className="text-muted-foreground">{fx.pair}</span>
                    <span className="text-slate-200 ml-1.5 font-mono">{fx.rate.toFixed(4)}</span>
                  </div>
                ))}
                <Separator orientation="vertical" className="h-4 bg-border" />
              </div>
            ) : null}

            {overallAccuracy !== null && !feedsLoading && (
              <div className="hidden md:flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground/60">Accuracy</span>
                <span className={cn('font-bold font-mono', accuracyColor(overallAccuracy))}>
                  {overallAccuracy}%
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {feedsLoading ? (
                <RefreshCw size={11} className="text-sky-400 animate-spin" />
              ) : (
                <Wifi size={11} className={lastFetchedAt ? 'text-emerald-400' : 'text-muted-foreground/40'} />
              )}
              <span className="hidden sm:inline text-muted-foreground/60">
                {feedsLoading ? 'Fetching...' : lastFetchedAt ? `Updated ${lastFetchedAt}` : 'No live data'}
              </span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 text-xs border border-border/50 rounded px-2 sm:px-2.5 py-1 bg-slate-800/40">
              <span className="font-mono font-bold text-slate-100">{timeStr}</span>
              <span className="text-muted-foreground/50 hidden sm:inline">{tzAbbr}</span>
              <span className="text-muted-foreground/40 hidden xl:inline text-[10px]">{dateStr}</span>
            </div>

            <TimezoneSelector value={timezone} onChange={onTimezoneChange} />

            <EmailSubscribe />

            {onOpenDiagnostics && (
              <button
                onClick={onOpenDiagnostics}
                title="Service Diagnostics"
                className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded border border-border/50 bg-slate-800/40 hover:bg-slate-700/50 hover:border-sky-500/40 transition-colors text-muted-foreground/60 hover:text-sky-400"
              >
                <Activity size={11} />
                <span className="text-[10px] hidden lg:inline font-medium">Diagnostics</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {!lastFetchedAt && !feedsLoading && (
        <div className="border-t border-border/50 bg-amber-950/20 px-4 sm:px-6 py-1.5">
          <div className="max-w-screen-2xl mx-auto">
            <p className="text-xs text-amber-400/70">
              Live data not yet loaded. EIA and ExchangeRate.host API keys required for price feeds. RSS news feeds load without keys.
            </p>
          </div>
        </div>
      )}
      {lastFetchedAt && !feedsLoading && secondsSinceRefresh > 900 && (
        <div className="border-t border-border/50 bg-orange-950/20 px-4 sm:px-6 py-1.5">
          <div className="max-w-screen-2xl mx-auto flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400/70 shrink-0" />
            <p className="text-xs text-orange-400/70">
              Data last refreshed {Math.floor(secondsSinceRefresh / 60)} minutes ago — prices may not reflect current market conditions.
            </p>
          </div>
        </div>
      )}
    </header>
  );
}
