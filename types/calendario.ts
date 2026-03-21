// ============================================================
// /types/calendario.ts
// Tipos para el módulo de calendario
// ============================================================

export type TipoEvento =
  | 'SERVICIO_PROGRAMADO'
  | 'SERVICIO_EJECUTADO'
  | 'VENCIMIENTO_FACTURA'
  | 'COBRO_CHEQUE'
  | 'PAGO_CHEQUE'
  | 'VENCIMIENTO_PLAN_PAGO'
  | 'VENCIMIENTO_POLIZA'
  | 'PAGO_CLIENTE'
  | 'VENCIMIENTO_SERVICIO_CONTINUO';

export interface EventoCalendario {
  id: string;
  tipo: TipoEvento;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  todo_el_dia: boolean;
  entidad_tipo: string | null;
  entidad_id: string | null;
  cliente_id: string | null;
  completado: boolean;
  color: string | null;
  razon_social?: string | null;
  creado_en: string;
}

export interface CrearEventoDTO {
  tipo: TipoEvento;
  titulo: string;
  descripcion?: string;
  fecha_inicio: string;
  fecha_fin?: string;
  todo_el_dia?: boolean;
  entidad_tipo?: string;
  entidad_id?: string;
  cliente_id?: string;
  color?: string;
}
