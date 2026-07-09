import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !key || 
      url === 'your-project-url' ||
      key === 'your-anon-key') {
    // Log to Sentry in production
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[CRITICAL] Supabase not configured. ' +
        'Site will not function correctly.'
      );
    }
    return false;
  }
  return true;
}

export const supabase = isSupabaseConfigured()
  ? createBrowserClient(supabaseUrl, supabaseAnonKey)
  : null;
