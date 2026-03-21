// ============================================================
// /lib/utils.ts
// Utilidades generales
// ============================================================

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Combina clases de Tailwind de forma segura */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Genera un número de documento legible */
export function formatearNumeroDoc(numero: string): string {
  return numero.replace(/-/g, '\u2011') // Non-breaking hyphen
}

/** Trunca texto a un máximo de caracteres */
export function truncar(texto: string, max = 50): string {
  return texto.length > max ? texto.slice(0, max) + '…' : texto
}

/** Convierte un enum de estado a label legible */
export const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: 'Borrador',
  ENVIADO: 'Enviado',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  VENCIDO: 'Vencido',
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  COMPLETADA: 'Completada',
  CANCELADA: 'Cancelada',
  SUSPENDIDA: 'Suspendida',
  EMITIDA: 'Emitida',
  PENDIENTE_COBRO: 'Pendiente cobro',
  COBRADA_PARCIAL: 'Cobro parcial',
  COBRADA: 'Cobrada',
  ANULADA: 'Anulada',
  EMITIDO: 'Emitido',
  ENTREGADO: 'Entregado',
}

export const ESTADO_COLORES: Record<string, string> = {
  BORRADOR: 'bg-gray-100 text-gray-700',
  ENVIADO: 'bg-blue-100 text-blue-700',
  APROBADO: 'bg-green-100 text-green-700',
  RECHAZADO: 'bg-red-100 text-red-700',
  VENCIDO: 'bg-orange-100 text-orange-700',
  PENDIENTE: 'bg-yellow-100 text-yellow-700',
  EN_PROGRESO: 'bg-blue-100 text-blue-700',
  COMPLETADA: 'bg-green-100 text-green-700',
  CANCELADA: 'bg-red-100 text-red-700',
  EMITIDA: 'bg-blue-100 text-blue-700',
  PENDIENTE_COBRO: 'bg-yellow-100 text-yellow-700',
  COBRADA: 'bg-green-100 text-green-700',
  ANULADA: 'bg-red-100 text-red-700',
}
