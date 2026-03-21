// ============================================================
// /lib/calculos.ts
// Funciones puras de cálculo económico
// ============================================================

import type {
  CrearPresupuestoItemDTO,
  CrearPresupuestoIncidenciaDTO,
} from '@/types'

interface OpcionesTotales {
  descuento_pct: number
  iva_pct: number
}

interface TotalesPresupuesto {
  subtotal_items: number
  subtotal_incidencias: number
  descuento_monto: number
  subtotal: number
  iva_monto: number
  total: number
  costo_total: number
  margen_monto: number
  margen_pct: number
}

/**
 * Calcula todos los totales de un presupuesto.
 * Función pura sin efectos secundarios — se puede usar en frontend y backend.
 */
export function calcularTotalesPresupuesto(
  items: CrearPresupuestoItemDTO[],
  incidencias: CrearPresupuestoIncidenciaDTO[],
  opciones: OpcionesTotales
): TotalesPresupuesto {
  const { descuento_pct, iva_pct } = opciones

  // Subtotal de ítems
  const subtotal_items = items.reduce((acc, item) => {
    const subtotal = item.cantidad * item.precio_unitario * (1 - (item.descuento_pct ?? 0) / 100)
    return acc + subtotal
  }, 0)

  // Subtotal de incidencias
  const subtotal_incidencias = incidencias.reduce((acc, inc) => {
    const subtotal = (inc.cantidad ?? 1) * (inc.dias ?? 1) * inc.monto_unitario
    return acc + subtotal
  }, 0)

  const base = subtotal_items + subtotal_incidencias
  const descuento_monto = base * (descuento_pct / 100)
  const subtotal = base - descuento_monto
  const iva_monto = subtotal * (iva_pct / 100)
  const total = subtotal + iva_monto

  // Costos (internos)
  const costo_items = items.reduce((acc, item) => {
    return acc + item.cantidad * (item.costo_unitario ?? 0)
  }, 0)
  const costo_incidencias = incidencias
    .filter(inc => inc.es_interno !== false)
    .reduce((acc, inc) => acc + (inc.cantidad ?? 1) * (inc.dias ?? 1) * inc.monto_unitario, 0)

  const costo_total = costo_items + costo_incidencias
  const margen_monto = subtotal - costo_total
  const margen_pct = subtotal > 0 ? (margen_monto / subtotal) * 100 : 0

  return {
    subtotal_items: redondear(subtotal_items),
    subtotal_incidencias: redondear(subtotal_incidencias),
    descuento_monto: redondear(descuento_monto),
    subtotal: redondear(subtotal),
    iva_monto: redondear(iva_monto),
    total: redondear(total),
    costo_total: redondear(costo_total),
    margen_monto: redondear(margen_monto),
    margen_pct: redondear(margen_pct),
  }
}

/**
 * Calcula el punto de equilibrio dado costos fijos y margen de contribución.
 * Q_eq = Costos Fijos / (Precio - Costo Variable Unitario)
 */
export function calcularPuntoEquilibrio(
  costos_fijos: number,
  precio_promedio: number,
  costo_variable_promedio: number
): number {
  const margen_contribucion = precio_promedio - costo_variable_promedio
  if (margen_contribucion <= 0) return Infinity
  return costos_fijos / margen_contribucion
}

/**
 * Formatea un monto en pesos argentinos.
 */
export function formatearMonto(monto: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(monto)
}

/**
 * Redondea a 2 decimales.
 */
export function redondear(valor: number): number {
  return Math.round(valor * 100) / 100
}
