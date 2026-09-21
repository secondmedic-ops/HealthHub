// Filled in by hand for AI Studio preview. On Cloudflare Pages these come from
// environment variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
export const SUPABASE_URL: string =
  (import.meta as any).env?.VITE_SUPABASE_URL || 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_ANON_KEY: string =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'YOUR-ANON-KEY';
