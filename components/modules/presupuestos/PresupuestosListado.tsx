'use client';

// ============================================================
// components/modules/presupuestos/PresupuestosListado.tsx
// Listado de presupuestos: busqueda, filtros, tabla ordenable,
// cambio de estado inline, duplicar, paginacion.
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
import { Eye, Pencil, FileText, ClipboardList, AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import type { EstadoPresupuesto, TipoOperacion } from '@/types';
import type { Presupuesto } from '@/types';
import {
  obtenerPresupuestos,
  cambiarEstadoPresupuesto,
  aprobarPresupuesto,
  duplicarPresupuesto,
} from '@/app/actions/presupuestos';
import {
  duplicateMockPresupuesto,
  getMockPresupuestos,
  shouldUsePlatformMocks,
  updateMockPresupuestoEstado,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';

// --- Constantes ---------------------------------------------------------------

type PresupuestoRow = Presupuesto & { razon_social: string };

const ESTADO_CFG: Record<
  EstadoPresupuesto,
  { label: string; badge: string; text: string; dot: string }
> = {
  BORRADOR: {
    label: 'Borrador',
    badge: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/15',
    text: 'text-slate-400',
    dot: 'bg-slate-400',
  },
  ENVIADO: {
    label: 'Enviado',
    badge: 'text-blue-400 bg-blue-400/[0.08] border-blue-400/20',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  APROBADO: {
    label: 'Aprobado',
    badge: 'text-green-400 bg-green-400/[0.08] border-green-400/20',
    text: 'text-green-400',
    dot: 'bg-green-400',
  },
  RECHAZADO: {
    label: 'Rechazado',
    badge: 'text-red-400 bg-red-400/[0.08] border-red-400/20',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
  VENCIDO: {
    label: 'Vencido',
    badge: 'text-amber-500 bg-amber-500/[0.08] border-amber-500/20',
    text: 'text-amber-500',
    dot: 'bg-amber-500',
  },
};

const TIPO_CFG: Record<TipoOperacion, { label: string; icon: string }> = {
  SERVICIO: { label: 'Servicio', icon: '🔧' },
  PRODUCTO: { label: 'Producto', icon: '📦' },
  PRODUCTO_SERVICIO: { label: 'Prod. + Serv.', icon: '🔧📦' },
};

const ESTADOS_FILTRO: { value: EstadoPresupuesto | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'VENCIDO', label: 'Vencido' },
];

const TRANSICIONES: Partial<Record<EstadoPresupuesto, EstadoPresupuesto[]>> = {
  BORRADOR: ['ENVIADO', 'APROBADO'],
  ENVIADO: ['APROBADO', 'RECHAZADO', 'BORRADOR'],
  APROBADO: [],
  RECHAZADO: ['BORRADOR'],
  VENCIDO: ['BORRADOR'],
};

const POR_PAGINA_OPS = [10, 20, 50];

// --- Helpers -----------------------------------------------------------------

const fmtFecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
      })
    : '—';

const isVencido = (p: PresupuestoRow) =>
  p.estado === 'ENVIADO' &&
  p.fecha_vencimiento &&
  new Date(p.fecha_vencimiento) < new Date();

const cardClass =
  'bg-slate-950/70 border border-slate-400/10 rounded-xl backdrop-blur-xl';
const inputClass =
  'px-3 py-2 bg-slate-950/60 border border-slate-400/10 rounded-lg text-slate-200 text-xs font-sans outline-none transition-colors';

// --- Subcomponentes -----------------------------------------------------------

function Skeleton({
  w = 'w-full',
  h = 'h-[13px]',
  r = 'rounded',
}: {
  w?: string;
  h?: string;
  r?: string;
}) {
  return (
    <div
      className={`bg-slate-400/10 animate-pulse ${w} ${h} ${r}`}
    />
  );
}

function BadgeEstado({ estado }: { estado: EstadoPresupuesto }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xl text-[10px] font-bold tracking-wide whitespace-nowrap border ${cfg.badge}`}
    >
      <span className={`w-1 h-1 rounded-full inline-block ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function MenuEstado({
  presupuesto,
  onCambio,
  onAprobar,
  loading,
}: {
  presupuesto: PresupuestoRow;
  onCambio: (id: string, estado: EstadoPresupuesto) => void;
  onAprobar: (id: string) => void;
  loading: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const transiciones = TRANSICIONES[presupuesto.estado] ?? [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (transiciones.length === 0)
    return <BadgeEstado estado={presupuesto.estado} />;

  return (
    <div ref={ref} className='relative'>
      <button
        onClick={() => setAbierto((p) => !p)}
        disabled={loading}
        className={`flex items-center gap-1 bg-transparent border-none p-0 transition-opacity ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer opacity-100'}`}
      >
        <BadgeEstado estado={presupuesto.estado} />
        {!loading && (
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
        )}
        {loading && (
          <svg
            width='9'
            height='9'
            viewBox='0 0 9 9'
            className='text-slate-600 [animation:spin_0.8s_linear_infinite]'
          >
            <circle
              cx='4.5'
              cy='4.5'
              r='3'
              stroke='currentColor'
              strokeWidth='1.2'
              fill='none'
              strokeDasharray='9'
              strokeDashoffset='3'
            />
          </svg>
        )}
      </button>
      {abierto && (
        <div className='absolute left-0 top-[calc(100%+4px)] z-30 bg-slate-900 border border-slate-400/15 rounded-[9px] p-1 min-w-[160px] shadow-2xl [animation:scaleIn_0.12s_ease]'>
          {transiciones.map((est) => {
            const cfg = ESTADO_CFG[est];
            const esAprobar = est === 'APROBADO';
            return (
              <button
                key={est}
                onClick={() => {
                  setAbierto(false);
                  esAprobar
                    ? onAprobar(presupuesto.id)
                    : onCambio(presupuesto.id, est);
                }}
                className={`flex items-center gap-2 w-full px-2.5 py-1.75 rounded-md border-none bg-transparent cursor-pointer font-sans text-xs text-left transition-colors hover:bg-slate-400/5 ${cfg.text}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`}
                />
                {esAprobar ? `Aprobar${' -> OS'}` : `Marcar ${cfg.label}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MenuAcciones({
  presupuesto,
  onDuplicar,
  loading,
}: {
  presupuesto: PresupuestoRow;
  onDuplicar: (id: string) => void;
  loading: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className='relative'>
      <button
        onClick={() => setAbierto((p) => !p)}
        className='w-7 h-7 rounded-[7px] border border-slate-400/10 bg-transparent text-slate-600 cursor-pointer flex items-center justify-center transition-all duration-120 hover:bg-slate-400/5 hover:text-slate-400'
      >
        <svg width='13' height='13' viewBox='0 0 13 13'>
          <circle cx='6.5' cy='2.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='6.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='10.5' r='1' fill='currentColor' />
        </svg>
      </button>
      {abierto && (
        <div className='absolute right-0 top-[calc(100%+4px)] z-30 bg-slate-900 border border-slate-400/15 rounded-[9px] p-1 min-w-[180px] shadow-2xl [animation:scaleIn_0.12s_ease]'>
          {[
            {
              href: `/presupuestos/${presupuesto.id}`,
              icon: <Eye className='w-3.5 h-3.5' />,
              label: 'Ver detalle',
            },
            {
              href: `/presupuestos/${presupuesto.id}/editar`,
              icon: <Pencil className='w-3.5 h-3.5' />,
              label: 'Editar',
            },
            {
              href: `/presupuestos/${presupuesto.id}/pdf`,
              icon: <FileText className='w-3.5 h-3.5' />,
              label: 'Ver PDF',
            },
          ].map(({ href, icon, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setAbierto(false)}
              className='flex items-center gap-2 px-2.5 py-1.75 rounded-md no-underline text-xs text-slate-400 font-sans transition-colors hover:bg-slate-400/5 hover:text-slate-100 cursor-pointer'
            >
              {icon}
              {label}
            </a>
          ))}
          <div className='h-px bg-slate-400/10 my-0.75 mx-1.5' />
          <button
            onClick={() => {
              setAbierto(false);
              onDuplicar(presupuesto.id);
            }}
            disabled={loading}
            className={`flex items-center gap-2 w-full px-2.5 py-1.75 rounded-md border-none bg-transparent text-xs text-left font-sans transition-colors ${loading ? 'cursor-not-allowed text-slate-500' : 'cursor-pointer text-slate-400 hover:bg-slate-400/5 hover:text-slate-100'}`}
          >
            <ClipboardList className='w-3.5 h-3.5' />
            {loading ? 'Duplicando...' : 'Duplicar presupuesto'}
          </button>
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

  const colorClass = tipo === 'ok' ? 'text-emerald-400' : 'text-red-400';
  const borderClass =
    tipo === 'ok' ? 'border-emerald-400/30' : 'border-red-400/30';

  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-4.5 py-3 rounded-[10px] bg-slate-900/95 border backdrop-blur-xl shadow-2xl [animation:slideUp_0.25s_cubic-bezier(0.34,1.56,0.64,1)] ${borderClass}`}
    >
      <span className={`text-[13px] font-semibold ${colorClass}`}>
        {tipo === 'ok' ? '✓' : '✕'}
      </span>
      <span className={`text-[13px] font-sans ${colorClass}`}>{mensaje}</span>
    </div>
  );
}

function FilaVacia({ tieneFilros }: { tieneFilros: boolean }) {
  return (
    <tr>
      <td colSpan={9} className='px-6 py-12 text-center'>
        <div className='flex flex-col items-center gap-2.5'>
          <FileText className='w-8 h-8 opacity-40 text-slate-600' />
          <span className='text-[13px] text-slate-700'>
            {tieneFilros
              ? 'Sin resultados para los filtros aplicados'
              : 'No hay presupuestos creados aun'}
          </span>
          {!tieneFilros && (
            <a
              href='/presupuestos/nuevo'
              className='text-xs text-amber-500 no-underline flex items-center gap-1.25 mt-1'
            >
              <svg width='10' height='10' viewBox='0 0 10 10'>
                <path
                  d='M5 1V9M1 5H9'
                  stroke='currentColor'
                  strokeWidth='1.6'
                  strokeLinecap='round'
                />
              </svg>
              Crear primer presupuesto
            </a>
          )}
        </div>
      </td>
    </tr>
  );
}

// --- Componente principal -----------------------------------------------------

export default function PresupuestosListado() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [rows, setRows] = useState<PresupuestoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPags, setTotalPags] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [busqueda, setBusqueda] = useState(() => searchParams.get('q') ?? '');
  const [estado, setEstado] = useState<EstadoPresupuesto | ''>(() => (searchParams.get('estado') as EstadoPresupuesto) ?? '');
  const [tipoOp, setTipoOp] = useState<TipoOperacion | ''>(() => (searchParams.get('tipo') as TipoOperacion) ?? '');
  const [fechaDesde, setFechaDesde] = useState(() => searchParams.get('desde') ?? '');
  const [fechaHasta, setFechaHasta] = useState(() => searchParams.get('hasta') ?? '');
  const [pagina, setPagina] = useState(() => Number(searchParams.get('pag') ?? 1));
  const [porPagina, setPorPagina] = useState(20);
  const [ordenPor, setOrdenPor] = useState<'numero' | 'creado_en' | 'total' | 'fecha_validez'>(() => (searchParams.get('ob') as any) ?? 'creado_en');
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

  const cargar = useCallback(() => {
    startTransition(async () => {
      setLoading(true);
      if (shouldUsePlatformMocks) {
        const data = getMockPresupuestos({
          busqueda: busqueda || undefined,
          estado: estado || undefined,
          tipo_operacion: tipoOp || undefined,
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
      const res = await obtenerPresupuestos({
        busqueda: busqueda || undefined,
        estado: estado || undefined,
        tipo_operacion: tipoOp || undefined,
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
  }, [busqueda, estado, tipoOp, fechaDesde, fechaHasta, pagina, porPagina, ordenPor, ordenDir]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleBusqueda = (v: string) => {
    setBusqueda(v);
    if (busquedaTimer.current) clearTimeout(busquedaTimer.current);
    busquedaTimer.current = setTimeout(() => {
      setPagina(1);
      actualizarUrl({ q: v, pag: '' });
    }, 350);
  };

  const hayFiltros = !!(estado || tipoOp || fechaDesde || fechaHasta);

  const limpiarFiltros = () => {
    setEstado('');
    setTipoOp('');
    setFechaDesde('');
    setFechaHasta('');
    setPagina(1);
    actualizarUrl({ estado: '', tipo: '', desde: '', hasta: '', pag: '' });
  };

  const SortIcon = ({ col }: { col: typeof ordenPor }) => {
    if (ordenPor !== col) return <ArrowUpDown className='w-3 h-3 text-slate-600' />;
    return ordenDir === 'asc'
      ? <ArrowUp className='w-3 h-3 text-amber-400' />
      : <ArrowDown className='w-3 h-3 text-amber-400' />;
  };

  const setLoadingId = (id: string, on: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });
  };

  const showToast = (mensaje: string, tipo: 'ok' | 'error') =>
    setToast({ mensaje, tipo });

  const handleCambioEstado = async (
    id: string,
    nuevoEstado: EstadoPresupuesto,
  ) => {
    if (shouldUsePlatformMocks) {
      setRows((prev) => updateMockPresupuestoEstado(prev, id, nuevoEstado));
      showToast('Estado actualizado en modo mock', 'ok');
      return;
    }
    setLoadingId(id, true);
    const res = await cambiarEstadoPresupuesto(id, nuevoEstado);
    setLoadingId(id, false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Estado actualizado', 'ok');
    cargar();
  };

  const handleAprobar = async (id: string) => {
    if (shouldUsePlatformMocks) {
      setRows((prev) => updateMockPresupuestoEstado(prev, id, 'APROBADO'));
      showToast('Presupuesto aprobado en modo mock', 'ok');
      return;
    }
    setLoadingId(id, true);
    const res = await aprobarPresupuesto(id, true);
    setLoadingId(id, false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Aprobado y OS generada', 'ok');
    cargar();
  };

  const handleDuplicar = async (id: string) => {
    if (shouldUsePlatformMocks) {
      setRows((prev) => duplicateMockPresupuesto(prev, id));
      setTotal((prev) => prev + 1);
      showToast('Presupuesto duplicado en modo mock', 'ok');
      return;
    }
    setLoadingId(id, true);
    const res = await duplicarPresupuesto(id);
    setLoadingId(id, false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Presupuesto duplicado', 'ok');
    cargar();
  };

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);

  const ventanaPags = () => {
    const arr: number[] = [];
    const inicio = Math.max(1, pagina - 2);
    const fin = Math.min(totalPags, inicio + 4);
    for (let i = inicio; i <= fin; i++) arr.push(i);
    return arr;
  };

  const esqueletos = Array.from({ length: porPagina > 10 ? 8 : 5 });

  return (
    <>
      <div className='min-h-screen bg-slate-950 bg-gradient-to-b from-amber-950/5 to-slate-950 px-3 py-5 pb-20 sm:px-5 sm:py-8 lg:px-6'>
        <div className='mx-auto max-w-7xl min-w-0'>
          <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <div className='mb-1 flex items-center gap-2'>
                <span className='text-[11px] text-slate-500 tracking-widest uppercase'>
                  Hexa Gestión
                </span>
                <span className='text-slate-500'>›</span>
                <span className='text-[11px] text-slate-600 tracking-widest uppercase'>
                  Presupuestos
                </span>
              </div>
              <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
                <h1 className='m-0 text-[32px] leading-none font-bold tracking-tight text-slate-200 max-[780px]:text-[22px]'>
                  Presupuestos
                </h1>
                {!loading && (
                  <span className='rounded-2xl border border-slate-400/10 bg-slate-400/10 px-2.5 py-0.5 font-mono text-[11px] text-slate-400'>
                    {total}
                  </span>
                )}
              </div>
            </div>
            <a
              href='/presupuestos/nuevo'
              className='inline-flex w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 px-4 py-2.5 text-[13px] font-bold text-slate-950 no-underline shadow-sm shadow-emerald-600/15 transition-all sm:w-auto'
            >
              <Plus className='w-4 h-4' />
              Nuevo presupuesto
            </a>
          </div>

          <div className={`${cardClass} mb-4 px-3 py-3 sm:p-4`}>
            <div
              suppressHydrationWarning
              className='flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center'
            >
              <div className='relative w-full min-w-0 flex-1 sm:min-w-[220px]'>
                <svg
                  width='13'
                  height='13'
                  viewBox='0 0 13 13'
                  fill='none'
                  className='absolute left-2.75 top-1/2 -translate-y-1/2 text-slate-700'
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
                  placeholder='Buscar por numero, titulo, cliente...'
                  className={`${inputClass} w-full pl-8 ${busqueda ? 'pr-7.5' : 'pr-3'} focus:border-emerald-500/40`}
                />
                {busqueda && (
                  <button
                    onClick={() => {
                      setBusqueda('');
                      setPagina(1);
                    }}
                    className='absolute right-2.25 top-1/2 -translate-y-1/2 bg-transparent border-none text-slate-700 cursor-pointer p-0.5 flex items-center'
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

              <div className='flex w-full flex-wrap gap-1 sm:w-auto'>
                {ESTADOS_FILTRO.map((f) => {
                  const selected = estado === f.value;
                  const selectedCls = f.value
                    ? ESTADO_CFG[f.value as EstadoPresupuesto]?.badge
                    : 'text-amber-500 bg-amber-500/[0.07] border-amber-500/30';
                  return (
                    <button
                      key={f.value}
                      onClick={() => {
                        setEstado(f.value as EstadoPresupuesto | '');
                        setPagina(1);
                        actualizarUrl({ estado: f.value, pag: '' });
                      }}
                      className={`px-2.75 py-1.5 rounded-[7px] cursor-pointer text-[11px] font-semibold font-sans whitespace-nowrap border transition-all ${selected ? selectedCls : 'text-slate-500 bg-transparent border-slate-400/10'}`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setFiltrosAbiertos((p) => !p)}
                className={`flex items-center gap-1.25 px-3 py-1.75 rounded-[7px] cursor-pointer font-sans text-[11px] font-semibold border transition-all ${filtrosAbiertos ? 'border-amber-500/30 bg-amber-500/5 text-amber-500' : 'border-slate-400/10 bg-transparent text-slate-600'}`}
              >
                <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                  <path
                    d='M1 3H11M3 6H9M5 9H7'
                    stroke='currentColor'
                    strokeWidth='1.3'
                    strokeLinecap='round'
                  />
                </svg>
                Filtros
                {hayFiltros && (
                  <span className='w-1.25 h-1.25 rounded-full bg-amber-500' />
                )}
              </button>

              {hayFiltros && (
                <button
                  onClick={limpiarFiltros}
                  className='text-[11px] text-slate-600 bg-transparent border-none cursor-pointer font-sans underline'
                >
                  Limpiar
                </button>
              )}
            </div>

            {filtrosAbiertos && (
              <div className='flex gap-3 mt-3.5 pt-3.5 border-t border-slate-400/10 flex-wrap [animation:fadeIn_0.15s_ease]'>
                <div className='flex flex-col gap-1 min-w-[160px]'>
                  <label className='text-[10px] font-semibold tracking-widest uppercase text-slate-700'>
                    Tipo
                  </label>
                  <div className='relative'>
                    <select
                      value={tipoOp}
                      onChange={(e) => {
                        setTipoOp(e.target.value as TipoOperacion | '');
                        setPagina(1);
                        actualizarUrl({ tipo: e.target.value, pag: '' });
                      }}
                      className={`${inputClass} appearance-none pr-6.5 cursor-pointer w-full`}
                    >
                      <option value=''>Todos</option>
                      {Object.entries(TIPO_CFG).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                    <svg
                      width='9'
                      height='9'
                      viewBox='0 0 9 9'
                      fill='none'
                      className='absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
                    >
                      <path
                        d='M1 3L4.5 6.5L8 3'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </div>
                </div>

                <div className='flex flex-col gap-1 min-w-[140px]'>
                  <label className='text-[10px] font-semibold tracking-widest uppercase text-slate-700'>
                    Desde
                  </label>
                  <input
                    type='date'
                    value={fechaDesde}
                    onChange={(e) => {
                      setFechaDesde(e.target.value);
                      setPagina(1);
                      actualizarUrl({ desde: e.target.value, pag: '' });
                    }}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>

                <div className='flex flex-col gap-1 min-w-[140px]'>
                  <label className='text-[10px] font-semibold tracking-widest uppercase text-slate-700'>
                    Hasta
                  </label>
                  <input
                    type='date'
                    value={fechaHasta}
                    onChange={(e) => {
                      setFechaHasta(e.target.value);
                      setPagina(1);
                      actualizarUrl({ hasta: e.target.value, pag: '' });
                    }}
                    className={`${inputClass} [color-scheme:dark]`}
                  />
                </div>
              </div>
            )}
          </div>

          <div className={`${cardClass} overflow-hidden`}>
            <div className='overflow-x-auto'>
              <table className='min-w-full'>
                <thead>
                  <tr className='border-b border-slate-400/10'>
                    {[
                      { label: 'Numero',  w: 'w-[90px]',  col: 'numero',       sort: 'numero'       as const },
                      { label: 'Cliente', w: 'w-auto',    col: 'cliente',      sort: null },
                      { label: 'Titulo',  w: 'w-auto',    col: 'titulo',       sort: null },
                      { label: 'Tipo',    w: 'w-[100px]', col: 'tipo',         sort: null },
                      { label: 'Emision', w: 'w-[80px]',  col: 'emision',      sort: 'creado_en'    as const },
                      { label: 'Vence',   w: 'w-[80px]',  col: 'vence',        sort: 'fecha_validez' as const },
                      { label: 'Total',   w: 'w-[110px]', col: 'total',        sort: 'total'        as const },
                      { label: 'Estado',  w: 'w-[120px]', col: 'estado',       sort: null },
                      { label: '',        w: 'w-[36px]',  col: 'acciones',     sort: null },
                    ].map((col) => (
                      <th
                        key={col.label || col.col}
                        data-col={col.col}
                        onClick={col.sort ? () => handleSort(col.sort!) : undefined}
                        className={[
                          'px-3.5 py-2.75 text-[10px] font-bold tracking-widest uppercase text-slate-700 whitespace-nowrap bg-slate-950/30',
                          col.w,
                          col.label === 'Total' ? 'text-right' : 'text-left',
                          'max-[780px]:px-1 max-[780px]:py-1 max-[780px]:text-[10px]',
                          col.col === 'titulo' ||
                          col.col === 'tipo' ||
                          col.col === 'emision' ||
                          col.col === 'vence'
                            ? 'max-[780px]:hidden'
                            : '',
                          col.col === 'cliente'
                            ? 'max-[780px]:max-w-[55px] max-[780px]:text-[9px]'
                            : '',
                          col.col === 'acciones' ? 'max-[780px]:px-[2px]' : '',
                          col.sort ? 'cursor-pointer select-none hover:text-slate-400 transition-colors' : '',
                        ].join(' ')}
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
                      <tr key={i} className='border-b border-slate-400/10'>
                        {[90, 160, 200, 80, 65, 65, 90, 100, 28].map((w, j) => (
                          <td key={j} className='px-3.5 py-3'>
                            <Skeleton w={`w-[${w}px]`} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : rows.length === 0 ? (
                    <FilaVacia tieneFilros={!!(busqueda || hayFiltros)} />
                  ) : (
                    rows.map((row) => {
                      const vencido = isVencido(row);
                      const idLoading = loadingIds.has(row.id);
                      return (
                        <tr
                          key={row.id}
                          className='border-b border-slate-400/10 transition-colors duration-100'
                        >
                          <td
                            data-col='numero'
                            className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <a
                              href={`/presupuestos/${row.id}`}
                              className='text-xs max-[780px]:text-[10px] font-bold text-amber-500 font-mono no-underline tracking-wide'
                            >
                              {row.numero}
                            </a>
                          </td>

                          <td
                            data-col='cliente'
                            className='px-3.5 py-3 max-w-[200px] max-[780px]:max-w-[55px] max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <div
                              className='text-xs max-[780px]:max-w-[50px] max-[780px]:text-[9px] text-slate-400 truncate block max-w-[190px]'
                              title={row.razon_social}
                            >
                              {row.razon_social}
                            </div>
                          </td>

                          <td
                            data-col='titulo'
                            className='px-3.5 py-3 max-w-[240px] max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <span
                              className='text-xs max-[780px]:text-[9px] text-slate-500 truncate block max-w-[230px]'
                              title={row.titulo}
                            >
                              {row.titulo}
                            </span>
                          </td>

                          <td
                            data-col='tipo'
                            className='px-3.5 py-3 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <span className='text-[11px] max-[780px]:text-[9px] text-slate-600 inline-flex items-center gap-1 whitespace-nowrap'>
                              <span>{TIPO_CFG[row.tipo_operacion].icon}</span>
                              <span>{TIPO_CFG[row.tipo_operacion].label}</span>
                            </span>
                          </td>

                          <td
                            data-col='emision'
                            className='px-3.5 py-3 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <span className='text-[11px] max-[780px]:text-[9px] text-slate-600 font-mono'>
                              {fmtFecha(row.fecha_emision)}
                            </span>
                          </td>

                          <td
                            data-col='vence'
                            className='px-3.5 py-3 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <span
                              className={`text-[11px] max-[780px]:text-[9px] font-mono ${vencido ? 'text-amber-500' : 'text-slate-700'}`}
                            >
                              {fmtFecha(row.fecha_vencimiento)}
                              {vencido && (
                                <AlertTriangle className='w-3 h-3 inline ml-1' />
                              )}
                            </span>
                          </td>

                          <td
                            data-col='total'
                            className='px-3.5 py-3 text-right max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <span className='text-[13px] max-[780px]:text-[10px] font-semibold text-slate-400 font-mono tabular-nums whitespace-nowrap'>
                              {formatearMonto(row.total)}
                            </span>
                          </td>

                          <td
                            data-col='estado'
                            className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <MenuEstado
                              presupuesto={row}
                              onCambio={handleCambioEstado}
                              onAprobar={handleAprobar}
                              loading={idLoading}
                            />
                          </td>

                          <td
                            data-col='acciones'
                            className='px-2 py-3 text-right max-[780px]:px-[2px] max-[780px]:py-1'
                          >
                            <MenuAcciones
                              presupuesto={row}
                              onDuplicar={handleDuplicar}
                              loading={idLoading}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!loading && total > 0 && (
              <div className='flex items-center justify-between px-4 py-3 border-t border-slate-400/10 flex-wrap gap-3'>
                <span className='text-[11px] text-slate-700 font-mono'>
                  {desde}–{hasta} de {total} presupuestos
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

                <div className='flex items-center gap-1.75'>
                  <span className='text-[11px] text-slate-700'>Filas:</span>
                  <div className='relative'>
                    <select
                      value={porPagina}
                      onChange={(e) => {
                        setPorPagina(Number(e.target.value));
                        setPagina(1);
                      }}
                      className={`${inputClass} px-2.25 py-1 pr-5.5 text-[11px] appearance-none cursor-pointer`}
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
                      className='absolute right-1.75 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
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
      {isPending && <span className='sr-only'>cargando</span>}
    </>
  );
}

// --- Boton de paginacion ------------------------------------------------------

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
  const borderClass = active ? 'border-amber-500/40' : 'border-slate-400/10';
  const bgClass = active ? 'bg-amber-500/10' : 'bg-transparent';
  const textClass = active
    ? 'text-amber-500 font-bold'
    : disabled
      ? 'text-slate-800 font-normal'
      : 'text-slate-600 font-normal';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`min-w-7 h-7 px-1.5 rounded-md border text-[11px] font-mono transition-all ${borderClass} ${bgClass} ${textClass} ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {children}
    </button>
  );
}
