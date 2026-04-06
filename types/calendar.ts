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
