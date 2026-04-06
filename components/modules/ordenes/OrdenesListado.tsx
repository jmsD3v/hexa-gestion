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
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Settings,
  CheckCircle2,
  XCircle,
  Pencil,
  User,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
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
  { label: string; badge: string; text: string; dot: string; icon: ReactNode }
> = {
  PENDIENTE:   { label: 'Pendiente',   badge: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/15',  text: 'text-slate-400',  dot: 'bg-slate-400',  icon: <span className="text-[10px]">⏳</span> },
  EN_PROGRESO: { label: 'En Progreso', badge: 'text-blue-400 bg-blue-400/[0.08] border-blue-400/20',     text: 'text-blue-400',   dot: 'bg-blue-400',   icon: <Settings className="w-3 h-3" /> },
  COMPLETADA:  { label: 'Completada',  badge: 'text-green-400 bg-green-400/[0.08] border-green-400/20',  text: 'text-green-400',  dot: 'bg-green-400',  icon: <CheckCircle2 className="w-3 h-3" /> },
  CANCELADA:   { label: 'Cancelada',   badge: 'text-red-400 bg-red-400/[0.08] border-red-400/20',        text: 'text-red-400',    dot: 'bg-red-400',    icon: <XCircle className="w-3 h-3" /> },
  SUSPENDIDA:  { label: 'Suspendida',  badge: 'text-amber-500 bg-amber-500/[0.08] border-amber-500/20',  text: 'text-amber-500',  dot: 'bg-amber-500',  icon: <span className="text-[10px]">⏸</span> },
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
      className='bg-slate-700/10 animate-pulse w-[var(--sk-w)] h-[var(--sk-h)] rounded-[var(--sk-r)]'
      style={
        {
          '--sk-w': w,
          '--sk-h': h,
          '--sk-r': r,
        } as React.CSSProperties
      }
    />
  );
}

