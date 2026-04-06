// ============================================================
// /types/ordenes.ts
// ============================================================

import type { EstadoOrden, AuditableConUsuario } from './database'

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
  orden_por?: 'numero' | 'creado_en' | 'fecha_inicio' | 'fecha_fin_estimada'
  orden_dir?: 'asc' | 'desc'
}
