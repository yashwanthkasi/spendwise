import { createClient } from '@supabase/supabase-js';
import type { Database } from './db-types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[spendwise] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — copy .env.example to .env and fill them in.',
  );
}

export const supabase = createClient<Database>(url ?? '', anonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
