import { TrendingUp, TrendingDown, Minus, Clock, AlertCircle } from "lucide-react";
import { useDailyDiff, type PriceDiff } from "@/hooks/useDailyDiff";

const KEY_SYMBOLS = ["BZ=F", "CL=F", "NG=F", "GBPUSD=X", "GBPEUR=X", "ZW=F", "ZC=F", "GC=F", "^GSPC", "^FTSE"];

function DeltaBadge({ pct, abs, currency }: { pct: number; abs: number; currency: string }) {
  const positive = pct > 0;
  const neutral = Math.abs(pct) < 0.01;

  if (neutral) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/50">
        <Minus size={10} />
        <span>flat</span>
      </span>
    );
  }

  const color = positive ? "text-emerald-400" : "text-red-400";
  const Icon = positive ? TrendingUp : TrendingDown;
  const sign = positive ? "+" : "";
  const absFormatted = Math.abs(abs) < 10
    ? Math.abs(abs).toFixed(4).replace(/\.?0+$/, "")
    : Math.abs(abs).toFixed(2);

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${color}`}>
      <Icon size={10} />
      <span>{sign}{pct.toFixed(2)}%</span>
      <span className="font-normal text-[10px] opacity-70">({sign}{absFormatted} {currency})</span>
    </span>
  );
}

function PriceRow({ diff }: { diff: PriceDiff }) {
  const isSignificant = Math.abs(diff.changePercent) >= 0.5;
  return (
    <div className={`flex items-center justify-between py-2 border-b border-border/20 last:border-0 ${isSignificant ? "bg-slate-800/20 -mx-3 px-3 rounded" : ""}`}>
      <div className="min-w-0">
        <span className="text-xs text-slate-300 font-medium truncate block">{diff.label}</span>
        <span className="text-[10px] text-muted-foreground/40 font-mono">
          {diff.yesterdayPrice.toLocaleString()} → {diff.todayPrice.toLocaleString()} {diff.currency}
        </span>
      </div>
      <div className="ml-3 shrink-0">
        <DeltaBadge pct={diff.changePercent} abs={diff.change} currency={diff.currency} />
      </div>
    </div>
  );
}

function FxDiffRow({ label, today, yesterday, change }: { label: string; today: number; yesterday: number; change: number }) {
  const pct = yesterday !== 0 ? (change / yesterday) * 100 : 0;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground/40 font-mono">
          {yesterday.toFixed(4)} → {today.toFixed(4)}
        </span>
        <DeltaBadge pct={pct} abs={change} currency="" />
      </div>
    </div>
  );
}

function formatTime(iso: string | null): string {
  if (!iso) return "–";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  }) + " UTC";
}

export default function DailyDiff() {
  const diff = useDailyDiff();

  if (diff.loading) {
    return (
      <div className="rounded-xl border border-border/30 bg-slate-900/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={12} className="text-muted-foreground/40" />
          <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground/40">Today vs Yesterday</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-8 bg-slate-800/40 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!diff.hasData) {
    return (
      <div className="rounded-xl border border-border/30 bg-slate-900/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock size={12} className="text-muted-foreground/40" />
          <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground/40">Today vs Yesterday</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground/50 py-3">
          <AlertCircle size={12} />
          <p className="text-xs">
            {!diff.todayFetchedAt
              ? "No data fetched yet today — check back after the next refresh."
              : "No data from yesterday to compare against yet."}
          </p>
        </div>
      </div>
    );
  }

  const keyDiffs = diff.priceDiffs.filter(d => KEY_SYMBOLS.includes(d.symbol));
  const movers = keyDiffs.filter(d => Math.abs(d.changePercent) >= 0.1).slice(0, 8);
  const biggestMover = movers[0] ?? null;

  return (
    <div className="rounded-xl border border-border/30 bg-slate-900/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-border/20 flex items-center justify-between bg-slate-800/20">
        <div className="flex items-center gap-2">
          <Clock size={12} className="text-muted-foreground/50" />
          <span className="text-[10px] font-black tracking-widest uppercase text-muted-foreground/50">Today vs Yesterday</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/35">
          <span>Yesterday {formatTime(diff.yesterdayFetchedAt)}</span>
          <span className="text-muted-foreground/20">→</span>
          <span>Today {formatTime(diff.todayFetchedAt)}</span>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {biggestMover && (
          <div className={`rounded-lg p-3 border ${
            Math.abs(biggestMover.changePercent) >= 2
              ? "border-amber-700/40 bg-amber-950/20"
              : "border-border/30 bg-slate-800/20"
          }`}>
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">Biggest move</p>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-200">{biggestMover.label}</span>
              <DeltaBadge pct={biggestMover.changePercent} abs={biggestMover.change} currency={biggestMover.currency} />
            </div>
            <p className="text-[10px] text-muted-foreground/40 font-mono mt-0.5">
              {biggestMover.yesterdayPrice.toLocaleString()} → {biggestMover.todayPrice.toLocaleString()} {biggestMover.currency}
            </p>
          </div>
        )}

        {diff.brentDiff && (
          <div>
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">Brent Crude (EIA spot)</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300">Brent Crude</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-muted-foreground/40 font-mono">
                  ${diff.brentDiff.yesterday?.toFixed(2)} → ${diff.brentDiff.today?.toFixed(2)}
                </span>
                {diff.brentDiff.changePct !== null && diff.brentDiff.change !== null && (
                  <DeltaBadge pct={diff.brentDiff.changePct} abs={diff.brentDiff.change} currency="USD" />
                )}
              </div>
            </div>
          </div>
        )}

        {diff.fxDiff && (diff.fxDiff.gbpUsd || diff.fxDiff.gbpEur) && (
          <div>
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">FX Rates</p>
            {diff.fxDiff.gbpUsd && (
              <FxDiffRow
                label="GBP/USD"
                today={diff.fxDiff.gbpUsd.today!}
                yesterday={diff.fxDiff.gbpUsd.yesterday!}
                change={diff.fxDiff.gbpUsd.change!}
              />
            )}
            {diff.fxDiff.gbpEur && (
              <FxDiffRow
                label="GBP/EUR"
                today={diff.fxDiff.gbpEur.today!}
                yesterday={diff.fxDiff.gbpEur.yesterday!}
                change={diff.fxDiff.gbpEur.change!}
              />
            )}
          </div>
        )}

        {movers.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">All key instruments</p>
            <div className="space-y-0">
              {movers.map(d => <PriceRow key={d.symbol} diff={d} />)}
            </div>
          </div>
        )}

        {diff.sourcesHealthDiff && diff.sourcesHealthDiff.delta !== 0 && (
          <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
            diff.sourcesHealthDiff.delta > 0
              ? "bg-emerald-950/30 border border-emerald-800/30 text-emerald-400"
              : "bg-red-950/30 border border-red-800/30 text-red-400"
          }`}>
            {diff.sourcesHealthDiff.delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            <span>
              Data sources: {diff.sourcesHealthDiff.yesterday} live yesterday → {diff.sourcesHealthDiff.today} today
              {" "}({diff.sourcesHealthDiff.delta > 0 ? "+" : ""}{diff.sourcesHealthDiff.delta} sources)
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
