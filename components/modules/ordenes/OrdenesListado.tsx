'use client';

// ============================================================
// components/modules/ordenes/OrdenesListado.tsx
// Listado de órdenes de servicio: KPIs, filtros, tabla con
// avance inline, cambio de estado y acciones.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useRef,
  type ReactNode,
} from 'react';
import type { EstadoOrden, OrdenServicio } from '@/types';
import {
  obtenerOrdenes,
  obtenerKPIsOrdenes,
  cambiarEstadoOrden,
  actualizarAvance,
} from '@/app/actions/ordenes';
import {
  getMockOrdenes,
  getMockOrdenesKPIs,
  shouldUsePlatformMocks,
  updateMockOrderStatus,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type OrdenRow = OrdenServicio & {
  razon_social: string;
  numero_presupuesto: string | null;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<
  EstadoOrden,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.15)',
    icon: '⏳',
  },
  EN_PROGRESO: {
    label: 'En Progreso',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
    icon: '⚙️',
  },
  COMPLETADA: {
    label: 'Completada',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
    icon: '✅',
  },
  CANCELADA: {
    label: 'Cancelada',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
    icon: '❌',
  },
  SUSPENDIDA: {
    label: 'Suspendida',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    icon: '⏸',
  },
};

const TRANSICIONES: Partial<Record<EstadoOrden, EstadoOrden[]>> = {
  PENDIENTE: ['EN_PROGRESO', 'CANCELADA'],
  EN_PROGRESO: ['COMPLETADA', 'SUSPENDIDA', 'CANCELADA'],
  SUSPENDIDA: ['EN_PROGRESO', 'CANCELADA'],
  COMPLETADA: [],
  CANCELADA: ['PENDIENTE'],
};

const ESTADOS_FILTRO: { value: EstadoOrden | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'PENDIENTE', label: 'Pendientes' },
  { value: 'EN_PROGRESO', label: 'En progreso' },
  { value: 'COMPLETADA', label: 'Completadas' },
  { value: 'SUSPENDIDA', label: 'Suspendidas' },
  { value: 'CANCELADA', label: 'Canceladas' },
];

const POR_PAGINA_OPS = [10, 20, 50];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtFecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—';

const diasRestantes = (fin: string | null): number | null => {
  if (!fin) return null;
  const diff = new Date(fin).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
};

// ─── Clases Tailwind ──────────────────────────────────────────────────────────

const cardClass =
  'bg-slate-900/70 border border-slate-400/10 rounded-lg backdrop-blur-xl';
const inputClass =
  'px-3 py-2 bg-slate-950/60 border border-slate-700/10 rounded-lg text-slate-200 text-xs font-mono outline-none transition-colors';

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Skeleton({
  w = '100%',
  h = '13px',
  r = '4px',
}: {
  w?: string;
  h?: string;
  r?: string;
}) {
  return (
    <div
      className='bg-slate-700/10 animate-pulse'
      style={{ width: w, height: h, borderRadius: r }}
    />
  );
}

function KPICard({
  label,
  value,
  sub,
  color = '#94a3b8',
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div className={cardClass + ' p-4 flex flex-col gap-1.5'}>
      <span className='text-[10px] font-semibold tracking-widest uppercase text-slate-700'>
        {label}
      </span>
      {loading ? (
        <Skeleton w='60px' h='22px' />
      ) : (
        <span
          className='text-xl font-black font-mono tracking-tighter block'
          style={{ color }}
        >
          {value}
        </span>
      )}
      {sub && !loading && (
        <span className='text-xs text-slate-700 mt-0.5 block'>{sub}</span>
      )}
    </div>
  );
}

