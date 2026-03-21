'use client';

// ============================================================
// /components/modules/logistica/NotaPedidoDetalle.tsx
// Ficha de Nota de Pedido con recepción de ítems inline
// ============================================================

import { useState, useEffect } from 'react';
import {
  ClipboardList,
  Package,
  PackageCheck,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Ban,
  AlertCircle,
  ChevronRight,
  Building2,
  CalendarDays,
} from 'lucide-react';
import {
  obtenerNotaPedido,
  recibirItemsNotaPedido,
  anularNotaPedido,
} from '@/app/actions/logistica';
import type { NotaPedidoCompleta } from '@/types';
import type { EstadoNotaPedido } from '@/types/facturacion';

// ── Badge ─────────────────────────────────────────────────────────────────────

const ESTADO_CONFIG: Record<
  EstadoNotaPedido,
  { label: string; cls: string; icon: React.FC<any> }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    cls: 'bg-amber-100 text-amber-800 border border-amber-200',
    icon: Clock,
  },
  PARCIAL: {
    label: 'Parcial',
    cls: 'bg-blue-100 text-blue-800 border border-blue-200',
    icon: Package,
  },
  RECIBIDO: {
    label: 'Recibido',
    cls: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    icon: CheckCircle2,
  },
  ANULADO: {
    label: 'Anulado',
    cls: 'bg-red-100 text-red-700 border border-red-200',
    icon: XCircle,
  },
};

