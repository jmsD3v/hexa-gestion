// ============================================================
// /types/facturacion.ts
// ============================================================

import type {
  TipoComprobanteAFIP,
  EstadoFactura,
  TipoRemito,
  EstadoRemito,
  TipoRecibo,
  TipoPago,
  AuditableConUsuario,
} from './database'

// ── Nota de Pedido ────────────────────────────────────────────

export interface NotaPedidoItem {
  id: string
  nota_pedido_id: string
  descripcion: string
  unidad_medida: string
  cantidad_pedida: number
  cantidad_recibida: number
  precio_unitario: number | null
  subtotal: number | null
  notas: string | null
}

export type EstadoNotaPedido = 'PENDIENTE' | 'PARCIAL' | 'RECIBIDO' | 'ANULADO'

export interface NotaPedido extends AuditableConUsuario {
  id: string
  numero: string
  orden_id: string | null
  presupuesto_id: string | null
  cliente_id: string | null
  proveedor: string | null
  fecha_pedido: string
  fecha_requerida: string | null
  fecha_recepcion: string | null
  estado: EstadoNotaPedido
  notas: string | null
}

export interface NotaPedidoCompleta extends NotaPedido {
  items: NotaPedidoItem[]
}

export interface CrearNotaPedidoDTO {
  orden_id?: string
  presupuesto_id?: string
  cliente_id?: string
  proveedor?: string
  fecha_requerida?: string
  notas?: string
  items: Array<{
    descripcion: string
    unidad_medida?: string
    cantidad_pedida: number
    precio_unitario?: number
    notas?: string
  }>
}

// ── Remito ────────────────────────────────────────────────────

export interface RemitoItem {
  id: string
  remito_id: string
  descripcion: string
  unidad_medida: string
  cantidad: number
  precio_unitario: number | null
  subtotal: number | null
  orden: number
}

export interface Remito extends AuditableConUsuario {
  id: string
  numero: string
  tipo: TipoRemito
  orden_id: string | null
  nota_pedido_id: string | null
  factura_id: string | null
  cliente_id: string | null
  proveedor: string | null
  // AFIP
  punto_venta: number | null
  numero_afip: number | null
  cai: string | null
  cai_vencimiento: string | null
  cae: string | null
  fecha_emision: string
  estado: EstadoRemito
  // Entrega
  direccion_entrega: string | null
  transportista: string | null
  patente_vehiculo: string | null
  chofer: string | null
  notas: string | null
}

export interface RemitoCompleto extends Remito {
  items: RemitoItem[]
}

export interface CrearRemitoDTO {
  tipo: TipoRemito
  orden_id?: string
  nota_pedido_id?: string
  cliente_id?: string
  proveedor?: string
  fecha_emision?: string
  direccion_entrega?: string
  transportista?: string
  patente_vehiculo?: string
  chofer?: string
  notas?: string
  items: Array<{
    descripcion: string
    unidad_medida?: string
    cantidad: number
    precio_unitario?: number
  }>
}

// ── Factura ───────────────────────────────────────────────────

export interface FacturaItem {
  id: string
  factura_id: string
  descripcion: string
  detalle: string | null
  cantidad: number
  unidad_medida: string
  precio_unitario: number
  descuento_pct: number
  iva_pct: number
  subtotal: number
  orden: number
}

export interface Factura extends AuditableConUsuario {
  id: string
  numero: string
  tipo_comprobante: TipoComprobanteAFIP
  punto_venta: number
  numero_afip: number | null
  cae: string | null
  cae_vencimiento: string | null
  presupuesto_id: string | null
  orden_id: string | null
  remito_id: string | null
  cliente_id: string
  fecha_emision: string
  fecha_vencimiento: string | null
  periodo_desde: string | null
  periodo_hasta: string | null
  subtotal: number
  descuento_monto: number
  iva_pct: number
  iva_monto: number
  otros_impuestos: number
  total: number
  saldo_pendiente: number
  estado: EstadoFactura
  condicion_venta: string | null
  notas: string | null
}

export interface FacturaCompleta extends Factura {
  items: FacturaItem[]
  recibos: Recibo[]
}

export interface CrearFacturaDTO {
  tipo_comprobante: TipoComprobanteAFIP
  presupuesto_id?: string
  orden_id?: string
  remito_id?: string
  cliente_id: string
  fecha_emision?: string
  fecha_vencimiento?: string
  periodo_desde?: string
  periodo_hasta?: string
  iva_pct?: number
  condicion_venta?: string
  notas?: string
  items: Array<{
    descripcion: string
    detalle?: string
    cantidad: number
    unidad_medida?: string
    precio_unitario: number
    descuento_pct?: number
    iva_pct?: number
  }>
}

export interface FiltrosFactura {
  busqueda?: string
  cliente_id?: string
  estado?: EstadoFactura
  tipo_comprobante?: TipoComprobanteAFIP
  fecha_desde?: string
  fecha_hasta?: string
  pagina?: number
  por_pagina?: number
  orden_por?: 'numero' | 'fecha_emision' | 'total' | 'fecha_vencimiento'
  orden_dir?: 'asc' | 'desc'
}

// ── Recibo ────────────────────────────────────────────────────

export interface Recibo {
  id: string
  numero: string
  factura_id: string | null
  cliente_id: string
  tipo: TipoRecibo
  fecha: string
  monto: number
  tipo_pago: TipoPago
  cheque_banco: string | null
  cheque_numero: string | null
  cheque_fecha: string | null
  cheque_titular: string | null
  concepto: string | null
  notas: string | null
  creado_por: string | null
  creado_en: string
}

export interface CrearReciboDTO {
  factura_id?: string
  cliente_id: string
  tipo: TipoRecibo
  fecha?: string
  monto: number
  tipo_pago: TipoPago
  cheque_banco?: string
  cheque_numero?: string
  cheque_fecha?: string
  cheque_titular?: string
  concepto?: string
  notas?: string
}

// ── Análisis económico ────────────────────────────────────────

export interface AnalisisLineal {
  periodo_desde: string
  periodo_hasta: string
  // Ingresos
  total_facturado: number
  total_cobrado: number
  saldo_pendiente: number
  // Costos
  total_costos: number
  // Márgenes
  margen_bruto: number
  margen_pct: number
  // Punto de equilibrio
  costos_fijos: number
  costos_variables: number
  punto_equilibrio: number
  // Unidades de negocio
  por_segmento: Array<{
    segmento: string
    facturado: number
    cobrado: number
    margen: number
    cantidad_servicios: number
  }>
}
