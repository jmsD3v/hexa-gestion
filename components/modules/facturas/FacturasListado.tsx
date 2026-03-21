'use client';

// ============================================================
// components/modules/facturas/FacturasListado.tsx
// Listado de facturas: KPIs económicos, filtros, tabla con
// saldo pendiente, alertas de vencimiento y acciones.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { EstadoFactura, TipoComprobanteAFIP, Factura } from '@/types';
import {
  obtenerFacturas,
  obtenerKPIsFacturacion,
} from '@/app/actions/facturas';
import {
  getMockFacturacionKPIs,
  getMockFacturas,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type FacturaRow = Factura & { razon_social: string };

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<
  EstadoFactura,
  { label: string; color: string; bg: string; border: string }
> = {
  BORRADOR: {
    label: 'Borrador',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.15)',
  },
  EMITIDA: {
    label: 'Emitida',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
  },
  PENDIENTE_COBRO: {
    label: 'Pend. cobro',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
  COBRADA_PARCIAL: {
    label: 'Cobro parcial',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.2)',
  },
  COBRADA: {
    label: 'Cobrada',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
  },
  ANULADA: {
    label: 'Anulada',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
  },
};

const COMP_LABEL: Record<TipoComprobanteAFIP, string> = {
  FACTURA_A: 'Fac. A',
  FACTURA_B: 'Fac. B',
  FACTURA_C: 'Fac. C',
  NOTA_DEBITO_A: 'ND A',
  NOTA_DEBITO_B: 'ND B',
  NOTA_CREDITO_A: 'NC A',
  NOTA_CREDITO_B: 'NC B',
  REMITO_R: 'Rem. R',
};

const ESTADOS_FILTRO: { value: EstadoFactura | ''; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'BORRADOR', label: 'Borrador' },
  { value: 'EMITIDA', label: 'Emitida' },
  { value: 'PENDIENTE_COBRO', label: 'Pend. cobro' },
  { value: 'COBRADA_PARCIAL', label: 'Parc.' },
  { value: 'COBRADA', label: 'Cobrada' },
  { value: 'ANULADA', label: 'Anulada' },
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

const isVencida = (f: FacturaRow) =>
  ['EMITIDA', 'PENDIENTE_COBRO', 'COBRADA_PARCIAL'].includes(f.estado) &&
  !!f.fecha_vencimiento &&
  new Date(f.fecha_vencimiento) < new Date();

