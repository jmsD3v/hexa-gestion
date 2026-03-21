// ============================================================
// /app/(dashboard)/clientes/[id]/page.tsx
// ============================================================

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ClienteFicha from '@/components/modules/clientes/ClienteFicha';
import { obtenerCliente } from '@/app/actions/clientes';
import {
  getMockClienteDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockClienteDetalle(id);
    const nombre = mock?.razon_social ?? 'Cliente';
    return { title: `${nombre} — Hexa Gestión` };
  }
  const res = await obtenerCliente(id);
  const nombre = res.data?.razon_social ?? 'Cliente';
  return { title: `${nombre} — Hexa Gestión` };
}

export default async function ClienteFichaPage({ params }: Props) {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockClienteDetalle(id);
    if (!mock) notFound();
    return <ClienteFicha clienteId={id} />;
  }
  // Prefetch básico en servidor; la ficha recarga sus propios datos en cliente
  const res = await obtenerCliente(id);
  if (!res.data) notFound();

  return <ClienteFicha clienteId={id} />;
}
