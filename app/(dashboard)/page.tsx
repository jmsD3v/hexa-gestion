// ============================================================
// /app/(dashboard)/page.tsx
// Página principal — Dashboard
// ============================================================

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import Dashboard from '@/components/modules/dashboard/Dashboard'

export const metadata: Metadata = {
  title: 'Dashboard — Hexa Gestión',
}

// Revalidar cada 5 minutos en lugar de forzar SSR completo
export const revalidate = 300

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('profiles').select('nombre_completo').eq('id', user.id).single()
    : { data: null }

  return <Dashboard nombreUsuario={profile?.nombre_completo ?? undefined} />
}
