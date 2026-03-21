import type {
  ClienteConDirecciones,
  ClienteDireccion,
  ClienteKPIs,
  ClienteListaItem,
  CondicionIVA,
  EstadoFactura,
  EstadoOrden,
  EstadoPresupuesto,
  Factura,
  FacturaCompleta,
  FacturaItem,
  FiltrosCliente,
  FiltrosFactura,
  FiltrosOrden,
  FiltrosPresupuesto,
  NotaPedido,
  NotaPedidoCompleta,
  NotaPedidoItem,
  OrdenServicioCompleta,
  OrdenTecnico,
  OrdenServicio,
  PaginatedResponse,
  Presupuesto,
  PresupuestoCompleto,
  PresupuestoIncidencia,
  PresupuestoItem,
  Recibo,
  Remito,
  RemitoCompleto,
  RemitoItem,
  TipoComprobanteAFIP,
  TipoOperacion,
} from '@/types';
import type { EventoCalendario } from '@/types/calendario';
import type {
  EstadoNotaPedido,
  EstadoRemito,
  TipoDocumento,
  TipoPago,
  TipoRecibo,
  TipoRemito,
} from '@/types/database';
import type { PuntoSerie, RankingItem, ResumenPeriodo } from './reportes';

type ClienteMock = ClienteListaItem;
type PresupuestoMock = Presupuesto & { razon_social: string };
type OrdenMock = OrdenServicio & {
  razon_social: string;
  numero_presupuesto: string | null;
};
type FacturaMock = Factura & { razon_social: string };
type NotaMock = NotaPedido & {
  nombre_orden: string | null;
  cantidad_items: number;
};
type RemitoMock = Remito & {
  nombre_orden: string | null;
  razon_social: string | null;
  cantidad_items: number;
};

type OrdenDetalleMock = OrdenServicioCompleta & {
  razon_social: string;
  numero_presupuesto: string | null;
};
type FacturaDetalleMock = FacturaCompleta & {
  razon_social: string;
  numero_presupuesto: string | null;
  numero_orden: string | null;
};
type NotaDetalleMock = NotaPedidoCompleta & { numero_orden: string | null };
type RemitoDetalleMock = RemitoCompleto & {
  numero_orden: string | null;
  razon_social: string | null;
};

export const shouldUsePlatformMocks =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_USE_MOCKS === 'true';

const now = new Date();

function dayOffset(offset: number) {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  return date.toISOString().split('T')[0];
}

function timestampOffset(days: number, hours = 9) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hours, 0, 0, 0);
  return date.toISOString();
}

function auditFields(index: number) {
  return {
    creado_en: timestampOffset(-index - 24),
    actualizado_en: timestampOffset(-Math.max(1, index)),
    creado_por: 'mock-user-admin',
  };
}

function paginate<T>(
  rows: T[],
  pagina = 1,
  por_pagina = 20,
): PaginatedResponse<T> {
  const total = rows.length;
  const total_paginas = Math.max(1, Math.ceil(total / por_pagina));
  const paginaSegura = Math.min(Math.max(1, pagina), total_paginas);
  const inicio = (paginaSegura - 1) * por_pagina;
  return {
    data: rows.slice(inicio, inicio + por_pagina),
    total,
    pagina: paginaSegura,
    por_pagina,
    total_paginas,
  };
}

function includesTerm(value: string | null | undefined, term: string) {
  return (value ?? '').toLowerCase().includes(term.toLowerCase());
}

const clientesBase: ClienteMock[] = [
  {
    id: 'cli-001',
    razon_social: 'Acme Industrial SA',
    nombre_fantasia: 'Acme Industrial',
    cuit: '30-71234567-8',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    telefono: '+54 11 4567-1020',
    email: 'compras@acmeindustrial.com',
    segmento: 'Automatización Industrial',
    activo: true,
    ultima_actividad: timestampOffset(-1),
    saldo_pendiente: 124500,
  },
  {
    id: 'cli-002',
    razon_social: 'Solar Grid Patagonia SRL',
    nombre_fantasia: 'Solar Grid',
    cuit: '30-70111222-3',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    telefono: '+54 299 477-8801',
    email: 'proyectos@solargrid.com',
    segmento: 'Energía Solar / Fotovoltaica',
    activo: true,
    ultima_actividad: timestampOffset(-2),
    saldo_pendiente: 0,
  },
  {
    id: 'cli-003',
    razon_social: 'FríoSur Servicios Técnicos',
    nombre_fantasia: 'FríoSur',
    cuit: '20-28444555-1',
    condicion_iva: 'MONOTRIBUTISTA',
    telefono: '+54 261 444-9911',
    email: 'operaciones@friosur.com',
    segmento: 'HVAC / Climatización',
    activo: true,
    ultima_actividad: timestampOffset(-4),
    saldo_pendiente: 58200,
  },
  {
    id: 'cli-004',
    razon_social: 'Build & Energy Constructora',
    nombre_fantasia: 'Build & Energy',
    cuit: '30-69888777-0',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    telefono: '+54 351 477-1919',
    email: 'administracion@buildenergy.com',
    segmento: 'Obra Civil',
    activo: true,
    ultima_actividad: timestampOffset(-6),
    saldo_pendiente: 315000,
  },
  {
    id: 'cli-005',
    razon_social: 'Andes Pharma Labs',
    nombre_fantasia: 'Andes Pharma',
    cuit: '30-65555444-9',
    condicion_iva: 'EXENTO',
    telefono: '+54 11 4399-0202',
    email: 'mantenimiento@andespharma.com',
    segmento: 'Servicios Técnicos',
    activo: true,
    ultima_actividad: timestampOffset(-7),
    saldo_pendiente: 0,
  },
  {
    id: 'cli-006',
    razon_social: 'Mercurio Retail Group',
    nombre_fantasia: 'Mercurio Retail',
    cuit: '30-62345678-2',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    telefono: '+54 341 522-0909',
    email: 'infraestructura@mercurio.com',
    segmento: 'Instalaciones Eléctricas',
    activo: true,
    ultima_actividad: timestampOffset(-9),
    saldo_pendiente: 92850,
  },
  {
    id: 'cli-007',
    razon_social: 'Estudio Galia Arquitectura',
    nombre_fantasia: 'Galia Arquitectura',
    cuit: '27-30222333-0',
    condicion_iva: 'CONSUMIDOR_FINAL',
    telefono: '+54 11 4882-1004',
    email: 'hola@galia.ar',
    segmento: 'Obra Civil',
    activo: true,
    ultima_actividad: timestampOffset(-11),
    saldo_pendiente: 18500,
  },
  {
    id: 'cli-008',
    razon_social: 'TecnoBaires Integraciones',
    nombre_fantasia: 'TecnoBaires',
    cuit: '30-74555111-6',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    telefono: '+54 11 4780-7300',
    email: 'servicio@tecnobaires.com',
    segmento: 'Automatización Industrial',
    activo: true,
    ultima_actividad: timestampOffset(-13),
    saldo_pendiente: 74000,
  },
  {
    id: 'cli-009',
    razon_social: 'Logística Delta SA',
    nombre_fantasia: 'Delta Logística',
    cuit: '30-67777888-1',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    telefono: '+54 11 4901-6655',
    email: 'deposito@deltalogistica.com',
    segmento: 'Servicios Técnicos',
    activo: false,
    ultima_actividad: timestampOffset(-20),
    saldo_pendiente: 0,
  },
  {
    id: 'cli-010',
    razon_social: 'Innova Food Plant',
    nombre_fantasia: 'Innova Food',
    cuit: '30-71999888-4',
    condicion_iva: 'RESPONSABLE_INSCRIPTO',
    telefono: '+54 261 521-4570',
    email: 'ingenieria@innovafood.com',
    segmento: 'Servicios Técnicos',
    activo: true,
    ultima_actividad: timestampOffset(-3),
    saldo_pendiente: 211700,
  },
];