function EstadoBadge({ estado }: { estado: EstadoNotaPedido }) {
  const c = ESTADO_CONFIG[estado];
  const Icon = c.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${c.cls}`}
    >
      <Icon className='w-4 h-4' />
      {c.label}
    </span>
  );
}

// ── Barra de progreso ─────────────────────────────────────────────────────────

function BarraProgreso({
  pedido,
  recibido,
}: {
  pedido: number;
  recibido: number;
}) {
  const pct = pedido > 0 ? Math.min(100, (recibido / pedido) * 100) : 0;
  return (
    <div className='flex items-center gap-2 w-full'>
      <div className='flex-1 h-2 bg-slate-100 rounded-full overflow-hidden'>
        <div
          className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-blue-500' : 'bg-slate-200'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className='text-xs text-slate-500 tabular-nums w-12 text-right'>
        {recibido}/{pedido}
      </span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function NotaPedidoDetalle({ id }: { id: string }) {
  const [nota, setNota] = useState<
    (NotaPedidoCompleta & { nombre_orden: string | null }) | null
  >(null);
  const [cargando, setCargando] = useState(true);
  const [recepciones, setRecepciones] = useState<Record<string, number>>({});
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    tipo: 'ok' | 'err';
  } | null>(null);
  const [anulando, setAnulando] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const r = await obtenerNotaPedido(id);
    if (r.data) {
      setNota(r.data);
      // Inicializar recepciones con valores actuales
      const init: Record<string, number> = {};
      r.data.items.forEach((it) => {
        init[it.id] = it.cantidad_recibida;
      });
      setRecepciones(init);
    }
    setCargando(false);
  };

  useEffect(() => {
    cargar();
  }, [id]);

  const showToast = (msg: string, tipo: 'ok' | 'err') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  };

  const handleGuardarRecepcion = async () => {
    if (!nota) return;
    setGuardando(true);
    const r = await recibirItemsNotaPedido(
      id,
      nota.items.map((it) => ({
        item_id: it.id,
        cantidad_recibida: recepciones[it.id] ?? 0,
      })),
    );
    if (r.error) showToast(r.error, 'err');
    else {
      showToast(r.mensaje ?? 'Recepción guardada', 'ok');
      await cargar();
    }
    setGuardando(false);
  };

  const handleAnular = async () => {
    if (
      !confirm('¿Anular esta nota de pedido? Esta acción no se puede deshacer.')
    )
      return;
    setAnulando(true);
    const r = await anularNotaPedido(id);
    if (r.error) showToast(r.error, 'err');
    else window.location.href = '/logistica';
    setAnulando(false);
  };

  const formatFecha = (f: string) =>
    new Date(f).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  // Calcular totales
  const totalPedido =
    nota?.items.reduce((a, i) => a + i.cantidad_pedida, 0) ?? 0;
  const totalRecibido = nota
    ? Object.values(recepciones).reduce((a, v) => a + v, 0)
    : 0;

  if (cargando)
    return (
      <div className='min-h-screen bg-slate-900 flex items-center justify-center'>
        <div className='w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin' />
      </div>
    );

  if (!nota)
    return (
      <div className='min-h-screen bg-slate-900 flex items-center justify-center'>
        <div className='text-center'>
          <AlertCircle className='w-12 h-12 text-slate-700 mx-auto mb-3' />
          <p className='text-slate-400'>Nota de pedido no encontrada</p>
          <a
            href='/logistica'
            className='mt-4 inline-block text-sm text-blue-400 hover:underline'
          >
            ← Volver a logística
          </a>
        </div>
      </div>
    );

  const puedeRecibir = nota.estado === 'PENDIENTE' || nota.estado === 'PARCIAL';
  const puedeAnular = nota.estado !== 'ANULADO' && nota.estado !== 'RECIBIDO';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        .nota-detalle{font-family:'DM Sans',sans-serif}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
        option{background:#0f172a;color:#e2e8f0}input:focus,select:focus,textarea:focus{outline:none!important}
      `}</style>
      <div className='nota-detalle px-3 py-3 pb-10 sm:px-5 sm:py-4 sm:pb-12 lg:px-5 lg:py-2 lg:pb-3 bg-slate-900'>
        <div style={{ width: '100%', margin: '0 auto', minWidth: 0 }}>
          {/* Toast */}
          {toast && (
            <div
              className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
                toast.tipo === 'ok'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-red-700 text-white'
              }`}
            >
              {toast.tipo === 'ok' ? (
                <CheckCircle2 className='w-4 h-4' />
              ) : (
                <AlertCircle className='w-4 h-4' />
              )}
              {toast.msg}
            </div>
          )}

          {/* Header */}
          <div className='bg-white border-b border-slate-200 px-6 py-5'>
            <div className='max-w-5xl mx-auto'>
              <div className='flex items-start justify-between gap-4'>
                <div className='flex items-start gap-3'>
                  <a
                    href='/logistica'
                    className='mt-1 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors'
                  >
                    <ArrowLeft className='w-4 h-4' />
                  </a>
                  <div>
                    <div className='flex items-center gap-3 flex-wrap'>
                      <h1 className='text-xl font-bold text-slate-900 font-mono'>
                        {nota.numero}
                      </h1>
                      <EstadoBadge estado={nota.estado} />
                    </div>
                    <div className='flex items-center gap-3 mt-1 flex-wrap'>
                      {nota.proveedor && (
                        <span className='flex items-center gap-1 text-sm text-slate-600'>
                          <Building2 className='w-3.5 h-3.5 text-slate-400' />{' '}
                          {nota.proveedor}
                        </span>
                      )}
                      {nota.nombre_orden && (
                        <a
                          href={`/ordenes/${nota.orden_id}`}
                          className='flex items-center gap-1 text-sm text-blue-600 hover:underline'
                        >
                          <ChevronRight className='w-3.5 h-3.5' /> OS{' '}
                          {nota.nombre_orden}
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Acciones */}
                <div className='flex items-center gap-2 flex-shrink-0'>
                  {puedeAnular && (
                    <button
                      onClick={handleAnular}
                      disabled={anulando}
                      className='flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-xl transition-colors'
                    >
                      <Ban className='w-4 h-4' /> Anular
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contenido */}
          <div className='max-w-5xl mx-auto px-6 py-6 space-y-6'>
            {/* Datos generales */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <div className='bg-white rounded-2xl border border-slate-200 p-4'>
                <p className='text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5'>
                  Fecha de pedido
                </p>
                <p className='text-sm font-medium text-slate-800 flex items-center gap-1.5'>
                  <CalendarDays className='w-4 h-4 text-slate-400' />
                  {formatFecha(nota.fecha_pedido)}
                </p>
              </div>
              <div
                className={`bg-white rounded-2xl border p-4 ${nota.fecha_requerida && new Date(nota.fecha_requerida) < new Date() && puedeRecibir ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}
              >
                <p className='text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5'>
                  Fecha requerida
                </p>
                <p
                  className={`text-sm font-medium flex items-center gap-1.5 ${nota.fecha_requerida && new Date(nota.fecha_requerida) < new Date() && puedeRecibir ? 'text-red-700' : 'text-slate-800'}`}
                >
                  <CalendarDays className='w-4 h-4' />
                  {nota.fecha_requerida
                    ? formatFecha(nota.fecha_requerida)
                    : '—'}
                  {nota.fecha_requerida &&
                    new Date(nota.fecha_requerida) < new Date() &&
                    puedeRecibir && (
                      <span className='text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-semibold'>
                        VENCIDA
                      </span>
                    )}
                </p>
              </div>
              <div className='bg-white rounded-2xl border border-slate-200 p-4'>
                <p className='text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5'>
                  Progreso de recepción
                </p>
                <BarraProgreso pedido={totalPedido} recibido={totalRecibido} />
              </div>
            </div>

            {/* Notas */}
            {nota.notas && (
              <div className='bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800'>
                <p className='font-semibold mb-1 text-xs uppercase tracking-wider text-amber-600'>
                  Notas internas
                </p>
                {nota.notas}
              </div>
            )}

            {/* Tabla de ítems con recepción */}
            <div className='bg-white rounded-2xl border border-slate-200 overflow-hidden'>
              <div className='px-5 py-4 border-b border-slate-100 flex items-center justify-between'>
                <h2 className='text-sm font-semibold text-slate-800 flex items-center gap-2'>
                  <ClipboardList className='w-4 h-4 text-slate-400' />
                  Ítems del pedido
                </h2>
                <span className='text-xs text-slate-400'>
                  {nota.items.length} ítem{nota.items.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='bg-slate-800/50 border-b border-slate-700'>
                      <th className='px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                        Descripción
                      </th>
                      <th className='px-5 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                        Unidad
                      </th>
                      <th className='px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                        Pedido
                      </th>
                      <th className='px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                        $ Unit.
                      </th>
                      {puedeRecibir && (
                        <th className='px-5 py-3 text-right text-xs font-semibold text-blue-500 uppercase tracking-wider'>
                          Recibido
                        </th>
                      )}
                      {!puedeRecibir && (
                        <th className='px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                          Recibido
                        </th>
                      )}
                      <th className='px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell'>
                        Notas
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-100'>
                    {nota.items.map((item) => {
                      const recibidoItem =
                        recepciones[item.id] ?? item.cantidad_recibida;
                      const completado = recibidoItem >= item.cantidad_pedida;

                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${completado && puedeRecibir ? 'bg-emerald-900/30' : 'hover:bg-slate-800/50'}`}
                        >
                          <td className='px-5 py-3 font-medium text-slate-800'>
                            <div className='flex items-center gap-2'>
                              {completado && puedeRecibir && (
                                <CheckCircle2 className='w-4 h-4 text-emerald-500 flex-shrink-0' />
                              )}
                              {item.descripcion}
                            </div>
                          </td>
                          <td className='px-5 py-3 text-center text-slate-500 text-xs'>
                            {item.unidad_medida}
                          </td>
                          <td className='px-5 py-3 text-right font-semibold text-slate-800 tabular-nums'>
                            {item.cantidad_pedida}
                          </td>
                          <td className='px-5 py-3 text-right text-slate-500 tabular-nums text-xs'>
                            {item.precio_unitario
                              ? `$${item.precio_unitario.toLocaleString('es-AR')}`
                              : '—'}
                          </td>
                          <td className='px-5 py-3 text-right'>
                            {puedeRecibir ? (
                              <input
                                type='number'
                                min={0}
                                max={item.cantidad_pedida}
                                step='any'
                                value={recibidoItem}
                                onChange={(e) =>
                                  setRecepciones((prev) => ({
                                    ...prev,
                                    [item.id]: parseFloat(e.target.value) || 0,
                                  }))
                                }
                                className='w-20 text-sm px-2 py-1 border border-blue-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-50 font-semibold'
                              />
                            ) : (
                              <span className='tabular-nums font-semibold text-slate-800'>
                                {item.cantidad_recibida}
                              </span>
                            )}
                          </td>
                          <td className='px-5 py-3 text-slate-500 text-xs hidden lg:table-cell'>
                            {item.notas ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Botón guardar recepción */}
              {puedeRecibir && (
                <div className='px-5 py-4 border-t border-slate-100 bg-blue-50/40 flex items-center justify-between'>
                  <p className='text-xs text-blue-700 font-medium'>
                    Editá las cantidades recibidas y guardá la recepción. El
                    estado se actualiza automáticamente.
                  </p>
                  <button
                    onClick={handleGuardarRecepcion}
                    disabled={guardando}
                    className='flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors'
                  >
                    <PackageCheck className='w-4 h-4' />
                    {guardando ? 'Guardando…' : 'Guardar recepción'}
                  </button>
                </div>
              )}

              {/* Recibido completamente */}
              {nota.estado === 'RECIBIDO' && (
                <div className='px-5 py-4 border-t border-emerald-100 bg-emerald-50 flex items-center gap-2 text-emerald-700 text-sm font-medium'>
                  <CheckCircle2 className='w-5 h-5' />
                  Todos los ítems fueron recibidos
                  {nota.fecha_recepcion && (
                    <span className='text-xs text-emerald-600 ml-1'>
                      · {formatFecha(nota.fecha_recepcion)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
