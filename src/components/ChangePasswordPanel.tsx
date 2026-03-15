import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { KeyRound, CheckCircle, AlertCircle, Loader, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChangePasswordPanel() {
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setSuccess(true);
      setNewPassword('');
      setConfirm('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={14} className="text-sky-400 shrink-0" />
        <h2 className="text-xs font-bold text-slate-400 tracking-widest uppercase">Change Password</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">New Password</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setSuccess(false); setError(''); }}
              required
              minLength={8}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 pr-9 text-sm text-white placeholder-slate-700 focus:outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500 transition-colors"
              placeholder="Min. 8 characters"
            />
            <button
              type="button"
              onClick={() => setShowNew(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              tabIndex={-1}
            >
              {showNew ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">Confirm Password</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setSuccess(false); setError(''); }}
              required
              minLength={8}
              className={cn(
                'w-full bg-slate-950 border rounded-lg px-3.5 py-2 pr-9 text-sm text-white placeholder-slate-700 focus:outline-none focus:ring-1 transition-colors',
                confirm && newPassword && confirm !== newPassword
                  ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/30'
                  : 'border-slate-700 focus:border-slate-500 focus:ring-slate-500'
              )}
              placeholder="Repeat new password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              tabIndex={-1}
            >
              {showConfirm ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-xs bg-red-950/30 border border-red-900/40 rounded-lg px-3 py-2">
            <AlertCircle size={12} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-950/30 border border-emerald-900/40 rounded-lg px-3 py-2">
            <CheckCircle size={12} className="shrink-0" />
            <span>Password updated successfully.</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !newPassword || !confirm}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all bg-sky-500/10 border-sky-500/30 text-sky-400 hover:bg-sky-500/20 hover:border-sky-400/50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading && <Loader size={11} className="animate-spin" />}
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}
