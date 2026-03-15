import { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Star, BarChart3, Leaf } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { MarketItem, SectorId } from '../types';
import SignalBadge from './SignalBadge';
import SparkLine from './SparkLine';
import PriceRangeChart from './PriceRangeChart';

interface MarketCardProps {
  item: MarketItem;
  activeSector?: SectorId | null;
  timezone?: string;
}

export default function MarketCard({ item, activeSector, timezone = 'Europe/London' }: MarketCardProps) {
  const [expanded, setExpanded] = useState(false);
  const positive = item.changePercent24h >= 0;
  const isRelevant = activeSector ? item.relevantSectors.includes(activeSector) : false;
  const isDimmed = activeSector ? !isRelevant : false;
  const perc = item.percentileContext;
  const seasonal = item.seasonalContext;

  return (
    <Card
      className={cn(
        'bg-slate-800/60 overflow-hidden transition-all duration-200 hover:border-slate-500/60 cursor-pointer',
        item.signal === 'URGENT' && 'border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.15)]',
        item.signal === 'BUY' && !isDimmed && 'border-emerald-500/30',
        isRelevant && 'ring-1 ring-sky-500/30',
        isDimmed && 'opacity-40',
      )}
      onClick={() => setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <SignalBadge signal={item.signal} size="sm" />
              {isRelevant && (
                <span className="inline-flex items-center gap-1 text-[10px] text-sky-400 font-medium">
                  <Star size={9} className="fill-sky-400" />
                  Your sector
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {(() => {
                  try {
                    const d = new Date(item.lastUpdated);
                    if (isNaN(d.getTime())) return item.lastUpdated;
                    const tzAbbr = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'short' })
                      .formatToParts(d).find(p => p.type === 'timeZoneName')?.value ?? 'GMT';
                    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: timezone }) + ' ' + tzAbbr;
                  } catch { return item.lastUpdated; }
                })()}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-200 leading-tight truncate">{item.name}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <SparkLine data={item.history} positive={positive} />
          </div>
        </div>

        <div className="flex items-end justify-between mt-3">
          <div>
            {item.currency === 'USX' ? (
              <span className="text-2xl font-bold text-foreground tracking-tight">
                {item.price.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                <span className="text-base font-normal text-muted-foreground ml-0.5">¢</span>
              </span>
            ) : (
              <span className="text-2xl font-bold text-foreground tracking-tight">
                {item.currency === 'GBP' ? '£' : item.currency === 'EUR' ? '€' : '$'}
                {item.price.toLocaleString('en-GB', {
                  minimumFractionDigits: item.price < 10 ? 3 : 2,
                  maximumFractionDigits: item.price < 10 ? 3 : 2,
                })}
              </span>
            )}
            <span className="text-xs text-muted-foreground ml-1">/{item.unit}</span>
          </div>
          <div className="text-right">
            <div className={cn('text-sm font-semibold', positive ? 'text-emerald-400' : 'text-red-400')}>
              {positive ? '+' : ''}{item.changePercent24h.toFixed(2)}%
            </div>
            <div className={cn('text-xs', positive ? 'text-emerald-500/70' : 'text-red-500/70')}>
              {positive ? '+' : ''}
              {item.currency === 'USX' ? '' : item.currency === 'GBP' ? '£' : item.currency === 'EUR' ? '€' : '$'}
              {Math.abs(item.change24h).toFixed(item.change24h < 1 ? 4 : 2)}
              {item.currency === 'USX' ? '¢' : ''} session
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mt-2">
          <div className={cn('text-xs', positive ? 'text-emerald-500/60' : 'text-red-500/60')}>
            7-day: {item.changeWeeklyPercent >= 0 ? '+' : ''}{item.changeWeeklyPercent.toFixed(2)}%
          </div>
          <span className="text-muted-foreground">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>

        {perc && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <BarChart3 size={9} className="text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/60">10-yr range</span>
              </div>
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded', perc.bg, perc.color)}>
                {perc.rank}th pct · {perc.label}
              </span>
            </div>
            <PriceRangeChart
              price={item.price}
              perc={perc}
              currency={item.currency}
              unit={item.unit}
            />
          </div>
        )}

        {seasonal && seasonal.pressureLabel !== 'NORMAL' && (
          <div className="mt-2 flex items-start gap-1.5 rounded-md px-2 py-1.5 bg-slate-700/30 border border-slate-600/20">
            <Leaf size={9} className={cn('shrink-0 mt-0.5', seasonal.color)} />
            <div className="min-w-0">
              <span className={cn('text-[10px] font-semibold', seasonal.color)}>
                Seasonal demand: {seasonal.pressureLabel}
              </span>
              {seasonal.notes && (
                <p className="text-[9px] text-muted-foreground/55 leading-relaxed mt-0.5 line-clamp-2">
                  {seasonal.notes}
                </p>
              )}
            </div>
          </div>
        )}

        {expanded && (
          <>
            <Separator className="my-3 bg-slate-700/50" />
            <p className="text-sm text-slate-300 leading-relaxed mb-3">{item.rationale}</p>
            {perc && (
              <p className="text-[10px] text-muted-foreground/50 mb-3">
                Historical context: {perc.dataSource}
              </p>
            )}
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 text-xs text-sky-400/80 hover:text-sky-400 transition-colors"
            >
              <ExternalLink size={11} />
              {item.source}
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}