const presupuestosBase: PresupuestoMock[] = [
  {
    id: 'pres-001',
    numero: 'PRES-2026-00118',
    cliente_id: 'cli-001',
    direccion_id: null,
    razon_social: 'Acme Industrial SA',
    titulo: 'Migración de tableros de control HVAC',
    objetivo_servicio: 'Modernizar automatismos y monitoreo central',
    tipo_operacion: 'SERVICIO',
    descripcion: 'Incluye relevamiento, provisión y puesta en marcha.',
    fecha_emision: dayOffset(-18),
    fecha_vencimiento: dayOffset(7),
    subtotal_items: 840000,
    subtotal_incidencias: 120000,
    descuento_pct: 5,
    descuento_monto: 48000,
    subtotal: 912000,
    iva_pct: 21,
    iva_monto: 191520,
    otros_impuestos: 0,
    total: 1103520,
    costo_total: 710000,
    margen_pct: 35,
    margen_monto: 393520,
    estado: 'ENVIADO',
    condiciones_pago: '50% anticipo, saldo contra entrega',
    tiempo_ejecucion: '21 días',
    garantia: '12 meses',
    notas_internas: 'Cliente estratégico Q1',
    notas_cliente: 'Vigencia 15 días',
    aprobado_por: null,
    aprobado_en: null,
    ...auditFields(1),
  },
  {
    id: 'pres-002',
    numero: 'PRES-2026-00117',
    cliente_id: 'cli-002',
    direccion_id: null,
    razon_social: 'Solar Grid Patagonia SRL',
    titulo: 'Mantenimiento de inversores solares',
    objetivo_servicio: 'Asegurar continuidad operativa en parque fotovoltaico',
    tipo_operacion: 'SERVICIO',
    descripcion: 'Visitas trimestrales y repuestos críticos.',
    fecha_emision: dayOffset(-25),
    fecha_vencimiento: dayOffset(-3),
    subtotal_items: 260000,
    subtotal_incidencias: 30000,
    descuento_pct: 0,
    descuento_monto: 0,
    subtotal: 290000,
    iva_pct: 21,
    iva_monto: 60900,
    otros_impuestos: 0,
    total: 350900,
    costo_total: 184000,
    margen_pct: 47,
    margen_monto: 166900,
    estado: 'APROBADO',
    condiciones_pago: '30 días',
    tiempo_ejecucion: 'Contrato anual',
    garantia: 'Durante vigencia',
    notas_internas: null,
    notas_cliente: 'Mantenimiento preventivo anual',
    aprobado_por: 'mock-user-admin',
    aprobado_en: timestampOffset(-10),
    ...auditFields(2),
  },
  {
    id: 'pres-003',
    numero: 'PRES-2026-00116',
    cliente_id: 'cli-003',
    direccion_id: null,
    razon_social: 'FríoSur Servicios Técnicos',
    titulo: 'Recambio de compresores rooftop',
    objetivo_servicio: 'Restituir capacidad frigorífica',
    tipo_operacion: 'PRODUCTO_SERVICIO',
    descripcion: 'Equipo + instalación + balanceo.',
    fecha_emision: dayOffset(-12),
    fecha_vencimiento: dayOffset(3),
    subtotal_items: 490000,
    subtotal_incidencias: 65000,
    descuento_pct: 3,
    descuento_monto: 16650,
    subtotal: 538350,
    iva_pct: 21,
    iva_monto: 113053.5,
    otros_impuestos: 0,
    total: 651403.5,
    costo_total: 438000,
    margen_pct: 32,
    margen_monto: 213403.5,
    estado: 'BORRADOR',
    condiciones_pago: 'Contado',
    tiempo_ejecucion: '10 días',
    garantia: '6 meses',
    notas_internas: 'Pendiente ajuste proveedor',
    notas_cliente: null,
    aprobado_por: null,
    aprobado_en: null,
    ...auditFields(3),
  },
  {
    id: 'pres-004',
    numero: 'PRES-2026-00115',
    cliente_id: 'cli-004',
    direccion_id: null,
    razon_social: 'Build & Energy Constructora',
    titulo: 'Tablero general de obra y protecciones',
    objetivo_servicio: 'Abastecer frente de obra principal',
    tipo_operacion: 'PRODUCTO',
    descripcion: 'Suministro de tablero y protecciones.',
    fecha_emision: dayOffset(-35),
    fecha_vencimiento: dayOffset(-12),
    subtotal_items: 1200000,
    subtotal_incidencias: 0,
    descuento_pct: 8,
    descuento_monto: 96000,
    subtotal: 1104000,
    iva_pct: 21,
    iva_monto: 231840,
    otros_impuestos: 0,
    total: 1335840,
    costo_total: 915000,
    margen_pct: 31,
    margen_monto: 420840,
    estado: 'RECHAZADO',
    condiciones_pago: 'Cheque diferido',
    tiempo_ejecucion: 'Entrega inmediata',
    garantia: '3 meses',
    notas_internas: 'Precio fuera de mercado',
    notas_cliente: 'Incluye flete',
    aprobado_por: null,
    aprobado_en: null,
    ...auditFields(4),
  },
  {
    id: 'pres-005',
    numero: 'PRES-2026-00114',
    cliente_id: 'cli-010',
    direccion_id: null,
    razon_social: 'Innova Food Plant',
    titulo: 'Automatización de línea de envasado',
    objetivo_servicio: 'Aumentar throughput y trazabilidad',
    tipo_operacion: 'SERVICIO',
    descripcion: 'PLC, HMI y tablero de fuerza.',
    fecha_emision: dayOffset(-8),
    fecha_vencimiento: dayOffset(12),
    subtotal_items: 1750000,
    subtotal_incidencias: 180000,
    descuento_pct: 4,
    descuento_monto: 77200,
    subtotal: 1852800,
    iva_pct: 21,
    iva_monto: 389088,
    otros_impuestos: 0,
    total: 2241888,
    costo_total: 1420000,
    margen_pct: 37,
    margen_monto: 821888,
    estado: 'ENVIADO',
    condiciones_pago: '40/40/20',
    tiempo_ejecucion: '45 días',
    garantia: '12 meses',
    notas_internas: 'Alta prioridad comercial',
    notas_cliente: 'Incluye capacitación',
    aprobado_por: null,
    aprobado_en: null,
    ...auditFields(5),
  },
  {
    id: 'pres-006',
    numero: 'PRES-2026-00113',
    cliente_id: 'cli-006',
    direccion_id: null,
    razon_social: 'Mercurio Retail Group',
    titulo: 'Mantenimiento correctivo de UPS',
    objetivo_servicio: 'Recuperar respaldo energético de sucursales',
    tipo_operacion: 'SERVICIO',
    descripcion: 'Servicio técnico con repuestos.',
    fecha_emision: dayOffset(-48),
    fecha_vencimiento: dayOffset(-18),
    subtotal_items: 220000,
    subtotal_incidencias: 25000,
    descuento_pct: 0,
    descuento_monto: 0,
    subtotal: 245000,
    iva_pct: 21,
    iva_monto: 51450,
    otros_impuestos: 0,
    total: 296450,
    costo_total: 172000,
    margen_pct: 42,
    margen_monto: 124450,
    estado: 'VENCIDO',
    condiciones_pago: '15 días FF',
    tiempo_ejecucion: '72 horas',
    garantia: '90 días',
    notas_internas: null,
    notas_cliente: 'Prioridad media',
    aprobado_por: null,
    aprobado_en: null,
    ...auditFields(6),
  },
];

const ordenesBase: OrdenMock[] = [
  {
    id: 'os-001',
    numero: 'OS-2026-00342',
    presupuesto_id: 'pres-002',
    cliente_id: 'cli-002',
    direccion_id: null,
    razon_social: 'Solar Grid Patagonia SRL',
    numero_presupuesto: 'PRES-2026-00117',
    titulo: 'Mantenimiento trimestral parque norte',
    descripcion: 'Checklist de inversores y termografías.',
    objetivo_tecnico: 'Mantener disponibilidad > 98%',
    fecha_inicio: dayOffset(-6),
    fecha_fin_estimada: dayOffset(2),
    fecha_fin_real: null,
    estado: 'EN_PROGRESO',
    porcentaje_avance: 72,
    notas_tecnicas: 'Falta reemplazo de 2 string boxes',
    notas_cliente: null,
    observaciones_cierre: null,
    ...auditFields(1),
  },
  {
    id: 'os-002',
    numero: 'OS-2026-00341',
    presupuesto_id: 'pres-001',
    cliente_id: 'cli-001',
    direccion_id: null,
    razon_social: 'Acme Industrial SA',
    numero_presupuesto: 'PRES-2026-00118',
    titulo: 'Instalación de sensores BACnet',
    descripcion: 'Integración con BMS existente.',
    objetivo_tecnico: 'Visibilidad completa de HVAC',
    fecha_inicio: dayOffset(-12),
    fecha_fin_estimada: dayOffset(-2),
    fecha_fin_real: dayOffset(-1),
    estado: 'COMPLETADA',
    porcentaje_avance: 100,
    notas_tecnicas: 'Cierre sin observaciones',
    notas_cliente: 'Se capacitó al operador',
    observaciones_cierre: 'Se deja acta firmada',
    ...auditFields(2),
  },
  {
    id: 'os-003',
    numero: 'OS-2026-00340',
    presupuesto_id: null,
    cliente_id: 'cli-003',
    direccion_id: null,
    razon_social: 'FríoSur Servicios Técnicos',
    numero_presupuesto: null,
    titulo: 'Guardia correctiva cámaras de frío',
    descripcion: 'Diagnóstico y recambio de contactores.',
    objetivo_tecnico: 'Restablecer temperatura objetivo',
    fecha_inicio: dayOffset(1),
    fecha_fin_estimada: dayOffset(4),
    fecha_fin_real: null,
    estado: 'PENDIENTE',
    porcentaje_avance: 0,
    notas_tecnicas: null,
    notas_cliente: 'Confirmado turno nocturno',
    observaciones_cierre: null,
    ...auditFields(3),
  },
  {
    id: 'os-004',
    numero: 'OS-2026-00339',
    presupuesto_id: 'pres-005',
    cliente_id: 'cli-010',
    direccion_id: null,
    razon_social: 'Innova Food Plant',
    numero_presupuesto: 'PRES-2026-00114',
    titulo: 'Integración PLC línea 4',
    descripcion: 'Cableado de campo y parametrización.',
    objetivo_tecnico: 'Integración con SCADA central',
    fecha_inicio: dayOffset(-3),
    fecha_fin_estimada: dayOffset(9),
    fecha_fin_real: null,
    estado: 'EN_PROGRESO',
    porcentaje_avance: 38,
    notas_tecnicas: 'Esperando I/O adicional',
    notas_cliente: null,
    observaciones_cierre: null,
    ...auditFields(4),
  },
  {
    id: 'os-005',
    numero: 'OS-2026-00338',
    presupuesto_id: null,
    cliente_id: 'cli-006',
    direccion_id: null,
    razon_social: 'Mercurio Retail Group',
    numero_presupuesto: null,
    titulo: 'Relevamiento UPS sucursal Rosario',
    descripcion: 'Visita técnica preventiva.',
    objetivo_tecnico: 'Emitir plan de mantenimiento',
    fecha_inicio: dayOffset(-16),
    fecha_fin_estimada: dayOffset(-13),
    fecha_fin_real: null,
    estado: 'CANCELADA',
    porcentaje_avance: 12,
    notas_tecnicas: null,
    notas_cliente: 'Se reprograma Q2',
    observaciones_cierre: 'Cancelada por cliente',
    ...auditFields(5),
  },
  {
    id: 'os-006',
    numero: 'OS-2026-00337',
    presupuesto_id: null,
    cliente_id: 'cli-004',
    direccion_id: null,
    razon_social: 'Build & Energy Constructora',
    numero_presupuesto: null,
    titulo: 'Tablero de obra torre B',
    descripcion: 'Montaje y pruebas de protecciones.',
    objetivo_tecnico: 'Habilitar alimentación temporal',
    fecha_inicio: dayOffset(-20),
    fecha_fin_estimada: dayOffset(-4),
    fecha_fin_real: null,
    estado: 'SUSPENDIDA',
    porcentaje_avance: 54,
    notas_tecnicas: 'Falta aprobación seguridad',
    notas_cliente: null,
    observaciones_cierre: null,
    ...auditFields(6),
  },
];

