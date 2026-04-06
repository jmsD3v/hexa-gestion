// ============================================================
// /types/database.ts
// Tipos base que espejean el esquema de Supabase
// ============================================================

// ── Enumeraciones ─────────────────────────────────────────────

export type TipoDocumento = 'DNI' | 'CUIT' | 'CUIL' | 'PASAPORTE' | 'LE' | 'LC';

export type CondicionIVA =
  | 'RESPONSABLE_INSCRIPTO'
  | 'MONOTRIBUTISTA'
  | 'EXENTO'
  | 'CONSUMIDOR_FINAL'
  | 'NO_RESPONSABLE';

export type TipoOperacion = 'PRODUCTO' | 'SERVICIO' | 'PRODUCTO_SERVICIO';

export type EstadoPresupuesto =
  | 'BORRADOR'
  | 'ENVIADO'
  | 'APROBADO'
  | 'RECHAZADO'
  | 'VENCIDO';

export type EstadoOrden =
  | 'PENDIENTE'
  | 'EN_PROGRESO'
  | 'COMPLETADA'
  | 'CANCELADA'
  | 'SUSPENDIDA';

export type EstadoFactura =
  | 'BORRADOR'
  | 'EMITIDA'
  | 'PENDIENTE_COBRO'
  | 'COBRADA_PARCIAL'
  | 'COBRADA'
  | 'ANULADA';

export type TipoRemito =
  | 'INTERNO_ENTRADA'
  | 'INTERNO_SALIDA'
  | 'LEGAL_ENTRADA'
  | 'LEGAL_SALIDA';

export type EstadoRemito = 'BORRADOR' | 'EMITIDO' | 'ENTREGADO' | 'ANULADO';

export type TipoRecibo =
  | 'ANTICIPO'
  | 'PAGO_PARCIAL'
  | 'PAGO_FINAL'
  | 'DEVOLUCION';

export type TipoComprobanteAFIP =
  | 'FACTURA_A'
  | 'FACTURA_B'
  | 'FACTURA_C'
  | 'NOTA_DEBITO_A'
  | 'NOTA_DEBITO_B'
  | 'NOTA_CREDITO_A'
  | 'NOTA_CREDITO_B'
  | 'REMITO_R';

export type TipoEventoCalendario =
  | 'SERVICIO_PROGRAMADO'
  | 'SERVICIO_EJECUTADO'
  | 'VENCIMIENTO_FACTURA'
  | 'COBRO_CHEQUE'
  | 'PAGO_CHEQUE'
  | 'VENCIMIENTO_PLAN_PAGO'
  | 'VENCIMIENTO_POLIZA'
  | 'PAGO_CLIENTE'
  | 'VENCIMIENTO_SERVICIO_CONTINUO';

export type TipoPago =
  | 'EFECTIVO'
  | 'TRANSFERENCIA'
  | 'CHEQUE'
  | 'TARJETA_DEBITO'
  | 'TARJETA_CREDITO'
  | 'CREDITO_CUENTA';

export type RolUsuario =
  | 'superadmin'
  | 'admin'
  | 'supervisor'
  | 'operador'
  | 'viewer';

export type EntidadTipo =
  | 'cliente'
  | 'presupuesto'
  | 'orden'
  | 'nota_pedido'
  | 'remito'
  | 'factura'
  | 'recibo';

// ── Tipos base de auditoría ───────────────────────────────────

export interface Auditable {
  creado_en: string;
  actualizado_en: string;
}

export interface AuditableConUsuario extends Auditable {
  creado_por: string | null;
  actualizado_por?: string | null;
}

// ── Profile / Usuario ─────────────────────────────────────────

export interface Profile {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  activo: boolean;
  avatar_url: string | null;
  creado_en: string;
  actualizado_en: string;
}

export type ProfileNombreCompleto = Pick<
  Profile,
  'id' | 'nombre' | 'apellido' | 'email'
>;

// ── Numerador ─────────────────────────────────────────────────

export interface Numerador {
  id: string;
  tipo: string;
  prefijo: string;
  ultimo_numero: number;
  anio: number;
}

// ── Configuración empresa ─────────────────────────────────────

export interface ConfiguracionEmpresa {
  id: string;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string;
  condicion_iva: CondicionIVA;
  ingresos_brutos: string | null;
  domicilio_fiscal: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
  logo_url: string | null;
  punto_venta_default: number;
  pie_pagina_pdf: string | null;
  color_primario: string;
  actualizado_en: string;
}
