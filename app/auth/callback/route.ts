// ============================================================
// /app/auth/callback/route.ts
// Maneja el intercambio de código OAuth / magic link de Supabase
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ensureProfileForUser } from '@/lib/profiles';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const redirectTo = searchParams.get('redirectTo') ?? '/';

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await ensureProfileForUser({
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
        });
      }

      return NextResponse.redirect(
        `${origin}${next !== '/' ? next : redirectTo}`,
      );
    }
  }

  // Error — redirigir a login con mensaje
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
