'use server';

// ============================================================
// /app/actions/calendario.ts
// Server Actions — Calendario de eventos
// ============================================================

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { registrarAudit } from '@/lib/audit';
import { COLORES_TIPO } from '@/lib/calendario-utils';
import type { ApiResponse } from '@/types';
import type {
  EventoCalendario,
  CrearEventoDTO,
  TipoEvento,
} from '@/types/calendario';

// ── Obtener eventos por rango ─────────────────────────────────

export async function obtenerEventos(
  desde: string,
  hasta: string,
): Promise<ApiResponse<EventoCalendario[]>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const { data, error } = await supabase
    .from('eventos_calendario')
    .select('*, clientes(razon_social)')
    .gte('fecha_inicio', desde)
    .lte('fecha_inicio', hasta)
    .order('fecha_inicio', { ascending: true });

  if (error) return { data: null, error: error.message };

  const eventos = (data ?? []).map((e: any) => ({
    ...e,
    razon_social: e.clientes?.razon_social ?? null,
    color: e.color ?? COLORES_TIPO[e.tipo as TipoEvento] ?? '#64748b',
  }));

  return { data: eventos, error: null };
}

// ── Crear evento manual ───────────────────────────────────────

export async function crearEvento(
  dto: CrearEventoDTO,
): Promise<ApiResponse<EventoCalendario>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  if (!dto.titulo?.trim())
    return { data: null, error: 'El título es requerido' };
  if (!dto.fecha_inicio)
    return { data: null, error: 'La fecha de inicio es requerida' };

  const { data, error } = await supabase
    .from('eventos_calendario')
    .insert({
      tipo: dto.tipo,
      titulo: dto.titulo.trim(),
      descripcion: dto.descripcion?.trim() ?? null,
      fecha_inicio: dto.fecha_inicio,
      fecha_fin: dto.fecha_fin ?? null,
      todo_el_dia: dto.todo_el_dia ?? true,
      entidad_tipo: dto.entidad_tipo ?? null,
      entidad_id: dto.entidad_id ?? null,
      cliente_id: dto.cliente_id ?? null,
      color: dto.color ?? COLORES_TIPO[dto.tipo] ?? '#64748b',
      completado: false,
      creado_por: user.id,
    })
    .select()
    .single();

  if (error || !data)
    return { data: null, error: error?.message ?? 'Error al crear evento' };

  await registrarAudit(supabase, {
    usuario_id: user.id,
    accion: 'CREATE',
    entidad_tipo: 'evento_calendario',
    entidad_id: data.id,
    datos_nuevos: { titulo: data.titulo, tipo: data.tipo },
  });

  revalidatePath('/calendario');
  return { data, error: null, mensaje: 'Evento creado' };
}

// ── Actualizar evento ─────────────────────────────────────────

export async function actualizarEvento(
  id: string,
  cambios: Partial<CrearEventoDTO> & { completado?: boolean },
): Promise<ApiResponse<null>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const { error } = await supabase
    .from('eventos_calendario')
    .update({ ...cambios, actualizado_en: new Date().toISOString() })
    .eq('id', id);

  if (error) return { data: null, error: error.message };

  revalidatePath('/calendario');
  return { data: null, error: null, mensaje: 'Evento actualizado' };
}

// ── Eliminar evento ───────────────────────────────────────────

export async function eliminarEvento(id: string): Promise<ApiResponse<null>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const { error } = await supabase
    .from('eventos_calendario')
    .delete()
    .eq('id', id);
  if (error) return { data: null, error: error.message };

  revalidatePath('/calendario');
  return { data: null, error: null, mensaje: 'Evento eliminado' };
}

// ── Sincronizar vencimientos desde otras tablas ───────────────
// Crea eventos de vencimiento para facturas emitidas sin evento previo

export async function sincronizarVencimientos(): Promise<
  ApiResponse<{ creados: number }>
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  // Facturas con vencimiento futuro que no tienen evento
  const { data: facturas } = await supabase
    .from('facturas')
    .select('id, numero, fecha_vencimiento, cliente_id, clientes(razon_social)')
    .eq('estado', 'EMITIDA')
    .not('fecha_vencimiento', 'is', null)
    .gt('fecha_vencimiento', new Date().toISOString().split('T')[0]);

  let creados = 0;
  for (const f of facturas ?? []) {
    // Verificar que no exista ya un evento para esta factura
    const { data: existe } = await supabase
      .from('eventos_calendario')
      .select('id')
      .eq('entidad_tipo', 'factura')
      .eq('entidad_id', f.id)
      .eq('tipo', 'VENCIMIENTO_FACTURA')
      .maybeSingle();

    if (!existe) {
      await supabase.from('eventos_calendario').insert({
        tipo: 'VENCIMIENTO_FACTURA',
        titulo: `Vencimiento Factura ${f.numero}`,
        descripcion: (f as any).clientes?.razon_social ?? null,
        fecha_inicio: f.fecha_vencimiento,
        todo_el_dia: true,
        entidad_tipo: 'factura',
        entidad_id: f.id,
        cliente_id: f.cliente_id,
        color: COLORES_TIPO.VENCIMIENTO_FACTURA,
        creado_por: user.id,
      });
      creados++;
    }
  }

  revalidatePath('/calendario');
  return {
    data: { creados },
    error: null,
    mensaje: `${creados} vencimientos sincronizados`,
  };
}
