import RemitoForm from '@/components/modules/logistica/RemitoForm'

export const metadata = { title: 'Nuevo remito — Hexa Gestión' }

export default function NuevoRemitoPage({
  searchParams,
}: {
  searchParams: { orden_id?: string; nota_pedido_id?: string; cliente_id?: string }
}) {
  return (
    <RemitoForm
      ordenId={searchParams.orden_id}
      notaPedidoId={searchParams.nota_pedido_id}
      clienteId={searchParams.cliente_id}
    />
  )
}