const facturasBase: FacturaMock[] = [
  {
    id: 'fac-001',
    numero: 'FAC-2026-00847',
    tipo_comprobante: 'FACTURA_A',
    punto_venta: 1,
    numero_afip: 847,
    cae: '73445566778899',
    cae_vencimiento: dayOffset(5),
    presupuesto_id: 'pres-002',
    orden_id: 'os-001',
    remito_id: null,
    cliente_id: 'cli-002',
    razon_social: 'Solar Grid Patagonia SRL',
    fecha_emision: dayOffset(-7),
    fecha_vencimiento: dayOffset(8),
    periodo_desde: null,
    periodo_hasta: null,
    subtotal: 290000,
    descuento_monto: 0,
    iva_pct: 21,
    iva_monto: 60900,
    otros_impuestos: 0,
    total: 350900,
    saldo_pendiente: 110900,
    estado: 'COBRADA_PARCIAL',
    condicion_venta: 'Transferencia 15 días',
    notas: 'Cobro parcial registrado',
    ...auditFields(1),
  },
  {
    id: 'fac-002',
    numero: 'FAC-2026-00846',
    tipo_comprobante: 'FACTURA_A',
    punto_venta: 1,
    numero_afip: 846,
    cae: '73445566778898',
    cae_vencimiento: dayOffset(2),
    presupuesto_id: 'pres-001',
    orden_id: 'os-002',
    remito_id: null,
    cliente_id: 'cli-001',
    razon_social: 'Acme Industrial SA',
    fecha_emision: dayOffset(-10),
    fecha_vencimiento: dayOffset(-1),
    periodo_desde: null,
    periodo_hasta: null,
    subtotal: 912000,
    descuento_monto: 48000,
    iva_pct: 21,
    iva_monto: 191520,
    otros_impuestos: 0,
    total: 1103520,
    saldo_pendiente: 1103520,
    estado: 'PENDIENTE_COBRO',
    condicion_venta: '30 días FF',
    notas: 'Seguimiento cobranzas',
    ...auditFields(2),
  },
  {
    id: 'fac-003',
    numero: 'FAC-2026-00845',
    tipo_comprobante: 'FACTURA_B',
    punto_venta: 2,
    numero_afip: 845,
    cae: '73445566778897',
    cae_vencimiento: dayOffset(-2),
    presupuesto_id: null,
    orden_id: 'os-003',
    remito_id: null,
    cliente_id: 'cli-003',
    razon_social: 'FríoSur Servicios Técnicos',
    fecha_emision: dayOffset(-20),
    fecha_vencimiento: dayOffset(-7),
    periodo_desde: null,
    periodo_hasta: null,
    subtotal: 118000,
    descuento_monto: 0,
    iva_pct: 21,
    iva_monto: 24780,
    otros_impuestos: 0,
    total: 142780,
    saldo_pendiente: 0,
    estado: 'COBRADA',
    condicion_venta: 'Contado',
    notas: null,
    ...auditFields(3),
  },
  {
    id: 'fac-004',
    numero: 'FAC-2026-00844',
    tipo_comprobante: 'FACTURA_A',
    punto_venta: 1,
    numero_afip: 844,
    cae: null,
    cae_vencimiento: null,
    presupuesto_id: 'pres-005',
    orden_id: 'os-004',
    remito_id: null,
    cliente_id: 'cli-010',
    razon_social: 'Innova Food Plant',
    fecha_emision: dayOffset(-2),
    fecha_vencimiento: dayOffset(13),
    periodo_desde: null,
    periodo_hasta: null,
    subtotal: 620000,
    descuento_monto: 0,
    iva_pct: 21,
    iva_monto: 130200,
    otros_impuestos: 0,
    total: 750200,
    saldo_pendiente: 750200,
    estado: 'EMITIDA',
    condicion_venta: 'Cuenta corriente',
    notas: 'Primera etapa',
    ...auditFields(4),
  },
  {
    id: 'fac-005',
    numero: 'FAC-2026-00843',
    tipo_comprobante: 'NOTA_CREDITO_A',
    punto_venta: 1,
    numero_afip: 843,
    cae: '73445566778896',
    cae_vencimiento: dayOffset(1),
    presupuesto_id: null,
    orden_id: null,
    remito_id: null,
    cliente_id: 'cli-006',
    razon_social: 'Mercurio Retail Group',
    fecha_emision: dayOffset(-5),
    fecha_vencimiento: dayOffset(10),
    periodo_desde: null,
    periodo_hasta: null,
    subtotal: -45000,
    descuento_monto: 0,
    iva_pct: 21,
    iva_monto: -9450,
    otros_impuestos: 0,
    total: -54450,
    saldo_pendiente: 0,
    estado: 'COBRADA',
    condicion_venta: 'Ajuste',
    notas: 'Bonificación por SLA',
    ...auditFields(5),
  },
  {
    id: 'fac-006',
    numero: 'FAC-2026-00842',
    tipo_comprobante: 'FACTURA_A',
    punto_venta: 1,
    numero_afip: 842,
    cae: '73445566778895',
    cae_vencimiento: dayOffset(-5),
    presupuesto_id: null,
    orden_id: null,
    remito_id: null,
    cliente_id: 'cli-004',
    razon_social: 'Build & Energy Constructora',
    fecha_emision: dayOffset(-28),
    fecha_vencimiento: dayOffset(-14),
    periodo_desde: null,
    periodo_hasta: null,
    subtotal: 540000,
    descuento_monto: 0,
    iva_pct: 21,
    iva_monto: 113400,
    otros_impuestos: 0,
    total: 653400,
    saldo_pendiente: 653400,
    estado: 'PENDIENTE_COBRO',
    condicion_venta: '45 días',
    notas: 'Factura vencida',
    ...auditFields(6),
  },
];

const notasBase: NotaMock[] = [
  {
    id: 'np-001',
    numero: 'NP-2026-00521',
    orden_id: 'os-004',
    presupuesto_id: 'pres-005',
    cliente_id: 'cli-010',
    proveedor: 'Electro Componentes SA',
    fecha_pedido: dayOffset(-4),
    fecha_requerida: dayOffset(2),
    fecha_recepcion: null,
    estado: 'PENDIENTE',
    notas: 'Prioridad por parada de línea',
    nombre_orden: 'OS-2026-00339 — Integración PLC línea 4',
    cantidad_items: 6,
    ...auditFields(1),
  },
  {
    id: 'np-002',
    numero: 'NP-2026-00520',
    orden_id: 'os-001',
    presupuesto_id: 'pres-002',
    cliente_id: 'cli-002',
    proveedor: 'Solar Parts Patagonia',
    fecha_pedido: dayOffset(-8),
    fecha_requerida: dayOffset(-1),
    fecha_recepcion: null,
    estado: 'PARCIAL',
    notas: 'Faltan 2 fusibles NH',
    nombre_orden: 'OS-2026-00342 — Mantenimiento trimestral parque norte',
    cantidad_items: 4,
    ...auditFields(2),
  },
  {
    id: 'np-003',
    numero: 'NP-2026-00519',
    orden_id: 'os-002',
    presupuesto_id: 'pres-001',
    cliente_id: 'cli-001',
    proveedor: 'Sensores & Control SRL',
    fecha_pedido: dayOffset(-14),
    fecha_requerida: dayOffset(-9),
    fecha_recepcion: dayOffset(-8),
    estado: 'RECIBIDO',
    notas: null,
    nombre_orden: 'OS-2026-00341 — Instalación de sensores BACnet',
    cantidad_items: 9,
    ...auditFields(3),
  },
  {
    id: 'np-004',
    numero: 'NP-2026-00518',
    orden_id: null,
    presupuesto_id: null,
    cliente_id: null,
    proveedor: 'Metalúrgica Norte',
    fecha_pedido: dayOffset(-18),
    fecha_requerida: dayOffset(-12),
    fecha_recepcion: null,
    estado: 'ANULADO',
    notas: 'Proveedor sin stock',
    nombre_orden: null,
    cantidad_items: 3,
    ...auditFields(4),
  },
];

