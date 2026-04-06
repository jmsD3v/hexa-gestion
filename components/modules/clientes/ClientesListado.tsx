'use client';

// ============================================================
// components/modules/clientes/ClientesListado.tsx
// Listado paginado de clientes con búsqueda, filtros y acciones
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useRef,
  type ReactNode,
} from 'react';
import { Search, AlertTriangle, CheckCircle2, FileText, Plus } from 'lucide-react';
import type { ClienteListaItem, FiltrosCliente, CondicionIVA } from '@/types';
import type { PaginatedResponse, ApiResponse } from '@/types';
import {
  obtenerClientes,
  desactivarCliente,
  reactivarCliente,
} from '@/app/actions/clientes';
import {
  getMockClientes,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { cn } from '@/lib/utils';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CONDICIONES_IVA: { value: CondicionIVA | ''; label: string }[] = [
  { value: '', label: 'Todas las condiciones' },
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Resp. Inscripto' },
  { value: 'MONOTRIBUTISTA', label: 'Monotributista' },
  { value: 'EXENTO', label: 'Exento' },
  { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { value: 'NO_RESPONSABLE', label: 'No Responsable' },
];

const SEGMENTOS = [
  '',
  'HVAC / Climatización',
  'Energía Solar / Fotovoltaica',
  'Obra Civil',
  'Instalaciones Eléctricas',
  'Automatización Industrial',
  'Servicios Técnicos',
  'Otros',
];

const IVA_BADGE: Record<CondicionIVA, { label: string; cls: string }> = {
  RESPONSABLE_INSCRIPTO: { label: 'RI', cls: 'text-blue-400 bg-blue-400/10 border-blue-400/[0.13]'       },
  MONOTRIBUTISTA:        { label: 'MT', cls: 'text-violet-400 bg-violet-400/10 border-violet-400/[0.13]' },
  EXENTO:                { label: 'EX', cls: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/[0.13]' },
  CONSUMIDOR_FINAL:      { label: 'CF', cls: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/[0.08]'  },
  NO_RESPONSABLE:        { label: 'NR', cls: 'text-slate-500 bg-slate-500/[0.08] border-slate-500/[0.08]'  },
};

const POR_PAGINA_OPCIONES = [10, 20, 50];

// ─── Tipos locales ────────────────────────────────────────────────────────────

type OrdenCol =
  | 'razon_social'
  | 'cuit'
  | 'condicion_iva'
  | 'segmento'
  | 'ultima_actividad';
type OrdenDir = 'asc' | 'desc';

interface EstadoFiltros {
  busqueda: string;
  condicion_iva: CondicionIVA | '';
  segmento: string;
  activo: boolean;
  pagina: number;
  por_pagina: number;
  orden_por: OrdenCol;
  orden_dir: OrdenDir;
}

interface AccionConfirmacion {
  tipo: 'desactivar' | 'reactivar';
  cliente: ClienteListaItem;
}

// ─── Hook: debounce ───────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function formatearMonto(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n);
}

function avatarLetra(razon_social: string): string {
  return razon_social.charAt(0).toUpperCase();
}

function avatarColor(razon_social: string): string {
  const hue = (razon_social.charCodeAt(0) * 7) % 360;
  return `hsl(${hue}, 35%, 22%)`;
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function IVABadge({ condicion }: { condicion: CondicionIVA }) {
  const cfg = IVA_BADGE[condicion];
  return (
    <span className={`inline-flex items-center px-[7px] py-0.5 rounded text-xs font-bold tracking-[0.06em] whitespace-nowrap font-mono border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function SaldoBadge({ monto }: { monto: number }) {
  if (monto === 0)
    return <span className='text-xs text-slate-600'>—</span>;
  return (
    <span className='text-xs font-mono tabular-nums font-medium text-status-danger'>
      {formatearMonto(monto)}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[44, 120, 100, 60, 80, 70, 70, 60].map((w, i) => (
        <td
          key={i}
          className='px-4 py-3 border-b border-slate-400/[0.05]'
        >
          <div
            className={`h-3 rounded bg-slate-400/[0.06] animate-pulse w-[${w}px] [animation-delay:${i * 60}ms]`}
          />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ filtrado }: { filtrado: boolean }) {
  return (
    <tr>
      <td colSpan={8} className='py-16 px-8 text-center'>
        <div className='flex flex-col items-center gap-3'>
          <div className='w-12 h-12 rounded-[14px] bg-slate-400/[0.06] border border-slate-400/10 flex items-center justify-center'>
            {filtrado ? <Search className='w-5 h-5 text-slate-500' /> : <span className='text-[20px]'>👥</span>}
          </div>
          <div>
            <p className='m-0 mb-1 text-[13px] font-semibold text-slate-600'>
              {filtrado ? 'Sin resultados' : 'Sin clientes aún'}
            </p>
            <p className='m-0 text-xs text-[#334155]'>
              {filtrado
                ? 'Probá con otros términos de búsqueda o filtros'
                : 'Creá el primer cliente con el botón de arriba'}
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}

function ModalConfirmacion({
  accion,
  loading,
  onConfirmar,
  onCancelar,
}: {
  accion: AccionConfirmacion;
  loading: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const esDesactivar = accion.tipo === 'desactivar';
  return (
    <div
      className='fixed inset-0 flex items-center justify-center z-[100] backdrop-blur-[4px] bg-black/70 animate-fade-in'
    >
      <div
        className='rounded-2xl p-7 w-[90%] max-w-[380px] bg-[#0f172a] border border-slate-400/[0.12] animate-modal-in'
      >
        <div className='mb-4'>
          <div
            className={`w-10 h-10 rounded-[10px] flex items-center justify-center mb-[14px] ${esDesactivar ? 'bg-red-400/10 border border-red-400/30' : 'bg-emerald-400/10 border border-emerald-400/30'}`}
          >
            {esDesactivar
              ? <AlertTriangle className='w-5 h-5 text-amber-400' />
              : <CheckCircle2 className='w-5 h-5 text-emerald-400' />}
          </div>
          <h3
            className='text-[15px] font-bold text-slate-200 mt-0 mx-0 mb-1.5'
          >
            {esDesactivar ? 'Desactivar cliente' : 'Reactivar cliente'}
          </h3>
          <p
            className='text-[13px] text-slate-500 leading-[1.6] m-0'
          >
            {esDesactivar ? (
              <>
                ¿Confirmás que querés desactivar a{' '}
                <strong className='text-slate-400'>
                  {accion.cliente.razon_social}
                </strong>
                ? No podrá ser seleccionado en nuevos documentos.
              </>
            ) : (
              <>
                ¿Reactivar a{' '}
                <strong className='text-slate-400'>
                  {accion.cliente.razon_social}
                </strong>
                ? Volvera a estar disponible en el sistema.
              </>
            )}
          </p>
        </div>
        <div className='flex gap-2.5 justify-end'>
          <button
            onClick={onCancelar}
            disabled={loading}
            className='px-4 py-2 rounded-lg border border-slate-400/[0.12] bg-transparent text-slate-500 text-[13px] cursor-pointer'
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={loading}
            className={`flex items-center gap-1.5 px-[18px] py-2 rounded-lg border-none text-[13px] font-semibold ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'} ${esDesactivar ? 'bg-red-400/15 text-red-400' : 'bg-gradient-to-br from-emerald-400/80 to-emerald-500/80 text-[#0f172a]'}`}
          >
            {loading && (
              <svg
                width='12'
                height='12'
                viewBox='0 0 12 12'
                className='animate-spin'
              >
                <circle
                  cx='6'
                  cy='6'
                  r='4.5'
                  stroke='currentColor'
                  strokeWidth='1.5'
                  fill='none'
                  strokeDasharray='14'
                  strokeDashoffset='5'
                />
              </svg>
            )}
            {esDesactivar ? 'Desactivar' : 'Reactivar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastNotificacion({
  mensaje,
  tipo,
  onClose,
}: {
  mensaje: string;
  tipo: 'ok' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-[18px] py-3 rounded-[10px] backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-w-[320px] bg-[rgba(15,23,42,0.95)] [animation:slideUp_0.25s_cubic-bezier(0.34,1.56,0.64,1)] ${tipo === 'ok' ? 'border border-emerald-400/30' : 'border border-red-400/30'}`}
    >
      <span className='text-sm'>{tipo === 'ok' ? '✓' : '✕'}</span>
      <span
        className={`text-[13px] ${tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
      >
        {mensaje}
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ClientesListado() {
  const [filtros, setFiltros] = useState<EstadoFiltros>({
    busqueda: '',
    condicion_iva: '',
    segmento: '',
    activo: true,
    pagina: 1,
    por_pagina: 20,
    orden_por: 'razon_social',
    orden_dir: 'asc',
  });

  const [resultado, setResultado] =
    useState<PaginatedResponse<ClienteListaItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionPending, setAccionPending] = useState<AccionConfirmacion | null>(
    null,
  );
  const [accionLoading, setAccionLoading] = useState(false);
  const [toast, setToast] = useState<{
    mensaje: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const busquedaDebounced = useDebounce(filtros.busqueda, 350);
  const menuRef = useRef<HTMLTableDataCellElement>(null);

  // ── Fetch datos ──────────────────────────────────────────────

  const cargarClientes = useCallback(
    async (f: EstadoFiltros, busqueda: string) => {
      setLoading(true);
      const params: FiltrosCliente = {
        busqueda: busqueda || undefined,
        condicion_iva: f.condicion_iva || undefined,
        segmento: f.segmento || undefined,
        activo: f.activo,
        pagina: f.pagina,
        por_pagina: f.por_pagina,
        orden_por: f.orden_por,
        orden_dir: f.orden_dir,
      };
      if (shouldUsePlatformMocks) {
        setResultado(getMockClientes(params));
        setLoading(false);
        return;
      }
      const res: ApiResponse<PaginatedResponse<ClienteListaItem>> =
        await obtenerClientes(params);
      setLoading(false);
      if (res.data) setResultado(res.data);
    },
    [],
  );

  useEffect(() => {
    startTransition(() => {
      cargarClientes(filtros, busquedaDebounced);
    });
  }, [
    filtros.pagina,
    filtros.por_pagina,
    filtros.condicion_iva,
    filtros.segmento,
    filtros.activo,
    filtros.orden_por,
    filtros.orden_dir,
    busquedaDebounced,
    cargarClientes,
  ]);

  // Resetear página al cambiar filtros o búsqueda
  useEffect(() => {
    setFiltros((prev) => ({ ...prev, pagina: 1 }));
  }, [
    busquedaDebounced,
    filtros.condicion_iva,
    filtros.segmento,
    filtros.activo,
  ]);

  // Cerrar menú al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────

  const setFiltro = <K extends keyof EstadoFiltros>(
    k: K,
    v: EstadoFiltros[K],
  ) => {
    setFiltros((prev) => ({ ...prev, [k]: v }));
  };

  const toggleOrden = (col: OrdenCol) => {
    setFiltros((prev) => ({
      ...prev,
      orden_por: col,
      orden_dir:
        prev.orden_por === col && prev.orden_dir === 'asc' ? 'desc' : 'asc',
      pagina: 1,
    }));
  };

  const handleConfirmarAccion = async () => {
    if (!accionPending) return;
    if (shouldUsePlatformMocks) {
      setAccionPending(null);
      setResultado((prev) => {
        if (!prev) return prev;
        const nextData = prev.data.filter(
          (cliente) => cliente.id !== accionPending.cliente.id,
        );
        return {
          ...prev,
          data: nextData,
          total: Math.max(0, prev.total - 1),
        };
      });
      setToast({
        mensaje:
          accionPending.tipo === 'desactivar'
            ? 'Cliente desactivado en modo mock'
            : 'Cliente reactivado en modo mock',
        tipo: 'ok',
      });
      return;
    }
    setAccionLoading(true);

    const res =
      accionPending.tipo === 'desactivar'
        ? await desactivarCliente(accionPending.cliente.id)
        : await reactivarCliente(accionPending.cliente.id);

    setAccionLoading(false);
    setAccionPending(null);

    if (res.error) {
      setToast({ mensaje: res.mensaje ?? res.error, tipo: 'error' });
    } else {
      setToast({ mensaje: res.mensaje ?? 'Operación exitosa', tipo: 'ok' });
      cargarClientes(filtros, busquedaDebounced);
    }
  };

  const hayFiltrosActivos =
    !!filtros.condicion_iva || !!filtros.segmento || !filtros.activo;

  const clientes = resultado?.data ?? [];
  const total = resultado?.total ?? 0;
  const totalPaginas = resultado?.total_paginas ?? 1;
  const hayResultados = clientes.length > 0;
  const filtradoActivo = !!filtros.busqueda || hayFiltrosActivos;

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <div
        className='min-h-screen bg-slate-950 bg-gradient-to-b from-amber-950/5 to-slate-950 px-3 py-5 pb-20 sm:px-5 sm:py-8 lg:px-6'
      >
        <div className='max-w-7xl mx-auto min-w-0'>
          {/* ── Header ── */}
          <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <div className='flex items-center gap-2 mb-1'>
                <span className='text-[11px] text-slate-500 tracking-widest uppercase'>
                  Hexa Gestión
                </span>
                <span className='text-slate-500'>›</span>
                <span className='text-[11px] text-slate-600 tracking-widest uppercase'>
                  Clientes
                </span>
              </div>
              <h1
                className='m-0 text-[32px] leading-none font-bold text-slate-100 tracking-tight flex items-center gap-2.5 max-[480px]:text-[26px]'
              >
                Clientes
                {total > 0 && (
                  <span className='text-[11px] font-semibold text-slate-400 bg-slate-400/10 border border-slate-400/10 rounded-2xl px-2.5 py-0.5 font-mono'>
                    {total}
                  </span>
                )}
              </h1>
            </div>

            <a
              href='/clientes/nuevo'
              className='inline-flex w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 px-4 py-2.5 text-[13px] font-bold text-slate-950 no-underline shadow-sm shadow-emerald-600/15 transition-all sm:w-auto'
            >
              <Plus className='w-4 h-4' />
              Nuevo cliente
            </a>
          </div>

          {/* ── Barra de búsqueda + filtros ── */}
          <div className='bg-slate-900/70 border border-slate-400/[0.08] rounded-xl px-4 py-[14px] mb-3 backdrop-blur-sm'>
            <div className='flex gap-2.5 items-center'>
              {/* Búsqueda */}
              <div className='flex-1 relative'>
                <svg
                  width='14'
                  height='14'
                  viewBox='0 0 14 14'
                  fill='none'
                  className='absolute left-3 top-1/2 -translate-y-1/2 text-[#334155] pointer-events-none'
                >
                  <circle
                    cx='6'
                    cy='6'
                    r='4.5'
                    stroke='currentColor'
                    strokeWidth='1.4'
                  />
                  <path
                    d='M9.5 9.5L12 12'
                    stroke='currentColor'
                    strokeWidth='1.4'
                    strokeLinecap='round'
                  />
                </svg>
                <input
                  type='text'
                  value={filtros.busqueda}
                  onChange={(e) => setFiltro('busqueda', e.target.value)}
                  placeholder='Buscar por razón social, CUIT o nombre...'
                  className='w-full py-[9px] pl-[34px] pr-3 bg-slate-950/60 border border-slate-400/10 rounded-lg text-slate-200 text-[13px] outline-none transition-colors'
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(245,158,11,0.35)')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(148,163,184,0.1)')
                  }
                />
                {filtros.busqueda && (
                  <button
                    onClick={() => setFiltro('busqueda', '')}
                    className='absolute right-[10px] top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-600 cursor-pointer p-0.5 flex items-center'
                  >
                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                      <path
                        d='M2 2L10 10M10 2L2 10'
                        stroke='currentColor'
                        strokeWidth='1.5'
                        strokeLinecap='round'
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Toggle filtros */}
              <button
                onClick={() => setFiltrosOpen((p) => !p)}
                className={`flex items-center gap-1.5 px-[14px] py-[9px] rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-all ${hayFiltrosActivos ? 'border border-amber-500/35 bg-amber-500/[0.08] text-amber-500' : 'border border-slate-400/10 bg-[rgba(8,16,35,0.6)] text-slate-500'}`}
              >
                <svg width='13' height='13' viewBox='0 0 13 13' fill='none'>
                  <path
                    d='M1 3H12M3 6.5H10M5 10H8'
                    stroke='currentColor'
                    strokeWidth='1.4'
                    strokeLinecap='round'
                  />
                </svg>
                Filtros
                {hayFiltrosActivos && (
                  <span
                    className='inline-block rounded-full bg-amber-500 w-[6px] h-[6px]'
                  />
                )}
              </button>

              {/* Toggle activos / inactivos */}
              <button
                onClick={() => setFiltro('activo', !filtros.activo)}
                className={`flex items-center gap-1.5 px-[14px] py-[9px] rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap transition-all ${!filtros.activo ? 'border border-red-400/30 bg-red-400/[0.08] text-red-400' : 'border border-slate-400/10 bg-[rgba(8,16,35,0.6)] text-slate-500'}`}
              >
                {filtros.activo ? 'Activos' : 'Inactivos'}
              </button>
            </div>

            {/* Panel de filtros expandible */}
            {filtrosOpen && (
              <div
                className='mt-3 pt-3 border-t border-slate-400/[0.06] flex gap-2.5 flex-wrap animate-fade-in'
              >
                <div className='flex flex-col gap-1'>
                  <label className='text-xs font-semibold text-slate-600 uppercase tracking-widest'>
                    Condición IVA
                  </label>
                  <select
                    value={filtros.condicion_iva}
                    onChange={(e) =>
                      setFiltro(
                        'condicion_iva',
                        e.target.value as CondicionIVA | '',
                      )
                    }
                    className="select-dropdown py-[7px] pl-[10px] pr-7 bg-slate-950/80 border border-slate-400/10 rounded-[7px] text-slate-400 text-xs outline-none cursor-pointer appearance-none"
                  >
                    {CONDICIONES_IVA.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='flex flex-col gap-1'>
                  <label className='text-xs font-semibold text-slate-600 uppercase tracking-widest'>
                    Segmento
                  </label>
                  <select
                    value={filtros.segmento}
                    onChange={(e) => setFiltro('segmento', e.target.value)}
                    className="select-dropdown py-[7px] pl-[10px] pr-7 bg-slate-950/80 border border-slate-400/10 rounded-[7px] text-slate-400 text-xs outline-none cursor-pointer appearance-none"
                  >
                    <option value=''>Todos los segmentos</option>
                    {SEGMENTOS.filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {hayFiltrosActivos && (
                  <div className='flex items-end'>
                    <button
                      onClick={() => {
                        setFiltro('condicion_iva', '');
                        setFiltro('segmento', '');
                        setFiltro('activo', true);
                      }}
                      className='px-3 py-[7px] rounded-[7px] border border-slate-400/10 bg-transparent text-slate-600 text-xs cursor-pointer'
                    >
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Tabla ── */}
          <div className='bg-slate-900/70 border border-slate-400/[0.08] rounded-xl overflow-hidden backdrop-blur-sm'>
            <div className='overflow-x-auto'>
              <table
                className='w-full border-collapse min-w-[700px]'
              >
                <thead>
                  <tr className='border-b border-slate-400/[0.08]'>
                    {(
                      [
                        { col: null, label: '', w: '44px' },
                        { col: 'razon_social', label: 'Cliente', w: 'auto' },
                        { col: 'cuit', label: 'CUIT', w: '130px' },
                        { col: 'condicion_iva', label: 'IVA', w: '70px' },
                        { col: 'segmento', label: 'Segmento', w: '160px' },
                        { col: null, label: 'Contacto', w: '140px' },
                        {
                          col: 'ultima_actividad',
                          label: 'Últ. actividad',
                          w: '110px',
                        },
                        { col: null, label: 'Saldo', w: '100px' },
                      ] as { col: OrdenCol | null; label: string; w: string }[]
                    ).map(({ col, label, w }, i) => (
                      <th
                        key={i}
                        className={cn(
                          'px-4 py-[11px] text-left text-xs font-bold tracking-widest uppercase whitespace-nowrap select-none',
                          col ? 'cursor-pointer hover:!text-slate-400' : '',
                          col && filtros.orden_por === col ? 'text-amber-500' : 'text-slate-700',
                          `w-[${w}]`,
                        )}
                        onClick={col ? () => toggleOrden(col) : undefined}
                      >
                        <span className='inline-flex items-center gap-1'>
                          {label}
                          {col && filtros.orden_por === col && (
                            <svg
                              width='9'
                              height='9'
                              viewBox='0 0 9 9'
                              fill='none'
                            >
                              {filtros.orden_dir === 'asc' ? (
                                <path
                                  d='M4.5 7V2M2 4.5L4.5 2L7 4.5'
                                  stroke='#f59e0b'
                                  strokeWidth='1.3'
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                />
                              ) : (
                                <path
                                  d='M4.5 2V7M2 4.5L4.5 7L7 4.5'
                                  stroke='#f59e0b'
                                  strokeWidth='1.3'
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                />
                              )}
                            </svg>
                          )}
                        </span>
                      </th>
                    ))}
                    <th className='px-4 py-[11px] w-10' />
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    Array.from({ length: filtros.por_pagina > 10 ? 8 : 5 }).map(
                      (_, i) => <SkeletonRow key={i} />,
                    )
                  ) : !hayResultados ? (
                    <EmptyState filtrado={filtradoActivo} />
                  ) : (
                    clientes.map((c, idx) => (
                      <tr
                        key={c.id}
                        className={`group border-b border-slate-400/[0.04] transition-colors duration-[120ms] hover:bg-amber-500/[0.03] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-[rgba(8,16,35,0.2)]'}`}
                      >
                        {/* Avatar */}
                        <td className='py-[10px] pl-4 pr-2'>
                          <div
                            className={`w-[30px] h-[30px] rounded-lg flex items-center justify-center text-xs font-bold text-amber-500 shrink-0 border border-amber-500/[0.12] bg-[${avatarColor(c.razon_social)}]`}
                          >
                            {avatarLetra(c.razon_social)}
                          </div>
                        </td>

                        {/* Razón social */}
                        <td className='px-4 py-[10px]'>
                          <a
                            href={`/clientes/${c.id}`}
                            className='no-underline block'
                          >
                            <div className='text-[13px] font-semibold leading-[1.3] mb-px transition-colors text-slate-300 hover:text-amber-500'>
                              {c.razon_social}
                            </div>
                            {c.nombre_fantasia && (
                              <div className='text-xs text-slate-600'>
                                {c.nombre_fantasia}
                              </div>
                            )}
                          </a>
                        </td>

                        {/* CUIT */}
                        <td className='px-4 py-[10px]'>
                          <span className={`text-xs font-mono ${c.cuit ? 'text-slate-500' : 'text-slate-800'}`}>
                            {c.cuit ?? '—'}
                          </span>
                        </td>

                        {/* IVA badge */}
                        <td className='px-4 py-[10px]'>
                          <IVABadge condicion={c.condicion_iva} />
                        </td>

                        {/* Segmento */}
                        <td className='px-4 py-[10px]'>
                          {c.segmento ? (
                            <span className='text-xs text-slate-500 bg-slate-400/[0.06] border border-slate-400/10 rounded px-[7px] py-0.5 whitespace-nowrap'>
                              {c.segmento}
                            </span>
                          ) : (
                            <span className='text-[#1e293b] text-xs'>—</span>
                          )}
                        </td>

                        {/* Contacto */}
                        <td className='px-4 py-[10px]'>
                          <div className='text-xs text-slate-600 leading-[1.4]'>
                            {c.email ? (
                              <div className='overflow-hidden text-ellipsis whitespace-nowrap max-w-[130px]'>
                                {c.email}
                              </div>
                            ) : null}
                            {c.telefono ? (
                              <div className='text-[#334155] font-mono text-xs'>
                                {c.telefono}
                              </div>
                            ) : null}
                            {!c.email && !c.telefono && (
                              <span className='text-[#1e293b]'>—</span>
                            )}
                          </div>
                        </td>

                        {/* Última actividad */}
                        <td className='px-4 py-[10px]'>
                          <span className='text-xs text-[#334155] font-mono'>
                            {formatearFecha(c.ultima_actividad)}
                          </span>
                        </td>

                        {/* Saldo */}
                        <td className='px-4 py-[10px]'>
                          <SaldoBadge monto={c.saldo_pendiente} />
                        </td>

                        {/* Acciones */}
                        <td
                          className='py-[10px] px-3 relative'
                          ref={menuAbierto === c.id ? menuRef : null}
                        >
                          <button
                            onClick={() =>
                              setMenuAbierto((prev) =>
                                prev === c.id ? null : c.id,
                              )
                            }
                            className={`acciones-fila flex items-center justify-center w-7 h-7 rounded-md border border-slate-400/[0.12] cursor-pointer transition-all text-slate-500 ${menuAbierto === c.id ? 'opacity-100 bg-slate-400/[0.08]' : 'opacity-0 bg-transparent'}`}
                          >
                            <svg
                              width='14'
                              height='14'
                              viewBox='0 0 14 14'
                              fill='none'
                            >
                              <circle cx='7' cy='3' r='1' fill='currentColor' />
                              <circle cx='7' cy='7' r='1' fill='currentColor' />
                              <circle
                                cx='7'
                                cy='11'
                                r='1'
                                fill='currentColor'
                              />
                            </svg>
                          </button>

                          {menuAbierto === c.id && (
                            <div className='absolute right-2 top-full z-50 min-w-[160px] rounded-[10px] p-1 shadow-[0_8px_24px_rgba(0,0,0,0.4)] bg-slate-950 border border-slate-400/[0.12] animate-modal-in'>
                              <MenuOpcion
                                icon='👁'
                                label='Ver ficha'
                                onClick={() => {
                                  window.location.href = `/clientes/${c.id}`;
                                }}
                              />
                              <MenuOpcion
                                icon='✏️'
                                label='Editar'
                                onClick={() => {
                                  window.location.href = `/clientes/${c.id}/editar`;
                                }}
                              />
                              <MenuOpcion
                                icon={<FileText className='w-3.5 h-3.5' />}
                                label='Nuevo presupuesto'
                                onClick={() => {
                                  window.location.href = `/presupuestos/nuevo?cliente=${c.id}`;
                                }}
                              />
                              <div className='h-px bg-slate-400/[0.06] my-1' />
                              {c.activo ? (
                                <MenuOpcion
                                  icon='🔴'
                                  label='Desactivar'
                                  danger
                                  onClick={() => {
                                    setMenuAbierto(null);
                                    setAccionPending({
                                      tipo: 'desactivar',
                                      cliente: c,
                                    });
                                  }}
                                />
                              ) : (
                                <MenuOpcion
                                  icon='🟢'
                                  label='Reactivar'
                                  onClick={() => {
                                    setMenuAbierto(null);
                                    setAccionPending({
                                      tipo: 'reactivar',
                                      cliente: c,
                                    });
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Footer / Paginación ── */}
            {!loading && hayResultados && (
              <div className='px-4 py-3 border-t border-slate-400/[0.06] flex items-center justify-between gap-3 flex-wrap'>
                {/* Info */}
                <span className='text-xs text-[#334155] font-mono whitespace-nowrap'>
                  {(filtros.pagina - 1) * filtros.por_pagina + 1}–
                  {Math.min(filtros.pagina * filtros.por_pagina, total)} de{' '}
                  {total}
                </span>

                {/* Controles */}
                <div className='flex items-center gap-2'>
                  {/* Por página */}
                  <div className='flex items-center gap-1.5'>
                    <span className='text-xs text-[#334155]'>por pág.</span>
                    <select
                      value={filtros.por_pagina}
                      onChange={(e) => {
                        setFiltro('por_pagina', Number(e.target.value));
                        setFiltro('pagina', 1);
                      }}
                      className='px-2 py-1 bg-slate-950/80 border border-slate-400/10 rounded-md text-slate-500 text-xs font-mono outline-none cursor-pointer'
                    >
                      {POR_PAGINA_OPCIONES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Páginas */}
                  <div className='flex gap-1 items-center'>
                    <BtnPag
                      onClick={() => setFiltro('pagina', filtros.pagina - 1)}
                      disabled={filtros.pagina <= 1}
                    >
                      <svg
                        width='12'
                        height='12'
                        viewBox='0 0 12 12'
                        fill='none'
                      >
                        <path
                          d='M8 10L4 6L8 2'
                          stroke='currentColor'
                          strokeWidth='1.4'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        />
                      </svg>
                    </BtnPag>

                    {Array.from(
                      { length: Math.min(totalPaginas, 5) },
                      (_, i) => {
                        let p = i + 1;
                        if (totalPaginas > 5) {
                          if (filtros.pagina <= 3) p = i + 1;
                          else if (filtros.pagina >= totalPaginas - 2)
                            p = totalPaginas - 4 + i;
                          else p = filtros.pagina - 2 + i;
                        }
                        return (
                          <BtnPag
                            key={p}
                            onClick={() => setFiltro('pagina', p)}
                            active={p === filtros.pagina}
                          >
                            {p}
                          </BtnPag>
                        );
                      },
                    )}

                    <BtnPag
                      onClick={() => setFiltro('pagina', filtros.pagina + 1)}
                      disabled={filtros.pagina >= totalPaginas}
                    >
                      <svg
                        width='12'
                        height='12'
                        viewBox='0 0 12 12'
                        fill='none'
                      >
                        <path
                          d='M4 2L8 6L4 10'
                          stroke='currentColor'
                          strokeWidth='1.4'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        />
                      </svg>
                    </BtnPag>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal confirmación ── */}
      {accionPending && (
        <ModalConfirmacion
          accion={accionPending}
          loading={accionLoading}
          onConfirmar={handleConfirmarAccion}
          onCancelar={() => setAccionPending(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <ToastNotificacion
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

// ─── Helpers de tabla ─────────────────────────────────────────────────────────

function MenuOpcion({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`flex items-center gap-2 w-full px-[10px] py-[7px] rounded-[7px] border-none text-xs cursor-pointer text-left transition-all ${danger ? 'text-red-400' : 'text-slate-400'} ${hovered ? (danger ? 'bg-red-400/[0.08]' : 'bg-slate-400/[0.06]') : 'bg-transparent'}`}
    >
      <span className='flex items-center text-[13px]'>{icon}</span>
      {label}
    </button>
  );
}

function BtnPag({
  onClick,
  disabled = false,
  active = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center w-7 h-7 rounded-md text-xs font-mono transition-all border ${active ? 'border-amber-500/40 bg-amber-500/10 text-amber-500' : 'border-slate-400/10 bg-transparent'} ${!active && (disabled ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 cursor-pointer')}`}
    >
      {children}
    </button>
  );
}
