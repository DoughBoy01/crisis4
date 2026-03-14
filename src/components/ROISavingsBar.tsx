import { PoundSterling, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { ActionItem } from '../types';

interface ROISavingsBarProps {
  topAction: ActionItem;
  subscriptionCost: number;
}

export default function ROISavingsBar({ topAction, subscriptionCost }: ROISavingsBarProps) {
  const roi = topAction.roi;
  if (!roi) return null;

  const yearlyMultiplier = Math.round(roi.savingAmount / (subscriptionCost / 12));

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900/40 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(16,185,129,0.06),_transparent_60%)] pointer-events-none" />
      <CardContent className="relative px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <PoundSterling size={16} className="text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Today's Top Saving Opportunity</span>
                {topAction.deadline && (
                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-300 border-red-500/30 font-bold gap-1 animate-pulse">
                    <Clock size={9} />
                    Act before {topAction.deadline}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground mt-0.5 truncate">{topAction.title}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-5 shrink-0">
            <Separator orientation="vertical" className="h-10 bg-border hidden sm:block" />

            <div className="text-center">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight">
                £{roi.savingAmount.toLocaleString('en-GB')}
              </div>
              <div className="text-xs text-muted-foreground">
                {roi.tonnage.toLocaleString()} {roi.unit} × £{roi.priceMove}{roi.unit === 'litres' ? '/L' : '/t'} saving
              </div>
            </div>

            <Separator orientation="vertical" className="h-10 bg-border hidden sm:block" />

            <div className="text-center">
              <div className="flex items-center gap-1.5 justify-center">
                <TrendingUp size={13} className="text-emerald-400" />
                <span className="text-lg sm:text-xl font-bold text-emerald-400">{yearlyMultiplier}×</span>
              </div>
              <div className="text-xs text-muted-foreground">annual sub ROI</div>
            </div>

            <Separator orientation="vertical" className="h-10 bg-border hidden sm:block" />

            <div className="text-center">
              <div className="text-sm font-bold text-slate-300">£{(subscriptionCost / 12).toFixed(0)}/mo</div>
              <div className="text-xs text-muted-foreground">subscription cost</div>
            </div>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-emerald-500/10">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <span className="text-emerald-400/80 font-medium">How this is calculated:</span> {roi.tonnage.toLocaleString()} {roi.unit} × £{roi.priceMove} price move = £{roi.savingAmount.toLocaleString()} — captured only if you act before {roi.deadline}. One correct decision covers <span className="text-emerald-400/80 font-medium">{yearlyMultiplier} months</span> of your ClearBid subscription.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