const remitosBase: RemitoMock[] = [
  {
    id: 'rem-001',
    numero: 'REM-2026-02847',
    tipo: 'LEGAL_SALIDA',
    orden_id: 'os-002',
    nota_pedido_id: null,
    factura_id: 'fac-002',
    cliente_id: 'cli-001',
    proveedor: null,
    punto_venta: 1,
    numero_afip: 2847,
    cai: '99887766',
    cai_vencimiento: dayOffset(90),
    cae: null,
    fecha_emision: dayOffset(-1),
    estado: 'EMITIDO',
    direccion_entrega: 'Planta Pilar',
    transportista: 'Ruta Norte',
    patente_vehiculo: 'AE123BC',
    chofer: 'Martín Costa',
    notas: 'Entrega parcial de sensores',
    nombre_orden: 'OS-2026-00341',
    razon_social: 'Acme Industrial SA',
    cantidad_items: 8,
    ...auditFields(1),
  },
  {
    id: 'rem-002',
    numero: 'REM-2026-02846',
    tipo: 'INTERNO_SALIDA',
    orden_id: 'os-004',
    nota_pedido_id: 'np-001',
    factura_id: null,
    cliente_id: 'cli-010',
    proveedor: null,
    punto_venta: null,
    numero_afip: null,
    cai: null,
    cai_vencimiento: null,
    cae: null,
    fecha_emision: dayOffset(-6),
    estado: 'BORRADOR',
    direccion_entrega: 'Planta Mendoza',
    transportista: 'Interno',
    patente_vehiculo: 'AD111EF',
    chofer: 'Sergio Díaz',
    notas: 'Pendiente validación depósito',
    nombre_orden: 'OS-2026-00339',
    razon_social: 'Innova Food Plant',
    cantidad_items: 5,
    ...auditFields(2),
  },
  {
    id: 'rem-003',
    numero: 'REM-2026-02845',
    tipo: 'LEGAL_ENTRADA',
    orden_id: 'os-001',
    nota_pedido_id: 'np-002',
    factura_id: null,
    cliente_id: 'cli-002',
    proveedor: 'Solar Parts Patagonia',
    punto_venta: 2,
    numero_afip: 845,
    cai: '12344321',
    cai_vencimiento: dayOffset(120),
    cae: null,
    fecha_emision: dayOffset(-9),
    estado: 'ENTREGADO',
    direccion_entrega: 'Depósito Neuquén',
    transportista: 'Patagonia Express',
    patente_vehiculo: 'AF987GH',
    chofer: 'Andrea Mena',
    notas: 'Recepción conforme',
    nombre_orden: 'OS-2026-00342',
    razon_social: 'Solar Grid Patagonia SRL',
    cantidad_items: 4,
    ...auditFields(3),
  },
  {
    id: 'rem-004',
    numero: 'REM-2026-02844',
    tipo: 'INTERNO_ENTRADA',
    orden_id: null,
    nota_pedido_id: null,
    factura_id: null,
    cliente_id: null,
    proveedor: 'Metalúrgica Norte',
    punto_venta: null,
    numero_afip: null,
    cai: null,
    cai_vencimiento: null,
    cae: null,
    fecha_emision: dayOffset(-15),
    estado: 'ANULADO',
    direccion_entrega: 'Depósito Central',
    transportista: 'Flete ocasional',
    patente_vehiculo: 'AC445DD',
    chofer: 'Lucas Prado',
    notas: 'Anulado por error de carga',
    nombre_orden: null,
    razon_social: 'Metalúrgica Norte',
    cantidad_items: 2,
    ...auditFields(4),
  },
];

const clienteDireccionesBase: Record<string, ClienteDireccion[]> = {
  'cli-001': [
    {
      id: 'dir-001',
      cliente_id: 'cli-001',
      etiqueta: 'Planta Pilar',
      calle: 'Parque Industrial Norte',
      numero: '1450',
      piso_dpto: null,
      barrio: 'Pilar',
      ciudad: 'Pilar',
      provincia: 'Buenos Aires',
      codigo_postal: 'B1629',
      pais: 'Argentina',
      es_principal: true,
      latitud: null,
      longitud: null,
      distancia_km: 48,
      notas: 'Ingreso por portería 2',
      creado_en: timestampOffset(-120),
    },
    {
      id: 'dir-002',
      cliente_id: 'cli-001',
      etiqueta: 'Oficinas CABA',
      calle: 'Av. Libertador',
      numero: '5250',
      piso_dpto: 'Piso 7',
      barrio: 'Belgrano',
      ciudad: 'CABA',
      provincia: 'CABA',
      codigo_postal: 'C1428',
      pais: 'Argentina',
      es_principal: false,
      latitud: null,
      longitud: null,
      distancia_km: 12,
      notas: null,
      creado_en: timestampOffset(-110),
    },
  ],
  'cli-002': [
    {
      id: 'dir-003',
      cliente_id: 'cli-002',
      etiqueta: 'Parque Solar Neuquén',
      calle: 'Ruta Provincial 7',
      numero: 'S/N',
      piso_dpto: null,
      barrio: null,
      ciudad: 'Añelo',
      provincia: 'Neuquén',
      codigo_postal: 'Q8305',
      pais: 'Argentina',
      es_principal: true,
      latitud: null,
      longitud: null,
      distancia_km: 1180,
      notas: 'Coordinar ingreso con HSE',
      creado_en: timestampOffset(-90),
    },
  ],
  'cli-003': [
    {
      id: 'dir-004',
      cliente_id: 'cli-003',
      etiqueta: 'Depósito Mendoza',
      calle: 'Calle 9 de Julio',
      numero: '221',
      piso_dpto: null,
      barrio: 'Godoy Cruz',
      ciudad: 'Mendoza',
      provincia: 'Mendoza',
      codigo_postal: 'M5501',
      pais: 'Argentina',
      es_principal: true,
      latitud: null,
      longitud: null,
      distancia_km: 990,
      notas: null,
      creado_en: timestampOffset(-80),
    },
  ],
};

const presupuestoItemsBase: Record<string, PresupuestoItem[]> = {
  'pres-001': [
    {
      id: 'pi-001',
      presupuesto_id: 'pres-001',
      servicio_id: null,
      orden: 0,
      descripcion: 'Controlador BACnet central',
      detalle: 'Incluye licencias y programación inicial.',
      cantidad: 1,
      unidad_medida: 'un',
      precio_unitario: 380000,
      costo_unitario: 295000,
      descuento_pct: 0,
      subtotal: 380000,
    },
    {
      id: 'pi-002',
      presupuesto_id: 'pres-001',
      servicio_id: null,
      orden: 1,
      descripcion: 'Sensores de temperatura y humedad',
      detalle: '12 sensores de ambiente.',
      cantidad: 12,
      unidad_medida: 'un',
      precio_unitario: 30000,
      costo_unitario: 21000,
      descuento_pct: 0,
      subtotal: 360000,
    },
    {
      id: 'pi-003',
      presupuesto_id: 'pres-001',
      servicio_id: null,
      orden: 2,
      descripcion: 'Puesta en marcha',
      detalle: 'Configuración, pruebas y capacitación.',
      cantidad: 1,
      unidad_medida: 'srv',
      precio_unitario: 100000,
      costo_unitario: 75000,
      descuento_pct: 0,
      subtotal: 100000,
    },
  ],
  'pres-002': [
    {
      id: 'pi-004',
      presupuesto_id: 'pres-002',
      servicio_id: null,
      orden: 0,
      descripcion: 'Visitas trimestrales a campo',
      detalle: 'Inspección y ajuste de inversores.',
      cantidad: 4,
      unidad_medida: 'vis',
      precio_unitario: 50000,
      costo_unitario: 28000,
      descuento_pct: 0,
      subtotal: 200000,
    },
    {
      id: 'pi-005',
      presupuesto_id: 'pres-002',
      servicio_id: null,
      orden: 1,
      descripcion: 'Stock de repuestos críticos',
      detalle: 'Fusibles, contactores y string boxes.',
      cantidad: 1,
      unidad_medida: 'kit',
      precio_unitario: 60000,
      costo_unitario: 45000,
      descuento_pct: 0,
      subtotal: 60000,
    },
  ],
  'pres-005': [
    {
      id: 'pi-006',
      presupuesto_id: 'pres-005',
      servicio_id: null,
      orden: 0,
      descripcion: 'PLC Siemens S7-1500',
      detalle: 'CPU + módulos DI/DO.',
      cantidad: 1,
      unidad_medida: 'kit',
      precio_unitario: 870000,
      costo_unitario: 690000,
      descuento_pct: 0,
      subtotal: 870000,
    },
    {
      id: 'pi-007',
      presupuesto_id: 'pres-005',
      servicio_id: null,
      orden: 1,
      descripcion: 'Interfaz HMI industrial',
      detalle: 'Panel táctil 10 pulgadas.',
      cantidad: 1,
      unidad_medida: 'un',
      precio_unitario: 420000,
      costo_unitario: 340000,
      descuento_pct: 0,
      subtotal: 420000,
    },
    {
      id: 'pi-008',
      presupuesto_id: 'pres-005',
      servicio_id: null,
      orden: 2,
      descripcion: 'Ingeniería y comisionado',
      detalle: 'Programación, FAT y SAT.',
      cantidad: 1,
      unidad_medida: 'srv',
      precio_unitario: 460000,
      costo_unitario: 320000,
      descuento_pct: 0,
      subtotal: 460000,
    },
  ],
};

