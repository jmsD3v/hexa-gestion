// ============================================================
// /types/documentos.ts
// ============================================================

import type { EntidadTipo } from './database'

export interface Documento {
  id: string
  entidad_tipo: EntidadTipo
  entidad_id: string
  nombre: string
  descripcion: string | null
  tipo_mime: string
  tamanio_bytes: number | null
  storage_path: string
  publico: boolean
  subido_por: string | null
  creado_en: string
}

export interface SubirDocumentoDTO {
  entidad_tipo: EntidadTipo
  entidad_id: string
  nombre: string
  descripcion?: string
  publico?: boolean
  archivo: File
}

// ── Generación PDF ────────────────────────────────────────────

export type TipoPDF =
  | 'presupuesto'
  | 'orden_servicio'
  | 'nota_pedido'
  | 'remito'
  | 'factura'
  | 'recibo'

export interface GenerarPDFRequest {
  tipo: TipoPDF
  id: string
  opciones?: {
    incluir_costos?: boolean    // false para PDF del cliente
    incluir_incidencias?: boolean
    marca_agua?: string
    pie_pagina?: string
  }
}

export interface GenerarPDFResponse {
  url: string
  nombre_archivo: string
  tamanio_bytes: number
}

// ============================================================
// /types/calendar.ts
// ============================================================

import type { TipoEventoCalendario, EntidadTipo } from './database'

export interface EventoCalendario {
  id: string
  tipo: TipoEventoCalendario
  titulo: string
  descripcion: string | null
  fecha_inicio: string
  fecha_fin: string | null
  todo_el_dia: boolean
  entidad_tipo: EntidadTipo | null
  entidad_id: string | null
  cliente_id: string | null
  completado: boolean
  color: string | null
  creado_por: string | null
  creado_en: string
  actualizado_en: string
}

export interface CrearEventoCalendarioDTO {
  tipo: TipoEventoCalendario
  titulo: string
  descripcion?: string
  fecha_inicio: string
  fecha_fin?: string
  todo_el_dia?: boolean
  entidad_tipo?: EntidadTipo
  entidad_id?: string
  cliente_id?: string
  color?: string
}

export interface FiltrosCalendario {
  fecha_desde: string
  fecha_hasta: string
  tipo?: TipoEventoCalendario
  cliente_id?: string
  completado?: boolean
}

// ============================================================
// /types/api.ts — Respuestas estándar de la API
// ============================================================

export interface ApiResponse<T = unknown> {
  data: T | null
  error: string | null
  mensaje?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  pagina: number
  por_pagina: number
  total_paginas: number
}

export interface ApiError {
  codigo: string
  mensaje: string
  detalles?: Record<string, string[]>
}

// ── Audit Log ─────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number
  usuario_id: string | null
  accion: string
  entidad_tipo: string
  entidad_id: string
  datos_anteriores: Record<string, unknown> | null
  datos_nuevos: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  creado_en: string
}
