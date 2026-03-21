import NotaPedidoForm from '@/components/modules/logistica/NotaPedidoForm';

export const metadata = { title: 'Nueva nota de pedido — Hexa Gestión' };

export default async function NuevaNotaPage({
  searchParams,
}: {
  searchParams: Promise<{
    orden_id?: string;
    presupuesto_id?: string;
    cliente_id?: string;
  }>;
}) {
  const params = await searchParams;
  return (
    <NotaPedidoForm
      ordenId={params.orden_id}
      presupuestoId={params.presupuesto_id}
      clienteId={params.cliente_id}
    />
  );
}