const diasVencida = (f: FacturaRow) => {
  if (!f.fecha_vencimiento) return null;
  return Math.ceil(
    (Date.now() - new Date(f.fecha_vencimiento).getTime()) / 86400000,
  );
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
// Nota: Todos convertidos a Tailwind classes en componentes

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
      className='bg-slate-400/10 animate-pulse'
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
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  loading?: boolean;
  alert?: boolean;
}) {
  return (
    <div
      className={`bg-slate-900/70 border rounded-lg backdrop-blur-xl p-4 ${alert ? 'border-red-400/20' : 'border-slate-400/10'}`}
    >
      <span
        className={`text-[10px] font-semibold tracking-widest uppercase block mb-1.5 ${alert ? 'text-red-400' : 'text-slate-700'}`}
      >
        {label}
      </span>
      {loading ? (
        <Skeleton w='80px' h='22px' />
      ) : (
        <span
          style={{ color }}
          className='text-xl font-black font-mono tracking-tighter block'
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

function BadgeEstado({ estado }: { estado: EstadoFactura }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span
      style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.border }}
      className='inline-flex items-center gap-1 px-2 py-0.5 rounded-2xl text-[10px] font-bold tracking-wide border whitespace-nowrap'
    >
      <span
        style={{ background: cfg.color }}
        className='w-1 h-1 rounded-full inline-block'
      />
      {cfg.label}
    </span>
  );
}

function BadgeComprobante({ tipo }: { tipo: TipoComprobanteAFIP }) {
  const color = tipo.endsWith('_A')
    ? '#f59e0b'
    : tipo.endsWith('_B')
      ? '#60a5fa'
      : '#94a3b8';
  return (
    <span
      style={{
        color,
        borderColor: `${color}20`,
        backgroundColor: `${color}10`,
      }}
      className='inline-flex px-1.75 py-0.5 rounded text-[10px] font-bold font-mono tracking-wide border whitespace-nowrap'
    >
      {COMP_LABEL[tipo]}
    </span>
  );
}

function MenuAcciones({ factura }: { factura: FacturaRow }) {
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
        className='w-7 h-7 rounded-[7px] border border-slate-400/10 bg-transparent text-slate-600 cursor-pointer flex items-center justify-center transition-all duration-120 hover:bg-slate-400/5 hover:text-slate-400'
      >
        <svg width='13' height='13' viewBox='0 0 13 13'>
          <circle cx='6.5' cy='2.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='6.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='10.5' r='1' fill='currentColor' />
        </svg>
      </button>
      {abierto && (
        <div className='absolute right-0 top-[calc(100%+4px)] z-30 bg-slate-950 border border-slate-400/15 rounded-[9px] p-1 w-48 shadow-2xl animate-in fade-in duration-120 scale-95'>
          {[
            {
              href: `/facturas/${factura.id}`,
              label: 'Ver detalle',
              icon: '👁',
            },
            {
              href: `/facturas/${factura.id}/pdf`,
              label: 'Ver PDF',
              icon: '📄',
              target: '_blank',
            },
            {
              href: `/clientes/${factura.cliente_id}`,
              label: 'Ver cliente',
              icon: '👤',
            },
            ...(factura.estado !== 'COBRADA' && factura.estado !== 'ANULADA'
              ? [
                  {
                    href: `/facturas/${factura.id}#cobros`,
                    label: 'Registrar cobro',
                    icon: '💰',
                  },
                ]
              : []),
          ].map(({ href, label, icon, target }) => (
            <a
              key={href}
              href={href}
              target={target}
              onClick={() => setAbierto(false)}
              className='flex items-center gap-2 px-2.5 py-1.75 rounded text-xs text-slate-400 no-underline transition-colors duration-100 hover:bg-slate-400/5 hover:text-slate-100 font-sans'
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
      className={`min-w-7 h-7 px-1.5 rounded text-[11px] font-mono cursor-pointer transition-all duration-120 ${
        active
          ? 'border border-amber-500/40 bg-amber-500/10 text-amber-500 font-bold'
          : disabled
            ? 'border border-slate-400/10 bg-transparent text-slate-800 cursor-not-allowed'
            : 'border border-slate-400/10 bg-transparent text-slate-600 font-normal'
      }`}
    >
      {children}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FacturasListado() {
  const [rows, setRows] = useState<FacturaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPags, setTotalPags] = useState(1);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<{
    total_facturado_mes: number;
    total_cobrado_mes: number;
    saldo_total_pendiente: number;
    facturas_vencidas: number;
    tasa_cobro: number;
  } | null>(null);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [, startTransition] = useTransition();

  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<EstadoFactura | ''>('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(20);
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false);

  const busquedaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(() => {
    startTransition(async () => {
      setLoading(true);
      if (shouldUsePlatformMocks) {
        const data = getMockFacturas({
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
      const res = await obtenerFacturas({
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
      setKpis(getMockFacturacionKPIs());
      setLoadingKpis(false);
      return;
    }
    obtenerKPIsFacturacion().then((r) => {
      if (r.data) setKpis(r.data);
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
  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const ventanaPags = () => {
    const arr: number[] = [];
    const ini = Math.max(1, pagina - 2);
    const fin = Math.min(totalPags, ini + 4);
    for (let i = ini; i <= fin; i++) arr.push(i);
    return arr;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box}body{margin:0;background:#060d1a;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        option{background:#0f172a;color:#e2e8f0}input:focus,select:focus{outline:none!important}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}@keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes scaleIn{from{transform:scale(0.96);opacity:0}to{transform:scale(1);opacity:1}}
        table{border-collapse:collapse;width:100%}tr:hover td{background:rgba(148,163,184,0.02)!important}
        .table-wrapper{overflow-x:auto}
      `}</style>

      <div className='min-h-screen bg-slate-950 bg-gradient-to-b from-emerald-950/5 to-slate-950 px-3 py-5 pb-20 sm:px-5 sm:py-8 lg:px-6'>
        <div className='mx-auto max-w-5xl min-w-0'>
          {/* Header */}
          <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <div className='mb-1 flex items-center gap-2 overflow-x-auto whitespace-nowrap'>
                <span className='text-[11px] text-slate-500 tracking-widest uppercase'>
                  Hexa Gestión
                </span>
                <span className='text-slate-800'>›</span>
                <span className='text-[11px] text-slate-600 tracking-widest uppercase'>
                  Facturas
                </span>
              </div>
              <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
                <h1 className='m-0 text-[32px] leading-none font-bold tracking-tight text-slate-100 max-[780px]:text-[22px]'>
                  Facturación
                </h1>
                {!loading && (
                  <span className='rounded-2xl border border-slate-400/10 bg-slate-400/7 px-2.25 py-0.5 font-mono text-[11px] text-slate-500'>
                    {total}
                  </span>
                )}
              </div>
            </div>
            <a
              href='/facturas/nueva'
              className='inline-flex w-full items-center justify-center gap-1.75 rounded-[9px] bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 px-4 py-2.5 text-sm font-bold text-slate-950 no-underline shadow-lg shadow-emerald-600/15 transition-all duration-120 hover:from-emerald-600 hover:to-emerald-700 sm:w-auto'
            >
              <svg width='11' height='11' viewBox='0 0 11 11'>
                <path
                  d='M5.5 1V10M1 5.5H10'
                  stroke='currentColor'
                  strokeWidth='1.8'
                  strokeLinecap='round'
                />
              </svg>
              Nueva factura
            </a>
          </div>

          {/* KPIs */}
          <div className='mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-4'>
            <KPICard
              label='Facturado este mes'
              value={kpis ? formatearMonto(kpis.total_facturado_mes) : '—'}
              color='#4ade80'
              loading={loadingKpis}
            />
            <KPICard
              label='Cobrado este mes'
              value={kpis ? formatearMonto(kpis.total_cobrado_mes) : '—'}
              sub={kpis ? `${kpis.tasa_cobro}% de tasa de cobro` : undefined}
              color='#60a5fa'
              loading={loadingKpis}
            />
            <KPICard
              label='Saldo total pendiente'
              value={kpis ? formatearMonto(kpis.saldo_total_pendiente) : '—'}
              color='#f59e0b'
              loading={loadingKpis}
            />
            <KPICard
              label='Facturas vencidas'
              value={kpis ? String(kpis.facturas_vencidas) : '—'}
              color='#f87171'
              loading={loadingKpis}
              alert={!!(kpis && kpis.facturas_vencidas > 0)}
            />
          </div>

          {/* Filtros */}
          <div className='mb-4 rounded-lg border border-slate-400/10 bg-slate-900/70 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4'>
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
                  className='absolute left-2.75 top-1/2 -translate-y-1/2 text-slate-500'
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
                  placeholder='Buscar por número, cliente...'
                  className='w-full bg-slate-800/50 border border-slate-400/10 rounded-lg px-8 py-2.75 text-sm text-slate-100 placeholder-slate-600 font-sans transition-all duration-120 focus:border-emerald-500/40 focus:bg-slate-800/70 focus:outline-none'
                />
                {busqueda && (
                  <button
                    onClick={() => {
                      setBusqueda('');
                      setPagina(1);
                    }}
                    className='absolute right-2.25 top-1/2 -translate-y-1/2 bg-transparent border-0 text-slate-500 cursor-pointer px-0.5 py-0.5 flex items-center hover:text-slate-300 transition-colors duration-120'
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
                  return (
                    <button
                      key={f.value}
                      onClick={() => {
                        setEstado(f.value as EstadoFactura | '');
                        setPagina(1);
                      }}
                      className={`px-2.75 py-1.5 rounded text-[11px] font-semibold font-sans cursor-pointer transition-all duration-120 whitespace-nowrap ${
                        estado === f.value
                          ? `border border-current bg-opacity-15`
                          : 'border border-slate-400/10 bg-transparent text-slate-600'
                      }`}
                      style={
                        estado === f.value
                          ? {
                              borderColor: cfg?.border,
                              backgroundColor: cfg?.bg,
                              color: cfg?.color,
                            }
                          : {}
                      }
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* Fechas */}
              <button
                onClick={() => setFiltrosAbiertos((p) => !p)}
                className={`flex items-center gap-1.25 px-3 py-1.75 rounded text-[11px] font-semibold font-sans border transition-all duration-120 cursor-pointer ${
                  filtrosAbiertos
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
                    : 'border-slate-400/10 bg-transparent text-slate-600'
                }`}
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
                {(fechaDesde || fechaHasta) && (
                  <span className='w-1.25 h-1.25 rounded-full bg-emerald-500 inline-block' />
                )}
              </button>
              {hayFiltros && (
                <button
                  onClick={limpiarFiltros}
                  className='text-[11px] text-slate-600 bg-transparent border-0 cursor-pointer font-sans underline hover:text-slate-400 transition-colors duration-120'
                >
                  Limpiar
                </button>
              )}
            </div>

            {filtrosAbiertos && (
              <div className='flex gap-3 mt-3.5 pt-3.5 border-t border-slate-400/10 flex-wrap animate-in fade-in duration-150'>
                {[
                  { label: 'Desde', v: fechaDesde, set: setFechaDesde },
                  { label: 'Hasta', v: fechaHasta, set: setFechaHasta },
                ].map(({ label, v, set }) => (
                  <div key={label} className='flex flex-col gap-1 min-w-35'>
                    <label className='text-[10px] font-semibold tracking-widest uppercase text-slate-500'>
                      {label}
                    </label>
                    <input
                      type='date'
                      value={v}
                      onChange={(e) => {
                        set(e.target.value);
                        setPagina(1);
                      }}
                      className='bg-slate-800/50 border border-slate-400/10 rounded-lg px-3 py-2 text-sm text-slate-100 font-sans transition-all duration-120 focus:border-emerald-500/40 focus:bg-slate-800/70 focus:outline-none'
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabla */}
          <div className='bg-slate-900/70 border border-slate-400/10 rounded-lg backdrop-blur-xl overflow-hidden'>
            <div className='table-wrapper overflow-x-auto'>
              <table className='min-w-full'>
                <thead>
                  <tr className='border-b border-slate-400/10'>
                    {[
                      { label: 'Número', w: '100px', col: 'numero' },
                      { label: 'Tipo', w: '80px', col: 'tipo' },
                      { label: 'Cliente', w: 'auto', col: 'cliente' },
                      { label: 'Emisión', w: '75px', col: 'emision' },
                      { label: 'Vence', w: '85px', col: 'vence' },
                      { label: 'Total', w: '120px', col: 'total' },
                      { label: 'Saldo', w: '120px', col: 'saldo' },
                      { label: 'Estado', w: '120px', col: 'estado' },
                      { label: '', w: '36px', col: 'acciones' },
                    ].map((col) => (
                      <th
                        key={col.label}
                        data-col={col.col}
                        className={`px-3.5 py-2.75 max-[780px]:px-1 max-[780px]:py-1 max-[780px]:text-[10px] text-[10px] font-bold tracking-widest uppercase text-slate-500 whitespace-nowrap bg-slate-800/50 ${
                          col.col === 'tipo' ||
                          col.col === 'emision' ||
                          col.col === 'vence'
                            ? 'max-[780px]:hidden'
                            : ''
                        } ${col.col === 'cliente' ? 'max-[780px]:max-w-14 max-[780px]:text-[9px]' : ''} ${
                          col.col === 'acciones' ? 'max-[780px]:px-0.5' : ''
                        } ${
                          ['Total', 'Saldo'].includes(col.label)
                            ? 'text-right'
                            : ''
                        }`}
                        style={{ width: col.w }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 7 }).map((_, i) => (
                      <tr
                        key={i}
                        className='border-b border-slate-400/5 hover:bg-slate-400/1'
                      >
                        {[90, 70, 180, 65, 75, 100, 100, 110, 28].map(
                          (w, j) => (
                            <td
                              key={j}
                              className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1'
                            >
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
                          <span className='text-2xl opacity-40'>🧾</span>
                          <span className='text-sm text-slate-500'>
                            {busqueda || hayFiltros
                              ? 'Sin resultados'
                              : 'No hay facturas aún'}
                          </span>
                          {!busqueda && !hayFiltros && (
                            <a
                              href='/facturas/nueva'
                              className='text-xs text-emerald-500 no-underline flex items-center gap-1.25 mt-1'
                            >
                              <svg width='10' height='10' viewBox='0 0 10 10'>
                                <path
                                  d='M5 1V9M1 5H9'
                                  stroke='currentColor'
                                  strokeWidth='1.6'
                                  strokeLinecap='round'
                                />
                              </svg>
                              Crear primera factura
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const vencida = isVencida(row);
                      const dias = vencida ? diasVencida(row) : null;
                      const saldoPct =
                        row.total > 0
                          ? (row.saldo_pendiente / row.total) * 100
                          : 0;
                      return (
                        <tr
                          key={row.id}
                          className='border-b border-slate-400/5 hover:bg-slate-400/2 transition-colors duration-100'
                        >
                          {/* Número */}
                          <td
                            data-col='numero'
                            className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <a
                              href={`/facturas/${row.id}`}
                              className='text-xs font-bold text-emerald-500 font-mono no-underline tracking-tight max-[780px]:text-xs hover:text-emerald-400 transition-colors duration-120'
                            >
                              {row.numero}
                            </a>
                          </td>
                          {/* Tipo */}
                          <td
                            data-col='tipo'
                            className='px-3.5 py-3 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <BadgeComprobante tipo={row.tipo_comprobante} />
                          </td>
                          {/* Cliente */}
                          <td
                            data-col='cliente'
                            className='px-3.5 py-3 max-[780px]:max-w-14 max-[780px]:px-1 max-[780px]:py-1 max-w-52'
                          >
                            <div
                              className='text-xs text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap block max-w-48 max-[780px]:max-w-12 max-[780px]:text-[9px]'
                              title={row.razon_social}
                            >
                              {row.razon_social}
                            </div>
                          </td>
                          {/* Emisión */}
                          <td
                            data-col='emision'
                            className='px-3.5 py-3 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <span className='text-[11px] text-slate-600 font-mono max-[780px]:text-xs'>
                              {fmtFecha(row.fecha_emision)}
                            </span>
                          </td>
                          {/* Vencimiento */}
                          <td
                            data-col='vence'
                            className='px-3.5 py-3 max-[780px]:hidden max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <div>
                              <span
                                className={`text-[11px] font-mono max-[780px]:text-xs ${vencida ? 'text-red-400' : 'text-slate-600'}`}
                              >
                                {fmtFecha(row.fecha_vencimiento)}
                              </span>
                              {vencida && dias && (
                                <div className='text-xs text-red-400 mt-0.5'>
                                  {dias}d vencida
                                </div>
                              )}
                            </div>
                          </td>
                          {/* Total */}
                          <td
                            data-col='total'
                            className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1 text-right'
                          >
                            <span className='text-sm font-semibold text-slate-400 font-mono whitespace-nowrap max-[780px]:text-xs'>
                              {formatearMonto(row.total)}
                            </span>
                          </td>
                          {/* Saldo pendiente */}
                          <td
                            data-col='saldo'
                            className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1 text-right'
                          >
                            {row.saldo_pendiente > 0 ? (
                              <div>
                                <span
                                  className={`text-sm font-bold font-mono whitespace-nowrap max-[780px]:text-xs ${vencida ? 'text-red-400' : 'text-amber-500'}`}
                                >
                                  {formatearMonto(row.saldo_pendiente)}
                                </span>
                                <div className='h-0.5 bg-slate-400/10 rounded-full mt-0.75 overflow-hidden max-[780px]:hidden'>
                                  <div
                                    className='h-full'
                                    style={{
                                      width: `${saldoPct}%`,
                                      backgroundColor: vencida
                                        ? '#f87171'
                                        : '#f59e0b',
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className='text-xs text-slate-600 font-mono max-[780px]:text-[10px]'>
                                —
                              </span>
                            )}
                          </td>
                          {/* Estado */}
                          <td
                            data-col='estado'
                            className='px-3.5 py-3 max-[780px]:px-1 max-[780px]:py-1'
                          >
                            <BadgeEstado estado={row.estado} />
                          </td>
                          {/* Acciones */}
                          <td
                            data-col='acciones'
                            className='px-2 py-3 max-[780px]:px-0.5 max-[780px]:py-1 text-right'
                          >
                            <MenuAcciones factura={row} />
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
              <div className='flex items-center justify-between px-4 py-3 border-t border-slate-400/10 flex-wrap gap-3'>
                <span className='text-[11px] text-slate-500 font-mono'>
                  {desde}–{hasta} de {total}
                </span>
                <div className='flex gap-1'>
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
                <div className='flex items-center gap-1.75'>
                  <span className='text-[11px] text-slate-500'>Filas:</span>
                  <div className='relative'>
                    <select
                      value={porPagina}
                      onChange={(e) => {
                        setPorPagina(Number(e.target.value));
                        setPagina(1);
                      }}
                      className='bg-slate-800/50 border border-slate-400/10 rounded-lg px-5.5 py-1 text-[11px] font-sans appearance-none cursor-pointer text-slate-100 transition-all duration-120 focus:border-emerald-500/40 focus:bg-slate-800/70 focus:outline-none'
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
    </>
  );
}
