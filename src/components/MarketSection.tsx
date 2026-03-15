import { cn } from '@/lib/utils';
import type { MarketItem, MarketCategory, SectorId } from '../types';
import MarketCard from './MarketCard';

interface MarketSectionProps {
  category: MarketCategory;
  label: string;
  description: string;
  items: MarketItem[];
  activeSector?: SectorId | null;
}

const categoryColors: Record<MarketCategory, string> = {
  energy: 'text-orange-400',
  freight: 'text-sky-400',
  fertilizer: 'text-lime-400',
  agricultural: 'text-amber-400',
  metals: 'text-slate-300',
  fx: 'text-teal-400',
};

const categoryDots: Record<MarketCategory, string> = {
  energy: 'bg-orange-400',
  freight: 'bg-sky-400',
  fertilizer: 'bg-lime-400',
  agricultural: 'bg-amber-400',
  metals: 'bg-slate-300',
  fx: 'bg-teal-400',
};

export default function MarketSection({ category, label, description, items, activeSector }: MarketSectionProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <span className={cn('w-2 h-2 rounded-full', categoryDots[category])} />
        <h3 className={cn('text-xs font-bold tracking-widest uppercase', categoryColors[category])}>
          {label}
        </h3>
        <span className="text-xs text-muted-foreground/60">{description}</span>
      </div>
      <div className="grid grid-cols-1 gap-3">
        {items.map(item => (
          <MarketCard key={item.id} item={item} activeSector={activeSector} />
        ))}
      </div>
    </div>
  );
}
