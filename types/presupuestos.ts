// ============================================================
// /types/presupuestos.ts
// ============================================================

import type {
  TipoOperacion,
  EstadoPresupuesto,
  EstadoOrden,
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
}

// ── Orden de Servicio ──────────────────────────────────────────

export interface OrdenTecnico {
  id: string
  orden_id: string
  tecnico_id: string | null
  nombre: string
  rol: string | null
  fecha_desde: string | null
  fecha_hasta: string | null
  notas: string | null
}

export interface OrdenServicio extends AuditableConUsuario {
  id: string
  numero: string
  presupuesto_id: string | null
  cliente_id: string
  direccion_id: string | null
  titulo: string
  descripcion: string | null
  objetivo_tecnico: string | null
  fecha_inicio: string | null
  fecha_fin_estimada: string | null
  fecha_fin_real: string | null
  estado: EstadoOrden
  porcentaje_avance: number
  notas_tecnicas: string | null
  notas_cliente: string | null
  observaciones_cierre: string | null
}

export interface OrdenServicioCompleta extends OrdenServicio {
  tecnicos: OrdenTecnico[]
}

export interface CrearOrdenServicioDTO {
  presupuesto_id?: string
  cliente_id: string
  direccion_id?: string
  titulo: string
  descripcion?: string
  objetivo_tecnico?: string
  fecha_inicio?: string
  fecha_fin_estimada?: string
  notas_tecnicas?: string
  notas_cliente?: string
  tecnicos?: Array<{
    tecnico_id?: string
    nombre: string
    rol?: string
    fecha_desde?: string
    fecha_hasta?: string
  }>
}

export interface FiltrosOrden {
  busqueda?: string
  cliente_id?: string
  estado?: EstadoOrden
  tecnico_id?: string
  fecha_desde?: string
  fecha_hasta?: string
  pagina?: number
  por_pagina?: number
}
