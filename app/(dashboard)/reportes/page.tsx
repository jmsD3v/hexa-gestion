// /app/(dashboard)/reportes/page.tsx
import type { Metadata } from 'next'
import Reportes from '@/components/modules/reportes/Reportes'
export const metadata: Metadata = { title: 'Reportes — Hexa Gestión' }
export default function ReportesPage() { return <Reportes /> }
