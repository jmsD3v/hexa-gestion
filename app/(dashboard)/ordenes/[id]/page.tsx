import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import OrdenDetalle from '@/components/modules/ordenes/OrdenDetalle';
import { obtenerOrden } from '@/app/actions/ordenes';
import {
  getMockOrdenDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
interface Props {
  params: Promise<{ id: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockOrdenDetalle(id);
    return { title: `${mock?.numero ?? 'Orden'} — Hexa Gestión` };
  }
  const res = await obtenerOrden(id);
  return { title: `${res.data?.numero ?? 'Orden'} — Hexa Gestión` };
}
export default async function OrdenDetallePage({ params }: Props) {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockOrdenDetalle(id);
    if (!mock) notFound();
    return <OrdenDetalle ordenId={id} />;
  }
  const res = await obtenerOrden(id);
  if (!res.data) notFound();
  return <OrdenDetalle ordenId={id} />;
}