const presupuestoIncidenciasBase: Record<string, PresupuestoIncidencia[]> = {
  'pres-001': [
    {
      id: 'inc-001',
      presupuesto_id: 'pres-001',
      tipo: 'traslado',
      descripcion: 'Movilidad y peajes',
      cantidad: 2,
      dias: 1,
      distancia_km: 120,
      monto_unitario: 30000,
      subtotal: 60000,
      es_interno: false,
      notas: null,
    },
    {
      id: 'inc-002',
      presupuesto_id: 'pres-001',
      tipo: 'honorario_externo',
      descripcion: 'Soporte integrador BMS',
      cantidad: 1,
      dias: 2,
      distancia_km: null,
      monto_unitario: 30000,
      subtotal: 60000,
      es_interno: true,
      notas: 'Costo interno',
    },
  ],
  'pres-002': [
    {
      id: 'inc-003',
      presupuesto_id: 'pres-002',
      tipo: 'viatico',
      descripcion: 'Viáticos de cuadrilla',
      cantidad: 3,
      dias: 1,
      distancia_km: null,
      monto_unitario: 10000,
      subtotal: 30000,
      es_interno: false,
      notas: null,
    },
  ],
  'pres-005': [
    {
      id: 'inc-004',
      presupuesto_id: 'pres-005',
      tipo: 'equipamiento',
      descripcion: 'Herramientas de calibración',
      cantidad: 1,
      dias: 1,
      distancia_km: null,
      monto_unitario: 80000,
      subtotal: 80000,
      es_interno: true,
      notas: 'Afecta margen',
    },
    {
      id: 'inc-005',
      presupuesto_id: 'pres-005',
      tipo: 'traslado',
      descripcion: 'Traslado de técnicos',
      cantidad: 2,
      dias: 1,
      distancia_km: 980,
      monto_unitario: 50000,
      subtotal: 100000,
      es_interno: false,
      notas: null,
    },
  ],
};

const ordenTecnicosBase: Record<string, OrdenTecnico[]> = {
  'os-001': [
    {
      id: 'ot-001',
      orden_id: 'os-001',
      tecnico_id: null,
      nombre: 'Valentín Gómez',
      rol: 'Supervisor eléctrico',
      fecha_desde: dayOffset(-6),
      fecha_hasta: dayOffset(2),
      notas: 'Coordina cierre',
    },
    {
      id: 'ot-002',
      orden_id: 'os-001',
      tecnico_id: null,
      nombre: 'María López',
      rol: 'Técnica solar',
      fecha_desde: dayOffset(-6),
      fecha_hasta: dayOffset(1),
      notas: null,
    },
  ],
  'os-002': [
    {
      id: 'ot-003',
      orden_id: 'os-002',
      tecnico_id: null,
      nombre: 'Tomás Ríos',
      rol: 'Programador BMS',
      fecha_desde: dayOffset(-12),
      fecha_hasta: dayOffset(-1),
      notas: 'Cierre conforme',
    },
  ],
  'os-004': [
    {
      id: 'ot-004',
      orden_id: 'os-004',
      tecnico_id: null,
      nombre: 'Paula Benítez',
      rol: 'PLC senior',
      fecha_desde: dayOffset(-3),
      fecha_hasta: dayOffset(8),
      notas: null,
    },
  ],
};

const facturaItemsBase: Record<string, FacturaItem[]> = {
  'fac-001': [
    {
      id: 'fi-001',
      factura_id: 'fac-001',
      descripcion: 'Servicio mantenimiento trimestral',
      detalle: 'Visita técnica + checklist',
      cantidad: 1,
      unidad_medida: 'srv',
      precio_unitario: 230000,
      descuento_pct: 0,
      iva_pct: 21,
      subtotal: 230000,
      orden: 0,
    },
    {
      id: 'fi-002',
      factura_id: 'fac-001',
      descripcion: 'Repuestos string box',
      detalle: 'Reposición de fusibles y borneras',
      cantidad: 1,
      unidad_medida: 'kit',
      precio_unitario: 60000,
      descuento_pct: 0,
      iva_pct: 21,
      subtotal: 60000,
      orden: 1,
    },
  ],
  'fac-002': [
    {
      id: 'fi-003',
      factura_id: 'fac-002',
      descripcion: 'Migración tableros HVAC',
      detalle: 'Etapa 1 de implementación',
      cantidad: 1,
      unidad_medida: 'srv',
      precio_unitario: 912000,
      descuento_pct: 5,
      iva_pct: 21,
      subtotal: 912000,
      orden: 0,
    },
  ],
  'fac-004': [
    {
      id: 'fi-004',
      factura_id: 'fac-004',
      descripcion: 'Automatización línea 4',
      detalle: 'Certificación de avance etapa 1',
      cantidad: 1,
      unidad_medida: 'srv',
      precio_unitario: 620000,
      descuento_pct: 0,
      iva_pct: 21,
      subtotal: 620000,
      orden: 0,
    },
  ],
};

const recibosBase: Record<string, Recibo[]> = {
  'fac-001': [
    {
      id: 'rec-001',
      numero: 'REC-2026-00121',
      factura_id: 'fac-001',
      cliente_id: 'cli-002',
      tipo: 'PAGO_PARCIAL',
      fecha: dayOffset(-2),
      monto: 240000,
      tipo_pago: 'TRANSFERENCIA',
      cheque_banco: null,
      cheque_numero: null,
      cheque_fecha: null,
      cheque_titular: null,
      concepto: 'Anticipo mantenimiento',
      notas: 'Ingreso confirmado',
      creado_por: 'mock-user-admin',
      creado_en: timestampOffset(-2),
    },
  ],
  'fac-003': [
    {
      id: 'rec-002',
      numero: 'REC-2026-00118',
      factura_id: 'fac-003',
      cliente_id: 'cli-003',
      tipo: 'PAGO_FINAL',
      fecha: dayOffset(-15),
      monto: 142780,
      tipo_pago: 'EFECTIVO',
      cheque_banco: null,
      cheque_numero: null,
      cheque_fecha: null,
      cheque_titular: null,
      concepto: 'Pago total',
      notas: null,
      creado_por: 'mock-user-admin',
      creado_en: timestampOffset(-15),
    },
  ],
};

const notaItemsBase: Record<string, NotaPedidoItem[]> = {
  'np-001': [
    {
      id: 'npi-001',
      nota_pedido_id: 'np-001',
      descripcion: 'Módulo DI 16 canales',
      unidad_medida: 'un',
      cantidad_pedida: 4,
      cantidad_recibida: 0,
      precio_unitario: 18000,
      subtotal: 72000,
      notas: null,
    },
    {
      id: 'npi-002',
      nota_pedido_id: 'np-001',
      descripcion: 'Borneras de paso',
      unidad_medida: 'un',
      cantidad_pedida: 20,
      cantidad_recibida: 0,
      precio_unitario: 2400,
      subtotal: 48000,
      notas: 'Se acepta marca equivalente',
    },
  ],
  'np-002': [
    {
      id: 'npi-003',
      nota_pedido_id: 'np-002',
      descripcion: 'Fusibles NH',
      unidad_medida: 'un',
      cantidad_pedida: 6,
      cantidad_recibida: 4,
      precio_unitario: 3500,
      subtotal: 21000,
      notas: null,
    },
    {
      id: 'npi-004',
      nota_pedido_id: 'np-002',
      descripcion: 'String boxes',
      unidad_medida: 'un',
      cantidad_pedida: 2,
      cantidad_recibida: 1,
      precio_unitario: 28000,
      subtotal: 56000,
      notas: null,
    },
  ],
  'np-003': [
    {
      id: 'npi-005',
      nota_pedido_id: 'np-003',
      descripcion: 'Sensores ambiente',
      unidad_medida: 'un',
      cantidad_pedida: 9,
      cantidad_recibida: 9,
      precio_unitario: 22000,
      subtotal: 198000,
      notas: null,
    },
  ],
};

