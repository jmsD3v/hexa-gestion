// ============================================================
// /lib/supabase/server.ts
// Cliente Supabase para Server Components y Server Actions
// ============================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookies();
          return cookieStore.getAll();
        },
        async setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          const cookieStore = await cookies();
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component — cookies de solo lectura
          }
        },
      },
    },
  );
}

// Cliente admin con service role (solo para server-side seguro)
export function createAdminClient() {
  const {
    createClient: createSupabaseClient,
  } = require('@supabase/supabase-js');
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
