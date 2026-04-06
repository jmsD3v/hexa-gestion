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
    incluir_costos?: boolean
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
