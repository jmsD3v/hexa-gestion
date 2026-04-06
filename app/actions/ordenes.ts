'use server'

// ============================================================
// /app/actions/ordenes.ts
// Server Actions — Módulo de Órdenes de Servicio
// ============================================================

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { registrarAudit } from '@/lib/audit'
import type {
  OrdenServicio, OrdenServicioCompleta,
  CrearOrdenServicioDTO, FiltrosOrden,
} from '@/types'
import type { ApiResponse, PaginatedResponse } from '@/types'
import type { EstadoOrden } from '@/types'

// ─── Listado paginado ─────────────────────────────────────────────────────────

export async function obtenerOrdenes(
  filtros: FiltrosOrden = {}
): Promise<ApiResponse<PaginatedResponse<OrdenServicio & { razon_social: string; numero_presupuesto: string | null }>>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const {
    busqueda, cliente_id, estado,
    fecha_desde, fecha_hasta,
    pagina = 1, por_pagina = 20,
    orden_por = 'creado_en', orden_dir = 'desc',
  } = filtros

  const desde = (pagina - 1) * por_pagina
  const hasta  = desde + por_pagina - 1

  const COLS_PERMITIDAS = ['numero', 'creado_en', 'fecha_inicio', 'fecha_fin_estimada'] as const
  const col = COLS_PERMITIDAS.includes(orden_por as any) ? orden_por : 'creado_en'

  let query = supabase
    .from('ordenes_servicio')
    .select(`
      *,
      clientes!inner(razon_social),
      presupuestos(numero)
    `, { count: 'exact' })

  if (busqueda) {
    query = query.or(
      `numero.ilike.%${busqueda}%,titulo.ilike.%${busqueda}%,clientes.razon_social.ilike.%${busqueda}%`
    )
  }
  if (cliente_id)  query = query.eq('cliente_id', cliente_id)
  if (estado)      query = query.eq('estado', estado)
  if (fecha_desde) query = query.gte('fecha_inicio', fecha_desde)
  if (fecha_hasta) query = query.lte('fecha_inicio', fecha_hasta)

  const { data, error, count } = await query
    .order(col, { ascending: orden_dir === 'asc' })
    .range(desde, hasta)

  if (error) return { data: null, error: error.message }

  const rows = (data ?? []).map((row: any) => ({
    ...row,
    razon_social:       row.clientes?.razon_social ?? '',
    numero_presupuesto: row.presupuestos?.numero ?? null,
  }))

  return {
    data: {
      data:          rows,
      total:         count ?? 0,
      pagina,
      por_pagina,
      total_paginas: Math.ceil((count ?? 0) / por_pagina),
    },
    error: null,
  }
}

// ─── Obtener orden completa ───────────────────────────────────────────────────

