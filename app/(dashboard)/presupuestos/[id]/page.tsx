// /app/(dashboard)/presupuestos/[id]/page.tsx
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PresupuestoFicha from '@/components/modules/presupuestos/PresupuestoFicha';
import { obtenerPresupuestoCompleto } from '@/app/actions/presupuestos';
import {
  getMockPresupuestoDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockPresupuestoDetalle(id);
    return { title: `${mock?.numero ?? 'Presupuesto'} — Hexa Gestión` };
  }
  const res = await obtenerPresupuestoCompleto(id);
  return { title: `${res.data?.numero ?? 'Presupuesto'} — Hexa Gestión` };
}

export default async function PresupuestoDetallePage({ params }: Props) {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockPresupuestoDetalle(id);
    if (!mock) notFound();
    return <PresupuestoFicha presupuestoId={id} />;
  }
  const res = await obtenerPresupuestoCompleto(id);
  if (!res.data) notFound();
  return <PresupuestoFicha presupuestoId={id} />;
}