function BadgeEstado({ estado }: { estado: EstadoOrden }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span
      className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider whitespace-nowrap'
      style={{
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span
        className='w-1 h-1 rounded-full inline-block'
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  );
}

function BarraAvance({ pct, color }: { pct: number; color: string }) {
  return (
    <div className='flex items-center gap-1.5 min-w-[90px]'>
      <div className='flex-1 h-1 bg-slate-700/20 rounded overflow-hidden'>
        <div
          className='h-full rounded transition-all duration-400'
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span
        className='text-[10px] font-bold font-mono min-w-[26px] text-right'
        style={{ color }}
      >
        {pct}%
      </span>
    </div>
  );
}

function MenuEstado({
  orden,
  onCambio,
  loading,
}: {
  orden: OrdenRow;
  onCambio: (id: string, est: EstadoOrden) => void;
  loading: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trans = TRANSICIONES[orden.estado] ?? [];

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  if (trans.length === 0) return <BadgeEstado estado={orden.estado} />;

  return (
    <div ref={ref} className='relative'>
      <button
        onClick={() => setAbierto((p) => !p)}
        disabled={loading}
        className='flex items-center gap-1 bg-transparent border-none p-0 transition-opacity'
        style={{
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.6 : 1,
        }}
      >
        <BadgeEstado estado={orden.estado} />
        <svg
          width='9'
          height='9'
          viewBox='0 0 9 9'
          fill='none'
          className='text-slate-600'
        >
          <path
            d='M1.5 3L4.5 6L7.5 3'
            stroke='currentColor'
            strokeWidth='1.2'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </button>
      {abierto && (
        <div
          className='absolute left-0 top-[calc(100%_+_4px)] z-30 bg-slate-950 border border-slate-700/20 rounded-2xl p-1 min-w-[170px] shadow-2xl animate-in scale-95'
          style={{ animation: 'scaleIn 0.12s ease' }}
        >
          {trans.map((est) => {
            const cfg = ESTADO_CFG[est];
            return (
              <button
                key={est}
                onClick={() => {
                  setAbierto(false);
                  onCambio(orden.id, est);
                }}
                className='flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md border-none bg-transparent cursor-pointer font-sans text-xs text-left transition-colors'
                style={{ color: cfg.color }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(148,163,184,0.06)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'transparent')
                }
              >
                <span>{cfg.icon}</span>
                <span>→ {cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MenuAcciones({ orden }: { orden: OrdenRow }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} className='relative'>
      <button
        onClick={() => setAbierto((p) => !p)}
        className='w-7 h-7 rounded-lg border border-slate-700/10 bg-transparent text-slate-600 cursor-pointer flex items-center justify-center transition-all'
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(148,163,184,0.06)';
          e.currentTarget.style.color = '#94a3b8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#475569';
        }}
      >
        <svg width='13' height='13' viewBox='0 0 13 13'>
          <circle cx='6.5' cy='2.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='6.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='10.5' r='1' fill='currentColor' />
        </svg>
      </button>
      {abierto && (
        <div
          className='absolute right-0 top-[calc(100%_+_4px)] z-30 bg-slate-950 border border-slate-700/20 rounded-2xl p-1 min-w-[180px] shadow-2xl animate-in scale-95'
          style={{ animation: 'scaleIn 0.12s ease' }}
        >
          {[
            { href: `/ordenes/${orden.id}`, label: 'Ver detalle', icon: '👁' },
            {
              href: `/ordenes/${orden.id}/editar`,
              label: 'Editar',
              icon: '✏️',
            },
            {
              href: `/clientes/${orden.cliente_id}`,
              label: 'Ver cliente',
              icon: '👤',
            },
            ...(orden.presupuesto_id
              ? [
                  {
                    href: `/presupuestos/${orden.presupuesto_id}`,
                    label: 'Ver presupuesto',
                    icon: '📄',
                  },
                ]
              : []),
          ].map(({ href, label, icon }) => (
            <a
              key={href}
              href={href}
              onClick={() => setAbierto(false)}
              className='flex items-center gap-2 px-2.5 py-1.5 rounded-md no-underline text-xs text-slate-400 transition-colors'
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(148,163,184,0.06)';
                e.currentTarget.style.color = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = '#94a3b8';
              }}
            >
              <span className='text-[11px]'>{icon}</span>
              {label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Toast({
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
  const bgColor =
    tipo === 'ok' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)';
  const textColor = tipo === 'ok' ? '#4ade80' : '#f87171';
  const icon = tipo === 'ok' ? '✓' : '✕';
  return (
    <div
      className='fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4.5 py-3 rounded-lg bg-slate-950/95 border backdrop-blur-3xl shadow-2xl animate-in slide-up'
      style={{
        borderColor: bgColor,
        animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <span className='text-xs font-semibold' style={{ color: textColor }}>
        {icon}
      </span>
      <span className='text-xs font-sans' style={{ color: textColor }}>
        {mensaje}
      </span>
    </div>
  );
}

function BtnPag({
  children,
  onClick,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const borderClass = active ? 'border-amber-500/40' : 'border-slate-700/10';
  const bgClass = active ? 'bg-amber-500/10' : 'bg-transparent';
  const textColor = active ? '#f59e0b' : disabled ? '#1e293b' : '#475569';
  const fontWeight = active ? 700 : 400;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-7 h-7 px-1.5 rounded-xl border font-mono text-xs transition-all ${borderClass} ${bgClass}`}
      style={{
        color: textColor,
        fontWeight,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OrdenesListado() {
  const [rows, setRows] = useState<OrdenRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPags, setTotalPags] = useState(1);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<{
    total: number;
    pendientes: number;
    en_progreso: number;
    completadas_mes: number;
    tasa_completadas: number;
  } | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoOrden | ''>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    mensaje: string;
    tipo: 'ok' | 'error';
  } | null>(null);

  const busquedaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────

  const cargar = useCallback(() => {
    startTransition(async () => {
      setLoading(true);
      if (shouldUsePlatformMocks) {
        const data = getMockOrdenes({
          busqueda: busqueda || undefined,
          estado: estado || undefined,
          fecha_desde: fechaDesde || undefined,
          fecha_hasta: fechaHasta || undefined,
          pagina,
          por_pagina: porPagina,
        });
        setRows(data.data);
        setTotal(data.total);
        setTotalPags(data.total_paginas);
        setLoading(false);
        return;
      }
      const res = await obtenerOrdenes({
        busqueda: busqueda || undefined,
        estado: estado || undefined,
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        pagina,
        por_pagina: porPagina,
      });
      setLoading(false);
      if (res.data) {
        setRows(res.data.data);
        setTotal(res.data.total);
        setTotalPags(res.data.total_paginas);
      }
    });
  }, [busqueda, estado, fechaDesde, fechaHasta, pagina, porPagina]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    if (shouldUsePlatformMocks) {
      setKpis(getMockOrdenesKPIs());
      setLoadingKpis(false);
      return;
    }
    obtenerKPIsOrdenes().then((res) => {
      if (res.data) setKpis(res.data);
      setLoadingKpis(false);
    });
  }, []);

  const handleBusqueda = (v: string) => {
    setBusqueda(v);
    if (busquedaTimer.current) clearTimeout(busquedaTimer.current);
    busquedaTimer.current = setTimeout(() => setPagina(1), 350);
  };

  const hayFiltros = !!(estado || fechaDesde || fechaHasta);

  const limpiarFiltros = () => {
    setEstado('');
    setFechaDesde('');
    setFechaHasta('');
    setPagina(1);
  };

  // ── Acciones inline ────────────────────────────────────────

  const setLoadingId = (id: string, on: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  };
  const showToast = (mensaje: string, tipo: 'ok' | 'error') =>
    setToast({ mensaje, tipo });

  const handleCambioEstado = async (id: string, nuevoEstado: EstadoOrden) => {
    if (shouldUsePlatformMocks) {
      setRows((prev) => {
        const next = updateMockOrderStatus(prev, id, nuevoEstado);
        const totalOrdenes = next.length;
        const pendientes = next.filter(
          (row) => row.estado === 'PENDIENTE',
        ).length;
        const enProgreso = next.filter(
          (row) => row.estado === 'EN_PROGRESO',
        ).length;
        const completadas = next.filter(
          (row) => row.estado === 'COMPLETADA',
        ).length;
        setKpis({
          total: totalOrdenes,
          pendientes,
          en_progreso: enProgreso,
          completadas_mes: completadas,
          tasa_completadas:
            totalOrdenes > 0
              ? Math.round((completadas / totalOrdenes) * 100)
              : 0,
        });
        return next;
      });
      showToast('Estado actualizado en modo mock', 'ok');
      return;
    }
    setLoadingId(id, true);
    const res = await cambiarEstadoOrden(id, nuevoEstado);
    setLoadingId(id, false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Estado actualizado', 'ok');
    cargar();
    obtenerKPIsOrdenes().then((r) => {
      if (r.data) setKpis(r.data);
    });
  };

  // ── Paginación ─────────────────────────────────────────────

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  const ventanaPags = () => {
    const arr: number[] = [];
    const ini = Math.max(1, pagina - 2);
    const fin = Math.min(totalPags, ini + 4);
    for (let i = ini; i <= fin; i++) arr.push(i);
    return arr;
  };

  const esqueletos = Array.from({ length: 7 });

  // ── Render ─────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box}body{margin:0;background:#060d1a;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        option{background:#0f172a;color:#e2e8f0}input:focus,select:focus{outline:none!important}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}@keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes scaleIn{from{transform:scale(0.96);opacity:0}to{transform:scale(1);opacity:1}}
        table{border-collapse:collapse;width:100%}tr:hover td{background:rgba(148,163,184,0.02)!important}
        .table-wrapper{overflow-x:auto}
      `}</style>

      <div
        className='min-h-screen bg-slate-950 px-3 py-4 pb-14 sm:px-5 sm:py-6 sm:pb-16 lg:px-7 lg:py-3 lg:pb-6'
        style={{
          backgroundImage:
            'radial-gradient(ellipse 100% 50% at 5% 0%,rgba(96,165,250,0.03),transparent 55%)',
        }}
      >
        <div className='mx-auto max-w-6xl min-w-0'>
          {/* Header */}
          <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between lg:mb-3'>
            <div>
              <div className='flex items-center gap-2 mb-1'>
                <span className='text-[11px] text-slate-500 tracking-widest uppercase'>
                  Hexa Gestión
                </span>
                <span className='text-slate-800'>›</span>
                <span className='text-[11px] text-slate-600 tracking-widest uppercase'>
                  Órdenes de Servicio
                </span>
              </div>
              <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
                <h1 className='m-0 text-[32px] leading-none font-bold tracking-tight text-slate-100 max-[780px]:text-[22px]'>
                  Órdenes de Servicio
                </h1>
                {!loading && (
                  <span className='text-[11px] text-slate-500 font-mono bg-slate-700/10 border border-slate-700/10 rounded-2xl px-2.5 py-0.5'>
                    {total}
                  </span>
                )}
              </div>
            </div>
            <a
              href='/ordenes/nueva'
              className='inline-flex w-full items-center justify-center gap-1.75 rounded-[9px] bg-gradient-to-br from-blue-600/80 to-blue-700/80 px-4 py-2.5 text-sm font-bold text-white no-underline shadow-lg shadow-blue-600/15 transition-all duration-120 hover:from-blue-600 hover:to-blue-700 sm:w-auto'
            >
              <svg width='11' height='11' viewBox='0 0 11 11'>
                <path
                  d='M5.5 1V10M1 5.5H10'
                  stroke='currentColor'
                  strokeWidth='1.8'
                  strokeLinecap='round'
                />
              </svg>
              Nueva orden
            </a>
          </div>

          {/* KPIs */}
          <div className='mb-4 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 xl:grid-cols-4 lg:mb-3'>
            <KPICard
              label='Total activas'
              value={kpis ? String(kpis.pendientes + kpis.en_progreso) : '—'}
              sub='pendientes + en progreso'
              color='#60a5fa'
              loading={loadingKpis}
            />
            <KPICard
              label='En progreso'
              value={kpis ? String(kpis.en_progreso) : '—'}
              color='#f59e0b'
              loading={loadingKpis}
            />
            <KPICard
              label='Completadas este mes'
              value={kpis ? String(kpis.completadas_mes) : '—'}
              color='#4ade80'
              loading={loadingKpis}
            />
            <KPICard
              label='Tasa de cierre'
              value={kpis ? `${kpis.tasa_completadas}%` : '—'}
              sub={`de ${kpis?.total ?? '...'} órdenes totales`}
              color='#a78bfa'
              loading={loadingKpis}
            />
          </div>

          {/* Filtros */}
          <div
            className={`${cardClass} mb-3 px-3 py-3 sm:p-4 lg:px-3.5 lg:py-3`}
          >
            <div
              suppressHydrationWarning
              className='flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center'
            >
              {/* Búsqueda */}
              <div className='relative w-full min-w-0 flex-1 sm:min-w-[220px]'>
                <svg
                  width='13'
                  height='13'
                  viewBox='0 0 13 13'
                  fill='none'
                  className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none'
                >
                  <circle
                    cx='5.5'
                    cy='5.5'
                    r='4'
                    stroke='currentColor'
                    strokeWidth='1.3'
                  />
                  <path
                    d='M9 9L11.5 11.5'
                    stroke='currentColor'
                    strokeWidth='1.3'
                    strokeLinecap='round'
                  />
                </svg>
                <input
                  value={busqueda}
                  onChange={(e) => handleBusqueda(e.target.value)}
                  placeholder='Buscar por número, título, cliente...'
                  className={`${inputClass} w-full pl-8 transition-colors`}
                  style={{ paddingRight: busqueda ? '30px' : '12px' }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(96,165,250,0.35)')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(148,163,184,0.1)')
                  }
                />
                {busqueda && (
                  <button
                    onClick={() => {
                      setBusqueda('');
                      setPagina(1);
                    }}
                    className='absolute right-2.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-500 cursor-pointer p-0.5 flex items-center'
                  >
                    <svg width='11' height='11' viewBox='0 0 11 11'>
                      <path
                        d='M1 1L10 10M10 1L1 10'
                        stroke='currentColor'
                        strokeWidth='1.4'
                        strokeLinecap='round'
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Chips de estado */}
              <div className='flex w-full flex-wrap gap-1 sm:w-auto'>
                {ESTADOS_FILTRO.map((f) => {
                  const cfg = f.value ? ESTADO_CFG[f.value] : null;
                  const isActive = estado === f.value;
                  return (
                    <button
                      key={f.value}
                      onClick={() => {
                        setEstado(f.value as EstadoOrden | '');
                        setPagina(1);
                      }}
                      className='px-3 py-1.5 rounded-lg cursor-pointer transition-all text-[11px] font-semibold whitespace-nowrap'
                      style={{
                        border: isActive
                          ? `1px solid ${cfg?.border ?? 'rgba(96,165,250,0.3)'}`
                          : '1px solid rgba(148,163,184,0.1)',
                        background: isActive
                          ? (cfg?.bg ?? 'rgba(96,165,250,0.07)')
                          : 'transparent',
                        color: isActive ? (cfg?.color ?? '#60a5fa') : '#475569',
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Toggle filtros avanzados */}
              <button
                onClick={() => setFiltrosAbiertos((p) => !p)}
                className='flex items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-[11px] font-semibold'
                style={{
                  border: filtrosAbiertos
                    ? '1px solid rgba(96,165,250,0.3)'
                    : '1px solid rgba(148,163,184,0.1)',
                  background: filtrosAbiertos
                    ? 'rgba(96,165,250,0.06)'
                    : 'transparent',
                  color: filtrosAbiertos ? '#60a5fa' : '#475569',
                }}
              >
                <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                  <path
                    d='M1 3H11M3 6H9M5 9H7'
                    stroke='currentColor'
                    strokeWidth='1.3'
                    strokeLinecap='round'
                  />
                </svg>
                Fechas
                {hayFiltros && (
                  <span className='w-1 h-1 rounded-full bg-blue-400' />
                )}
              </button>

              {hayFiltros && (
                <button
                  onClick={limpiarFiltros}
                  className='text-[11px] text-slate-600 bg-transparent border-none cursor-pointer underline'
                >
                  Limpiar
                </button>
              )}
            </div>

            {filtrosAbiertos && (
              <div
                className='mt-3 flex flex-wrap gap-3 border-t border-slate-700/10 pt-3 animate-in fade-in'
                style={{ animation: 'fadeIn 0.15s ease' }}
              >
                {[
                  { label: 'Desde', value: fechaDesde, set: setFechaDesde },
                  { label: 'Hasta', value: fechaHasta, set: setFechaHasta },
                ].map(({ label, value, set }) => (
                  <div
                    key={label}
                    className='flex flex-col gap-1 min-w-[140px]'
                  >
                    <label className='text-[10px] font-semibold tracking-widest uppercase text-slate-500'>
                      {label}
                    </label>
                    <input
                      type='date'
                      value={value}
                      onChange={(e) => {
                        set(e.target.value);
                        setPagina(1);
                      }}
                      className={inputClass}
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className='table-wrapper overflow-x-auto'>
              <table className='min-w-full'>
                <thead>
                  <tr className='border-b border-slate-700/10'>
                    {[
                      { label: 'Número', w: '90px', col: 'numero' },
                      { label: 'Cliente', w: 'auto', col: 'cliente' },
                      { label: 'Título', w: 'auto', col: 'titulo' },
                      { label: 'Ppto.', w: '90px', col: 'ppto' },
                      { label: 'Inicio', w: '75px', col: 'inicio' },
                      { label: 'Fin est.', w: '80px', col: 'fin' },
                      { label: 'Avance', w: '120px', col: 'avance' },
                      { label: 'Estado', w: '130px', col: 'estado' },
                      { label: '', w: '36px', col: 'acciones' },
                    ].map((col) => (
                      <th
                        key={col.label}
                        data-col={col.col}
                        className={`px-3.5 py-3 text-left text-[10px] font-bold tracking-widest uppercase text-slate-500 whitespace-nowrap bg-slate-900/30 max-[780px]:px-1 max-[780px]:py-1 max-[780px]:text-[10px] ${col.col === 'titulo' || col.col === 'ppto' || col.col === 'inicio' || col.col === 'fin' ? 'max-[780px]:hidden' : ''} ${col.col === 'cliente' ? 'max-[780px]:max-w-[55px] max-[780px]:text-[9px]' : ''} ${col.col === 'avance' ? 'max-[780px]:text-[9px]' : ''} ${col.col === 'acciones' ? 'max-[780px]:px-[2px]' : ''}`}
                        style={{ width: col.w }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    esqueletos.map((_, i) => (
                      <tr
                        key={i}
                        className='border-b border-slate-700/5 hover:bg-slate-800/2'
                      >
                        {[80, 160, 200, 80, 60, 60, 100, 110, 28].map(
                          (w, j) => (
                            <td key={j} className='px-3.5 py-3'>
                              <Skeleton w={`${w}px`} />
                            </td>
                          ),
                        )}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className='px-6 py-12 text-center'>
                        <div className='flex flex-col items-center gap-2.5'>
                          <span className='text-4xl opacity-40'>⚙️</span>
                          <span className='text-xs text-slate-500'>
                            {busqueda || hayFiltros
                              ? 'Sin resultados para los filtros aplicados'
                              : 'No hay órdenes de servicio aún'}
                          </span>
                          {!busqueda && !hayFiltros && (
                            <a
                              href='/ordenes/nueva'
                              className='text-[11px] text-blue-400 no-underline flex items-center gap-1 mt-1'
                            >
                              <svg width='10' height='10' viewBox='0 0 10 10'>
                                <path
                                  d='M5 1V9M1 5H9'
                                  stroke='currentColor'
                                  strokeWidth='1.6'
                                  strokeLinecap='round'
                                />
                              </svg>
                              Crear primera orden
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const idLoading = loadingIds.has(row.id);
                      const dias = diasRestantes(row.fecha_fin_estimada);
                      const vencida =
                        dias !== null &&
                        dias < 0 &&
                        row.estado === 'EN_PROGRESO';
                      const cfg = ESTADO_CFG[row.estado];
                      const avanceColor =
                        row.porcentaje_avance === 100
                          ? '#4ade80'
                          : row.porcentaje_avance >= 50
                            ? '#60a5fa'
                            : '#f59e0b';
                      return (
                        <tr
                          key={row.id}
                          className='border-b border-slate-700/5 transition-colors hover:bg-slate-800/2'
                        >
                          {/* Número */}
                          <td
                            data-col='numero'
                            className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <a
                              href={`/ordenes/${row.id}`}
                              className='text-xs font-bold text-blue-400 font-mono no-underline tracking-wide max-[780px]:text-[10px]'
                            >
                              {row.numero}
                            </a>
                          </td>

                          {/* Cliente */}
                          <td
                            data-col='cliente'
                            className='px-3.5 py-3 max-w-44 max-[780px]:max-w-[55px] max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <div
                              className='text-xs text-slate-400 truncate max-[780px]:max-w-[50px] max-[780px]:text-[9px]'
                              title={row.razon_social}
                            >
                              {row.razon_social}
                            </div>
                          </td>

                          {/* Título */}
                          <td
                            data-col='titulo'
                            className='px-3.5 py-3 max-w-52 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <span
                              className='text-xs text-slate-600 truncate block max-[780px]:text-[9px]'
                              title={row.titulo}
                            >
                              {row.titulo}
                            </span>
                          </td>

                          {/* Presupuesto */}
                          <td
                            data-col='ppto'
                            className='px-3.5 py-3 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            {row.numero_presupuesto ? (
                              <a
                                href={`/presupuestos/${row.presupuesto_id}`}
                                className='text-[11px] text-slate-600 font-mono no-underline max-[780px]:text-[8px] hover:text-amber-500 transition-colors'
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.color = '#f59e0b')
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.color = '#475569')
                                }
                              >
                                {row.numero_presupuesto}
                              </a>
                            ) : (
                              <span className='text-[11px] text-slate-900 max-[780px]:text-[8px]'>
                                —
                              </span>
                            )}
                          </td>

                          {/* Inicio */}
                          <td
                            data-col='inicio'
                            className='px-3.5 py-3 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <span className='text-[11px] text-slate-600 font-mono max-[780px]:text-[8px]'>
                              {fmtFecha(row.fecha_inicio)}
                            </span>
                          </td>

                          {/* Fin estimada */}
                          <td
                            data-col='fin'
                            className='px-3.5 py-3 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <div>
                              <span
                                className='text-[11px] font-mono max-[780px]:text-[8px]'
                                style={{
                                  color: vencida ? '#f87171' : '#334155',
                                }}
                              >
                                {fmtFecha(row.fecha_fin_estimada)}
                              </span>
                              {dias !== null &&
                                row.estado === 'EN_PROGRESO' && (
                                  <div
                                    className='text-[9px] mt-0.5 max-[780px]:hidden'
                                    style={{
                                      color: vencida
                                        ? '#f87171'
                                        : dias <= 3
                                          ? '#f59e0b'
                                          : '#334155',
                                    }}
                                  >
                                    {vencida
                                      ? `${Math.abs(dias)}d vencida`
                                      : `${dias}d restantes`}
                                  </div>
                                )}
                            </div>
                          </td>

                          {/* Avance */}
                          <td
                            data-col='avance'
                            className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1 max-[780px]:text-[9px]'
                          >
                            <BarraAvance
                              pct={row.porcentaje_avance}
                              color={avanceColor}
                            />
                          </td>

                          {/* Estado */}
                          <td
                            data-col='estado'
                            className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <MenuEstado
                              orden={row}
                              onCambio={handleCambioEstado}
                              loading={idLoading}
                            />
                          </td>

                          {/* Acciones */}
                          <td
                            data-col='acciones'
                            className='px-2 py-3 text-right max-[780px]:px-[2px] max-[780px]:py-1'
                          >
                            <MenuAcciones orden={row} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {!loading && total > 0 && (
              <div className='flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/10 px-4 py-2.5 lg:py-2'>
                <span className='text-[11px] text-slate-500 font-mono'>
                  {desde}–{hasta} de {total}
                </span>
                <div className='flex items-center gap-1'>
                  <BtnPag onClick={() => setPagina(1)} disabled={pagina === 1}>
                    «
                  </BtnPag>
                  <BtnPag
                    onClick={() => setPagina((p) => p - 1)}
                    disabled={pagina === 1}
                  >
                    ‹
                  </BtnPag>
                  {ventanaPags().map((p) => (
                    <BtnPag
                      key={p}
                      onClick={() => setPagina(p)}
                      active={p === pagina}
                    >
                      {String(p)}
                    </BtnPag>
                  ))}
                  <BtnPag
                    onClick={() => setPagina((p) => p + 1)}
                    disabled={pagina === totalPags}
                  >
                    ›
                  </BtnPag>
                  <BtnPag
                    onClick={() => setPagina(totalPags)}
                    disabled={pagina === totalPags}
                  >
                    »
                  </BtnPag>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='text-[11px] text-slate-500'>Filas:</span>
                  <div className='relative'>
                    <select
                      value={porPagina}
                      onChange={(e) => {
                        setPorPagina(Number(e.target.value));
                        setPagina(1);
                      }}
                      className={`${inputClass} px-2 py-1 text-xs appearance-none cursor-pointer pr-6`}
                    >
                      {POR_PAGINA_OPS.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <svg
                      width='8'
                      height='8'
                      viewBox='0 0 8 8'
                      fill='none'
                      className='absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
                    >
                      <path
                        d='M1 3L4 6L7 3'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
