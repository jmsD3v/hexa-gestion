import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import FacturaFicha from '@/components/modules/facturas/FacturaFicha';
import { obtenerFactura } from '@/app/actions/facturas';
import {
  getMockFacturaDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
interface Props {
  params: Promise<{ id: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockFacturaDetalle(id);
    return { title: `${mock?.numero ?? 'Factura'} — Hexa Gestión` };
  }
  const res = await obtenerFactura(id);
  return { title: `${res.data?.numero ?? 'Factura'} — Hexa Gestión` };
}
export default async function FacturaDetallePage({ params }: Props) {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockFacturaDetalle(id);
    if (!mock) notFound();
    return <FacturaFicha facturaId={id} />;
  }
  const res = await obtenerFactura(id);
  if (!res.data) notFound();
  return <FacturaFicha facturaId={id} />;
}
