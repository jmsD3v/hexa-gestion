'use server';

// ============================================================
// /app/actions/dashboard.ts
// Server Actions — KPIs y actividad reciente del Dashboard
// ============================================================

import { createClient } from '@/lib/supabase/server';
import type { ApiResponse } from '@/types';

// ── Tipos ─────────────────────────────────────────────────────

export interface DashboardKPIs {
  // Comercial
  presupuestos_pendientes: number; // BORRADOR + ENVIADO
  presupuestos_mes: number; // emitidos este mes
  tasa_conversion: number; // APROBADO / total enviados (%)
  // Operativo
  ordenes_activas: number; // PENDIENTE + EN_PROGRESO
  ordenes_en_progreso: number;
  ordenes_completadas_mes: number;
  // Finanzas
  facturado_mes: number;
  cobrado_mes: number;
  saldo_pendiente: number;
  facturas_vencidas: number;
  // Logística
  notas_pedido_pendientes: number;
  remitos_emitidos_mes: number;
}

export interface ActividadReciente {
  id: string;
  tipo: 'presupuesto' | 'orden' | 'factura' | 'remito' | 'nota_pedido';
  numero: string;
  titulo: string;
  subtitulo: string;
  estado: string;
  fecha: string;
  href: string;
}

export interface AlertaDashboard {
  tipo: 'warning' | 'error' | 'info';
  modulo: string;
  mensaje: string;
  href: string;
  cantidad: number;
}

// ── KPIs globales ─────────────────────────────────────────────

export async function obtenerDashboardKPIs(): Promise<
  ApiResponse<DashboardKPIs>
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const inicioMesStr = inicioMes.toISOString();
  const hoy = new Date().toISOString().split('T')[0];

  const [
    { data: presPendientes },
    { data: presMes },
    { data: presEnviados },
    { data: presAprobados },
    { data: ordenesActivas },
    { data: ordenesEnProgreso },
    { data: ordenesCompletadasMes },
    { data: factMes },
    { data: cobradoMes },
    { data: saldoPendiente },
    { data: factsVencidas },
    { data: notasPendientes },
    { data: remitosMes },
  ] = await Promise.all([
    // Presupuestos pendientes de resolución
    supabase
      .from('presupuestos')
      .select('id')
      .in('estado', ['BORRADOR', 'ENVIADO']),
    // Emitidos este mes
    supabase.from('presupuestos').select('id').gte('creado_en', inicioMesStr),
    // Base tasa conversión
    supabase.from('presupuestos').select('id').eq('estado', 'ENVIADO'),
    supabase.from('presupuestos').select('id').eq('estado', 'APROBADO'),
    // Órdenes activas
    supabase
      .from('ordenes_servicio')
      .select('id')
      .in('estado', ['PENDIENTE', 'EN_PROGRESO']),
    supabase.from('ordenes_servicio').select('id').eq('estado', 'EN_PROGRESO'),
    supabase
      .from('ordenes_servicio')
      .select('id')
      .eq('estado', 'COMPLETADA')
      .gte('actualizado_en', inicioMesStr),
    // Facturación: suma facturado del mes
    supabase
      .from('facturas')
      .select('total')
      .in('estado', ['EMITIDA', 'COBRADA'])
      .gte('fecha_emision', inicioMes.toISOString().split('T')[0]),
    // Cobrado del mes (suma de recibos)
    supabase
      .from('recibos')
      .select('monto')
      .gte('fecha', inicioMes.toISOString().split('T')[0]),
    // Saldo pendiente total
    supabase
      .from('facturas')
      .select('saldo_pendiente')
      .in('estado', ['EMITIDA']),
    // Facturas vencidas
    supabase
      .from('facturas')
      .select('id')
      .eq('estado', 'EMITIDA')
      .lt('fecha_vencimiento', hoy),
    // Logística
    supabase
      .from('notas_pedido')
      .select('id')
      .in('estado', ['PENDIENTE', 'PARCIAL']),
    supabase
      .from('remitos')
      .select('id')
      .eq('estado', 'EMITIDO')
      .gte('fecha_emision', inicioMes.toISOString().split('T')[0]),
  ]);

  const totalEnviados =
    (presEnviados?.length ?? 0) + (presAprobados?.length ?? 0);
  const tasa_conversion =
    totalEnviados > 0
      ? Math.round(((presAprobados?.length ?? 0) / totalEnviados) * 100)
      : 0;

  const facturado_mes = (factMes ?? []).reduce(
    (a: number, f: any) => a + (f.total ?? 0),
    0,
  );
  const cobrado_mes = (cobradoMes ?? []).reduce(
    (a: number, r: any) => a + (r.monto ?? 0),
    0,
  );
  const saldo_total = (saldoPendiente ?? []).reduce(
    (a: number, f: any) => a + (f.saldo_pendiente ?? 0),
    0,
  );

  return {
    data: {
      presupuestos_pendientes: presPendientes?.length ?? 0,
      presupuestos_mes: presMes?.length ?? 0,
      tasa_conversion,
      ordenes_activas: ordenesActivas?.length ?? 0,
      ordenes_en_progreso: ordenesEnProgreso?.length ?? 0,
      ordenes_completadas_mes: ordenesCompletadasMes?.length ?? 0,
      facturado_mes,
      cobrado_mes,
      saldo_pendiente: saldo_total,
      facturas_vencidas: factsVencidas?.length ?? 0,
      notas_pedido_pendientes: notasPendientes?.length ?? 0,
      remitos_emitidos_mes: remitosMes?.length ?? 0,
    },
    error: null,
  };
}

