// ============================================================
// /app/(dashboard)/presupuestos/nuevo/page.tsx
// ============================================================

import type { Metadata } from 'next'
import PresupuestoBuilder from '@/components/modules/presupuestos/PresupuestoBuilder'

export const metadata: Metadata = {
  title:       'Nuevo Presupuesto — Hexa Gestión',
  description: 'Crear nuevo presupuesto de servicios',
}

export default function NuevoPresupuestoPage() {
  return <PresupuestoBuilder />
}
