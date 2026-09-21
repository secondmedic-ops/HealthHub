import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { mockFetch, IS_MOCK_ENV } from './mockInterceptor';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  global: {
    fetch: IS_MOCK_ENV ? mockFetch : undefined,
  },
});
