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
