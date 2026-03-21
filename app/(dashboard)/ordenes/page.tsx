import type { Metadata } from 'next'
import OrdenesListado from '@/components/modules/ordenes/OrdenesListado'
export const metadata: Metadata = { title: 'Órdenes de Servicio — Hexa Gestión' }
export default function OrdenesPage() { return <OrdenesListado /> }
