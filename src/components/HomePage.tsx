import { ArrowRight, Bell, Mail, Moon, Newspaper, ShieldAlert, Zap } from 'lucide-react';

interface HomePageProps {
  onEnter: () => void;
}

const timeline = [
  { time: '9pm', label: 'Sydney opens', detail: 'Pacific session live. AUD, NZD, and early Gold moves captured.' },
  { time: '12am', label: 'Tokyo opens', detail: 'JPY pairs, Gold session, and Asian equity futures begin moving. Shipping and conflict alerts monitored.' },
  { time: '1am', label: 'Shanghai & mainland China', detail: 'Commodity futures, CNY FX, and geopolitical signals tracked across APAC.' },
  { time: '3am', label: 'Hong Kong & Singapore', detail: 'Regional equity closes, freight indices, and late-breaking news scored for impact.' },
  { time: '6am', label: 'Brief compiled', detail: 'AI distils the full overnight session into a ranked intelligence report.' },
  { time: '7am', label: 'In your inbox', detail: 'You read it with your coffee. You know what to act on.' },
];

const signals = [
  { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Conflict alerts', body: 'Active war zones, escalations, and sanctions that affect your supply routes.' },
  { icon: Newspaper, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Market moves', body: 'Overnight price swings in energy, grain, metals, fertilisers, and freight.' },
  { icon: Bell, color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/20', label: 'Shipping disruptions', body: 'Lane closures, war risk premiums, port delays — ranked by severity.' },
  { icon: Mail, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Morning brief', body: 'One email. What happened, why it matters, and what to do about it.' },
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
      <section className="relative pt-28 pb-24 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-sky-500/4 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-20 left-1/3 w-72 h-72 bg-slate-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-sky-400/80 bg-sky-500/8 border border-sky-500/15 rounded-full px-3.5 py-1.5 mb-10 tracking-widest uppercase">
            <Moon size={11} className="opacity-70" />
            Overnight intelligence · supply chain & procurement
          </div>

          <h1 className="text-5xl sm:text-[64px] font-black text-slate-100 leading-[1.05] tracking-tight mb-7">
            We monitor the crisis
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-400 via-sky-300 to-emerald-400">
              whilst you sleep
            </span>
          </h1>

          <p className="text-xl text-slate-400 leading-relaxed max-w-xl mx-auto mb-12 font-light">
            Every morning, an intelligence briefing lands in your inbox — conflict zones, commodity price moves,
            and shipping disruptions that hit overnight, ranked by impact on your supply chain.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onEnter}
              className="inline-flex items-center gap-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm px-8 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-sky-500/20 hover:shadow-sky-400/25 hover:scale-[1.02] active:scale-[0.99]"
            >
              See this morning's briefing
              <ArrowRight size={15} />
            </button>
            <span className="text-xs text-muted-foreground/40">No sign-up required</span>
          </div>
        </div>
      </section>

      {/* Overnight timeline */}
      <section className="py-20 px-6 border-t border-border/20 bg-slate-800/10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight mb-3">While you were asleep</h2>
            <p className="text-sm text-slate-400/70 max-w-sm mx-auto">The world doesn't stop moving at 5pm. Here's what we watch through the night.</p>
          </div>

          <div className="relative">
            <div className="absolute left-[72px] top-4 bottom-4 w-px bg-gradient-to-b from-sky-500/30 via-sky-500/15 to-transparent hidden sm:block" />
            <div className="space-y-6">
              {timeline.map((t, i) => (
                <div key={i} className="flex items-start gap-5 sm:gap-7">
                  <div className="flex-shrink-0 text-right w-14 sm:w-16">
                    <span className="text-xs font-bold text-sky-400/70 font-mono">{t.time}</span>
                  </div>
                  <div className="flex-shrink-0 relative z-10 mt-0.5 hidden sm:flex">
                    <div className="w-2.5 h-2.5 rounded-full bg-sky-500/50 border border-sky-400/40 ring-4 ring-background" />
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-sm font-bold text-slate-200">{t.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{t.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* What's in the brief */}
      <section className="py-20 px-6 border-t border-border/20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-2xl font-black text-slate-100 tracking-tight mb-3">What's in the briefing</h2>
            <p className="text-sm text-slate-400/70 max-w-md mx-auto">Four categories of intelligence, distilled from 19 live data sources into one readable report.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {signals.map(s => (
              <div key={s.label} className={`rounded-2xl border p-6 ${s.bg} transition-all duration-200 hover:scale-[1.01]`}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <s.icon size={18} className={s.color} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-200 mb-1.5">{s.label}</p>
                    <p className="text-xs text-slate-400/80 leading-relaxed">{s.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The brief mockup / quote */}
      <section className="py-20 px-6 border-t border-border/20 bg-slate-800/10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold text-amber-400/70 bg-amber-500/8 border border-amber-500/15 rounded-full px-3 py-1.5 mb-8 tracking-widest uppercase">
            <Mail size={10} />
            Example morning brief
          </div>
          <div className="rounded-2xl border border-border/40 bg-slate-800/40 text-left p-7 shadow-2xl shadow-black/30">
            <div className="flex items-center gap-3 mb-5 pb-4 border-b border-border/30">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center flex-shrink-0">
                <Zap size={13} className="text-sky-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-200">DawnSignal Morning Brief</p>
                <p className="text-[10px] text-slate-500">Tuesday, 7:02 AM · 4 signals</p>
              </div>
            </div>
            <div className="space-y-3.5">
              {[
                { tag: 'HIGH', color: 'text-red-400 bg-red-500/10 border-red-500/20', text: 'Russia-Ukraine: fresh drone strikes on Odessa port. Black Sea wheat corridor risk elevated. Wheat futures +2.3% overnight.' },
                { tag: 'MED', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', text: 'Brent crude +$1.40 on Hormuz tension reports. No formal disruption confirmed. Monitor.' },
                { tag: 'MED', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', text: 'Red Sea: Houthi attack on container vessel. Maersk rerouting via Cape of Good Hope. +12 day transit.' },
                { tag: 'INFO', color: 'text-sky-400 bg-sky-500/10 border-sky-500/20', text: 'EU carbon price steady. Natural gas TTF -1.1%. No immediate action required for European buyers.' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border tracking-wider flex-shrink-0 mt-0.5 ${item.color}`}>{item.tag}</span>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-20 px-6 border-t border-border/20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-black text-slate-100 tracking-tight mb-3">Built for people who can't afford surprises</h2>
          <p className="text-sm text-slate-400/70 mb-10 max-w-md mx-auto">If an overnight event can change your buying decision, you need this in your inbox before 8am.</p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {['Procurement managers', 'Supply chain directors', 'Food importers', 'Freight & logistics', 'Chemical buyers', 'Finance teams'].map(r => (
              <span key={r} className="text-xs font-medium text-slate-300 bg-slate-700/40 border border-slate-600/30 rounded-full px-3.5 py-1.5 hover:border-slate-500/50 transition-colors">
                {r}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 border-t border-border/20 bg-slate-800/10">
        <div className="max-w-xl mx-auto text-center">
          <Moon size={28} className="text-sky-400/40 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-slate-100 tracking-tight mb-4">
            The world moves overnight.
            <br />
            <span className="text-slate-400 font-light">Be ready when it does.</span>
          </h2>
          <p className="text-slate-500 text-sm mb-10">
            The dashboard is live and pulling data right now.
          </p>
          <button
            onClick={onEnter}
            className="inline-flex items-center gap-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm px-8 py-4 rounded-xl transition-all duration-200 shadow-lg shadow-sky-500/20 hover:shadow-sky-400/25 hover:scale-[1.02] active:scale-[0.99]"
          >
            See this morning's briefing
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
            Market data from live sources. Verify with named sources before acting.
          </p>
        </div>
      </footer>
    </div>
  );
}
