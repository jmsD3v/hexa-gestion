// ============================================================
// /app/(dashboard)/clientes/page.tsx
// Página del listado de clientes — Server Component wrapper
// ============================================================

import type { Metadata } from 'next'
import ClientesListado from '@/components/modules/clientes/ClientesListado'

export const metadata: Metadata = {
  title:       'Clientes — Hexa Gestión',
  description: 'Listado de clientes de Hexa Servicios Integrales',
}

export default function ClientesPage() {
  return <ClientesListado />
}
