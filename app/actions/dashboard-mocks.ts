// ============================================================
// /app/actions/dashboard-mocks.ts
// Mocks para desarrollo y testing del Dashboard
// ============================================================

import type {
  DashboardKPIs,
  ActividadReciente,
  AlertaDashboard,
} from './dashboard';

// KPI Mocks — Datos realistas completos
export const mockDashboardKPIs: DashboardKPIs = {
  // Comercial
  presupuestos_pendientes: 12,
  presupuestos_mes: 24,
  tasa_conversion: 65,
  // Operativo
  ordenes_activas: 8,
  ordenes_en_progreso: 5,
  ordenes_completadas_mes: 18,
  // Finanzas
  facturado_mes: 185000,
  cobrado_mes: 142000,
  saldo_pendiente: 89500,
  facturas_vencidas: 3,
  // Logística
  notas_pedido_pendientes: 7,
  remitos_emitidos_mes: 31,
};

// Datos para gráficas
export const mockSalesData = [
  { month: 'Ene', value: 42000 },
  { month: 'Feb', value: 58000 },
  { month: 'Mar', value: 51000 },
  { month: 'Abr', value: 73000 },
  { month: 'May', value: 68000 },
  { month: 'Jun', value: 85000 },
];

export const mockOrdersDistribution = [
  { label: 'Completadas', value: 45, color: '#4ade80' },
  { label: 'En Progreso', value: 28, color: '#60a5fa' },
  { label: 'Pendientes', value: 18, color: '#f59e0b' },
  { label: 'Rechazadas', value: 9, color: '#f87171' },
];

export const mockTopClients = [
  { name: 'Acme Corp', value: 125000 },
  { name: 'Global Tech', value: 98000 },
  { name: 'Digital Sol', value: 76000 },
  { name: 'Build Inc', value: 54000 },
  { name: 'Enterprise', value: 42000 },
];

// Actividad Reciente — Últimas 12 operaciones
export const mockActividadReciente: ActividadReciente[] = [
  {
    id: '1',
    tipo: 'factura',
    numero: 'FAC-2026-00847',
    titulo: 'Acme Corporation',
    subtitulo: 'Servicios de Consultoría - Mayo',
    estado: 'COBRADA',
    fecha: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // hace 1h
    href: '/facturas/fac-847',
  },
  {
    id: '2',
    tipo: 'orden',
    numero: 'OS-2026-0342',
    titulo: 'Sistema de Automatización - Fase 1',
    subtitulo: 'TechStart Industries',
    estado: 'EN_PROGRESO',
    fecha: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // hace 3h
    href: '/ordenes/os-342',
  },
  {
    id: '3',
    tipo: 'presupuesto',
    numero: 'PRES-2026-01203',
    titulo: 'Desarrollo de App Móvil',
    subtitulo: 'Digital Solutions LLC',
    estado: 'APROBADO',
    fecha: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // hace 5h
    href: '/presupuestos/pres-1203',
  },
  {
    id: '4',
    tipo: 'remito',
    numero: 'REM-2026-2847',
    titulo: 'Entrega de Hardware y Equipos',
    subtitulo: 'Logística Centro',
    estado: 'ENTREGADO',
    fecha: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // hace 8h
    href: '/logistica/remitos/rem-2847',
  },
  {
    id: '5',
    tipo: 'nota_pedido',
    numero: 'NP-2026-0521',
    titulo: 'Compra de Repuestos Electrónicos',
    subtitulo: 'Almacén Central',
    estado: 'PENDIENTE',
    fecha: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // hace 12h
    href: '/logistica/notas/np-521',
  },
  {
    id: '6',
    tipo: 'factura',
    numero: 'FAC-2026-00846',
    titulo: 'Global Tech Services',
    subtitulo: 'Soporte técnico anual',
    estado: 'EMITIDA',
    fecha: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // hace 1 día
    href: '/facturas/fac-846',
  },
  {
    id: '7',
    tipo: 'orden',
    numero: 'OS-2026-0341',
    titulo: 'Instalación de Red Empresarial',
    subtitulo: 'Build Corp',
    estado: 'COMPLETADA',
    fecha: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // hace 1 día
    href: '/ordenes/os-341',
  },
  {
    id: '8',
    tipo: 'presupuesto',
    numero: 'PRES-2026-01202',
    titulo: 'Revisión de Código y Auditoría',
    subtitulo: 'CodeFlow Systems',
    estado: 'BORRADOR',
    fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // hace 2 días
    href: '/presupuestos/pres-1202',
  },
  {
    id: '9',
    tipo: 'remito',
    numero: 'REM-2026-2846',
    titulo: 'Devolución de Productos Defectuosos',
    subtitulo: 'Logística Centro',
    estado: 'ENTREGADO',
    fecha: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // hace 2 días
    href: '/logistica/remitos/rem-2846',
  },
  {
    id: '10',
    tipo: 'nota_pedido',
    numero: 'NP-2026-0520',
    titulo: 'Provisión de Software Licencias',
    subtitulo: 'Departamento IT',
    estado: 'RECIBIDO',
    fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // hace 3 días
    href: '/logistica/notas/np-520',
  },
  {
    id: '11',
    tipo: 'factura',
    numero: 'FAC-2026-00845',
    titulo: 'Enterprise Solutions Group',
    subtitulo: 'Consultoría estratégica trimestral',
    estado: 'ANULADO',
    fecha: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // hace 3 días
    href: '/facturas/fac-845',
  },
  {
    id: '12',
    tipo: 'orden',
    numero: 'OS-2026-0340',
    titulo: 'Mantenimiento Preventivo - Q1',
    subtitulo: 'Industrial Partners Inc',
    estado: 'COMPLETADA',
    fecha: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // hace 4 días
    href: '/ordenes/os-340',
  },
];

// Alertas — Notificaciones importantes
export const mockAlertas: AlertaDashboard[] = [
  {
    tipo: 'error',
    modulo: 'FINANZAS',
    mensaje: 'Tienes 3 facturas vencidas que requieren atención inmediata',
    href: '/facturas',
    cantidad: 3,
  },
  {
    tipo: 'warning',
    modulo: 'LOGÍSTICA',
    mensaje: '7 notas de pedido pendientes de procesamiento',
    href: '/logistica',
    cantidad: 7,
  },
  {
    tipo: 'info',
    modulo: 'COMERCIAL',
    mensaje: 'Tasa de conversión en 65% - Desempeño arriba del promedio',
    href: '/presupuestos',
    cantidad: 1,
  },
];

// Función helper para obtener mocks
export function getMockDashboardData() {
  return {
    kpis: mockDashboardKPIs,
    actividad: mockActividadReciente,
    alertas: mockAlertas,
    sales: mockSalesData,
    orders: mockOrdersDistribution,
    clients: mockTopClients,
  };
}
