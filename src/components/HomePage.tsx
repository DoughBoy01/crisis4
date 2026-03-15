import { ArrowRight, BarChart2, Bell, CheckSquare, Clock, Globe, Shield, TrendingUp, Zap } from 'lucide-react';

interface HomePageProps {
  onEnter: () => void;
}

const features = [
  {
    icon: Bell,
    title: 'Overnight alerts at a glance',
    body: 'Know what moved while you slept. Critical price events, geopolitical flashpoints, and shipping disruptions surfaced the moment you open the app.',
  },
  {
    icon: BarChart2,
    title: 'Live market price reference',
    body: 'Energy, FX, freight, fertilisers, agricultural — all tracked instruments in one view with intraday charts and 10-year historical context.',
  },
  {
    icon: CheckSquare,
    title: 'Morning action list',
    body: 'A ranked, signal-driven to-do list telling you exactly what to act on before 9am. Checkboxes persist across sessions.',
  },
  {
    icon: Globe,
    title: 'Conflict & supply chain intel',
    body: 'Live conflict zone tracking with commodity impact scores, shipping lane RAG status, and contingency playbooks for your sector.',
  },
  {
    icon: TrendingUp,
    title: 'Relevance-ranked news',
    body: 'Hundreds of RSS headlines deduplicated and scored for procurement relevance. Only what matters surfaces to the top.',
  },
  {
    icon: Shield,
    title: 'Sector-specific filtering',
    body: 'Tell us your sector — food imports, chemicals, freight, construction, or finance — and the whole dashboard filters to what affects you.',
  },
];

const stats = [
  { value: '19', label: 'live intel sources' },
  { value: '<60s', label: 'data refresh cycle' },
  { value: '6', label: 'commodity categories' },
  { value: '10yr', label: 'historical context' },
];

export default function HomePage({ onEnter }: HomePageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* Nav */}
      <nav className="border-b border-border/30 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <Zap size={14} className="text-sky-400" />
            </div>
            <span className="text-sm font-bold text-slate-200 tracking-tight">DawnSignal</span>
          </div>
          <button
            onClick={onEnter}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1.5"
          >
            Open dashboard
            <ArrowRight size={13} />
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-20 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-32 left-1/4 w-64 h-64 bg-emerald-500/4 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-full px-3.5 py-1.5 mb-8 tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
            Procurement intelligence · live feeds
          </div>

          <h1 className="text-5xl sm:text-6xl font-black text-slate-100 leading-[1.08] tracking-tight mb-6">
            Know what moved
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
              before the market opens
            </span>
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-10">
            DawnSignal aggregates 19 live intelligence sources — commodity prices, conflict zones, shipping
            disruptions, and news feeds — into a single morning briefing for procurement and supply chain teams.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onEnter}
              className="inline-flex items-center gap-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm px-7 py-3.5 rounded-xl transition-all duration-200 shadow-lg shadow-sky-500/25 hover:shadow-sky-400/30 hover:scale-[1.02] active:scale-[0.99]"
            >
              Open the dashboard
              <ArrowRight size={15} />
            </button>
            <span className="text-xs text-muted-foreground/50">No sign-up required</span>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border/30 bg-slate-800/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
          {stats.map(s => (
            <div key={s.value} className="text-center">
              <p className="text-3xl font-black text-slate-100 tracking-tight">{s.value}</p>
              <p className="text-xs text-muted-foreground/60 mt-1 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature grid */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-black text-slate-100 tracking-tight mb-3">
              Everything you need by 8am
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Built for procurement managers who need to make buying decisions before commodity prices move against them.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <div
                key={f.title}
                className="rounded-2xl border border-border/40 bg-slate-800/30 p-6 hover:border-slate-600/60 hover:bg-slate-800/50 transition-all duration-200 group"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-700/60 border border-slate-600/40 flex items-center justify-center mb-4 group-hover:border-sky-500/30 group-hover:bg-sky-500/10 transition-all duration-200">
                  <f.icon size={16} className="text-muted-foreground group-hover:text-sky-400 transition-colors duration-200" />
                </div>
                <h3 className="text-sm font-bold text-slate-200 mb-2 leading-snug">{f.title}</h3>
                <p className="text-xs text-muted-foreground/70 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 border-t border-border/20 bg-slate-800/10">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight mb-12">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', icon: Globe, title: 'Aggregates live data', body: 'Pulls from 19 sources every 60 seconds — Reuters, Financial Times, AHDB, USDA, BBC, Rigzone, and more.' },
              { step: '02', icon: Zap, title: 'Derives signals', body: 'AI scores each item for urgency, attaches historical context, and generates an actionable morning brief.' },
              { step: '03', icon: Clock, title: 'Filters for your sector', body: 'Pick your sector and every panel — alerts, actions, conflict zones, charts — filters to what is relevant for you.' },
            ].map(s => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div className="relative mb-5">
                  <div className="w-12 h-12 rounded-2xl border border-border/40 bg-slate-800/50 flex items-center justify-center">
                    <s.icon size={18} className="text-sky-400/70" />
                  </div>
                  <span className="absolute -top-2 -right-2 text-[9px] font-black text-sky-400/50 font-mono">{s.step}</span>
                </div>
                <h3 className="text-sm font-bold text-slate-200 mb-2">{s.title}</h3>
                <p className="text-xs text-muted-foreground/60 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-20 px-6 border-t border-border/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight mb-3">Built for your team</h2>
            <p className="text-sm text-muted-foreground/60">Choose a persona when you open the dashboard and the view adapts to your role.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: 'Food Importer', desc: 'Grain, FX, fertilisers' },
              { label: 'Chemical Buyer', desc: 'Gas, oil, feedstocks' },
              { label: 'Freight & 3PL', desc: 'Lanes, containers, war risk' },
              { label: 'Construction', desc: 'Steel, fuel, aluminium' },
              { label: 'Financial Analyst', desc: 'All commodities, macro' },
            ].map(p => (
              <div key={p.label} className="rounded-xl border border-border/30 bg-slate-800/20 px-4 py-4 text-center hover:border-sky-500/20 hover:bg-sky-500/5 transition-all duration-200">
                <p className="text-xs font-bold text-slate-300 mb-1">{p.label}</p>
                <p className="text-[10px] text-muted-foreground/50">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border/20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-black text-slate-100 tracking-tight mb-4">
            Ready to see this morning's signals?
          </h2>
          <p className="text-muted-foreground mb-10">
            The dashboard is live and pulling data right now. No sign-up, no setup.
          </p>
          <button
            onClick={onEnter}
            className="inline-flex items-center gap-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm px-8 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-sky-500/25 hover:shadow-sky-400/30 hover:scale-[1.02] active:scale-[0.99]"
          >
            Open the dashboard
            <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/20 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-sky-500/20 border border-sky-500/30 flex items-center justify-center">
              <Zap size={10} className="text-sky-400" />
            </div>
            <span className="text-xs font-bold text-slate-400">DawnSignal</span>
          </div>
          <p className="text-[11px] text-muted-foreground/30 text-center">
            Market data from live sources. Verify with named sources before trading.
          </p>
        </div>
      </footer>
    </div>
  );
}
