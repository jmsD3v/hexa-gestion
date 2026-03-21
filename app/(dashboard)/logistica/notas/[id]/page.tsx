import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import NotaPedidoFicha from '@/components/modules/logistica/NotaPedidoFicha';
import { obtenerNotaPedido } from '@/app/actions/logistica';
import {
  getMockNotaPedidoDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
interface Props {
  params: Promise<{ id: string }>;
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockNotaPedidoDetalle(id);
    return { title: `${mock?.numero ?? 'Nota de pedido'} — Hexa Gestión` };
  }
  const res = await obtenerNotaPedido(id);
  return { title: `${res.data?.numero ?? 'Nota de pedido'} — Hexa Gestión` };
}
export default async function NotaPedidoPage({ params }: Props) {
  const { id } = await params;
  if (shouldUsePlatformMocks) {
    const mock = getMockNotaPedidoDetalle(id);
    if (!mock) notFound();
    return <NotaPedidoFicha notaId={id} />;
  }
  const res = await obtenerNotaPedido(id);
  if (!res.data) notFound();
  return <NotaPedidoFicha notaId={id} />;
}
