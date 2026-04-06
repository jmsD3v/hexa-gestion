// ============================================================
// /lib/calendario-utils.ts
// Utilidades y constantes para el calendario (sin 'use server')
// ============================================================

import type { TipoEvento } from '@/types/calendario';

export const COLORES_TIPO: Record<TipoEvento, string> = {
  SERVICIO_PROGRAMADO: '#3b82f6', // azul
  SERVICIO_EJECUTADO: '#10b981', // verde
  VENCIMIENTO_FACTURA: '#ef4444', // rojo
  COBRO_CHEQUE: '#8b5cf6', // violeta
  PAGO_CHEQUE: '#f59e0b', // ámbar
  VENCIMIENTO_PLAN_PAGO: '#ec4899', // rosa
  VENCIMIENTO_POLIZA: '#f97316', // naranja
  PAGO_CLIENTE: '#06b6d4', // cyan
  VENCIMIENTO_SERVICIO_CONTINUO: '#84cc16', // lima
};

export const COLORES_TIPO_CLS: Record<TipoEvento, string> = {
  SERVICIO_PROGRAMADO: 'bg-blue-500',
  SERVICIO_EJECUTADO: 'bg-emerald-500',
  VENCIMIENTO_FACTURA: 'bg-red-500',
  COBRO_CHEQUE: 'bg-violet-500',
  PAGO_CHEQUE: 'bg-amber-500',
  VENCIMIENTO_PLAN_PAGO: 'bg-pink-500',
  VENCIMIENTO_POLIZA: 'bg-orange-500',
  PAGO_CLIENTE: 'bg-cyan-500',
  VENCIMIENTO_SERVICIO_CONTINUO: 'bg-lime-500',
};