const remitoItemsBase: Record<string, RemitoItem[]> = {
  'rem-001': [
    {
      id: 'ri-001',
      remito_id: 'rem-001',
      descripcion: 'Sensores BACnet',
      unidad_medida: 'un',
      cantidad: 8,
      precio_unitario: 30000,
      subtotal: 240000,
      orden: 0,
    },
  ],
  'rem-002': [
    {
      id: 'ri-002',
      remito_id: 'rem-002',
      descripcion: 'PLC Siemens S7-1500',
      unidad_medida: 'un',
      cantidad: 1,
      precio_unitario: 870000,
      subtotal: 870000,
      orden: 0,
    },
    {
      id: 'ri-003',
      remito_id: 'rem-002',
      descripcion: 'Panel HMI 10"',
      unidad_medida: 'un',
      cantidad: 1,
      precio_unitario: 420000,
      subtotal: 420000,
      orden: 1,
    },
  ],
  'rem-003': [
    {
      id: 'ri-004',
      remito_id: 'rem-003',
      descripcion: 'Fusibles NH',
      unidad_medida: 'un',
      cantidad: 4,
      precio_unitario: 3500,
      subtotal: 14000,
      orden: 0,
    },
    {
      id: 'ri-005',
      remito_id: 'rem-003',
      descripcion: 'String box',
      unidad_medida: 'un',
      cantidad: 1,
      precio_unitario: 28000,
      subtotal: 28000,
      orden: 1,
    },
  ],
};

const clienteKpisBase: Record<string, ClienteKPIs> = {
  'cli-001': {
    cliente_id: 'cli-001',
    presupuestos_emitidos: 4,
    presupuestos_aprobados: 3,
    tasa_conversion: 75,
    facturas_emitidas: 5,
    servicios_realizados: 3,
    servicios_facturados: 4,
    servicios_cobrados: 2,
    monto_total_facturado: 1840000,
    monto_total_cobrado: 736480,
    saldo_pendiente: 1103520,
    ultimo_servicio: dayOffset(-1),
    primera_operacion: dayOffset(-220),
  },
  'cli-002': {
    cliente_id: 'cli-002',
    presupuestos_emitidos: 3,
    presupuestos_aprobados: 2,
    tasa_conversion: 67,
    facturas_emitidas: 3,
    servicios_realizados: 2,
    servicios_facturados: 2,
    servicios_cobrados: 1,
    monto_total_facturado: 1280000,
    monto_total_cobrado: 1169100,
    saldo_pendiente: 110900,
    ultimo_servicio: dayOffset(1),
    primera_operacion: dayOffset(-180),
  },
  'cli-003': {
    cliente_id: 'cli-003',
    presupuestos_emitidos: 2,
    presupuestos_aprobados: 1,
    tasa_conversion: 50,
    facturas_emitidas: 2,
    servicios_realizados: 1,
    servicios_facturados: 1,
    servicios_cobrados: 1,
    monto_total_facturado: 540000,
    monto_total_cobrado: 481800,
    saldo_pendiente: 58200,
    ultimo_servicio: dayOffset(-4),
    primera_operacion: dayOffset(-130),
  },
};

function getClienteDocumento(id: string) {
  const map: Record<
    string,
    {
      tipo_documento: TipoDocumento;
      numero_documento: string;
      ingresos_brutos: string | null;
      email_facturacion: string | null;
      telefono_alt: string | null;
      sitio_web: string | null;
      contacto_nombre: string | null;
      contacto_cargo: string | null;
      origen: string | null;
      notas: string | null;
    }
  > = {
    'cli-001': {
      tipo_documento: 'CUIT',
      numero_documento: '30712345678',
      ingresos_brutos: '901-554433-2',
      email_facturacion: 'pagos@acmeindustrial.com',
      telefono_alt: '+54 11 4567-1099',
      sitio_web: 'https://acmeindustrial.com',
      contacto_nombre: 'Lucía Benítez',
      contacto_cargo: 'Compras técnicas',
      origen: 'Referido',
      notas: 'Cliente con SLA premium',
    },
    'cli-002': {
      tipo_documento: 'CUIT',
      numero_documento: '30701112223',
      ingresos_brutos: '904-998877-0',
      email_facturacion: 'finanzas@solargrid.com',
      telefono_alt: null,
      sitio_web: 'https://solargrid.com.ar',
      contacto_nombre: 'Pablo Ferreyra',
      contacto_cargo: 'Jefe de operaciones',
      origen: 'Licitación privada',
      notas: null,
    },
    'cli-003': {
      tipo_documento: 'CUIT',
      numero_documento: '20284445551',
      ingresos_brutos: null,
      email_facturacion: 'facturas@friosur.com',
      telefono_alt: '+54 261 444-9922',
      sitio_web: null,
      contacto_nombre: 'Carla Sosa',
      contacto_cargo: 'Dueña',
      origen: 'Web',
      notas: 'Atención fuera de horario',
    },
  };
  return (
    map[id] ?? {
      tipo_documento: 'CUIT',
      numero_documento: id.toUpperCase(),
      ingresos_brutos: null,
      email_facturacion: null,
      telefono_alt: null,
      sitio_web: null,
      contacto_nombre: null,
      contacto_cargo: null,
      origen: null,
      notas: null,
    }
  );
}

export function hasMockDetailId(id: string) {
  return (
    clientesBase.some((item) => item.id === id) ||
    presupuestosBase.some((item) => item.id === id) ||
    ordenesBase.some((item) => item.id === id) ||
    facturasBase.some((item) => item.id === id) ||
    notasBase.some((item) => item.id === id) ||
    remitosBase.some((item) => item.id === id)
  );
}

export function getMockClienteDetalle(
  id: string,
): ClienteConDirecciones | null {
  const base = clientesBase.find((item) => item.id === id);
  if (!base) return null;
  const extra = getClienteDocumento(id);
  return {
    id: base.id,
    razon_social: base.razon_social,
    nombre_fantasia: base.nombre_fantasia,
    tipo_documento: extra.tipo_documento,
    numero_documento: extra.numero_documento,
    cuit: base.cuit,
    condicion_iva: base.condicion_iva,
    ingresos_brutos: extra.ingresos_brutos,
    email: base.email,
    email_facturacion: extra.email_facturacion,
    telefono: base.telefono,
    telefono_alt: extra.telefono_alt,
    sitio_web: extra.sitio_web,
    contacto_nombre: extra.contacto_nombre,
    contacto_cargo: extra.contacto_cargo,
    segmento: base.segmento,
    origen: extra.origen,
    notas: extra.notas,
    activo: base.activo,
    direcciones: clienteDireccionesBase[id] ?? [],
    creado_en: timestampOffset(-300),
    actualizado_en: base.ultima_actividad ?? timestampOffset(-2),
    creado_por: 'mock-user-admin',
  };
}

export function getMockClienteKPIs(id: string): ClienteKPIs {
  return (
    clienteKpisBase[id] ?? {
      cliente_id: id,
      presupuestos_emitidos: 0,
      presupuestos_aprobados: 0,
      tasa_conversion: 0,
      facturas_emitidas: 0,
      servicios_realizados: 0,
      servicios_facturados: 0,
      servicios_cobrados: 0,
      monto_total_facturado: 0,
      monto_total_cobrado: 0,
      saldo_pendiente: 0,
      ultimo_servicio: null,
      primera_operacion: null,
    }
  );
}

export function getMockPresupuestoDetalle(
  id: string,
): (PresupuestoCompleto & { razon_social?: string }) | null {
  const base = presupuestosBase.find((item) => item.id === id);
  if (!base) return null;
  return {
    ...base,
    razon_social: base.razon_social,
    items: presupuestoItemsBase[id] ?? [],
    incidencias: presupuestoIncidenciasBase[id] ?? [],
  };
}

export function getMockOrdenDetalle(id: string): OrdenDetalleMock | null {
  const base = ordenesBase.find((item) => item.id === id);
  if (!base) return null;
  return {
    ...base,
    tecnicos: ordenTecnicosBase[id] ?? [],
  };
}

export function getMockFacturaDetalle(id: string): FacturaDetalleMock | null {
  const base = facturasBase.find((item) => item.id === id);
  if (!base) return null;
  return {
    ...base,
    items: facturaItemsBase[id] ?? [],
    recibos: recibosBase[id] ?? [],
    numero_presupuesto: base.presupuesto_id
      ? (presupuestosBase.find((item) => item.id === base.presupuesto_id)
          ?.numero ?? null)
      : null,
    numero_orden: base.orden_id
      ? (ordenesBase.find((item) => item.id === base.orden_id)?.numero ?? null)
      : null,
  };
}

