import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { mockFetch, IS_MOCK_ENV } from './mockInterceptor';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // detectSessionInUrl must be true so a password-recovery / invite link
  // (…?token=…&type=recovery) lands here with a working session that
  // SetPasswordScreen can call auth.updateUser() against.
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  global: {
    fetch: IS_MOCK_ENV ? mockFetch : undefined,
  },
});
