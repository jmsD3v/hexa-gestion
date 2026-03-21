import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RemitoFicha from '@/components/modules/logistica/RemitoFicha';
import { obtenerRemito } from '@/app/actions/logistica';
import {
  getMockRemitoDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
interface Props {
  params: Promise<{ id: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockRemitoDetalle(id);
    return { title: `${mock?.numero ?? 'Remito'} — Hexa Gestión` };
  }
  const res = await obtenerRemito(id);
  return { title: `${res.data?.numero ?? 'Remito'} — Hexa Gestión` };
}
export default async function RemitoPage({ params }: Props) {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockRemitoDetalle(id);
    if (!mock) notFound();
    return <RemitoFicha remitoId={id} />;
  }
  const res = await obtenerRemito(id);
  if (!res.data) notFound();
  return <RemitoFicha remitoId={id} />;
}
