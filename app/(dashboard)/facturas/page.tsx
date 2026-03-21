import type { Metadata } from 'next'
import FacturasListado from '@/components/modules/facturas/FacturasListado'
export const metadata: Metadata = { title: 'Facturación — Hexa Gestión' }
export default function FacturasPage() { return <FacturasListado /> }