export async function obtenerOrden(
  id: string
): Promise<ApiResponse<OrdenServicioCompleta & { razon_social: string; numero_presupuesto: string | null }>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ordenes_servicio')
    .select(`
      *,
      clientes(razon_social),
      presupuestos(numero),
      tecnicos:ordenes_tecnicos(*),
      remitos(id, numero, estado, factura_id)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return { data: null, error: 'Orden no encontrada' }

  const remitos = (data as any).remitos ?? []
  const remito  = remitos[0] ?? null   // una orden tiene 0 o 1 remito

  return {
    data: {
      ...data,
      razon_social:       (data as any).clientes?.razon_social ?? '',
      numero_presupuesto: (data as any).presupuestos?.numero   ?? null,
      tecnicos:           (data as any).tecnicos ?? [],
      remito,
    },
    error: null,
  }
}

// ─── Crear orden manual ───────────────────────────────────────────────────────

export async function crearOrden(
  dto: CrearOrdenServicioDTO
): Promise<ApiResponse<OrdenServicio>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  if (!dto.cliente_id) return { data: null, error: 'El cliente es requerido' }
  if (!dto.titulo?.trim()) return { data: null, error: 'El título es requerido' }

  const { data: numero } = await supabase.rpc('generar_numero_documento', { p_tipo: 'orden' })
  if (!numero) return { data: null, error: 'Error al generar número de orden' }

  const { tecnicos, ...ordenData } = dto

  const { data: orden, error } = await supabase
    .from('ordenes_servicio')
    .insert({
      ...ordenData,
      numero,
      estado:            'PENDIENTE',
      porcentaje_avance: 0,
      creado_por:        user.id,
    })
    .select()
    .single()

  if (error || !orden) return { data: null, error: error?.message ?? 'Error al crear la orden' }

  if (tecnicos && tecnicos.length > 0) {
    await supabase.from('ordenes_tecnicos').insert(
      tecnicos.map(t => ({ ...t, orden_id: orden.id }))
    )
  }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'CREATE',
    entidad_tipo: 'orden_servicio',
    entidad_id:   orden.id,
    datos_nuevos: { numero: orden.numero, titulo: orden.titulo },
  })

  revalidatePath('/ordenes')
  return { data: orden, error: null, mensaje: `Orden ${numero} creada exitosamente` }
}

// ─── Actualizar datos generales ───────────────────────────────────────────────

export async function actualizarOrden(
  id: string,
  dto: Partial<CrearOrdenServicioDTO>
): Promise<ApiResponse<OrdenServicio>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { tecnicos, ...ordenData } = dto

  const { data: anterior } = await supabase
    .from('ordenes_servicio').select().eq('id', id).single()

  const { data: orden, error } = await supabase
    .from('ordenes_servicio')
    .update({ ...ordenData, actualizado_por: user.id })
    .eq('id', id)
    .select()
    .single()

  if (error || !orden) return { data: null, error: error?.message ?? 'Error al actualizar' }

  await registrarAudit(supabase, {
    usuario_id:    user.id,
    accion:        'UPDATE',
    entidad_tipo:  'orden_servicio',
    entidad_id:    id,
    datos_anteriores: anterior,
    datos_nuevos:     orden,
  })

  revalidatePath('/ordenes')
  revalidatePath(`/ordenes/${id}`)
  return { data: orden, error: null, mensaje: 'Orden actualizada' }
}

// ─── Cambiar estado ───────────────────────────────────────────────────────────

const TRANSICIONES_ORDEN: Record<EstadoOrden, EstadoOrden[]> = {
  PENDIENTE:   ['EN_PROGRESO', 'CANCELADA'],
  EN_PROGRESO: ['COMPLETADA', 'SUSPENDIDA', 'CANCELADA'],
  SUSPENDIDA:  ['EN_PROGRESO', 'CANCELADA'],
  CANCELADA:   ['PENDIENTE'],
  COMPLETADA:  [],
}

export async function cambiarEstadoOrden(
  id: string,
  estado: EstadoOrden,
  opciones?: { observaciones_cierre?: string; fecha_fin_real?: string }
): Promise<ApiResponse<OrdenServicio>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data: actual } = await supabase
    .from('ordenes_servicio').select('estado, fecha_inicio').eq('id', id).single()
  if (!actual) return { data: null, error: 'Orden no encontrada' }

  const transicionesValidas = TRANSICIONES_ORDEN[actual.estado as EstadoOrden] ?? []
  if (!transicionesValidas.includes(estado)) {
    return { data: null, error: `No se puede pasar de "${actual.estado}" a "${estado}"` }
  }

  const updates: Record<string, unknown> = { estado, actualizado_por: user.id }

  if (estado === 'EN_PROGRESO') {
    if (!actual.fecha_inicio) {
      updates.fecha_inicio = new Date().toISOString().split('T')[0]
    }
  }

  if (estado === 'COMPLETADA') {
    updates.porcentaje_avance   = 100
    updates.fecha_fin_real      = opciones?.fecha_fin_real ?? new Date().toISOString().split('T')[0]
    updates.observaciones_cierre = opciones?.observaciones_cierre ?? null
  }

  const { data: orden, error } = await supabase
    .from('ordenes_servicio')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error || !orden) return { data: null, error: error?.message ?? 'Error al cambiar estado' }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'UPDATE',
    entidad_tipo: 'orden_servicio',
    entidad_id:   id,
    datos_nuevos: { estado },
  })

  revalidatePath('/ordenes')
  revalidatePath(`/ordenes/${id}`)

  const labels: Record<EstadoOrden, string> = {
    PENDIENTE:   'Pendiente',
    EN_PROGRESO: 'En Progreso',
    COMPLETADA:  'Completada',
    CANCELADA:   'Cancelada',
    SUSPENDIDA:  'Suspendida',
  }
  return { data: orden, error: null, mensaje: `Orden marcada como ${labels[estado]}` }
}

// ─── Actualizar porcentaje de avance ─────────────────────────────────────────

export async function actualizarAvance(
  id: string,
  porcentaje: number
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  if (porcentaje < 0 || porcentaje > 100) {
    return { data: null, error: 'El porcentaje debe estar entre 0 y 100' }
  }

  const updates: Record<string, unknown> = { porcentaje_avance: porcentaje, actualizado_por: user.id }
  if (porcentaje === 100) {
    updates.estado         = 'COMPLETADA'
    updates.fecha_fin_real = new Date().toISOString().split('T')[0]
  } else if (porcentaje > 0) {
    // Auto-iniciar si estaba pendiente
    const { data: actual } = await supabase
      .from('ordenes_servicio').select('estado').eq('id', id).single()
    if (actual?.estado === 'PENDIENTE') updates.estado = 'EN_PROGRESO'
  }

  const { error } = await supabase
    .from('ordenes_servicio')
    .update(updates)
    .eq('id', id)

  if (error) return { data: null, error: error.message }

  revalidatePath('/ordenes')
  revalidatePath(`/ordenes/${id}`)
  return { data: null, error: null }
}

// ─── Técnicos ─────────────────────────────────────────────────────────────────

export async function agregarTecnico(
  orden_id: string,
  tecnico: { nombre: string; rol?: string; fecha_desde?: string; fecha_hasta?: string; notas?: string; tecnico_catalogo_id?: string }
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  if (!tecnico.nombre?.trim()) return { data: null, error: 'El nombre del técnico es requerido' }

  const { error } = await supabase
    .from('ordenes_tecnicos')
    .insert({ ...tecnico, orden_id })

  if (error) return { data: null, error: error.message }

  revalidatePath(`/ordenes/${orden_id}`)
  return { data: null, error: null, mensaje: 'Técnico agregado' }
}

export async function eliminarTecnico(
  tecnico_id: string,
  orden_id: string
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { error } = await supabase
    .from('ordenes_tecnicos')
    .delete()
    .eq('id', tecnico_id)
    .eq('orden_id', orden_id) // IDOR guard

  if (error) return { data: null, error: error.message }

  revalidatePath(`/ordenes/${orden_id}`)
  return { data: null, error: null, mensaje: 'Técnico eliminado' }
}

// ─── Notas técnicas ───────────────────────────────────────────────────────────

export async function actualizarNotasTecnicas(
  id: string,
  notas_tecnicas: string
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { error } = await supabase
    .from('ordenes_servicio')
    .update({ notas_tecnicas, actualizado_por: user.id })
    .eq('id', id)

  if (error) return { data: null, error: error.message }

  revalidatePath(`/ordenes/${id}`)
  return { data: null, error: null, mensaje: 'Notas guardadas' }
}

// ─── KPIs órdenes ────────────────────────────────────────────────────────────

export async function obtenerKPIsOrdenes(): Promise<ApiResponse<{
  total: number
  pendientes: number
  en_progreso: number
  completadas_mes: number
  tasa_completadas: number
}>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const inicioMes = new Date()
  inicioMes.setDate(1)
  inicioMes.setHours(0, 0, 0, 0)

  const [{ data: todas }, { data: compMes }] = await Promise.all([
    supabase.from('ordenes_servicio').select('estado'),
    supabase.from('ordenes_servicio')
      .select('id')
      .eq('estado', 'COMPLETADA')
      .gte('fecha_fin_real', inicioMes.toISOString().split('T')[0]),
  ])

  const total          = todas?.length ?? 0
  const pendientes     = todas?.filter(o => o.estado === 'PENDIENTE').length  ?? 0
  const en_progreso    = todas?.filter(o => o.estado === 'EN_PROGRESO').length ?? 0
  const completadas    = todas?.filter(o => o.estado === 'COMPLETADA').length  ?? 0
  const completadas_mes = compMes?.length ?? 0
  const tasa_completadas = total > 0 ? Math.round((completadas / total) * 100) : 0

  return {
    data: { total, pendientes, en_progreso, completadas_mes, tasa_completadas },
    error: null,
  }
}
