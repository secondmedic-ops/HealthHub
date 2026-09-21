import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { Lock, AlertCircle } from 'lucide-react';

/**
 * Where an "Add person" / "Resend link" recovery link lands. Because the
 * Supabase client has detectSessionInUrl: true, the token in the URL has
 * already been exchanged for a real (temporary) session by the time this
 * component mounts — we just need to confirm that session exists, then let
 * the person pick their own password with auth.updateUser().
 */
export function SetPasswordScreen() {
  const navigate = useNavigate();
  const { refreshProfile, getLandingRoute } = useAuth();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled && data.session) {
        setHasSession(true);
        setChecking(false);
      }
    });

    // Recovery-link processing can finish a beat after mount — keep
    // listening rather than only checking once.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' || (session && event === 'SIGNED_IN')) {
        setHasSession(true);
        setChecking(false);
      }
    });

    // Give the URL a couple of seconds to resolve before giving up.
    const timeout = setTimeout(() => {
      if (!cancelled) setChecking(false);
    }, 3000);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setSaving(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await refreshProfile();
      navigate(getLandingRoute(), { replace: true });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not set password. The link may have expired.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-[6px] bg-[#16324F] text-white flex items-center justify-center font-bold text-2xl shadow-sm">
            H
          </div>
        </div>
        <h2 className="text-center text-2xl font-semibold tracking-tight text-[#16324F]">
          Set your password
        </h2>
        <p className="mt-1 text-center text-sm text-[#5B6670]">SecondMedic HealthHub</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-[6px] border border-[#D9DEDA] shadow-sm">
          {checking ? (
            <p className="text-sm text-[#5B6670] text-center">Checking your link…</p>
          ) : !hasSession ? (
            <div className="text-sm text-[#B42318] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This link is invalid or has expired. Ask your admin to resend it from Admin → People.
              </span>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit} noValidate>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-[#1D2329] mb-1.5">
                  New password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5B6670]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="input-ledger w-full pl-9"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-[#1D2329] mb-1.5">
                  Confirm password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5B6670]">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Re-enter password"
                    className="input-ledger w-full pl-9"
                  />
                </div>
              </div>

              <button type="submit" disabled={saving} className="w-full btn-primary text-base">
                {saving ? 'Saving…' : 'Set password & continue'}
              </button>

              {errorMsg && (
                <div className="p-3 bg-[#FEF3F2] border border-[#FECDCA] rounded-[6px] text-xs text-[#B42318] flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-snug">{errorMsg}</span>
                </div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