// ── Actividad reciente ────────────────────────────────────────

export async function obtenerActividadReciente(
  limite = 12,
): Promise<ApiResponse<ActividadReciente[]>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const [
    { data: presups },
    { data: ordenes },
    { data: facturas },
    { data: remitos },
  ] = await Promise.all([
    supabase
      .from('presupuestos')
      .select(
        'id, numero, titulo, estado, actualizado_en, clientes(razon_social)',
      )
      .order('actualizado_en', { ascending: false })
      .limit(5),
    supabase
      .from('ordenes_servicio')
      .select(
        'id, numero, titulo, estado, actualizado_en, clientes(razon_social)',
      )
      .order('actualizado_en', { ascending: false })
      .limit(5),
    supabase
      .from('facturas')
      .select(
        'id, numero, tipo_comprobante, estado, actualizado_en, clientes(razon_social)',
      )
      .order('actualizado_en', { ascending: false })
      .limit(5),
    supabase
      .from('remitos')
      .select(
        'id, numero, tipo, estado, actualizado_en, clientes(razon_social)',
      )
      .order('actualizado_en', { ascending: false })
      .limit(4),
  ]);

  const actividad: ActividadReciente[] = [
    ...(presups ?? []).map((p: any) => ({
      id: p.id,
      tipo: 'presupuesto' as const,
      numero: p.numero,
      titulo: p.titulo ?? 'Sin título',
      subtitulo: p.clientes?.razon_social ?? '—',
      estado: p.estado,
      fecha: p.actualizado_en,
      href: `/presupuestos/${p.id}`,
    })),
    ...(ordenes ?? []).map((o: any) => ({
      id: o.id,
      tipo: 'orden' as const,
      numero: o.numero,
      titulo: o.titulo ?? 'Sin título',
      subtitulo: o.clientes?.razon_social ?? '—',
      estado: o.estado,
      fecha: o.actualizado_en,
      href: `/ordenes/${o.id}`,
    })),
    ...(facturas ?? []).map((f: any) => ({
      id: f.id,
      tipo: 'factura' as const,
      numero: f.numero,
      titulo: f.tipo_comprobante?.replace('_', ' ') ?? 'Factura',
      subtitulo: f.clientes?.razon_social ?? '—',
      estado: f.estado,
      fecha: f.actualizado_en,
      href: `/facturas/${f.id}`,
    })),
    ...(remitos ?? []).map((r: any) => ({
      id: r.id,
      tipo: 'remito' as const,
      numero: r.numero,
      titulo: r.tipo?.replace(/_/g, ' ') ?? 'Remito',
      subtitulo: r.clientes?.razon_social ?? '—',
      estado: r.estado,
      fecha: r.actualizado_en,
      href: `/logistica/remitos/${r.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, limite);

  return { data: actividad, error: null };
}

// ── Alertas ───────────────────────────────────────────────────

export async function obtenerAlertas(): Promise<
  ApiResponse<AlertaDashboard[]>
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const hoy = new Date().toISOString().split('T')[0];
  const en7d = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  // Órdenes completadas: obtener las que ya tienen remito para excluirlas
  const { data: remitoOrdenIds } = await supabase
    .from('remitos')
    .select('orden_id')
    .not('orden_id', 'is', null);

  const idsConRemito = [...new Set(
    (remitoOrdenIds ?? []).map((r: { orden_id: string }) => r.orden_id).filter(Boolean)
  )];

  const [
    { data: presVencidos },
    { data: presProxVencer },
    { data: factsVencidas },
    { data: ordenesAtrasadas },
    { data: ordenesCompletadasSinRemito },
    { data: remitosSinFactura },
    { data: notasParciales },
  ] = await Promise.all([
    // Presupuestos enviados con vencimiento pasado
    supabase
      .from('presupuestos')
      .select('id')
      .eq('estado', 'ENVIADO')
      .lt('fecha_validez', hoy),
    // Presupuestos enviados que vencen en los próximos 7 días
    supabase
      .from('presupuestos')
      .select('id')
      .eq('estado', 'ENVIADO')
      .gte('fecha_validez', hoy)
      .lte('fecha_validez', en7d),
    // Facturas vencidas sin cobrar
    supabase
      .from('facturas')
      .select('id')
      .eq('estado', 'EMITIDA')
      .lt('fecha_vencimiento', hoy),
    // OS en progreso con fecha fin estimada vencida
    supabase
      .from('ordenes_servicio')
      .select('id')
      .eq('estado', 'EN_PROGRESO')
      .lt('fecha_fin_estimada', hoy),
    // Órdenes completadas sin remito generado
    idsConRemito.length > 0
      ? supabase
          .from('ordenes_servicio')
          .select('id')
          .eq('estado', 'COMPLETADA')
          .not('id', 'in', `(${idsConRemito.join(',')})`)
      : supabase
          .from('ordenes_servicio')
          .select('id')
          .eq('estado', 'COMPLETADA'),
    // Remitos emitidos/entregados sin factura
    supabase
      .from('remitos')
      .select('id')
      .in('estado', ['EMITIDO', 'ENTREGADO'])
      .is('factura_id', null),
    // Notas de pedido con recepción parcial vencidas
    supabase
      .from('notas_pedido')
      .select('id')
      .eq('estado', 'PARCIAL')
      .lt('fecha_requerida', hoy),
  ]);

  const alertas: AlertaDashboard[] = [];

  const p = (n: number, singular: string, plural?: string) =>
    `${n} ${n === 1 ? singular : (plural ?? singular + 's')}`;

  if ((factsVencidas?.length ?? 0) > 0)
    alertas.push({
      tipo: 'error',
      modulo: 'Facturación',
      cantidad: factsVencidas!.length,
      href: '/facturas',
      mensaje: `${p(factsVencidas!.length, 'factura vencida', 'facturas vencidas')} sin cobrar`,
    });

  if ((ordenesAtrasadas?.length ?? 0) > 0)
    alertas.push({
      tipo: 'error',
      modulo: 'Órdenes',
      cantidad: ordenesAtrasadas!.length,
      href: '/ordenes',
      mensaje: `${p(ordenesAtrasadas!.length, 'orden fuera de plazo', 'órdenes fuera de plazo')}`,
    });

  if ((remitosSinFactura?.length ?? 0) > 0)
    alertas.push({
      tipo: 'warning',
      modulo: 'Facturación',
      cantidad: remitosSinFactura!.length,
      href: '/logistica',
      mensaje: `${p(remitosSinFactura!.length, 'remito entregado sin facturar', 'remitos entregados sin facturar')}`,
    });

  if ((ordenesCompletadasSinRemito?.length ?? 0) > 0)
    alertas.push({
      tipo: 'warning',
      modulo: 'Logística',
      cantidad: ordenesCompletadasSinRemito!.length,
      href: '/ordenes',
      mensaje: `${p(ordenesCompletadasSinRemito!.length, 'orden completada sin remito', 'órdenes completadas sin remito')}`,
    });

  if ((presVencidos?.length ?? 0) > 0)
    alertas.push({
      tipo: 'warning',
      modulo: 'Presupuestos',
      cantidad: presVencidos!.length,
      href: '/presupuestos',
      mensaje: `${p(presVencidos!.length, 'presupuesto enviado vencido', 'presupuestos enviados vencidos')}`,
    });

  if ((presProxVencer?.length ?? 0) > 0)
    alertas.push({
      tipo: 'info',
      modulo: 'Presupuestos',
      cantidad: presProxVencer!.length,
      href: '/presupuestos',
      mensaje: `${p(presProxVencer!.length, 'presupuesto vence en 7 días', 'presupuestos vencen en 7 días')}`,
    });

  if ((notasParciales?.length ?? 0) > 0)
    alertas.push({
      tipo: 'info',
      modulo: 'Logística',
      cantidad: notasParciales!.length,
      href: '/logistica',
      mensaje: `${p(notasParciales!.length, 'nota de pedido con recepción incompleta', 'notas de pedido con recepción incompleta')}`,
    });

  return { data: alertas, error: null };
}
