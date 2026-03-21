// /app/(dashboard)/facturas/nueva/page.tsx
import type { Metadata } from 'next'
import { Suspense } from 'react'
import FacturaBuilder from '@/components/modules/facturas/FacturaBuilder'

export const metadata: Metadata = {
  title: 'Nueva factura — Hexa Gestión',
}

// FacturaBuilder usa useSearchParams → requiere Suspense
export default function NuevaFacturaPage() {
  return (
    <Suspense>
      <FacturaBuilder />
    </Suspense>
  )
}
