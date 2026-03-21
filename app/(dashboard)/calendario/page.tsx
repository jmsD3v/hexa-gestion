// /app/(dashboard)/calendario/page.tsx
import type { Metadata } from 'next'
import Calendario from '@/components/modules/calendario/Calendario'
export const metadata: Metadata = { title: 'Calendario — Hexa Gestión' }
export default function CalendarioPage() { return <Calendario /> }
