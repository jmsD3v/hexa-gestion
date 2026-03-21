'use client';

// ============================================================
// /components/modules/reportes/Reportes.tsx
// Dashboard de análisis — series temporales + rankings
// Charts: recharts (LineChart, BarChart, ResponsiveContainer)
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  ClipboardList,
  FileText,
  Users,
  Calendar,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import {
  obtenerSerieFacturacion,
  obtenerSerieOrdenes,
  obtenerSeriePresupuestos,
  obtenerRankingClientes,
  obtenerResumenPeriodo,
} from '@/app/actions/reportes';
import {
  getMockRankingClientes,
  getMockResumenPeriodo,
  getMockSerieFacturacion,
  getMockSerieOrdenes,
  getMockSeriePresupuestos,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import type {
  PuntoSerie,
  RankingItem,
  ResumenPeriodo,
} from '@/app/actions/reportes';

// ── Helpers ───────────────────────────────────────────────────

const fmt$ = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

const fmtK = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n}`;

// ── Opciones de período ───────────────────────────────────────

type PeriodoKey = '3m' | '6m' | '12m' | 'ytd';

const PERIODOS: { key: PeriodoKey; label: string; meses: number }[] = [
  { key: '3m', label: 'Últimos 3 meses', meses: 3 },
  { key: '6m', label: 'Últimos 6 meses', meses: 6 },
  { key: '12m', label: 'Últimos 12 meses', meses: 12 },
  { key: 'ytd', label: 'Este año', meses: new Date().getMonth() + 1 },
];

// Rango de fecha para el resumen
function rangoDesde(meses: number): { desde: string; hasta: string } {
  const hasta = new Date();
  const desde = new Date(hasta.getFullYear(), hasta.getMonth() - meses + 1, 1);
  return {
    desde: desde.toISOString().split('T')[0],
    hasta: hasta.toISOString().split('T')[0],
  };
}

// ── Tooltip personalizado ─────────────────────────────────────

function TooltipCustom({ active, payload, label, dinero = false }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className='bg-slate-800 border border-slate-700 rounded-xl shadow-lg px-3 py-2.5 text-sm'>
      <p className='font-semibold text-slate-200 mb-1.5'>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className='flex items-center gap-2'>
          <span
            className='w-2.5 h-2.5 rounded-full flex-shrink-0'
            style={{ backgroundColor: p.color }}
          />
          <span className='text-slate-400 text-xs'>{p.name}:</span>
          <span className='font-semibold text-slate-200'>
            {dinero ? fmtK(p.value) : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── KPI resumen card ──────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.FC<any>;
  color: string;
  sub?: string;
}) {
  return (
    <div className='bg-slate-800 rounded-2xl border border-slate-700 p-4 shadow-sm'>
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}
      >
        <Icon className='w-4.5 h-4.5' />
      </div>
      <p className='text-2xl font-bold text-slate-100 leading-none'>{value}</p>
      <p className='text-xs text-slate-400 mt-1.5 leading-tight'>{label}</p>
      {sub && <p className='text-xs text-slate-500 mt-0.5'>{sub}</p>}
    </div>
  );
}

// ── Panel de chart ────────────────────────────────────────────

function ChartPanel({
  titulo,
  children,
  loading,
}: {
  titulo: string;
  children: React.ReactNode;
  loading: boolean;
}) {
  return (
    <div className='bg-slate-800 rounded-2xl border border-slate-700 shadow-sm overflow-hidden'>
      <div className='px-5 py-4 border-b border-slate-700'>
        <h2 className='text-sm font-semibold text-slate-100'>{titulo}</h2>
      </div>
      <div className='p-4'>
        {loading ? (
          <div className='h-56 flex items-center justify-center'>
            <div className='w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin' />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

// ── Ranking bar ───────────────────────────────────────────────

function FilaRanking({
  item,
  max,
  rank,
}: {
  item: RankingItem;
  max: number;
  rank: number;
}) {
  const pct = max > 0 ? (item.valor / max) * 100 : 0;
  return (
    <div className='flex items-center gap-3 py-2'>
      <span className='w-5 text-xs font-bold text-slate-400 text-right flex-shrink-0'>
        {rank}
      </span>
      <div className='flex-1 min-w-0'>
        <div className='flex items-baseline justify-between mb-1'>
          <p className='text-sm font-medium text-slate-800 truncate'>
            {item.nombre}
          </p>
          <span className='text-sm font-bold text-slate-900 ml-2 flex-shrink-0'>
            {fmt$(item.valor)}
          </span>
        </div>
        <div className='h-1.5 bg-slate-100 rounded-full overflow-hidden'>
          <div
            className='h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700'
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className='text-[10px] text-slate-400 mt-0.5'>
          {item.cantidad} factura{item.cantidad !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function Reportes() {
  const [periodo, setPeriodo] = useState<PeriodoKey>('12m');
  const [showPeriodos, setShowP] = useState(false);

  const [resumen, setResumen] = useState<ResumenPeriodo | null>(null);
  const [serieFactura, setSerieF] = useState<PuntoSerie[]>([]);
  const [serieOrdenes, setSerieO] = useState<PuntoSerie[]>([]);
  const [seriePres, setSeriePr] = useState<PuntoSerie[]>([]);
  const [ranking, setRanking] = useState<RankingItem[]>([]);

  const [loadingRes, setLoadingRes] = useState(true);
  const [loadingCh, setLoadingCh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const meses = PERIODOS.find((p) => p.key === periodo)?.meses ?? 12;

  const cargar = useCallback(
    async (showSpin = false) => {
      if (showSpin) setRefreshing(true);
      setLoadingRes(true);
      setLoadingCh(true);

      if (shouldUsePlatformMocks) {
        setResumen(getMockResumenPeriodo(meses));
        setSerieF(getMockSerieFacturacion(meses));
        setSerieO(getMockSerieOrdenes(meses));
        setSeriePr(getMockSeriePresupuestos(meses));
        setRanking(getMockRankingClientes(10));
        setLoadingRes(false);
        setLoadingCh(false);
        setRefreshing(false);
        return;
      }

      const { desde, hasta } = rangoDesde(meses);

      const [resRes, sfRes, soRes, spRes, rkRes] = await Promise.all([
        obtenerResumenPeriodo(desde, hasta),
        obtenerSerieFacturacion(meses),
        obtenerSerieOrdenes(meses),
        obtenerSeriePresupuestos(meses),
        obtenerRankingClientes(10),
      ]);

      if (resRes.data) setResumen(resRes.data);
      if (sfRes.data) setSerieF(sfRes.data);
      if (soRes.data) setSerieO(soRes.data);
      if (spRes.data) setSeriePr(spRes.data);
      if (rkRes.data) setRanking(rkRes.data);

      setLoadingRes(false);
      setLoadingCh(false);
      setRefreshing(false);
    },
    [meses],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const periodoLabel = PERIODOS.find((p) => p.key === periodo)?.label ?? '';

  return (
    <>
      <style>{`::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}`}</style>
      <div className='min-h-screen bg-slate-900'>
        {/* Header */}
        <div className='bg-slate-800 border-b border-slate-700 px-6 py-5'>
          <div className='max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3'>
            <div>
              <h1 className='text-xl font-bold text-slate-100'>Reportes</h1>
              <p className='text-sm text-slate-400 mt-0.5'>
                Análisis de rendimiento comercial y operativo
              </p>
            </div>
            <div className='flex items-center gap-2'>
              {/* Selector de período */}
              <div className='relative'>
                <button
                  onClick={() => setShowP((v) => !v)}
                  className='flex items-center gap-2 px-4 py-2 bg-slate-700 border border-slate-600 rounded-xl text-sm font-medium text-slate-200 hover:bg-slate-600 transition-colors shadow-sm'
                >
                  <Calendar className='w-4 h-4 text-slate-400' />
                  {periodoLabel}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showPeriodos ? 'rotate-180' : ''}`}
                  />
                </button>
                {showPeriodos && (
                  <div className='absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-lg z-20 overflow-hidden'>
                    {PERIODOS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => {
                          setPeriodo(p.key);
                          setShowP(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          periodo === p.key
                            ? 'bg-blue-900/40 text-blue-400 font-semibold'
                            : 'text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => cargar(true)}
                disabled={refreshing}
                className='flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-500 hover:bg-slate-50 transition-colors disabled:opacity-50'
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className='max-w-7xl mx-auto px-6 py-6 space-y-6'>
          {/* KPIs resumen */}
          <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4'>
            {loadingRes
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className='h-28 bg-white rounded-2xl border border-slate-200 animate-pulse'
                  />
                ))
              : resumen && (
                  <>
                    <KpiCard
                      label='Facturado'
                      value={fmtK(resumen.facturado)}
                      icon={TrendingUp}
                      color='bg-blue-100 text-blue-600'
                      sub={periodoLabel}
                    />
                    <KpiCard
                      label='Cobrado'
                      value={fmtK(resumen.cobrado)}
                      icon={TrendingUp}
                      color='bg-emerald-100 text-emerald-600'
                      sub={
                        resumen.facturado > 0
                          ? `${Math.round((resumen.cobrado / resumen.facturado) * 100)}% del facturado`
                          : undefined
                      }
                    />
                    <KpiCard
                      label='Saldo pendiente'
                      value={fmtK(resumen.facturado - resumen.cobrado)}
                      icon={TrendingUp}
                      color='bg-amber-100 text-amber-600'
                    />
                    <KpiCard
                      label='Órdenes cerradas'
                      value={String(resumen.ordenes_cerradas)}
                      icon={ClipboardList}
                      color='bg-violet-100 text-violet-600'
                    />
                    <KpiCard
                      label='Pres. aprobados'
                      value={String(resumen.presupuestos_aprobados)}
                      icon={FileText}
                      color='bg-indigo-100 text-indigo-600'
                      sub={`${resumen.tasa_conversion}% tasa`}
                    />
                    <KpiCard
                      label='Ticket promedio'
                      value={fmtK(resumen.ticket_promedio)}
                      icon={Users}
                      color='bg-rose-100 text-rose-600'
                    />
                  </>
                )}
          </div>

          {/* Gráficos fila 1: facturación (ancho completo) */}
          <ChartPanel titulo='Facturado vs Cobrado por mes' loading={loadingCh}>
            <ResponsiveContainer width='100%' height={240}>
              <LineChart
                data={serieFactura}
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                <XAxis
                  dataKey='label'
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={fmtK}
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip content={<TooltipCustom dinero />} />
                <Legend
                  iconType='circle'
                  iconSize={8}
                  formatter={(v) => (
                    <span style={{ fontSize: 11, color: '#64748b' }}>{v}</span>
                  )}
                />
                <Line
                  type='monotone'
                  dataKey='valor'
                  name='Facturado'
                  stroke='#3b82f6'
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type='monotone'
                  dataKey='valor2'
                  name='Cobrado'
                  stroke='#10b981'
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                  strokeDasharray='4 2'
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartPanel>

          {/* Gráficos fila 2: órdenes + presupuestos */}
          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <ChartPanel
              titulo='Órdenes: nuevas vs completadas'
              loading={loadingCh}
            >
              <ResponsiveContainer width='100%' height={220}>
                <BarChart
                  data={serieOrdenes}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  barSize={10}
                >
                  <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                  <XAxis
                    dataKey='label'
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<TooltipCustom />} />
                  <Legend
                    iconType='circle'
                    iconSize={7}
                    formatter={(v) => (
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        {v}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey='valor2'
                    name='Nuevas'
                    fill='#bfdbfe'
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey='valor'
                    name='Completadas'
                    fill='#3b82f6'
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel
              titulo='Presupuestos: emitidos vs aprobados'
              loading={loadingCh}
            >
              <ResponsiveContainer width='100%' height={220}>
                <BarChart
                  data={seriePres}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                  barSize={10}
                >
                  <CartesianGrid strokeDasharray='3 3' stroke='#f1f5f9' />
                  <XAxis
                    dataKey='label'
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<TooltipCustom />} />
                  <Legend
                    iconType='circle'
                    iconSize={7}
                    formatter={(v) => (
                      <span style={{ fontSize: 10, color: '#64748b' }}>
                        {v}
                      </span>
                    )}
                  />
                  <Bar
                    dataKey='valor'
                    name='Emitidos'
                    fill='#ddd6fe'
                    radius={[3, 3, 0, 0]}
                  />
                  <Bar
                    dataKey='valor2'
                    name='Aprobados'
                    fill='#7c3aed'
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartPanel>
          </div>

          {/* Ranking clientes */}
          <div className='bg-slate-800 rounded-2xl border border-slate-700 shadow-sm overflow-hidden'>
            <div className='px-5 py-4 border-b border-slate-100 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Users className='w-4 h-4 text-slate-400' />
                <h2 className='text-sm font-semibold text-slate-800'>
                  Top clientes por facturación acumulada
                </h2>
              </div>
              <span className='text-xs text-slate-400'>Histórico total</span>
            </div>
            <div className='px-5 py-3 divide-y divide-slate-50'>
              {loadingCh ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className='py-2.5'>
                    <div className='h-4 bg-slate-100 rounded animate-pulse mb-1.5 w-48' />
                    <div className='h-1.5 bg-slate-100 rounded animate-pulse w-full' />
                  </div>
                ))
              ) : ranking.length === 0 ? (
                <p className='text-sm text-slate-400 py-6 text-center'>
                  Sin datos de facturación
                </p>
              ) : (
                ranking.map((item, i) => (
                  <FilaRanking
                    key={item.id}
                    item={item}
                    rank={i + 1}
                    max={ranking[0].valor}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
