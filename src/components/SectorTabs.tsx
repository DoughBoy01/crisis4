import { Tractor, Ship, ShoppingCart, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SectorId } from '../types';

interface Sector {
  id: SectorId;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
}

const sectors: Sector[] = [
  {
    id: 'agricultural',
    label: 'Agricultural Merchant',
    description: 'Fertilizer · Fuel · Grain',
    icon: Tractor,
    color: 'text-lime-400',
    activeBg: 'bg-lime-500/10',
    activeBorder: 'border-lime-500/40',
    activeText: 'text-lime-300',
  },
  {
    id: 'freight',
    label: 'Freight Forwarder',
    description: 'Container · War Risk · BDI',
    icon: Ship,
    color: 'text-sky-400',
    activeBg: 'bg-sky-500/10',
    activeBorder: 'border-sky-500/40',
    activeText: 'text-sky-300',
  },
  {
    id: 'food',
    label: 'Food Distributor',
    description: 'Wheat · Oils · Packaging',
    icon: ShoppingCart,
    color: 'text-amber-400',
    activeBg: 'bg-amber-500/10',
    activeBorder: 'border-amber-500/40',
    activeText: 'text-amber-300',
  },
  {
    id: 'energy',
    label: 'Energy-Exposed',
    description: 'Gas · Diesel · Manufacturing',
    icon: Zap,
    color: 'text-orange-400',
    activeBg: 'bg-orange-500/10',
    activeBorder: 'border-orange-500/40',
    activeText: 'text-orange-300',
  },
];

interface SectorTabsProps {
  active: SectorId | null;
  onChange: (id: SectorId | null) => void;
}

export default function SectorTabs({ active, onChange }: SectorTabsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {sectors.map(sector => {
        const Icon = sector.icon;
        const isActive = active === sector.id;
        return (
          <button
            key={sector.id}
            onClick={() => onChange(isActive ? null : sector.id)}
            title={sector.description}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all duration-150',
              isActive
                ? `${sector.activeBg} ${sector.activeBorder} ${sector.activeText}`
                : 'bg-slate-800/50 border-border/50 text-muted-foreground hover:border-slate-600 hover:text-slate-300'
            )}
          >
            <Icon size={11} className={cn('shrink-0', isActive ? sector.color : '')} />
            <span className="hidden sm:inline">{sector.label}</span>
            <span className="sm:hidden">{sector.label.split(' ')[0]}</span>
          </button>
        );
      })}
      {active && (
        <button
          onClick={() => onChange(null)}
          className="px-2 py-1 rounded-md text-[10px] text-muted-foreground/60 hover:text-muted-foreground border border-transparent hover:border-border/50 transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
