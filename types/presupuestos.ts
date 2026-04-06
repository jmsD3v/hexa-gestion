// ============================================================
// /types/presupuestos.ts
// ============================================================

import type {
  TipoOperacion,
  EstadoPresupuesto,
  AuditableConUsuario,
} from './database'

// ── Presupuesto ───────────────────────────────────────────────

export interface PresupuestoItem {
  id: string
  presupuesto_id: string
  servicio_id: string | null
  orden: number
  descripcion: string
  detalle: string | null
  cantidad: number
  unidad_medida: string
  precio_unitario: number
  costo_unitario: number | null
  descuento_pct: number
  subtotal: number
}

export type TipoIncidencia =
  | 'traslado'
  | 'viatico'
  | 'hospedaje'
  | 'combustible'
  | 'vianda'
  | 'equipamiento'
  | 'sanidad'
  | 'honorario_externo'
  | 'pago_tercero'
  | 'otro'

export interface PresupuestoIncidencia {
  id: string
  presupuesto_id: string
  tipo: TipoIncidencia
  descripcion: string
  cantidad: number
  dias: number
  distancia_km: number | null
  monto_unitario: number
  subtotal: number
  es_interno: boolean
  notas: string | null
}

export interface Presupuesto extends AuditableConUsuario {
  id: string
  numero: string
  cliente_id: string
  direccion_id: string | null
  titulo: string
  objetivo_servicio: string
  tipo_operacion: TipoOperacion
  descripcion: string | null
  fecha_emision: string
  fecha_vencimiento: string | null
  // Económico
  subtotal_items: number
  subtotal_incidencias: number
  descuento_pct: number
  descuento_monto: number
  subtotal: number
  iva_pct: number
  iva_monto: number
  otros_impuestos: number
  total: number
  // Interno
  costo_total: number | null
  margen_pct: number | null
  margen_monto: number | null
  // Estado
  estado: EstadoPresupuesto
  condiciones_pago: string | null
  tiempo_ejecucion: string | null
  garantia: string | null
  notas_internas: string | null
  notas_cliente: string | null
  aprobado_por: string | null
  aprobado_en: string | null
}

export interface PresupuestoCompleto extends Presupuesto {
  items: PresupuestoItem[]
  incidencias: PresupuestoIncidencia[]
}

// ── DTOs ──────────────────────────────────────────────────────

export interface CrearPresupuestoItemDTO {
  servicio_id?: string
  descripcion: string
  detalle?: string
  cantidad: number
  unidad_medida?: string
  precio_unitario: number
  costo_unitario?: number
  descuento_pct?: number
}

export interface CrearPresupuestoIncidenciaDTO {
  tipo: TipoIncidencia
  descripcion: string
  cantidad?: number
  dias?: number
  distancia_km?: number
  monto_unitario: number
  es_interno?: boolean
  notas?: string
}

export interface CrearPresupuestoDTO {
  cliente_id: string
  direccion_id?: string
  titulo: string
  objetivo_servicio: string
  tipo_operacion: TipoOperacion
  descripcion?: string
  fecha_vencimiento?: string
  descuento_pct?: number
  iva_pct?: number
  condiciones_pago?: string
  tiempo_ejecucion?: string
  garantia?: string
  notas_internas?: string
  notas_cliente?: string
  items: CrearPresupuestoItemDTO[]
  incidencias?: CrearPresupuestoIncidenciaDTO[]
}

export type ActualizarPresupuestoDTO = Partial<CrearPresupuestoDTO>

// ── Filtros ───────────────────────────────────────────────────

export interface FiltrosPresupuesto {
  busqueda?: string
  cliente_id?: string
  estado?: EstadoPresupuesto
  fecha_desde?: string
  fecha_hasta?: string
  tipo_operacion?: TipoOperacion
  pagina?: number
  por_pagina?: number
  orden_por?: 'numero' | 'creado_en' | 'total' | 'fecha_validez'
  orden_dir?: 'asc' | 'desc'
}

// Orden types moved to ./ordenes
export type { OrdenTecnico, OrdenServicio, OrdenServicioCompleta, CrearOrdenServicioDTO, FiltrosOrden } from './ordenes'
