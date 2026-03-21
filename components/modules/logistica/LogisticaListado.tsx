'use client';

// ============================================================
// /components/modules/logistica/LogisticaListado.tsx
// Módulo unificado: Notas de Pedido + Remitos
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Truck,
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  XCircle,
  MoreVertical,
  Eye,
  Ban,
  Package,
  PackageCheck,
  ArrowRight,
  CalendarDays,
  Hash,
  Building2,
  SlidersHorizontal,
} from 'lucide-react';
import type { NotaPedido, Remito } from '@/types';
import type {
  EstadoNotaPedido,
  EstadoRemito,
  TipoRemito,
} from '@/types/database';
import {
  obtenerNotasPedido,
  obtenerRemitos,
  obtenerKPIsLogistica,
  anularNotaPedido,
  cambiarEstadoRemito,
} from '@/app/actions/logistica';
import {
  getMockLogisticaKPIs,
  getMockNotasPedido,
  getMockRemitos,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';

// ── Tipos locales ─────────────────────────────────────────────────────────────

type NotaRow = NotaPedido & {
  nombre_orden: string | null;
  cantidad_items: number;
};
type RemitoRow = Remito & {
  nombre_orden: string | null;
  razon_social: string | null;
  cantidad_items: number;
};

interface KPIs {
  notas_pendientes: number;
  notas_parciales: number;
  remitos_emitidos_mes: number;
  remitos_entregados_mes: number;
}

// ── Badge helpers ─────────────────────────────────────────────────────────────

const NOTA_ESTADO_CONFIG: Record<
  EstadoNotaPedido,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.FC<any>;
  }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    icon: Clock,
  },
  PARCIAL: {
    label: 'Parcial',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
    icon: Circle,
  },
  RECIBIDO: {
    label: 'Recibido',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
    icon: CheckCircle2,
  },
  ANULADO: {
    label: 'Anulado',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
    icon: XCircle,
  },
};

const REMITO_ESTADO_CONFIG: Record<
  EstadoRemito,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    icon: React.FC<any>;
  }
> = {
  BORRADOR: {
    label: 'Borrador',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.15)',
    icon: Circle,
  },
  EMITIDO: {
    label: 'Emitido',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
    icon: Clock,
  },
  ENTREGADO: {
    label: 'Entregado',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
    icon: CheckCircle2,
  },
  ANULADO: {
    label: 'Anulado',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
    icon: XCircle,
  },
};

const TIPO_REMITO_LABEL: Record<
  TipoRemito,
  { label: string; color: string; bg: string }
