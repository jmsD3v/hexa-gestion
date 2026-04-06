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
  Download,
  Loader2,
} from 'lucide-react';
import {
  obtenerSerieFacturacion,
  obtenerSerieOrdenes,
  obtenerSeriePresupuestos,
  obtenerRankingClientes,
  obtenerResumenPeriodo,
  exportarFacturasPeriodo,
  exportarOrdenesPeriodo,
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
    <div className='bg-slate-950 border border-slate-400/15 rounded-lg shadow-2xl px-3 py-2.5 text-sm'>
      <p className='font-semibold text-slate-200 mb-1.5'>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className='flex items-center gap-2'>
          <span
            className='w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[var(--dot-color)]'
            style={{ '--dot-color': p.color } as React.CSSProperties}
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
    <div className='bg-slate-900/70 rounded-lg border border-slate-400/10 p-4'>
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
    <div className='bg-slate-900/70 rounded-lg border border-slate-400/10 overflow-hidden'>
      <div className='px-5 py-4 border-b border-slate-400/10'>
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
          <p className='text-sm font-medium text-slate-200 truncate'>
            {item.nombre}
          </p>
          <span className='text-sm font-bold text-slate-100 ml-2 flex-shrink-0'>
            {fmt$(item.valor)}
          </span>
        </div>
        <div className='h-1.5 bg-slate-400/10 rounded-full overflow-hidden'>
          <div
            className='h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-700 w-[var(--bar-pct)]'
            style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
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

// ── Utilidad CSV ──────────────────────────────────────────────

function descargarCSV(
  filas: Record<string, unknown>[],
  columnas: { key: string; label: string }[],
  nombre: string,
) {
  const header = columnas.map((c) => `"${c.label}"`).join(',');
  const rows = filas.map((f) =>
    columnas
      .map((c) => {
        const v = f[c.key] ?? '';
        return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : String(v);
      })
      .join(','),
  );
  const csv = '\uFEFF' + [header, ...rows].join('\r\n'); // BOM para Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const [periodo, setPeriodo] = useState<PeriodoKey>('12m');
  const [showPeriodos, setShowP] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportando, setExportando] = useState(false);

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
  const { desde, hasta } = rangoDesde(meses);

  const handleExportar = async (tipo: 'facturas' | 'ordenes' | 'ranking' | 'facturacion') => {
    setShowExport(false);
    setExportando(true);

    const fechaNombre = `${desde}_${hasta}`;

    if (tipo === 'ranking') {
      descargarCSV(
        ranking as unknown as Record<string, unknown>[],
        [
          { key: 'nombre', label: 'Cliente' },
          { key: 'cantidad', label: 'Cant. facturas' },
          { key: 'valor', label: 'Total facturado (ARS)' },
        ],
        `ranking_clientes_${fechaNombre}.csv`,
      );
    }

    if (tipo === 'facturacion') {
      descargarCSV(
        serieFactura as unknown as Record<string, unknown>[],
        [
          { key: 'label', label: 'Mes' },
          { key: 'valor', label: 'Facturado (ARS)' },
          { key: 'valor2', label: 'Cobrado (ARS)' },
        ],
        `serie_facturacion_${fechaNombre}.csv`,
      );
    }

    if (tipo === 'facturas') {
      const res = await exportarFacturasPeriodo(desde, hasta);
      if (res.data) {
        descargarCSV(
          res.data as unknown as Record<string, unknown>[],
          [
            { key: 'numero', label: 'Número' },
            { key: 'fecha_emision', label: 'Fecha' },
            { key: 'tipo_comprobante', label: 'Tipo' },
            { key: 'cliente', label: 'Cliente' },
            { key: 'estado', label: 'Estado' },
            { key: 'subtotal', label: 'Subtotal (ARS)' },
            { key: 'iva_monto', label: 'IVA (ARS)' },
            { key: 'total', label: 'Total (ARS)' },
            { key: 'cobrado', label: 'Cobrado (ARS)' },
            { key: 'saldo_pendiente', label: 'Saldo (ARS)' },
          ],
          `facturas_${fechaNombre}.csv`,
        );
      }
    }

    if (tipo === 'ordenes') {
      const res = await exportarOrdenesPeriodo(desde, hasta);
      if (res.data) {
        descargarCSV(
          res.data as unknown as Record<string, unknown>[],
          [
            { key: 'numero', label: 'Número' },
            { key: 'titulo', label: 'Título' },
            { key: 'cliente', label: 'Cliente' },
            { key: 'estado', label: 'Estado' },
            { key: 'fecha_inicio', label: 'Inicio' },
            { key: 'fecha_fin_real', label: 'Fin real' },
            { key: 'presupuesto', label: 'Presupuesto' },
          ],
          `ordenes_${fechaNombre}.csv`,
        );
      }
    }

    setExportando(false);
  };

  return (
    <>
      <div className='min-h-screen bg-slate-950 bg-gradient-to-b from-violet-950/5 to-slate-950'>
        {/* Header */}
        <div className='bg-slate-900/80 backdrop-blur-sm border-b border-slate-400/10 px-6 py-5'>
          <div className='max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3'>
            <div className='min-w-0'>
              <div className='mb-1 flex items-center gap-2'>
                <span className='text-[11px] text-slate-500 tracking-widest uppercase'>Hexa Gestión</span>
                <span className='text-slate-500'>›</span>
                <span className='text-[11px] text-slate-600 tracking-widest uppercase'>Reportes</span>
              </div>
              <h1 className='text-[32px] leading-none font-bold tracking-tight text-slate-100 max-[780px]:text-[22px]'>
                Reportes
              </h1>
            </div>
            <div className='flex items-center gap-2'>
              {/* Selector de período */}
              <div className='relative'>
                <button
                  onClick={() => setShowP((v) => !v)}
                  className='flex items-center gap-2 px-4 py-2 bg-transparent border border-slate-400/10 rounded-[7px] text-sm font-medium text-slate-400 hover:bg-slate-400/5 hover:text-slate-200 transition-colors'
                >
                  <Calendar className='w-4 h-4 text-slate-400' />
                  {periodoLabel}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showPeriodos ? 'rotate-180' : ''}`}
                  />
                </button>
                {showPeriodos && (
                  <div className='absolute right-0 top-full mt-1 w-48 bg-slate-950 border border-slate-400/15 rounded-[9px] shadow-2xl z-20 overflow-hidden'>
                    {PERIODOS.map((p) => (
                      <button
                        key={p.key}
                        onClick={() => {
                          setPeriodo(p.key);
                          setShowP(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                          periodo === p.key
                            ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                            : 'text-slate-400 hover:bg-slate-400/5 hover:text-slate-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Exportar */}
              <div className='relative'>
                <button
                  onClick={() => setShowExport((v) => !v)}
                  disabled={exportando || loadingCh}
                  className='flex items-center gap-1.5 px-3 py-2 bg-transparent border border-slate-400/10 rounded-[7px] text-sm font-medium text-slate-400 hover:bg-slate-400/5 hover:text-slate-200 transition-colors disabled:opacity-50'
                >
                  {exportando
                    ? <Loader2 className='w-3.5 h-3.5 animate-spin' />
                    : <Download className='w-3.5 h-3.5' />}
                  Exportar
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${showExport ? 'rotate-180' : ''}`} />
                </button>
                {showExport && (
                  <div className='absolute right-0 top-full mt-1 w-56 bg-slate-950 border border-slate-400/15 rounded-[9px] shadow-2xl z-30 overflow-hidden'>
                    {[
                      { key: 'facturas',    label: 'Facturas del período', sub: 'Detalle completo' },
                      { key: 'ordenes',     label: 'Órdenes del período',  sub: 'Con estado y fechas' },
                      { key: 'facturacion', label: 'Serie facturación',    sub: 'Datos del gráfico' },
                      { key: 'ranking',     label: 'Ranking clientes',     sub: 'Top por facturación' },
                    ].map((op) => (
                      <button
                        key={op.key}
                        onClick={() => handleExportar(op.key as any)}
                        className='w-full text-left px-4 py-3 hover:bg-slate-400/5 transition-colors border-b border-slate-400/5 last:border-0'
                      >
                        <div className='text-sm font-medium text-slate-200'>{op.label}</div>
                        <div className='text-xs text-slate-500'>{op.sub} · CSV</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => cargar(true)}
                disabled={refreshing}
                className='flex items-center gap-1.5 px-3 py-2 border border-slate-400/10 rounded-[7px] text-sm text-slate-400 hover:bg-slate-400/5 transition-colors disabled:opacity-50'
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
                    className='h-28 bg-slate-900/70 rounded-lg border border-slate-400/10 animate-pulse'
                  />
                ))
              : resumen && (
                  <>
                    <KpiCard
                      label='Facturado'
                      value={fmtK(resumen.facturado)}
                      icon={TrendingUp}
                      color='bg-blue-500/15 text-blue-400'
                      sub={periodoLabel}
                    />
                    <KpiCard
                      label='Cobrado'
                      value={fmtK(resumen.cobrado)}
                      icon={TrendingUp}
                      color='bg-emerald-500/15 text-emerald-400'
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
                      color='bg-amber-500/15 text-amber-400'
                    />
                    <KpiCard
                      label='Órdenes cerradas'
                      value={String(resumen.ordenes_cerradas)}
                      icon={ClipboardList}
                      color='bg-violet-500/15 text-violet-400'
                    />
                    <KpiCard
                      label='Pres. aprobados'
                      value={String(resumen.presupuestos_aprobados)}
                      icon={FileText}
                      color='bg-indigo-500/15 text-indigo-400'
                      sub={`${resumen.tasa_conversion}% tasa`}
                    />
                    <KpiCard
                      label='Ticket promedio'
                      value={fmtK(resumen.ticket_promedio)}
                      icon={Users}
                      color='bg-rose-500/15 text-rose-400'
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
                <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
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
                    <span className='text-[11px] text-slate-500'>{v}</span>
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
                  <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
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
                      <span className='text-[10px] text-slate-500'>
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
                  <CartesianGrid strokeDasharray='3 3' stroke='#1e293b' />
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
                      <span className='text-[10px] text-slate-500'>
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
          <div className='bg-slate-900/70 rounded-lg border border-slate-400/10 overflow-hidden'>
            <div className='px-5 py-4 border-b border-slate-400/10 flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Users className='w-4 h-4 text-slate-400' />
                <h2 className='text-sm font-semibold text-slate-100'>
                  Top clientes por facturación acumulada
                </h2>
              </div>
              <span className='text-xs text-slate-400'>Histórico total</span>
            </div>
            <div className='px-5 py-3 divide-y divide-slate-400/5'>
              {loadingCh ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className='py-2.5'>
                    <div className='h-4 bg-slate-400/10 rounded animate-pulse mb-1.5 w-48' />
                    <div className='h-1.5 bg-slate-400/10 rounded animate-pulse w-full' />
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