export function getMockNotaPedidoDetalle(id: string): NotaDetalleMock | null {
  const base = notasBase.find((item) => item.id === id);
  if (!base) return null;
  return {
    ...base,
    items: notaItemsBase[id] ?? [],
    numero_orden: base.orden_id
      ? (ordenesBase.find((item) => item.id === base.orden_id)?.numero ?? null)
      : null,
  };
}

export function getMockRemitoDetalle(id: string): RemitoDetalleMock | null {
  const base = remitosBase.find((item) => item.id === id);
  if (!base) return null;
  return {
    ...base,
    items: remitoItemsBase[id] ?? [],
    numero_orden: base.orden_id
      ? (ordenesBase.find((item) => item.id === base.orden_id)?.numero ?? null)
      : null,
    razon_social: base.razon_social,
  };
}

export const mockEventosCalendario: EventoCalendario[] = [
  {
    id: 'evt-001',
    tipo: 'SERVICIO_PROGRAMADO',
    titulo: 'OS-342 Parque Norte',
    descripcion: 'Mantenimiento trimestral con cuadrilla 2',
    fecha_inicio: `${dayOffset(1)}T09:00:00`,
    fecha_fin: `${dayOffset(1)}T13:00:00`,
    todo_el_dia: false,
    entidad_tipo: 'orden',
    entidad_id: 'os-001',
    cliente_id: 'cli-002',
    completado: false,
    color: '#3b82f6',
    razon_social: 'Solar Grid Patagonia SRL',
    creado_en: timestampOffset(-2),
  },
  {
    id: 'evt-002',
    tipo: 'VENCIMIENTO_FACTURA',
    titulo: 'Vence FAC-2026-00846',
    descripcion: 'Acme Industrial SA',
    fecha_inicio: `${dayOffset(-1)}T00:00:00`,
    fecha_fin: null,
    todo_el_dia: true,
    entidad_tipo: 'factura',
    entidad_id: 'fac-002',
    cliente_id: 'cli-001',
    completado: false,
    color: '#f59e0b',
    razon_social: 'Acme Industrial SA',
    creado_en: timestampOffset(-10),
  },
  {
    id: 'evt-003',
    tipo: 'PAGO_CLIENTE',
    titulo: 'Cobro parcial Solar Grid',
    descripcion: 'Seguimiento de transferencia',
    fecha_inicio: `${dayOffset(3)}T11:00:00`,
    fecha_fin: null,
    todo_el_dia: false,
    entidad_tipo: 'factura',
    entidad_id: 'fac-001',
    cliente_id: 'cli-002',
    completado: false,
    color: '#10b981',
    razon_social: 'Solar Grid Patagonia SRL',
    creado_en: timestampOffset(-5),
  },
  {
    id: 'evt-004',
    tipo: 'SERVICIO_EJECUTADO',
    titulo: 'Cierre técnico BACnet',
    descripcion: 'Validación final con cliente',
    fecha_inicio: `${dayOffset(-4)}T15:00:00`,
    fecha_fin: null,
    todo_el_dia: false,
    entidad_tipo: 'orden',
    entidad_id: 'os-002',
    cliente_id: 'cli-001',
    completado: true,
    color: '#22c55e',
    razon_social: 'Acme Industrial SA',
    creado_en: timestampOffset(-6),
  },
  {
    id: 'evt-005',
    tipo: 'VENCIMIENTO_SERVICIO_CONTINUO',
    titulo: 'Renovar mantenimiento UPS',
    descripcion: 'Mercurio Retail Group',
    fecha_inicio: `${dayOffset(8)}T00:00:00`,
    fecha_fin: null,
    todo_el_dia: true,
    entidad_tipo: 'cliente',
    entidad_id: 'cli-006',
    cliente_id: 'cli-006',
    completado: false,
    color: '#8b5cf6',
    razon_social: 'Mercurio Retail Group',
    creado_en: timestampOffset(-1),
  },
];

const serieFacturacion12m = buildSeries([
  [320000, 250000],
  [410000, 330000],
  [465000, 380000],
  [520000, 430000],
  [610000, 470000],
  [590000, 540000],
  [680000, 610000],
  [720000, 640000],
  [760000, 705000],
  [840000, 760000],
  [910000, 855000],
  [1030000, 912000],
]);

const serieOrdenes12m = buildSeries([
  [8, 10],
  [10, 12],
  [9, 11],
  [12, 13],
  [11, 14],
  [13, 15],
  [15, 17],
  [14, 16],
  [16, 18],
  [17, 19],
  [19, 20],
  [18, 22],
]);

const seriePresupuestos12m = buildSeries([
  [9, 4],
  [11, 5],
  [10, 6],
  [12, 7],
  [13, 8],
  [12, 8],
  [14, 9],
  [16, 10],
  [15, 11],
  [18, 12],
  [17, 12],
  [19, 13],
]);

const rankingClientesBase: RankingItem[] = [
  { id: 'cli-001', nombre: 'Acme Industrial SA', valor: 1840000, cantidad: 7 },
  { id: 'cli-010', nombre: 'Innova Food Plant', valor: 1625000, cantidad: 5 },
  {
    id: 'cli-002',
    nombre: 'Solar Grid Patagonia SRL',
    valor: 1280000,
    cantidad: 6,
  },
  {
    id: 'cli-004',
    nombre: 'Build & Energy Constructora',
    valor: 980000,
    cantidad: 4,
  },
  {
    id: 'cli-006',
    nombre: 'Mercurio Retail Group',
    valor: 760000,
    cantidad: 5,
  },
  {
    id: 'cli-003',
    nombre: 'FríoSur Servicios Técnicos',
    valor: 540000,
    cantidad: 3,
  },
];

function buildSeries(values: Array<[number, number]>) {
  return values.map(([valor, valor2], index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - (values.length - 1 - index),
      1,
    );
    return {
      mes: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('es-AR', {
        month: 'short',
        year: '2-digit',
      }),
      valor,
      valor2,
    } satisfies PuntoSerie;
  });
}

function sliceSeries(series: PuntoSerie[], meses: number) {
  return series.slice(Math.max(0, series.length - meses));
}

function sumSerie(series: PuntoSerie[]) {
  return series.reduce((acc, item) => acc + item.valor, 0);
}

function sumSerie2(series: PuntoSerie[]) {
  return series.reduce((acc, item) => acc + (item.valor2 ?? 0), 0);
}

export function getMockClientes(filtros: FiltrosCliente = {}) {
  const {
    busqueda,
    condicion_iva,
    segmento,
    activo = true,
    pagina = 1,
    por_pagina = 20,
    orden_por = 'razon_social',
    orden_dir = 'asc',
  } = filtros;

  let rows = clientesBase.filter((item) => item.activo === activo);
  if (busqueda) {
    rows = rows.filter(
      (item) =>
        includesTerm(item.razon_social, busqueda) ||
        includesTerm(item.nombre_fantasia, busqueda) ||
        includesTerm(item.cuit, busqueda),
    );
  }
  if (condicion_iva)
    rows = rows.filter((item) => item.condicion_iva === condicion_iva);
  if (segmento) rows = rows.filter((item) => item.segmento === segmento);

  rows = [...rows].sort((a, b) => {
    const aValue =
      orden_por === 'ultima_actividad'
        ? (a.ultima_actividad ?? '')
        : String((a as Record<string, unknown>)[orden_por] ?? '');
    const bValue =
      orden_por === 'ultima_actividad'
        ? (b.ultima_actividad ?? '')
        : String((b as Record<string, unknown>)[orden_por] ?? '');
    return orden_dir === 'asc'
      ? String(aValue).localeCompare(String(bValue))
      : String(bValue).localeCompare(String(aValue));
  });

  return paginate(rows, pagina, por_pagina);
}

export function getMockPresupuestos(filtros: FiltrosPresupuesto = {}) {
  const {
    busqueda,
    estado,
    fecha_desde,
    fecha_hasta,
    tipo_operacion,
    pagina = 1,
    por_pagina = 20,
  } = filtros;
  let rows = [...presupuestosBase];
  if (busqueda)
    rows = rows.filter(
      (item) =>
        includesTerm(item.numero, busqueda) ||
        includesTerm(item.titulo, busqueda) ||
        includesTerm(item.razon_social, busqueda),
    );
  if (estado) rows = rows.filter((item) => item.estado === estado);
  if (tipo_operacion)
    rows = rows.filter((item) => item.tipo_operacion === tipo_operacion);
  if (fecha_desde)
    rows = rows.filter((item) => item.fecha_emision >= fecha_desde);
  if (fecha_hasta)
    rows = rows.filter((item) => item.fecha_emision <= fecha_hasta);
  rows.sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision));
  return paginate(rows, pagina, por_pagina);
}

export function getMockOrdenes(filtros: FiltrosOrden = {}) {
  const {
    busqueda,
    estado,
    fecha_desde,
    fecha_hasta,
    pagina = 1,
    por_pagina = 20,
  } = filtros;
  let rows = [...ordenesBase];
  if (busqueda)
    rows = rows.filter(
      (item) =>
        includesTerm(item.numero, busqueda) ||
        includesTerm(item.titulo, busqueda) ||
        includesTerm(item.razon_social, busqueda),
    );
  if (estado) rows = rows.filter((item) => item.estado === estado);
  if (fecha_desde)
    rows = rows.filter((item) => (item.fecha_inicio ?? '') >= fecha_desde);
  if (fecha_hasta)
    rows = rows.filter((item) => (item.fecha_inicio ?? '') <= fecha_hasta);
  rows.sort((a, b) =>
    (b.fecha_inicio ?? '').localeCompare(a.fecha_inicio ?? ''),
  );
  return paginate(rows, pagina, por_pagina);
}

