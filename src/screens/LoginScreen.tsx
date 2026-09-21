import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, getRoleLanding } from '../context/AuthContext';
import { SUPABASE_URL } from '../lib/config';
import { Lock, Mail, AlertCircle, Sparkles, Building2 } from 'lucide-react';

export function LoginScreen() {
  const { signIn, profile, getLandingRoute } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already logged in and active, redirect to their role landing
  React.useEffect(() => {
    if (profile && profile.is_active) {
      const from = (location.state as any)?.from?.pathname || getLandingRoute();
      navigate(from, { replace: true });
    }
  }, [profile, getLandingRoute, navigate, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      await signIn(email, password);
      // AuthProvider will refreshProfile. The effect above or below redirects.
    } catch (err: any) {
      setErrorMsg(err?.message || 'Email or password is wrong.');
    } finally {
      setLoading(false);
    }
  };

  const isDemo = SUPABASE_URL.includes('YOUR-PROJECT');

  const fillQuickDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('demo123');
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-[#F7F8F6] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand identity */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-[6px] bg-[#16324F] text-white flex items-center justify-center font-bold text-2xl shadow-sm">
            H
          </div>
        </div>
        <h2 className="text-center text-2xl font-semibold tracking-tight text-[#16324F]">
          SecondMedic HealthHub
        </h2>
        <p className="mt-1 text-center text-sm text-[#5B6670]">
          Daily branch business reporting and performance review
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 rounded-[6px] border border-[#D9DEDA] shadow-sm">
          <form className="space-y-5" onSubmit={handleSubmit} noValidate>
            <div>
              <label
                htmlFor="email-address"
                className="block text-sm font-medium text-[#1D2329] mb-1.5"
              >
                Work email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5B6670]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@healthhub.in"
                  className="input-ledger w-full pl-9"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#1D2329] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#5B6670]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-ledger w-full pl-9"
                />
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary text-base"
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>

            {/* Error message inline under the button */}
            {errorMsg && (
              <div className="p-3 bg-[#FEF3F2] border border-[#FECDCA] rounded-[6px] text-xs text-[#B42318] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}
          </form>

          {/* Optional Quick Account Selector for AI Studio Reviewers */}
          {isDemo && (
            <div className="mt-8 pt-6 border-t border-[#D9DEDA]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#16324F] mb-3">
                <Sparkles className="w-3.5 h-3.5 text-[#1F7A4D]" />
                <span>Test credentials (1-click fill)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => fillQuickDemo('staff@healthhub.in')}
                  className="p-2 border border-[#D9DEDA] rounded-[6px] text-left hover:bg-[#F0F5F9] transition-colors"
                >
                  <span className="font-semibold text-[#16324F] block">Staff</span>
                  <span className="text-[11px] text-[#5B6670]">Indiranagar Hub</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickDemo('manager@healthhub.in')}
                  className="p-2 border border-[#D9DEDA] rounded-[6px] text-left hover:bg-[#F0F5F9] transition-colors"
                >
                  <span className="font-semibold text-[#16324F] block">Manager</span>
                  <span className="text-[11px] text-[#5B6670]">3 Hubs Board</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickDemo('accounts@healthhub.in')}
                  className="p-2 border border-[#D9DEDA] rounded-[6px] text-left hover:bg-[#F0F5F9] transition-colors"
                >
                  <span className="font-semibold text-[#16324F] block">Accounts</span>
                  <span className="text-[11px] text-[#5B6670]">P&L Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => fillQuickDemo('admin@healthhub.in')}
                  className="p-2 border border-[#D9DEDA] rounded-[6px] text-left hover:bg-[#F0F5F9] transition-colors"
                >
                  <span className="font-semibold text-[#16324F] block">Super Admin</span>
                  <span className="text-[11px] text-[#5B6670]">Full Admin</span>
                </button>
              </div>
              <p className="text-[11px] text-[#5B6670] mt-2.5 leading-relaxed">
                Connect live Supabase by configuring <code className="text-[#16324F]">VITE_SUPABASE_URL</code> and <code className="text-[#16324F]">VITE_SUPABASE_ANON_KEY</code> in your environment.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
