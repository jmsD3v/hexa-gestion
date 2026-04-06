'use client';

// ============================================================
// /components/modules/dashboard/Dashboard.tsx
// Panel principal — KPIs, alertas y actividad reciente
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  ClipboardList,
  Receipt,
  Package,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  ArrowRight,
  RefreshCw,
  DollarSign,
  Wallet,
  ShieldAlert,
  Truck,
  Users,
  BarChart3,
} from 'lucide-react';
import {
  obtenerDashboardKPIs,
  obtenerActividadReciente,
  obtenerAlertas,
} from '@/app/actions/dashboard';
import {
  getMockDashboardData,
  mockSalesData,
  mockOrdersDistribution,
  mockTopClients,
} from '@/app/actions/dashboard-mocks';
import { SalesLineChart, OrdersPieChart, TopClientsBarChart } from './Charts';
import type {
  DashboardKPIs,
  ActividadReciente,
  AlertaDashboard,
} from '@/app/actions/dashboard';

// ── Helpers ───────────────────────────────────────────────────

const fmt$ = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

const fmtFecha = (iso: string) => {
  const d = new Date(iso);
  const ahora = new Date();
  const diff = Math.floor((ahora.getTime() - d.getTime()) / 60000);
  if (diff < 60) return `hace ${diff}m`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)}h`;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
};

// ── Estado configs ────────────────────────────────────────────

const ESTADO_COLOR: Record<string, string> = {
  BORRADOR: 'bg-slate-800 text-slate-300 border border-slate-700',
  ENVIADO: 'bg-amber-900/40 text-amber-400',
  APROBADO: 'bg-emerald-900/40 text-emerald-400',
  RECHAZADO: 'bg-red-900/40 text-red-400',
  PENDIENTE: 'bg-amber-900/40 text-amber-400',
  EN_PROGRESO: 'bg-blue-900/40 text-blue-400',
  COMPLETADA: 'bg-emerald-900/40 text-emerald-400',
  EMITIDA: 'bg-blue-900/40 text-blue-400',
  COBRADA: 'bg-emerald-900/40 text-emerald-400',
  ANULADO: 'bg-red-900/40 text-red-400',
  EMITIDO: 'bg-blue-900/40 text-blue-400',
  ENTREGADO: 'bg-emerald-900/40 text-emerald-400',
  PARCIAL: 'bg-orange-900/40 text-orange-400',
  RECIBIDO: 'bg-emerald-900/40 text-emerald-400',
};

const TIPO_ICON: Record<string, React.FC<any>> = {
  presupuesto: FileText,
  orden: ClipboardList,
  factura: Receipt,
  remito: Truck,
  nota_pedido: Package,
};

const TIPO_COLOR: Record<string, string> = {
  presupuesto: 'bg-violet-900/40 text-violet-400',
  orden: 'bg-blue-900/40 text-blue-400',
  factura: 'bg-emerald-900/40 text-emerald-400',
  remito: 'bg-orange-900/40 text-orange-400',
  nota_pedido: 'bg-teal-900/40 text-teal-400',
};

// ── KPI Card ──────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  icon: React.FC<any>;
  iconBg: string;
  href?: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  alert?: boolean;
  loading?: boolean;
}

function KPICard({
  label,
  value,
  icon: Icon,
  iconBg,
  href,
  sub,
  trend,
  alert,
  loading,
}: KPICardProps) {
  const inner = (
    <div
      className={`bg-slate-900/70 backdrop-blur-xl rounded-lg border p-5 flex flex-col gap-3 transition-all h-full ${
        alert
          ? 'border-red-500/25 bg-red-900/10'
          : 'border-slate-400/10 hover:border-slate-400/20'
      } ${href ? 'cursor-pointer' : ''}`}
    >
      <div className='flex items-start justify-between'>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon className='w-5 h-5' />
        </div>
        {trend === 'up' && (
          <TrendingUp className='w-4 h-4 text-emerald-500 mt-1' />
        )}
        {trend === 'down' && (
          <TrendingDown className='w-4 h-4 text-red-500 mt-1' />
        )}
        {alert && <AlertTriangle className='w-4 h-4 text-red-500 mt-1' />}
      </div>
      {loading ? (
        <div className='space-y-1.5 flex-1 flex flex-col justify-center'>
          <div className='h-7 w-24 bg-slate-400/10 rounded animate-pulse' />
          <div className='h-3.5 w-32 bg-slate-400/10 rounded animate-pulse' />
        </div>
      ) : (
        <div className='flex-1 flex flex-col justify-center'>
          <p
            className={`text-2xl font-bold leading-none ${alert ? 'text-red-400' : 'text-slate-100'}`}
          >
            {value}
          </p>
          <p className='text-xs text-slate-400 mt-1.5'>{label}</p>
          {sub && <p className='text-xs text-slate-500 mt-0.5'>{sub}</p>}
        </div>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Alerta Banner ─────────────────────────────────────────────

function AlertaBanner({ alerta }: { alerta: AlertaDashboard }) {
  const cfgs = {
    error: {
      bg: 'bg-red-900/20 border-red-700',
      icon: ShieldAlert,
      text: 'text-red-400',
      iconC: 'text-red-400',
    },
    warning: {
      bg: 'bg-amber-900/20 border-amber-700',
      icon: AlertTriangle,
      text: 'text-amber-400',
      iconC: 'text-amber-400',
    },
    info: {
      bg: 'bg-blue-900/20 border-blue-700',
      icon: Info,
      text: 'text-blue-400',
      iconC: 'text-blue-400',
    },
  };
  const cfg = cfgs[alerta.tipo];
  const Icon = cfg.icon;
  return (
    <Link
      href={alerta.href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${cfg.bg} group transition-all hover:shadow-sm`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${cfg.iconC}`} />
      <div className='flex-1 min-w-0'>
        <span
          className={`text-xs font-semibold uppercase tracking-wider ${cfg.iconC} mr-2`}
        >
          {alerta.modulo}
        </span>
        <span className={`text-sm ${cfg.text}`}>{alerta.mensaje}</span>
      </div>
      <ArrowRight
        className={`w-4 h-4 flex-shrink-0 ${cfg.iconC} opacity-0 group-hover:opacity-100 transition-opacity`}
      />
    </Link>
  );
}

// ── Fila Actividad ────────────────────────────────────────────

function FilaActividad({ item }: { item: ActividadReciente }) {
  const Icon = TIPO_ICON[item.tipo] ?? FileText;
  const tipoClr = TIPO_COLOR[item.tipo] ?? 'bg-slate-100 text-slate-500';
  const estadoClr = ESTADO_COLOR[item.estado] ?? 'bg-slate-100 text-slate-500';

  return (
    <Link
      href={item.href}
      className='flex items-center gap-3 px-4 py-3 hover:bg-slate-400/3 rounded-xl transition-colors group'
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${tipoClr}`}
      >
        <Icon className='w-4 h-4' />
      </div>
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2'>
          <span className='text-xs font-mono font-semibold text-slate-200'>
            {item.numero}
          </span>
          <span className='text-xs text-slate-400 truncate'>
            {item.subtitulo}
          </span>
        </div>
        <p className='text-sm text-slate-100 font-medium truncate leading-tight mt-0.5'>
          {item.titulo}
        </p>
      </div>
      <div className='flex items-center gap-2 flex-shrink-0'>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${estadoClr}`}
        >
          {item.estado.replace(/_/g, ' ')}
        </span>
        <span className='text-[11px] text-slate-500 w-14 text-right'>
          {fmtFecha(item.fecha)}
        </span>
        <ArrowRight className='w-3.5 h-3.5 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity' />
      </div>
    </Link>
  );
}

// ── Acceso rápido ─────────────────────────────────────────────

function AccesoRapido({
  label,
  href,
  icon: Icon,
  color,
}: {
  label: string;
  href: string;
  icon: React.FC<any>;
  color: string;
}) {
  return (
    <Link
      href={href}
      className='flex flex-col items-center gap-2 p-3 sm:p-4 bg-slate-900/70 border border-slate-400/10 rounded-xl hover:border-slate-400/20 hover:bg-slate-900/90 transition-all group text-center'
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}
      >
        <Icon className='w-5 h-5' />
      </div>
      <span className='text-xs font-medium text-slate-200 leading-tight line-clamp-2'>
        {label}
      </span>
    </Link>
  );
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function Dashboard({
  nombreUsuario,
  useMocks = false,
}: {
  nombreUsuario?: string;
  useMocks?: boolean;
}) {
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [actividad, setActividad] = useState<ActividadReciente[]>([]);
  const [alertas, setAlertas] = useState<AlertaDashboard[]>([]);
  const [loadingKPIs, setLoadingKPIs] = useState(true);
  const [loadingAct, setLoadingAct] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) setRefreshing(true);

      const shouldUseMocks =
        useMocks ||
        process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

      if (shouldUseMocks) {
        const mockData = getMockDashboardData();
        setKpis(mockData.kpis);
        setActividad(mockData.actividad);
        setAlertas(mockData.alertas);
        setLoadingKPIs(false);
        setLoadingAct(false);
        setRefreshing(false);
        return;
      }

      const [kpisRes, actRes, alertasRes] = await Promise.all([
        obtenerDashboardKPIs(),
        obtenerActividadReciente(12),
        obtenerAlertas(),
      ]);
      if (kpisRes.data) setKpis(kpisRes.data);
      if (actRes.data) setActividad(actRes.data);
      if (alertasRes.data) setAlertas(alertasRes.data);
      setLoadingKPIs(false);
      setLoadingAct(false);
      setRefreshing(false);
    },
    [useMocks],
  );

  useEffect(() => {
    cargar();
  }, [cargar]);

  const hora = new Date().getHours();
  const saludo =
    hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <>
      <div
        className='min-h-screen bg-slate-950 bg-gradient-to-b from-emerald-950/5 to-slate-950'
      >
        {/* Header */}
        <div className='bg-slate-900/80 backdrop-blur-sm border-b border-slate-400/10 px-4 sm:px-6 py-4 sm:py-5'>
          <div className='max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
            <div className='min-w-0'>
              <h1 className='text-lg sm:text-xl font-bold text-slate-100 truncate'>
                {saludo}
                {nombreUsuario ? `, ${nombreUsuario.split(' ')[0]}` : ''} 👋
              </h1>
              <p className='text-xs sm:text-sm text-slate-400 mt-0.5'>
                {new Date().toLocaleDateString('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <button
              onClick={() => cargar(true)}
              disabled={refreshing}
              className='flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 border border-slate-400/10 rounded-xl hover:bg-slate-400/5 transition-colors disabled:opacity-50 flex-shrink-0 w-full sm:w-auto justify-center'
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
              />
              Actualizar
            </button>
          </div>
        </div>

        <div className='max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6'>
          {/* Alertas críticas */}
          {alertas.length > 0 && (
            <div className='space-y-2'>
              {alertas.map((a, i) => (
                <AlertaBanner key={i} alerta={a} />
              ))}
            </div>
          )}

          {/* KPIs — 3 secciones */}

          {/* Comercial */}
          <div>
            <h2 className='text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3'>
              Comercial
            </h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              <KPICard
                label='Presupuestos activos'
                value={kpis?.presupuestos_pendientes ?? '—'}
                icon={FileText}
                iconBg='bg-violet-900/40 text-violet-400'
                href='/presupuestos'
                sub='Borrador + Enviados'
                loading={loadingKPIs}
              />
              <KPICard
                label='Emitidos este mes'
                value={kpis?.presupuestos_mes ?? '—'}
                icon={TrendingUp}
                iconBg='bg-violet-900/30 text-violet-400'
                href='/presupuestos'
                loading={loadingKPIs}
              />
              <KPICard
                label='Tasa de conversión'
                value={kpis ? `${kpis.tasa_conversion}%` : '—'}
                icon={BarChart3}
                iconBg='bg-indigo-900/40 text-indigo-400'
                href='/presupuestos'
                sub='Enviados → Aprobados'
                trend={kpis && kpis.tasa_conversion >= 50 ? 'up' : 'neutral'}
                loading={loadingKPIs}
              />
              <KPICard
                label='Órdenes en progreso'
                value={kpis?.ordenes_en_progreso ?? '—'}
                icon={ClipboardList}
                iconBg='bg-blue-900/40 text-blue-400'
                href='/ordenes'
                sub={`${kpis?.ordenes_activas ?? '—'} activas en total`}
                loading={loadingKPIs}
              />
            </div>
          </div>

          {/* Finanzas */}
          <div>
            <h2 className='text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3'>
              Finanzas
            </h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              <KPICard
                label='Facturado este mes'
                value={kpis ? fmt$(kpis.facturado_mes) : '—'}
                icon={DollarSign}
                iconBg='bg-emerald-900/40 text-emerald-400'
                href='/facturas'
                trend='up'
                loading={loadingKPIs}
              />
              <KPICard
                label='Cobrado este mes'
                value={kpis ? fmt$(kpis.cobrado_mes) : '—'}
                icon={Wallet}
                iconBg='bg-teal-900/40 text-teal-400'
                href='/facturas'
                sub={
                  kpis && kpis.facturado_mes > 0
                    ? `${Math.round((kpis.cobrado_mes / kpis.facturado_mes) * 100)}% del facturado`
                    : undefined
                }
                loading={loadingKPIs}
              />
              <KPICard
                label='Saldo pendiente'
                value={kpis ? fmt$(kpis.saldo_pendiente) : '—'}
                icon={Receipt}
                iconBg='bg-amber-900/40 text-amber-400'
                href='/facturas'
                sub='Total a cobrar'
                loading={loadingKPIs}
              />
              <KPICard
                label='Facturas vencidas'
                value={kpis?.facturas_vencidas ?? '—'}
                icon={AlertCircle}
                iconBg='bg-red-900/40 text-red-400'
                href='/facturas'
                alert={(kpis?.facturas_vencidas ?? 0) > 0}
                loading={loadingKPIs}
              />
            </div>
          </div>

          {/* Logística */}
          <div>
            <h2 className='text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3'>
              Logística
            </h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
              <KPICard
                label='Notas de pedido pendientes'
                value={kpis?.notas_pedido_pendientes ?? '—'}
                icon={Package}
                iconBg='bg-orange-900/40 text-orange-400'
                href='/logistica'
                alert={(kpis?.notas_pedido_pendientes ?? 0) > 0}
                loading={loadingKPIs}
              />
              <KPICard
                label='Remitos emitidos (mes)'
                value={kpis?.remitos_emitidos_mes ?? '—'}
                icon={Truck}
                iconBg='bg-slate-700 text-slate-300'
                href='/logistica'
                loading={loadingKPIs}
              />
              <KPICard
                label='OS completadas (mes)'
                value={kpis?.ordenes_completadas_mes ?? '—'}
                icon={CheckCircle2}
                iconBg='bg-emerald-900/40 text-emerald-400'
                href='/ordenes'
                loading={loadingKPIs}
              />
              <KPICard
                label='Clientes activos'
                value='—'
                icon={Users}
                iconBg='bg-sky-900/40 text-sky-400'
                href='/clientes'
                loading={false}
              />
            </div>
          </div>

          {/* Gráficas */}
          <div>
            <h2 className='text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3'>
              Análisis
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              {/* Ventas Mensuales */}
              <div className='bg-slate-900/70 backdrop-blur-xl rounded-lg border border-slate-400/10 p-4'>
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='text-sm font-semibold text-slate-100'>
                    Ventas Mensuales
                  </h3>
                  <BarChart3 className='w-4 h-4 text-blue-400' />
                </div>
                <div className='flex justify-center'>
                  <SalesLineChart data={mockSalesData} />
                </div>
              </div>

              {/* Distribución de Órdenes */}
              <div className='bg-slate-900/70 backdrop-blur-xl rounded-lg border border-slate-400/10 p-4'>
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='text-sm font-semibold text-slate-100'>
                    Estados de Órdenes
                  </h3>
                  <BarChart3 className='w-4 h-4 text-emerald-400' />
                </div>
                <div className='flex justify-center'>
                  <OrdersPieChart data={mockOrdersDistribution} />
                </div>
                <div className='mt-3 space-y-1 text-xs'>
                  {mockOrdersDistribution.map((item) => (
                    <div key={item.label} className='flex items-center gap-2'>
                      <div
                        className={`w-2 h-2 rounded-full ${item.colorCls}`}
                      />
                      <span className='text-slate-300'>{item.label}</span>
                      <span className='ml-auto text-slate-400'>
                        {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Clientes */}
              <div className='bg-slate-900/70 backdrop-blur-xl rounded-lg border border-slate-400/10 p-4'>
                <div className='flex items-center justify-between mb-3'>
                  <h3 className='text-sm font-semibold text-slate-100'>
                    Top Clientes
                  </h3>
                  <Users className='w-4 h-4 text-sky-400' />
                </div>
                <div className='flex justify-center'>
                  <TopClientsBarChart data={mockTopClients} />
                </div>
              </div>
            </div>
          </div>

          {/* Panel inferior: Actividad + Accesos rápidos */}
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6'>
            {/* Actividad reciente */}
            <div className='lg:col-span-2 bg-slate-900/70 backdrop-blur-xl rounded-lg border border-slate-400/10 overflow-hidden'>
              <div className='px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-400/5 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <Clock className='w-4 h-4 text-slate-500 flex-shrink-0' />
                  <h2 className='text-sm font-semibold text-slate-100 truncate'>
                    Actividad reciente
                  </h2>
                </div>
                <span className='text-xs text-slate-500 flex-shrink-0 ml-2'>
                  {actividad.length}
                </span>
              </div>

              {loadingAct ? (
                <div className='p-4 space-y-2'>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className='flex items-center gap-3 px-2 py-2'>
                      <div className='w-8 h-8 rounded-lg bg-slate-400/10 animate-pulse flex-shrink-0' />
                      <div className='flex-1 space-y-1.5 min-w-0'>
                        <div className='h-3 w-32 bg-slate-400/10 rounded animate-pulse' />
                        <div className='h-3.5 w-48 bg-slate-400/10 rounded animate-pulse' />
                      </div>
                      <div className='h-5 w-16 bg-slate-400/10 rounded-full animate-pulse flex-shrink-0' />
                    </div>
                  ))}
                </div>
              ) : actividad.length === 0 ? (
                <div className='flex flex-col items-center justify-center py-16 text-slate-500'>
                  <Clock className='w-10 h-10 mb-3 opacity-30' />
                  <p className='text-sm'>Sin actividad reciente</p>
                </div>
              ) : (
                <div className='p-2 divide-y divide-slate-400/5'>
                  {actividad.map((item) => (
                    <FilaActividad key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>

            {/* Panel derecho: Accesos rápidos + estado */}
            <div className='space-y-4'>
              {/* Accesos rápidos */}
              <div className='bg-slate-900/70 backdrop-blur-xl rounded-lg border border-slate-400/10 p-4'>
                <h2 className='text-sm font-semibold text-slate-100 mb-3'>
                  Crear nuevo
                </h2>
                <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
                  <AccesoRapido
                    label='Presupuesto'
                    href='/presupuestos/nuevo'
                    icon={FileText}
                    color='bg-violet-900/40 text-violet-400'
                  />
                  <AccesoRapido
                    label='Orden de Servicio'
                    href='/ordenes/nueva'
                    icon={ClipboardList}
                    color='bg-blue-900/40 text-blue-400'
                  />
                  <AccesoRapido
                    label='Factura'
                    href='/facturas/nueva'
                    icon={Receipt}
                    color='bg-emerald-900/40 text-emerald-400'
                  />
                  <AccesoRapido
                    label='Nota de pedido'
                    href='/logistica/notas/nueva'
                    icon={Package}
                    color='bg-orange-900/40 text-orange-400'
                  />
                  <AccesoRapido
                    label='Remito'
                    href='/logistica/remitos/nuevo'
                    icon={Truck}
                    color='bg-slate-700 text-slate-300'
                  />
                  <AccesoRapido
                    label='Cliente'
                    href='/clientes/nuevo'
                    icon={Users}
                    color='bg-sky-900/40 text-sky-400'
                  />
                </div>
              </div>

              {/* Resumen de estado del sistema */}
              <div className='bg-slate-900/70 backdrop-blur-xl rounded-lg border border-slate-400/10 p-4'>
                <h2 className='text-sm font-semibold text-slate-100 mb-3'>
                  Estado del sistema
                </h2>
                <div className='space-y-2.5'>
                  {[
                    {
                      label: 'Órdenes activas',
                      value: kpis?.ordenes_activas ?? 0,
                      total:
                        (kpis?.ordenes_activas ?? 0) +
                        (kpis?.ordenes_completadas_mes ?? 0),
                      color: 'bg-blue-500',
                    },
                    {
                      label: 'Cobro del mes',
                      value: kpis?.cobrado_mes ?? 0,
                      total: kpis?.facturado_mes ?? 1,
                      color: 'bg-emerald-500',
                      isMoney: true,
                    },
                  ].map((item) => {
                    const pct =
                      item.total > 0
                        ? Math.min(
                            100,
                            Math.round((item.value / item.total) * 100),
                          )
                        : 0;
                    return (
                      <div key={item.label}>
                        <div className='flex items-center justify-between mb-1'>
                          <span className='text-xs text-slate-400'>
                            {item.label}
                          </span>
                          <span className='text-xs font-semibold text-slate-300'>
                            {item.isMoney ? `${pct}%` : `${item.value}`}
                          </span>
                        </div>
                        <div className='h-1.5 bg-slate-700 rounded-full overflow-hidden'>
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${item.color} w-[var(--bar-pct)]`}
                            style={{ '--bar-pct': `${pct}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>
                    );
                  })}

                  {loadingKPIs && (
                    <div className='space-y-2'>
                      {[1, 2].map((i) => (
                        <div
                          key={i}
                          className='h-6 bg-slate-700 rounded animate-pulse'
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
