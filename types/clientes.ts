// ============================================================
// /types/clientes.ts
// ============================================================

import type { TipoDocumento, CondicionIVA, AuditableConUsuario } from './database'

// ── Entidades ─────────────────────────────────────────────────

export interface ClienteDireccion {
  id: string
  cliente_id: string
  etiqueta: string
  calle: string
  numero: string | null
  piso_dpto: string | null
  barrio: string | null
  ciudad: string
  provincia: string
  codigo_postal: string | null
  pais: string
  es_principal: boolean
  latitud: number | null
  longitud: number | null
  distancia_km: number | null
  notas: string | null
  creado_en: string
}

export interface Cliente extends AuditableConUsuario {
  id: string
  // Datos fiscales
  razon_social: string
  nombre_fantasia: string | null
  tipo_documento: TipoDocumento
  numero_documento: string
  cuit: string | null
  condicion_iva: CondicionIVA
  ingresos_brutos: string | null
  // Datos comerciales
  email: string | null
  email_facturacion: string | null
  telefono: string | null
  telefono_alt: string | null
  sitio_web: string | null
  contacto_nombre: string | null
  contacto_cargo: string | null
  // Clasificación
  segmento: string | null
  origen: string | null
  notas: string | null
  activo: boolean
}

// Con relaciones expandidas
export interface ClienteConDirecciones extends Cliente {
  direcciones: ClienteDireccion[]
}

// ── KPIs por cliente ──────────────────────────────────────────

export interface ClienteKPIs {
  cliente_id: string
  presupuestos_emitidos: number
  presupuestos_aprobados: number
  tasa_conversion: number // %
  facturas_emitidas: number
  servicios_realizados: number
  servicios_facturados: number
  servicios_cobrados: number
  monto_total_facturado: number
  monto_total_cobrado: number
  saldo_pendiente: number
  ultimo_servicio: string | null
  primera_operacion: string | null
}

// ── DTOs ──────────────────────────────────────────────────────

export interface CrearClienteDTO {
  razon_social: string
  nombre_fantasia?: string
  tipo_documento: TipoDocumento
  numero_documento: string
  cuit?: string
  condicion_iva: CondicionIVA
  ingresos_brutos?: string
  email?: string
  email_facturacion?: string
  telefono?: string
  telefono_alt?: string
  sitio_web?: string
  contacto_nombre?: string
  contacto_cargo?: string
  segmento?: string
  origen?: string
  notas?: string
  direccion_principal?: CrearDireccionDTO
}

export type ActualizarClienteDTO = Partial<CrearClienteDTO>

export interface CrearDireccionDTO {
  etiqueta: string
  calle: string
  numero?: string
  piso_dpto?: string
  barrio?: string
  ciudad: string
  provincia?: string
  codigo_postal?: string
  pais?: string
  es_principal?: boolean
  distancia_km?: number
  notas?: string
}

// ── Filtros ───────────────────────────────────────────────────

export interface FiltrosCliente {
  busqueda?: string
  condicion_iva?: CondicionIVA
  segmento?: string
  activo?: boolean
  pagina?: number
  por_pagina?: number
  orden_por?: keyof ClienteListaItem
  orden_dir?: 'asc' | 'desc'
}

// ── Listado ───────────────────────────────────────────────────

export interface ClienteListaItem {
  id: string
  razon_social: string
  nombre_fantasia: string | null
  cuit: string | null
  condicion_iva: CondicionIVA
  telefono: string | null
  email: string | null
  segmento: string | null
  activo: boolean
  // Calculados para la lista
  ultima_actividad: string | null
  saldo_pendiente: number
}
