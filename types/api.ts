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