function KPICard({
  label,
  value,
  sub,
  textCls = 'text-slate-400',
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  textCls?: string;
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
        <span className={`text-xl font-black font-mono tracking-tighter block ${textCls}`}>
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider whitespace-nowrap border ${cfg.badge}`}>
      <span className={`w-1 h-1 rounded-full inline-block ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function BarraAvance({ pct, barCls, textCls }: { pct: number; barCls: string; textCls: string }) {
  return (
    <div className='flex items-center gap-1.5 min-w-[90px]'>
      <div className='flex-1 h-1 bg-slate-700/20 rounded overflow-hidden'>
        <div
          className={`h-full rounded transition-all duration-400 w-[var(--bar-w)] ${barCls}`}
          style={{ '--bar-w': `${pct}%` } as React.CSSProperties}
        />
      </div>
      <span className={`text-[10px] font-bold font-mono min-w-[26px] text-right ${textCls}`}>
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
        className={`flex items-center gap-1 bg-transparent border-none p-0 transition-opacity ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
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
          className='absolute left-0 top-[calc(100%_+_4px)] z-30 bg-slate-950 border border-slate-700/20 rounded-2xl p-1 min-w-[170px] shadow-2xl animate-modal-in'
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
                className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md border-none bg-transparent cursor-pointer font-sans text-xs text-left transition-colors hover:bg-slate-400/[0.06] ${cfg.text}`}
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
        className='w-7 h-7 rounded-lg border border-slate-700/10 bg-transparent text-slate-600 cursor-pointer flex items-center justify-center transition-all hover:bg-slate-400/[0.06] hover:text-slate-400'
      >
        <svg width='13' height='13' viewBox='0 0 13 13'>
          <circle cx='6.5' cy='2.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='6.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='10.5' r='1' fill='currentColor' />
        </svg>
      </button>
      {abierto && (
        <div
          className='absolute right-0 top-[calc(100%_+_4px)] z-30 bg-slate-950 border border-slate-700/20 rounded-2xl p-1 min-w-[180px] shadow-2xl animate-modal-in'
        >
          {([
            { href: `/ordenes/${orden.id}`, label: 'Ver detalle', icon: <span className="text-[11px]">👁</span> },
            {
              href: `/ordenes/${orden.id}/editar`,
              label: 'Editar',
              icon: <Pencil className="w-3 h-3" />,
            },
            {
              href: `/clientes/${orden.cliente_id}`,
              label: 'Ver cliente',
              icon: <User className="w-3 h-3" />,
            },
            ...(orden.presupuesto_id
              ? [
                  {
                    href: `/presupuestos/${orden.presupuesto_id}`,
                    label: 'Ver presupuesto',
                    icon: <FileText className="w-3 h-3" />,
                  },
                ]
              : []),
          ] as { href: string; label: string; icon: ReactNode }[]).map(({ href, label, icon }) => (
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
              {icon}
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
  const borderCls = tipo === 'ok' ? 'border-green-400/30' : 'border-red-400/30';
  const textCls   = tipo === 'ok' ? 'text-green-400'      : 'text-red-400';
  const icon      = tipo === 'ok' ? '✓'                   : '✕';
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4.5 py-3 rounded-lg bg-slate-950/95 border backdrop-blur-3xl shadow-2xl animate-modal-in ${borderCls}`}>
      <span className={`text-xs font-semibold ${textCls}`}>{icon}</span>
      <span className={`text-xs font-sans ${textCls}`}>{mensaje}</span>
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
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-7 h-7 px-1.5 rounded-xl border font-mono text-xs transition-all ${active ? 'border-amber-500/40 bg-amber-500/10 text-amber-500 font-bold' : 'border-slate-700/10 bg-transparent'} ${!active && (disabled ? 'text-slate-800 cursor-not-allowed' : 'text-slate-500 cursor-pointer')}`}
    >
      {children}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OrdenesListado() {
  const searchParams = useSearchParams();
  const router = useRouter();

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

  const [busqueda, setBusqueda] = useState(() => searchParams.get('q') ?? '');
  const [estado, setEstado] = useState<EstadoOrden | ''>(() => (searchParams.get('estado') as EstadoOrden) ?? '');
  const [fechaDesde, setFechaDesde] = useState(() => searchParams.get('desde') ?? '');
  const [fechaHasta, setFechaHasta] = useState(() => searchParams.get('hasta') ?? '');
  const [pagina, setPagina] = useState(() => Number(searchParams.get('pag') ?? 1));
  const [porPagina, setPorPagina] = useState(20);
  const [ordenPor, setOrdenPor] = useState<'numero' | 'creado_en' | 'fecha_inicio' | 'fecha_fin_estimada'>(() => (searchParams.get('ob') as any) ?? 'creado_en');
  const [ordenDir, setOrdenDir] = useState<'asc' | 'desc'>(() => (searchParams.get('od') as any) ?? 'desc');
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{
    mensaje: string;
    tipo: 'ok' | 'error';
  } | null>(null);

  const busquedaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const actualizarUrl = useCallback((params: Record<string, string>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(params).forEach(([k, v]) => v ? sp.set(k, v) : sp.delete(k));
    router.replace(`?${sp.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const handleSort = (col: typeof ordenPor) => {
    const dir = ordenPor === col && ordenDir === 'desc' ? 'asc' : 'desc';
    setOrdenPor(col);
    setOrdenDir(dir);
    setPagina(1);
    actualizarUrl({ ob: col, od: dir, pag: '' });
  };

  const SortIcon = ({ col }: { col: typeof ordenPor }) => {
    if (ordenPor !== col) return <ArrowUpDown className='w-3 h-3 text-slate-600' />;
    return ordenDir === 'asc'
      ? <ArrowUp className='w-3 h-3 text-blue-400' />
      : <ArrowDown className='w-3 h-3 text-blue-400' />;
  };

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
        orden_por: ordenPor,
        orden_dir: ordenDir,
      });
      setLoading(false);
      if (res.data) {
        setRows(res.data.data);
        setTotal(res.data.total);
        setTotalPags(res.data.total_paginas);
      }
    });
  }, [busqueda, estado, fechaDesde, fechaHasta, pagina, porPagina, ordenPor, ordenDir]);

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
    busquedaTimer.current = setTimeout(() => {
      setPagina(1);
      actualizarUrl({ q: v, pag: '' });
    }, 350);
  };

  const hayFiltros = !!(estado || fechaDesde || fechaHasta);

  const limpiarFiltros = () => {
    setEstado('');
    setFechaDesde('');
    setFechaHasta('');
    setPagina(1);
    actualizarUrl({ estado: '', desde: '', hasta: '', pag: '' });
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
      <div
        className='min-h-screen bg-slate-950 bg-gradient-to-b from-blue-950/5 to-slate-950 px-3 py-5 pb-20 sm:px-5 sm:py-8 lg:px-6'
      >
        <div className='mx-auto max-w-6xl min-w-0'>
          {/* Header */}
          <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between lg:mb-3'>
            <div>
              <div className='flex items-center gap-2 mb-1'>
                <span className='text-[11px] text-slate-500 tracking-widest uppercase'>
                  Hexa Gestión
                </span>
                <span className='text-slate-500'>›</span>
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
              className='inline-flex w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 px-4 py-2.5 text-sm font-bold text-slate-950 no-underline shadow-sm shadow-emerald-600/15 transition-all hover:from-emerald-600 hover:to-emerald-700 sm:w-auto'
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
          <div className='mb-4 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:mb-3'>
            <KPICard
              label='Total activas'
              value={kpis ? String(kpis.pendientes + kpis.en_progreso) : '—'}
              sub='pendientes + en progreso'
              textCls='text-blue-400'
              loading={loadingKpis}
            />
            <KPICard
              label='En progreso'
              value={kpis ? String(kpis.en_progreso) : '—'}
              textCls='text-amber-500'
              loading={loadingKpis}
            />
            <KPICard
              label='Completadas este mes'
              value={kpis ? String(kpis.completadas_mes) : '—'}
              textCls='text-green-400'
              loading={loadingKpis}
            />
            <KPICard
              label='Tasa de cierre'
              value={kpis ? `${kpis.tasa_completadas}%` : '—'}
              sub={`de ${kpis?.total ?? '...'} órdenes totales`}
              textCls='text-violet-400'
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
                  className={`${inputClass} w-full pl-8 transition-colors focus:border-blue-400/35 ${busqueda ? 'pr-[30px]' : 'pr-3'}`}
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
                  const isActive = estado === f.value;
                  const selectedCls = f.value
                    ? ESTADO_CFG[f.value]?.badge
                    : 'text-blue-400 bg-blue-400/[0.07] border-blue-400/30';
                  return (
                    <button
                      key={f.value}
                      onClick={() => {
                        setEstado(f.value as EstadoOrden | '');
                        setPagina(1);
                        actualizarUrl({ estado: f.value, pag: '' });
                      }}
                      className={`px-3 py-1.5 rounded-lg cursor-pointer transition-all text-[11px] font-semibold whitespace-nowrap border ${isActive ? selectedCls : 'border-slate-400/10 bg-transparent text-slate-500'}`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Toggle filtros avanzados */}
              <button
                onClick={() => setFiltrosAbiertos((p) => !p)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg cursor-pointer transition-all text-[11px] font-semibold border ${filtrosAbiertos ? 'border-blue-400/30 bg-blue-400/[0.06] text-blue-400' : 'border-slate-400/10 bg-transparent text-slate-500'}`}
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
                className='mt-3 flex flex-wrap gap-3 border-t border-slate-700/10 pt-3 animate-fade-in'
              >
                {[
                  { label: 'Desde', value: fechaDesde, set: setFechaDesde, key: 'desde' },
                  { label: 'Hasta', value: fechaHasta, set: setFechaHasta, key: 'hasta' },
                ].map(({ label, value, set, key }) => (
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
                        actualizarUrl({ [key]: e.target.value, pag: '' });
                      }}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla */}
          <div className={`${cardClass} overflow-hidden`}>
            <div className='table-wrapper overflow-x-auto'>
              <table className='min-w-full border-collapse'>
                <thead>
                  <tr className='border-b border-slate-700/10'>
                    {[
                      { label: 'Número',   w: '90px',  col: 'numero',  sort: 'numero'           as const },
                      { label: 'Cliente',  w: 'auto',  col: 'cliente', sort: null },
                      { label: 'Título',   w: 'auto',  col: 'titulo',  sort: null },
                      { label: 'Ppto.',    w: '90px',  col: 'ppto',    sort: null },
                      { label: 'Inicio',   w: '75px',  col: 'inicio',  sort: 'fecha_inicio'      as const },
                      { label: 'Fin est.', w: '80px',  col: 'fin',     sort: 'fecha_fin_estimada' as const },
                      { label: 'Avance',   w: '120px', col: 'avance',  sort: null },
                      { label: 'Estado',   w: '130px', col: 'estado',  sort: null },
                      { label: '',         w: '36px',  col: 'acciones',sort: null },
                    ].map((col) => (
                      <th
                        key={col.label || col.col}
                        data-col={col.col}
                        onClick={col.sort ? () => handleSort(col.sort!) : undefined}
                        className={[
                          'px-3.5 py-3 text-left text-[10px] font-bold tracking-widest uppercase text-slate-500 whitespace-nowrap bg-slate-900/30 w-[var(--col-w)]',
                          'max-[780px]:px-1 max-[780px]:py-1 max-[780px]:text-[10px]',
                          col.col === 'titulo' || col.col === 'ppto' || col.col === 'inicio' || col.col === 'fin' ? 'max-[780px]:hidden' : '',
                          col.col === 'cliente' ? 'max-[780px]:max-w-[55px] max-[780px]:text-[9px]' : '',
                          col.col === 'avance' ? 'max-[780px]:text-[9px]' : '',
                          col.col === 'acciones' ? 'max-[780px]:px-[2px]' : '',
                          col.sort ? 'cursor-pointer select-none hover:text-slate-400 transition-colors' : '',
                        ].join(' ')}
                        style={{ '--col-w': col.w } as React.CSSProperties}
                      >
                        {col.sort ? (
                          <span className='inline-flex items-center gap-1'>
                            {col.label}
                            <SortIcon col={col.sort} />
                          </span>
                        ) : col.label}
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
                          <Settings className='w-12 h-12 text-slate-700' />
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
                      const avanceCls =
                        row.porcentaje_avance === 100
                          ? { bar: 'bg-green-400', text: 'text-green-400' }
                          : row.porcentaje_avance >= 50
                            ? { bar: 'bg-blue-400', text: 'text-blue-400' }
                            : { bar: 'bg-amber-500', text: 'text-amber-500' };
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
                              <span className={`text-[11px] font-mono max-[780px]:text-[8px] ${vencida ? 'text-red-400' : 'text-slate-700'}`}>
                                {fmtFecha(row.fecha_fin_estimada)}
                              </span>
                              {dias !== null &&
                                row.estado === 'EN_PROGRESO' && (
                                  <div className={`text-[9px] mt-0.5 max-[780px]:hidden ${vencida ? 'text-red-400' : dias <= 3 ? 'text-amber-500' : 'text-slate-700'}`}>
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
                              barCls={avanceCls.bar}
                              textCls={avanceCls.text}
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
                  <BtnPag onClick={() => { setPagina(1); actualizarUrl({ pag: '1' }); }} disabled={pagina === 1}>
                    «
                  </BtnPag>
                  <BtnPag
                    onClick={() => { setPagina((p) => { const n = p - 1; actualizarUrl({ pag: String(n) }); return n; }); }}
                    disabled={pagina === 1}
                  >
                    ‹
                  </BtnPag>
                  {ventanaPags().map((p) => (
                    <BtnPag
                      key={p}
                      onClick={() => { setPagina(p); actualizarUrl({ pag: String(p) }); }}
                      active={p === pagina}
                    >
                      {String(p)}
                    </BtnPag>
                  ))}
                  <BtnPag
                    onClick={() => { setPagina((p) => { const n = p + 1; actualizarUrl({ pag: String(n) }); return n; }); }}
                    disabled={pagina === totalPags}
                  >
                    ›
                  </BtnPag>
                  <BtnPag
                    onClick={() => { setPagina(totalPags); actualizarUrl({ pag: String(totalPags) }); }}
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
