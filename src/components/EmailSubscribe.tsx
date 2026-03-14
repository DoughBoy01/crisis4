import { useState } from 'react';
import { Mail, Check, Loader2, X, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

const SUBSCRIBE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-morning-brief`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

type State = 'idle' | 'loading' | 'success' | 'error';

export default function EmailSubscribe() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<State>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setState('loading');
    setMessage('');

    try {
      const res = await fetch(SUBSCRIBE_URL, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ action: 'subscribe', email: email.trim(), name: name.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? `Error ${res.status}`);
      setState('success');
      setMessage(json.message ?? 'Subscribed! You will receive tomorrow\'s brief at 06:00 UTC.');
    } catch (err) {
      setState('error');
      setMessage(String(err).replace('Error: ', ''));
    }
  }

  function handleClose() {
    setOpen(false);
    setTimeout(() => {
      setState('idle');
      setMessage('');
      setEmail('');
      setName('');
    }, 300);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded border border-border/50 bg-slate-800/40 hover:bg-slate-700/50 hover:border-sky-500/40 transition-colors text-muted-foreground/60 hover:text-sky-400"
        title="Subscribe to morning brief email"
      >
        <Mail size={11} />
        <span className="text-[10px] hidden lg:inline font-medium">Email Brief</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={handleClose}>
          <div
            className="relative w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-sky-500/50 via-sky-400/30 to-transparent" />

            <div className="px-6 pt-6 pb-5">
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-sky-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-100 leading-tight">Morning Brief by Email</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Delivered daily at 06:00 UTC</p>
                </div>
              </div>

              {state === 'success' ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <Check size={22} className="text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-100">You're subscribed</p>
                  <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
                  <button
                    onClick={handleClose}
                    className="mt-2 px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 border border-slate-700/60 transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      Name (optional)
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-colors"
                      disabled={state === 'loading'}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      required
                      className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700/60 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 transition-colors"
                      disabled={state === 'loading'}
                    />
                  </div>

                  {state === 'error' && message && (
                    <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{message}</p>
                  )}

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={state === 'loading' || !email.trim()}
                      className={cn(
                        'w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all',
                        state === 'loading' || !email.trim()
                          ? 'bg-sky-500/30 text-sky-400/50 cursor-not-allowed'
                          : 'bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20'
                      )}
                    >
                      {state === 'loading' ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Subscribing...
                        </>
                      ) : (
                        <>
                          <Mail size={14} />
                          Subscribe to Morning Brief
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                    Overnight market intelligence delivered before the trading day opens.
                    Unsubscribe at any time via the link in any email.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