export function getMockOrdenesKPIs() {
  const completadas = ordenesBase.filter(
    (item) => item.estado === 'COMPLETADA',
  ).length;
  const pendientes = ordenesBase.filter(
    (item) => item.estado === 'PENDIENTE',
  ).length;
  const en_progreso = ordenesBase.filter(
    (item) => item.estado === 'EN_PROGRESO',
  ).length;
  return {
    total: ordenesBase.length,
    pendientes,
    en_progreso,
    completadas_mes: completadas,
    tasa_completadas: Math.round((completadas / ordenesBase.length) * 100),
  };
}

export function getMockFacturas(filtros: FiltrosFactura = {}) {
  const {
    busqueda,
    estado,
    fecha_desde,
    fecha_hasta,
    pagina = 1,
    por_pagina = 20,
  } = filtros;
  let rows = [...facturasBase];
  if (busqueda)
    rows = rows.filter(
      (item) =>
        includesTerm(item.numero, busqueda) ||
        includesTerm(item.razon_social, busqueda),
    );
  if (estado) rows = rows.filter((item) => item.estado === estado);
  if (fecha_desde)
    rows = rows.filter((item) => item.fecha_emision >= fecha_desde);
  if (fecha_hasta)
    rows = rows.filter((item) => item.fecha_emision <= fecha_hasta);
  rows.sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision));
  return paginate(rows, pagina, por_pagina);
}

export function getMockFacturacionKPIs() {
  const total_facturado_mes = facturasBase
    .filter(
      (item) => item.fecha_emision.slice(0, 7) === dayOffset(0).slice(0, 7),
    )
    .reduce((acc, item) => acc + item.total, 0);
  const total_cobrado_mes = facturasBase.reduce(
    (acc, item) => acc + (item.total - item.saldo_pendiente),
    0,
  );
  const saldo_total_pendiente = facturasBase.reduce(
    (acc, item) => acc + item.saldo_pendiente,
    0,
  );
  const facturas_vencidas = facturasBase.filter(
    (item) =>
      ['EMITIDA', 'PENDIENTE_COBRO', 'COBRADA_PARCIAL'].includes(item.estado) &&
      !!item.fecha_vencimiento &&
      item.fecha_vencimiento < dayOffset(0),
  ).length;
  return {
    total_facturado_mes,
    total_cobrado_mes,
    saldo_total_pendiente,
    facturas_vencidas,
    tasa_cobro:
      total_facturado_mes > 0
        ? Math.round((total_cobrado_mes / total_facturado_mes) * 100)
        : 0,
  };
}

export function getMockNotasPedido(
  filtros: {
    busqueda?: string;
    estado?: EstadoNotaPedido;
    pagina?: number;
    por_pagina?: number;
  } = {},
) {
  const { busqueda, estado, pagina = 1, por_pagina = 20 } = filtros;
  let rows = [...notasBase];
  if (busqueda)
    rows = rows.filter(
      (item) =>
        includesTerm(item.numero, busqueda) ||
        includesTerm(item.proveedor, busqueda),
    );
  if (estado) rows = rows.filter((item) => item.estado === estado);
  rows.sort((a, b) => b.fecha_pedido.localeCompare(a.fecha_pedido));
  return paginate(rows, pagina, por_pagina);
}

export function getMockRemitos(
  filtros: {
    busqueda?: string;
    estado?: EstadoRemito;
    tipo?: TipoRemito;
    pagina?: number;
    por_pagina?: number;
  } = {},
) {
  const { busqueda, estado, tipo, pagina = 1, por_pagina = 20 } = filtros;
  let rows = [...remitosBase];
  if (busqueda)
    rows = rows.filter(
      (item) =>
        includesTerm(item.numero, busqueda) ||
        includesTerm(item.transportista, busqueda),
    );
  if (estado) rows = rows.filter((item) => item.estado === estado);
  if (tipo) rows = rows.filter((item) => item.tipo === tipo);
  rows.sort((a, b) => b.fecha_emision.localeCompare(a.fecha_emision));
  return paginate(rows, pagina, por_pagina);
}

export function getMockLogisticaKPIs() {
  return {
    notas_pendientes: notasBase.filter((item) => item.estado === 'PENDIENTE')
      .length,
    notas_parciales: notasBase.filter((item) => item.estado === 'PARCIAL')
      .length,
    remitos_emitidos_mes: remitosBase.filter(
      (item) =>
        item.estado === 'EMITIDO' &&
        item.fecha_emision.slice(0, 7) === dayOffset(0).slice(0, 7),
    ).length,
    remitos_entregados_mes: remitosBase.filter(
      (item) =>
        item.estado === 'ENTREGADO' &&
        item.fecha_emision.slice(0, 7) === dayOffset(0).slice(0, 7),
    ).length,
  };
}

export function getMockEventos(desde: string, hasta: string) {
  return mockEventosCalendario.filter(
    (item) => item.fecha_inicio >= desde && item.fecha_inicio <= hasta,
  );
}

export function getMockSerieFacturacion(meses = 12) {
  return sliceSeries(serieFacturacion12m, meses);
}

export function getMockSerieOrdenes(meses = 12) {
  return sliceSeries(serieOrdenes12m, meses);
}

export function getMockSeriePresupuestos(meses = 12) {
  return sliceSeries(seriePresupuestos12m, meses);
}

export function getMockRankingClientes(top = 10) {
  return rankingClientesBase.slice(0, top);
}

export function getMockResumenPeriodo(meses = 12): ResumenPeriodo {
  const facturacion = getMockSerieFacturacion(meses);
  const presupuestos = getMockSeriePresupuestos(meses);
  const ordenes = getMockSerieOrdenes(meses);
  const facturado = sumSerie(facturacion);
  const cobrado = sumSerie2(facturacion);
  const presupuestos_aprobados = sumSerie2(presupuestos);
  const presupuestos_emitidos = sumSerie(presupuestos);
  return {
    facturado,
    cobrado,
    ordenes_cerradas: sumSerie(ordenes),
    presupuestos_aprobados,
    tasa_conversion:
      presupuestos_emitidos > 0
        ? Math.round((presupuestos_aprobados / presupuestos_emitidos) * 100)
        : 0,
    ticket_promedio:
      presupuestos_aprobados > 0
        ? Math.round(facturado / presupuestos_aprobados)
        : 0,
  };
}

export function createMockCalendarEvent(input: {
  tipo: EventoCalendario['tipo'];
  titulo: string;
  descripcion?: string;
  fecha_inicio: string;
  todo_el_dia?: boolean;
}) {
  return {
    id: `evt-mock-${Math.random().toString(36).slice(2, 8)}`,
    tipo: input.tipo,
    titulo: input.titulo,
    descripcion: input.descripcion ?? null,
    fecha_inicio: input.fecha_inicio,
    fecha_fin: null,
    todo_el_dia: input.todo_el_dia ?? true,
    entidad_tipo: null,
    entidad_id: null,
    cliente_id: null,
    completado: false,
    color: null,
    razon_social: null,
    creado_en: new Date().toISOString(),
  } satisfies EventoCalendario;
}

export function updateMockOrderStatus(
  rows: OrdenMock[],
  id: string,
  estado: EstadoOrden,
) {
  return rows.map((row) => {
    if (row.id !== id) return row;
    return {
      ...row,
      estado,
      porcentaje_avance: estado === 'COMPLETADA' ? 100 : row.porcentaje_avance,
      fecha_fin_real:
        estado === 'COMPLETADA' ? dayOffset(0) : row.fecha_fin_real,
    };
  });
}

export function updateMockClienteActivo(
  rows: ClienteListaItem[],
  id: string,
  activo: boolean,
) {
  return rows.map((row) => (row.id === id ? { ...row, activo } : row));
}

export function updateMockPresupuestoEstado(
  rows: PresupuestoMock[],
  id: string,
  estado: EstadoPresupuesto,
) {
  return rows.map((row) =>
    row.id === id
      ? {
          ...row,
          estado,
          aprobado_en:
            estado === 'APROBADO' ? new Date().toISOString() : row.aprobado_en,
        }
      : row,
  );
}

export function duplicateMockPresupuesto(rows: PresupuestoMock[], id: string) {
  const original = rows.find((row) => row.id === id);
  if (!original) return rows;
  const clone: PresupuestoMock = {
    ...original,
    id: `pres-mock-${Math.random().toString(36).slice(2, 8)}`,
    numero: 'PRES-2026-00999',
    estado: 'BORRADOR',
    fecha_emision: dayOffset(0),
    fecha_vencimiento: dayOffset(15),
    aprobado_en: null,
    aprobado_por: null,
  };
  return [clone, ...rows];
}
