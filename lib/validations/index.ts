// ============================================================
// /lib/validations/index.ts
// Schemas Zod para validación en backend y frontend
// ============================================================

import { z } from 'zod'

// ── Helpers ───────────────────────────────────────────────────

const fechaISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
const uuid = z.string().uuid('ID inválido')
const monto = z.number().min(0, 'El monto no puede ser negativo')
const porcentaje = z.number().min(0).max(100)

// ── Cliente ───────────────────────────────────────────────────

export const DireccionSchema = z.object({
  etiqueta: z.string().min(1, 'La etiqueta es requerida').max(100),
  calle: z.string().min(1, 'La calle es requerida').max(200),
  numero: z.string().max(20).optional(),
  piso_dpto: z.string().max(50).optional(),
  barrio: z.string().max(100).optional(),
  ciudad: z.string().min(1, 'La ciudad es requerida').max(100),
  provincia: z.string().max(100).default('Chaco'),
  codigo_postal: z.string().max(10).optional(),
  pais: z.string().max(100).default('Argentina'),
  es_principal: z.boolean().default(false),
  distancia_km: z.number().min(0).optional(),
  notas: z.string().max(500).optional(),
})

export const ClienteSchema = z.object({
  razon_social: z.string().min(2, 'La razón social es requerida').max(200),
  nombre_fantasia: z.string().max(200).optional(),
  tipo_documento: z.enum(['DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'LE', 'LC']),
  numero_documento: z.string().min(7, 'El número de documento es inválido').max(20),
  cuit: z
    .string()
    .regex(/^\d{2}-\d{8}-\d$/, 'CUIT inválido. Formato: XX-XXXXXXXX-X')
    .optional()
    .or(z.literal('')),
  condicion_iva: z.enum([
    'RESPONSABLE_INSCRIPTO',
    'MONOTRIBUTISTA',
    'EXENTO',
    'CONSUMIDOR_FINAL',
    'NO_RESPONSABLE',
  ]),
  ingresos_brutos: z.string().max(50).optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  email_facturacion: z.string().email('Email de facturación inválido').optional().or(z.literal('')),
  telefono: z.string().max(30).optional(),
  telefono_alt: z.string().max(30).optional(),
  sitio_web: z.string().url('URL inválida').optional().or(z.literal('')),
  contacto_nombre: z.string().max(150).optional(),
  contacto_cargo: z.string().max(100).optional(),
  segmento: z.string().max(100).optional(),
  origen: z.string().max(100).optional(),
  notas: z.string().max(2000).optional(),
  direccion_principal: DireccionSchema.optional(),
})

export type ClienteFormValues = z.infer<typeof ClienteSchema>

// ── Presupuesto ───────────────────────────────────────────────

export const PresupuestoItemSchema = z.object({
  servicio_id: uuid.optional(),
  descripcion: z.string().min(1, 'La descripción es requerida').max(500),
  detalle: z.string().max(1000).optional(),
  cantidad: z.number().min(0.001, 'La cantidad debe ser mayor a 0'),
  unidad_medida: z.string().max(20).default('UN'),
  precio_unitario: monto,
  costo_unitario: monto.optional(),
  descuento_pct: porcentaje.default(0),
})

export const PresupuestoIncidenciaSchema = z.object({
  tipo: z.enum([
    'traslado',
    'viatico',
    'hospedaje',
    'combustible',
    'vianda',
    'equipamiento',
    'sanidad',
    'honorario_externo',
    'pago_tercero',
    'otro',
  ]),
  descripcion: z.string().min(1).max(500),
  cantidad: z.number().min(0).default(1),
  dias: z.number().int().min(1).default(1),
  distancia_km: z.number().min(0).optional(),
  monto_unitario: monto,
  es_interno: z.boolean().default(true),
  notas: z.string().max(500).optional(),
})

export const PresupuestoSchema = z.object({
  cliente_id: uuid,
  direccion_id: uuid.optional(),
  titulo: z.string().min(3, 'El título es requerido').max(300),
  objetivo_servicio: z.string().min(3, 'El objetivo del servicio es requerido').max(500),
  tipo_operacion: z.enum(['PRODUCTO', 'SERVICIO', 'PRODUCTO_SERVICIO']),
  descripcion: z.string().max(2000).optional(),
  fecha_vencimiento: fechaISO.optional(),
  descuento_pct: porcentaje.default(0),
  iva_pct: porcentaje.default(21),
  condiciones_pago: z.string().max(500).optional(),
  tiempo_ejecucion: z.string().max(200).optional(),
  garantia: z.string().max(500).optional(),
  notas_internas: z.string().max(2000).optional(),
  notas_cliente: z.string().max(2000).optional(),
  items: z
    .array(PresupuestoItemSchema)
    .min(1, 'El presupuesto debe tener al menos un ítem'),
  incidencias: z.array(PresupuestoIncidenciaSchema).default([]),
})

export type PresupuestoFormValues = z.infer<typeof PresupuestoSchema>

// ── Orden de Servicio ──────────────────────────────────────────

export const OrdenServicioSchema = z.object({
  presupuesto_id: uuid.optional(),
  cliente_id: uuid,
  direccion_id: uuid.optional(),
  titulo: z.string().min(3).max(300),
  descripcion: z.string().max(2000).optional(),
  objetivo_tecnico: z.string().max(1000).optional(),
  fecha_inicio: fechaISO.optional(),
  fecha_fin_estimada: fechaISO.optional(),
  notas_tecnicas: z.string().max(2000).optional(),
  notas_cliente: z.string().max(2000).optional(),
  tecnicos: z
    .array(
      z.object({
        tecnico_id: uuid.optional(),
        nombre: z.string().min(2).max(200),
        rol: z.string().max(100).optional(),
        fecha_desde: fechaISO.optional(),
        fecha_hasta: fechaISO.optional(),
      })
    )
    .default([]),
})

export type OrdenServicioFormValues = z.infer<typeof OrdenServicioSchema>

// ── Factura ───────────────────────────────────────────────────

export const FacturaItemSchema = z.object({
  descripcion: z.string().min(1).max(500),
  detalle: z.string().max(1000).optional(),
  cantidad: z.number().min(0.001),
  unidad_medida: z.string().max(20).default('UN'),
  precio_unitario: monto,
  descuento_pct: porcentaje.default(0),
  iva_pct: porcentaje.default(21),
})

export const FacturaSchema = z.object({
  tipo_comprobante: z.enum([
    'FACTURA_A',
    'FACTURA_B',
    'FACTURA_C',
    'NOTA_DEBITO_A',
    'NOTA_DEBITO_B',
    'NOTA_CREDITO_A',
    'NOTA_CREDITO_B',
    'REMITO_R',
  ]),
  presupuesto_id: uuid.optional(),
  orden_id: uuid.optional(),
  remito_id: uuid.optional(),
  cliente_id: uuid,
  fecha_emision: fechaISO.optional(),
  fecha_vencimiento: fechaISO.optional(),
  periodo_desde: fechaISO.optional(),
  periodo_hasta: fechaISO.optional(),
  iva_pct: porcentaje.default(21),
  condicion_venta: z.string().max(200).optional(),
  notas: z.string().max(2000).optional(),
  items: z.array(FacturaItemSchema).min(1, 'La factura debe tener al menos un ítem'),
})

export type FacturaFormValues = z.infer<typeof FacturaSchema>

// ── Recibo ────────────────────────────────────────────────────

export const ReciboSchema = z.object({
  factura_id: uuid.optional(),
  cliente_id: uuid,
  tipo: z.enum(['ANTICIPO', 'PAGO_PARCIAL', 'PAGO_FINAL', 'DEVOLUCION']),
  fecha: fechaISO.optional(),
  monto: z.number().min(0.01, 'El monto debe ser mayor a 0'),
  tipo_pago: z.enum([
    'EFECTIVO',
    'TRANSFERENCIA',
    'CHEQUE',
    'TARJETA_DEBITO',
    'TARJETA_CREDITO',
    'CREDITO_CUENTA',
  ]),
  cheque_banco: z.string().max(100).optional(),
  cheque_numero: z.string().max(50).optional(),
  cheque_fecha: fechaISO.optional(),
  cheque_titular: z.string().max(200).optional(),
  concepto: z.string().max(500).optional(),
  notas: z.string().max(1000).optional(),
})

export type ReciboFormValues = z.infer<typeof ReciboSchema>