> = {
  INTERNO_ENTRADA: {
    label: 'Int. Entrada',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
  },
  INTERNO_SALIDA: {
    label: 'Int. Salida',
    color: '#818cf8',
    bg: 'rgba(129,140,248,0.08)',
  },
  LEGAL_ENTRADA: {
    label: 'Legal Ent.',
    color: '#2dd4bf',
    bg: 'rgba(45,212,191,0.08)',
  },
  LEGAL_SALIDA: {
    label: 'Legal Sal.',
    color: '#fb923c',
    bg: 'rgba(251,146,60,0.08)',
  },
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({
  label,
  value,
  color = '#94a3b8',
  warning = false,
}: {
  label: string;
  value: number;
  color?: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`bg-slate-800/70 backdrop-blur-sm rounded-xl border p-4 ${warning && value > 0 ? 'border-amber-600/20' : 'border-slate-700/80'}`}
    >
      <span className='text-[10px] font-semibold tracking-wider uppercase text-slate-500 block mb-1.5'>
        {label}
      </span>
      <span
        className='text-xl font-extrabold font-mono tracking-tight block'
        style={{
          color: warning && value > 0 ? '#f59e0b' : color,
          fontFamily: "'DM Mono', monospace",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Nota badge ────────────────────────────────────────────────────────────────

function NotaBadge({ estado }: { estado: EstadoNotaPedido }) {
  const c = NOTA_ESTADO_CONFIG[estado];
  const Icon = c.icon;
  return (
    <span
      className='inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-[10px] font-bold tracking-wide'
      style={{
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className='w-1 h-1 rounded-full' style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

function RemitoBadge({ estado }: { estado: EstadoRemito }) {
  const c = REMITO_ESTADO_CONFIG[estado];
  const Icon = c.icon;
  return (
    <span
      className='inline-flex items-center gap-1.5 px-2 py-1 rounded-xl text-[10px] font-bold tracking-wide'
      style={{
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      <span className='w-1 h-1 rounded-full' style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: TipoRemito }) {
  const c = TIPO_REMITO_LABEL[tipo];
  return (
    <span
      className='inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wide'
      style={{
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.color}20`,
      }}
    >
      {c.label}
    </span>
  );
}

// ── Nota Menu ─────────────────────────────────────────────────────────────────

function NotaMenu({
  nota,
  onRefresh,
}: {
  nota: NotaRow;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const handleAnular = async () => {
    if (!confirm('¿Anular nota de pedido?')) return;
    setLoading(true);
    const r = await anularNotaPedido(nota.id);
    if (r.error) setToast(r.error);
    else {
      setToast(r.mensaje ?? 'Anulada');
      onRefresh();
    }
    setOpen(false);
    setLoading(false);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className='relative'>
      {toast && (
        <div className='fixed bottom-4 right-4 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow z-50'>
          {toast}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className='p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors'
      >
        <MoreVertical className='w-4 h-4' />
      </button>
      {open && (
        <>
          <div className='fixed inset-0 z-10' onClick={() => setOpen(false)} />
          <div className='absolute right-0 top-full mt-1 w-44 bg-slate-800 border border-slate-700 rounded-xl shadow-lg z-20 py-1 overflow-hidden'>
            <a
              href={`/logistica/notas/${nota.id}`}
              className='flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700'
            >
              <Eye className='w-4 h-4' /> Ver detalle
            </a>
            {nota.estado !== 'ANULADO' && nota.estado !== 'RECIBIDO' && (
              <button
                onClick={handleAnular}
                disabled={loading}
                className='w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50'
              >
                <Ban className='w-4 h-4' /> Anular
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Remito Menu ───────────────────────────────────────────────────────────────

const REMITO_TRANSICIONES: Record<EstadoRemito, EstadoRemito[]> = {
  BORRADOR: ['EMITIDO', 'ANULADO'],
  EMITIDO: ['ENTREGADO', 'ANULADO'],
  ENTREGADO: [],
  ANULADO: [],
};

function RemitoMenu({
  remito,
  onRefresh,
}: {
  remito: RemitoRow;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const transiciones = REMITO_TRANSICIONES[remito.estado];

  const handleEstado = async (estado: EstadoRemito) => {
    if (estado === 'ANULADO' && !confirm('¿Anular este remito?')) return;
    setLoading(true);
    const r = await cambiarEstadoRemito(remito.id, estado);
    if (r.error) setToast(r.error);
    else {
      setToast(r.mensaje ?? 'Actualizado');
      onRefresh();
    }
    setOpen(false);
    setLoading(false);
    setTimeout(() => setToast(null), 3000);
  };

  const estadoLabel: Record<EstadoRemito, string> = {
    BORRADOR: 'Borrador',
    EMITIDO: 'Marcar Emitido',
    ENTREGADO: 'Marcar Entregado',
    ANULADO: 'Anular',
  };

  return (
    <div className='relative'>
      {toast && (
        <div className='fixed bottom-4 right-4 bg-slate-800 text-white text-sm px-4 py-2 rounded-lg shadow z-50'>
          {toast}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className='p-1.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors'
      >
        <MoreVertical className='w-4 h-4' />
      </button>
      {open && (
        <>
          <div className='fixed inset-0 z-10' onClick={() => setOpen(false)} />
          <div className='absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-lg z-20 py-1 overflow-hidden'>
            <a
              href={`/logistica/remitos/${remito.id}`}
              className='flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700'
            >
              <Eye className='w-4 h-4' /> Ver detalle
            </a>
            {transiciones
              .filter((t) => t !== 'ANULADO')
              .map((t) => (
                <button
                  key={t}
                  onClick={() => handleEstado(t)}
                  disabled={loading}
                  className='w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700'
                >
                  <ArrowRight className='w-4 h-4 text-emerald-500' />{' '}
                  {estadoLabel[t]}
                </button>
              ))}
            {transiciones.includes('ANULADO') && (
              <button
                onClick={() => handleEstado('ANULADO')}
                disabled={loading}
                className='w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50'
              >
                <Ban className='w-4 h-4' /> Anular
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Tabla Notas de Pedido ─────────────────────────────────────────────────────

function TablaNotas({
  busqueda,
  estado,
  onRefresh,
  refreshKey,
}: {
  busqueda: string;
  estado: EstadoNotaPedido | '';
  onRefresh: () => void;
  refreshKey: number;
}) {
  const [filas, setFilas] = useState<NotaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const POR_PAGINA = 20;

  const cargar = useCallback(async () => {
    setCargando(true);
    if (shouldUsePlatformMocks) {
      const data = getMockNotasPedido({
        busqueda,
        estado: estado || undefined,
        pagina,
        por_pagina: POR_PAGINA,
      });
      setFilas(data.data);
      setTotal(data.total);
      setCargando(false);
      return;
    }
    const r = await obtenerNotasPedido({
      busqueda,
      estado: estado || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    });
    if (r.data) {
      setFilas(r.data.data);
      setTotal(r.data.total);
    }
    setCargando(false);
  }, [busqueda, estado, pagina, refreshKey]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    setPagina(1);
  }, [busqueda, estado]);

  const formatFecha = (f: string) =>
    new Date(f).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });

  if (cargando)
    return (
      <div className='space-y-2 p-4'>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className='h-12 bg-slate-100 rounded-lg animate-pulse' />
        ))}
      </div>
    );

  if (!filas.length)
    return (
      <div className='flex flex-col items-center justify-center py-16 text-slate-400'>
        <ClipboardList className='w-12 h-12 mb-3 opacity-40' />
        <p className='text-sm font-medium'>Sin notas de pedido</p>
        <p className='text-xs mt-1'>Creá la primera nota de pedido</p>
      </div>
    );

  return (
    <div>
      <div className='overflow-x-auto logistica-scroll'>
        <table className='logistica-table w-full text-sm'>
          <thead>
            <tr className='border-b border-slate-700/10'>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                Nro.
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                Proveedor
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell'>
                OS vinculada
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell'>
                Fecha pedido
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell'>
                F. requerida
              </th>
              <th className='px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                Ítems
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                Estado
              </th>
              <th className='px-4 py-3 w-10' />
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-700/5'>
            {filas.map((n) => (
              <tr
                key={n.id}
                className='hover:bg-slate-800/50 transition-colors group'
              >
                <td className='px-4 py-3'>
                  <a
                    href={`/logistica/notas/${n.id}`}
                    className='font-mono font-semibold text-slate-800 hover:text-blue-600 transition-colors text-xs'
                  >
                    {n.numero}
                  </a>
                </td>
                <td className='px-4 py-3 text-slate-700 font-medium'>
                  {n.proveedor ?? (
                    <span className='text-slate-400 italic'>—</span>
                  )}
                </td>
                <td className='px-4 py-3 text-slate-500 text-xs hidden md:table-cell'>
                  {n.nombre_orden ?? '—'}
                </td>
                <td className='px-4 py-3 text-slate-500 text-xs hidden sm:table-cell'>
                  {formatFecha(n.fecha_pedido)}
                </td>
                <td className='px-4 py-3 text-xs hidden lg:table-cell'>
                  {n.fecha_requerida ? (
                    <span
                      className={
                        new Date(n.fecha_requerida) < new Date() &&
                        n.estado === 'PENDIENTE'
                          ? 'text-red-600 font-semibold'
                          : 'text-slate-500'
                      }
                    >
                      {formatFecha(n.fecha_requerida)}
                    </span>
                  ) : (
                    <span className='text-slate-400'>—</span>
                  )}
                </td>
                <td className='px-4 py-3 text-center'>
                  <span className='inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs font-semibold text-slate-300'>
                    {n.cantidad_items}
                  </span>
                </td>
                <td className='px-4 py-3'>
                  <NotaBadge estado={n.estado} />
                </td>
                <td className='px-4 py-3'>
                  <NotaMenu
                    nota={n}
                    onRefresh={() => {
                      onRefresh();
                      cargar();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Paginación */}
      {total > POR_PAGINA && (
        <div className='flex items-center justify-between px-4 py-3 border-t border-slate-100'>
          <p className='text-xs text-slate-500'>
            {total} notas · página {pagina} de {Math.ceil(total / POR_PAGINA)}
          </p>
          <div className='flex gap-1'>
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className='px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
            >
              Anterior
            </button>
            <button
              onClick={() => setPagina((p) => p + 1)}
              disabled={pagina >= Math.ceil(total / POR_PAGINA)}
              className='px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed'
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tabla Remitos ─────────────────────────────────────────────────────────────

function TablaRemitos({
  busqueda,
  estado,
  tipo,
  onRefresh,
  refreshKey,
}: {
  busqueda: string;
  estado: EstadoRemito | '';
  tipo: TipoRemito | '';
  onRefresh: () => void;
  refreshKey: number;
}) {
  const [filas, setFilas] = useState<RemitoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const POR_PAGINA = 20;

  const cargar = useCallback(async () => {
    setCargando(true);
    if (shouldUsePlatformMocks) {
      const data = getMockRemitos({
        busqueda,
        estado: estado || undefined,
        tipo: tipo || undefined,
        pagina,
        por_pagina: POR_PAGINA,
      });
      setFilas(data.data);
      setTotal(data.total);
      setCargando(false);
      return;
    }
    const r = await obtenerRemitos({
      busqueda,
      estado: estado || undefined,
      tipo: tipo || undefined,
      pagina,
      por_pagina: POR_PAGINA,
    });
    if (r.data) {
      setFilas(r.data.data);
      setTotal(r.data.total);
    }
    setCargando(false);
  }, [busqueda, estado, tipo, pagina, refreshKey]);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEffect(() => {
    setPagina(1);
  }, [busqueda, estado, tipo]);

  const formatFecha = (f: string) =>
    new Date(f).toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });

  if (cargando)
    return (
      <div className='space-y-2 p-4'>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className='h-12 bg-slate-100 rounded-lg animate-pulse' />
        ))}
      </div>
    );

  if (!filas.length)
    return (
      <div className='flex flex-col items-center justify-center py-16 text-slate-400'>
        <Truck className='w-12 h-12 mb-3 opacity-40' />
        <p className='text-sm font-medium'>Sin remitos</p>
        <p className='text-xs mt-1'>Creá el primer remito</p>
      </div>
    );

  return (
    <div>
      <div className='overflow-x-auto logistica-scroll'>
        <table className='logistica-table w-full text-sm'>
          <thead>
            <tr className='border-b border-slate-700/10'>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                Nro.
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                Tipo
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                Cliente / Proveedor
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell'>
                OS
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell'>
                Emisión
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell'>
                Transportista
              </th>
              <th className='px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                Ítems
              </th>
              <th className='px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider'>
                Estado
              </th>
              <th className='px-4 py-3 w-10' />
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-700/5'>
            {filas.map((r) => (
              <tr
                key={r.id}
                className='hover:bg-slate-800/50 transition-colors group'
              >
                <td className='px-4 py-3'>
                  <a
                    href={`/logistica/remitos/${r.id}`}
                    className='font-mono font-semibold text-slate-800 hover:text-blue-600 transition-colors text-xs'
                  >
                    {r.numero}
                  </a>
                </td>
                <td className='px-4 py-3'>
                  <TipoBadge tipo={r.tipo} />
                </td>
                <td className='px-4 py-3 text-slate-700 font-medium'>
                  {r.razon_social ?? (
                    <span className='text-slate-400 italic'>—</span>
                  )}
                </td>
                <td className='px-4 py-3 text-slate-500 text-xs hidden md:table-cell'>
                  {r.nombre_orden ?? '—'}
                </td>
                <td className='px-4 py-3 text-slate-500 text-xs hidden sm:table-cell'>
                  {formatFecha(r.fecha_emision)}
                </td>
                <td className='px-4 py-3 text-slate-500 text-xs hidden lg:table-cell'>
                  {r.transportista ?? '—'}
                </td>
                <td className='px-4 py-3 text-center'>
                  <span className='inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-xs font-semibold text-slate-300'>
                    {r.cantidad_items}
                  </span>
                </td>
                <td className='px-4 py-3'>
                  <RemitoBadge estado={r.estado} />
                </td>
                <td className='px-4 py-3'>
                  <RemitoMenu
                    remito={r}
                    onRefresh={() => {
                      onRefresh();
                      cargar();
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > POR_PAGINA && (
        <div className='flex items-center justify-between px-4 py-3 border-t border-slate-100'>
          <p className='text-xs text-slate-500'>
            {total} remitos · página {pagina} de {Math.ceil(total / POR_PAGINA)}
          </p>
          <div className='flex gap-1'>
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina === 1}
              className='px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-600 text-slate-200'
            >
              Anterior
            </button>
            <button
              onClick={() => setPagina((p) => p + 1)}
              disabled={pagina >= Math.ceil(total / POR_PAGINA)}
              className='px-3 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg hover:bg-slate-600 text-slate-200'
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function LogisticaListado() {
  const [tab, setTab] = useState<'notas' | 'remitos'>('notas');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDelay, setBusquedaDelay] = useState('');
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Filtros notas
  const [estadoNota, setEstadoNota] = useState<EstadoNotaPedido | ''>('');
  // Filtros remitos
  const [estadoRemito, setEstadoRemito] = useState<EstadoRemito | ''>('');
  const [tipoRemito, setTipoRemito] = useState<TipoRemito | ''>('');

  const [kpis, setKpis] = useState<KPIs | null>(null);

  useEffect(() => {
    if (shouldUsePlatformMocks) {
      setKpis(getMockLogisticaKPIs());
      return;
    }
    obtenerKPIsLogistica().then((r) => {
      if (r.data) setKpis(r.data);
    });
  }, [refreshKey]);

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setBusquedaDelay(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=DM+Mono:wght@300;400;500;700&display=swap');
        .logistica-ui { font-family: 'DM Sans', sans-serif; }
        .logistica-ui .font-mono { font-family: 'DM Mono', monospace !important; }
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
        @media (max-width: 640px) {
          .logistica-scroll { overflow-x: hidden !important; }
          .logistica-table { font-size: 0.75rem !important; }
          .logistica-table th, .logistica-table td { padding: 0.375rem 0.5rem !important; font-size: 0.75rem !important; }
          .logistica-table th { font-size: 0.7rem !important; }
        }
      `}</style>
      <div
        className='logistica-ui min-h-screen bg-slate-900'
        style={{
          background:
            'radial-gradient(ellipse 100% 50% at 5% 0%, rgba(96,165,250,0.03), transparent 55%), #060d1a',
        }}
      >
        {/* Header */}
        <div className='bg-slate-800/70 backdrop-blur-sm border-b border-slate-700/80 px-6 py-5'>
          <div className='max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4'>
            <div>
              <div className='flex items-center gap-2 mb-1'>
                <span className='text-[11px] text-slate-600 tracking-wider uppercase'>
                  Hexa Gestión
                </span>
                <span className='text-slate-700'>›</span>
                <span className='text-[11px] text-slate-500 tracking-wider uppercase'>
                  Logística
                </span>
              </div>
              <div className='flex items-center gap-3'>
                <h1 className='text-[22px] font-bold text-slate-100 tracking-tight'>
                  Notas de pedido y remitos
                </h1>
              </div>
            </div>
            <a
              href={
                tab === 'notas'
                  ? '/logistica/notas/nueva'
                  : '/logistica/remitos/nuevo'
              }
              className='inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold rounded-lg transition-colors shadow-sm'
            >
              <Plus className='w-4 h-4' />
              {tab === 'notas' ? 'Nueva nota de pedido' : 'Nuevo remito'}
            </a>
          </div>
        </div>

        <div className='max-w-7xl mx-auto px-6 py-6 space-y-5'>
          {/* KPIs */}
          <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
            <KPICard
              label='Notas pendientes'
              value={kpis?.notas_pendientes ?? 0}
              color='#f59e0b'
              warning
            />
            <KPICard
              label='Recepción parcial'
              value={kpis?.notas_parciales ?? 0}
              color='#60a5fa'
              warning
            />
            <KPICard
              label='Remitos emitidos (mes)'
              value={kpis?.remitos_emitidos_mes ?? 0}
              color='#4ade80'
            />
            <KPICard
              label='Entregados (mes)'
              value={kpis?.remitos_entregados_mes ?? 0}
              color='#4ade80'
            />
          </div>

          {/* Panel principal */}
          <div className='bg-slate-800/70 backdrop-blur-sm rounded-xl border border-slate-700/80 shadow-sm overflow-hidden'>
            {/* Tabs */}
            <div className='flex border-b border-slate-700/50 bg-slate-900/20'>
              {[
                { key: 'notas', label: 'Notas de Pedido', icon: ClipboardList },
                { key: 'remitos', label: 'Remitos', icon: Truck },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key as any);
                    setBusqueda('');
                    setFiltrosOpen(false);
                  }}
                  className={`flex items-center gap-2 px-5 py-3 text-[13px] font-semibold border-b-2 transition-colors ${
                    tab === t.key
                      ? 'border-blue-500 text-blue-400 bg-blue-900/10'
                      : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/30'
                  }`}
                >
                  <t.icon className='w-4 h-4' />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Barra de búsqueda + filtros */}
            <div className='px-4 py-4 border-b border-slate-700/50 space-y-3 bg-slate-900/10'>
              <div className='flex items-center gap-2'>
                <div className='relative flex-1'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-[13px] h-[13px] text-slate-500' />
                  <input
                    type='text'
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder={
                      tab === 'notas'
                        ? 'Buscar por número o proveedor…'
                        : 'Buscar por número o transportista…'
                    }
                    className='w-full pl-9 pr-3 py-2 text-sm border border-slate-700/60 bg-slate-900/60 text-slate-100 placeholder-slate-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all'
                  />
                </div>
                <button
                  onClick={() => setFiltrosOpen(!filtrosOpen)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold border rounded-lg transition-colors ${
                    filtrosOpen
                      ? 'bg-blue-900/40 border-blue-600/50 text-blue-400'
                      : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:bg-slate-700/60'
                  }`}
                >
                  <SlidersHorizontal className='w-3.5 h-3.5' />
                  Filtros
                  {filtrosOpen ? (
                    <ChevronUp className='w-3 h-3' />
                  ) : (
                    <ChevronDown className='w-3 h-3' />
                  )}
                </button>
              </div>

              {/* Filtros expandibles */}
              {filtrosOpen && (
                <div
                  className='flex flex-wrap gap-2 pt-2 border-t border-slate-700/30'
                  style={{ animation: 'fadeIn 0.15s ease' }}
                >
                  {tab === 'notas' ? (
                    <>
                      <div className='flex items-center gap-1.5'>
                        <label className='text-[10px] text-slate-500 font-semibold tracking-wider uppercase'>
                          Estado:
                        </label>
                        <select
                          value={estadoNota}
                          onChange={(e) => setEstadoNota(e.target.value as any)}
                          className='text-xs border border-slate-700 bg-slate-900/60 text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500'
                        >
                          <option value=''>Todos</option>
                          <option value='PENDIENTE'>Pendiente</option>
                          <option value='PARCIAL'>Parcial</option>
                          <option value='RECIBIDO'>Recibido</option>
                          <option value='ANULADO'>Anulado</option>
                        </select>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className='flex items-center gap-1.5'>
                        <label className='text-[10px] text-slate-500 font-semibold tracking-wider uppercase'>
                          Estado:
                        </label>
                        <select
                          value={estadoRemito}
                          onChange={(e) =>
                            setEstadoRemito(e.target.value as any)
                          }
                          className='text-xs border border-slate-700 bg-slate-900/60 text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500'
                        >
                          <option value=''>Todos</option>
                          <option value='BORRADOR'>Borrador</option>
                          <option value='EMITIDO'>Emitido</option>
                          <option value='ENTREGADO'>Entregado</option>
                          <option value='ANULADO'>Anulado</option>
                        </select>
                      </div>
                      <div className='flex items-center gap-1.5'>
                        <label className='text-[10px] text-slate-500 font-semibold tracking-wider uppercase'>
                          Tipo:
                        </label>
                        <select
                          value={tipoRemito}
                          onChange={(e) => setTipoRemito(e.target.value as any)}
                          className='text-xs border border-slate-700 bg-slate-900/60 text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500'
                        >
                          <option value=''>Todos</option>
                          <option value='INTERNO_ENTRADA'>Int. Entrada</option>
                          <option value='INTERNO_SALIDA'>Int. Salida</option>
                          <option value='LEGAL_ENTRADA'>Legal Entrada</option>
                          <option value='LEGAL_SALIDA'>Legal Salida</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Tabla activa */}
            {tab === 'notas' ? (
              <TablaNotas
                busqueda={busquedaDelay}
                estado={estadoNota}
                onRefresh={() => setRefreshKey((k) => k + 1)}
                refreshKey={refreshKey}
              />
            ) : (
              <TablaRemitos
                busqueda={busquedaDelay}
                estado={estadoRemito}
                tipo={tipoRemito}
                onRefresh={() => setRefreshKey((k) => k + 1)}
                refreshKey={refreshKey}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
