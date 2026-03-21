// ============================================================
// /app/(dashboard)/layout.tsx
// Layout principal del sistema con navegación lateral
// ============================================================

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ensureProfileForUser } from '@/lib/profiles';
import DashboardLayoutClient from '@/components/layout/DashboardLayoutClient';

export const metadata: Metadata = {
  title: 'HEXA | Sistema de Gestión',
  description:
    'Sistema de Gestión Comercial, Operativa y Documental - Hexa Servicios Integrales',
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await ensureProfileForUser({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  });

  return (
    <DashboardLayoutClient profile={profile}>{children}</DashboardLayoutClient>
  );
}
