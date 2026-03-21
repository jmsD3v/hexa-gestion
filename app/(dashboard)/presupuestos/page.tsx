// /app/(dashboard)/presupuestos/page.tsx
import type { Metadata } from 'next'
import PresupuestosListado from '@/components/modules/presupuestos/PresupuestosListado'

export const metadata: Metadata = {
  title: 'Presupuestos — Hexa Gestión',
}

export default function PresupuestosPage() {
  return <PresupuestosListado />
}
