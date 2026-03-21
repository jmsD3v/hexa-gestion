// /app/(dashboard)/configuracion/page.tsx
import type { Metadata } from 'next'
import Configuracion from '@/components/modules/configuracion/Configuracion'
export const metadata: Metadata = { title: 'Configuración — Hexa Gestión' }
export default function ConfiguracionPage() { return <Configuracion /> }
