// ============================================================
// /app/(dashboard)/ordenes/nueva/page.tsx
// Página de creación de nueva orden de servicio
// ============================================================

import type { Metadata } from 'next';
import OrdenForm from '@/components/modules/ordenes/OrdenForm';

export const metadata: Metadata = {
  title: 'Nueva Orden de Servicio — Hexa Gestión',
  description: 'Formulario de alta de orden de servicio',
};

export default async function NuevaOrdenPage({
  searchParams,
}: {
  searchParams: Promise<{ presupuesto_id?: string; cliente_id?: string }>;
}) {
  const params = await searchParams;
  return (
    <OrdenForm
      presupuestoId={params.presupuesto_id}
      clienteId={params.cliente_id}
    />
  );
}
