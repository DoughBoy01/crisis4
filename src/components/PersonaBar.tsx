import { cn } from '@/lib/utils';
import { TrendingUp, ShoppingBasket, Ship, BarChart2, Briefcase } from 'lucide-react';

export type PersonaId = 'trader' | 'agri' | 'logistics' | 'analyst' | 'general';

interface Persona {
  id: PersonaId;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ElementType;
  color: string;
  activeBg: string;
  activeBorder: string;
  activeText: string;
}

const PERSONAS: Persona[] = [
  {
    id: 'trader',
    label: 'Commodity Trader',
    shortLabel: 'Trader',
    description: 'Crisis alerts · Price reactions · Market timing',
    icon: TrendingUp,
    color: 'text-red-400',
    activeBg: 'bg-red-950/50',
    activeBorder: 'border-red-500/50',
    activeText: 'text-red-300',
  },
  {
    id: 'agri',
    label: 'Agri Buyer',
    shortLabel: 'Agri Buyer',
    description: 'Fertilizer · Grain · Supply shocks',
    icon: ShoppingBasket,
    color: 'text-emerald-400',
    activeBg: 'bg-emerald-950/50',
    activeBorder: 'border-emerald-500/50',
    activeText: 'text-emerald-300',
  },
  {
    id: 'logistics',
    label: 'Logistics Director',
    shortLabel: 'Logistics',
    description: 'Shipping lanes · Freight rates · Rerouting',
    icon: Ship,
    color: 'text-sky-400',
    activeBg: 'bg-sky-950/50',
    activeBorder: 'border-sky-500/50',
    activeText: 'text-sky-300',
  },
  {
    id: 'analyst',
    label: 'Risk Analyst',
    shortLabel: 'Analyst',
    description: 'Scenarios · Correlations · Client briefs',
    icon: BarChart2,
    color: 'text-amber-400',
    activeBg: 'bg-amber-950/50',
    activeBorder: 'border-amber-500/50',
    activeText: 'text-amber-300',
  },
  {
    id: 'general',
    label: 'Business Overview',
    shortLabel: 'Overview',
    description: 'Plain-English · What it means for you',
    icon: Briefcase,
    color: 'text-slate-400',
    activeBg: 'bg-slate-800/60',
    activeBorder: 'border-slate-500/50',
    activeText: 'text-slate-300',
  },
];

interface PersonaBarProps {
  active: PersonaId;
  onChange: (id: PersonaId) => void;
}

export default function PersonaBar({ active, onChange }: PersonaBarProps) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
      <span className="text-[10px] font-bold text-muted-foreground/40 tracking-widest uppercase shrink-0 mr-1">View as</span>
      {PERSONAS.map(p => {
        const Icon = p.icon;
        const isActive = active === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onChange(p.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-all shrink-0',
              isActive
                ? `${p.activeBg} ${p.activeBorder} ${p.activeText}`
                : 'bg-slate-900/40 border-border/30 text-muted-foreground/60 hover:text-slate-300 hover:border-border/50'
            )}
          >
            <Icon size={11} className={isActive ? p.activeText : p.color} />
            <span className="hidden sm:inline">{p.label}</span>
            <span className="sm:hidden">{p.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

export { PERSONAS };
