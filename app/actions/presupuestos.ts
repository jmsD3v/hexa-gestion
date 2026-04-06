// ============================================================
// /app/actions/presupuestos.ts
// Server Actions — Módulo de Presupuestos
// ============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { PresupuestoSchema } from '@/lib/validations'
import { registrarAudit } from '@/lib/audit'
import { calcularTotalesPresupuesto } from '@/lib/calculos'
import type {
  CrearPresupuestoDTO, Presupuesto, PresupuestoCompleto, FiltrosPresupuesto,
} from '@/types'
import type { ApiResponse, PaginatedResponse } from '@/types'
import type { EstadoPresupuesto } from '@/types'

// ── Crear presupuesto ─────────────────────────────────────────

export async function crearPresupuesto(
  data: CrearPresupuestoDTO
): Promise<ApiResponse<Presupuesto>> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const parsed = PresupuestoSchema.safeParse(data)
  if (!parsed.success) {
    return {
      data: null,
      error: 'Datos inválidos',
      mensaje: parsed.error.errors[0]?.message,
    }
  }

  const { items, incidencias, ...presupuestoData } = parsed.data

  // Calcular totales
  const totales = calcularTotalesPresupuesto(items, incidencias ?? [], {
    descuento_pct: presupuestoData.descuento_pct ?? 0,
    iva_pct: presupuestoData.iva_pct ?? 21,
  })

  // Generar número correlativo
  const { data: numero } = await supabase.rpc('generar_numero_documento', {
    p_tipo: 'presupuesto',
  })

  if (!numero) {
    return { data: null, error: 'Error al generar número de presupuesto' }
  }

  // Insertar presupuesto
  const { data: presupuesto, error } = await supabase
    .from('presupuestos')
    .insert({
      ...presupuestoData,
      numero,
      creado_por: user.id,
      ...totales,
    })
    .select()
    .single()

  if (error || !presupuesto) {
    return { data: null, error: error?.message ?? 'Error al crear presupuesto' }
  }

  // Insertar ítems
  if (items.length > 0) {
    const itemsConId = items.map((item, idx) => ({
      ...item,
      presupuesto_id: presupuesto.id,
      orden: idx,
      subtotal:
        item.cantidad *
        item.precio_unitario *
        (1 - (item.descuento_pct ?? 0) / 100),
    }))

    const { error: errorItems } = await supabase
      .from('presupuestos_items')
      .insert(itemsConId)

    if (errorItems) {
      // Rollback manual: eliminar presupuesto si los ítems fallaron
      await supabase.from('presupuestos').delete().eq('id', presupuesto.id)
      return { data: null, error: 'Error al guardar los ítems del presupuesto' }
    }
  }

  // Insertar incidencias
  if (incidencias && incidencias.length > 0) {
    const incidenciasConId = incidencias.map(inc => ({
      ...inc,
      presupuesto_id: presupuesto.id,
      subtotal: (inc.cantidad ?? 1) * (inc.dias ?? 1) * inc.monto_unitario,
    }))

    await supabase.from('presupuestos_incidencias').insert(incidenciasConId)
  }

  await registrarAudit(supabase, {
    usuario_id: user.id,
    accion: 'CREATE',
    entidad_tipo: 'presupuesto',
    entidad_id: presupuesto.id,
    datos_nuevos: { numero: presupuesto.numero, total: presupuesto.total },
  })

  revalidatePath('/presupuestos')

  return {
    data: presupuesto,
    error: null,
    mensaje: `Presupuesto ${numero} creado exitosamente`,
  }
}

// ── Aprobar presupuesto (genera OS automáticamente) ───────────

export async function aprobarPresupuesto(
  id: string,
  generarOrden = true
): Promise<ApiResponse<{ presupuesto: Presupuesto; orden_id?: string }>> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  // Verificar que esté en estado correcto
  const { data: presupuesto } = await supabase
    .from('presupuestos')
    .select()
    .eq('id', id)
    .single()

  if (!presupuesto) return { data: null, error: 'Presupuesto no encontrado' }

  if (!['BORRADOR', 'ENVIADO'].includes(presupuesto.estado)) {
    return { data: null, error: `No se puede aprobar un presupuesto en estado ${presupuesto.estado}` }
  }

  // Actualizar estado
  const { data: actualizado, error } = await supabase
    .from('presupuestos')
    .update({
      estado: 'APROBADO',
      aprobado_por: user.id,
      aprobado_en: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error || !actualizado) {
    return { data: null, error: error?.message ?? 'Error al aprobar' }
  }

  let orden_id: string | undefined

  // Generar Orden de Servicio automáticamente
  if (generarOrden) {
    const { data: numeroOS } = await supabase.rpc('generar_numero_documento', {
      p_tipo: 'orden',
    })

    const { data: orden } = await supabase
      .from('ordenes_servicio')
      .insert({
        numero: numeroOS,
        presupuesto_id: id,
        cliente_id: presupuesto.cliente_id,
        direccion_id: presupuesto.direccion_id,
        titulo: presupuesto.titulo,
        descripcion: presupuesto.descripcion,
        objetivo_tecnico: presupuesto.objetivo_servicio,
        estado: 'PENDIENTE',
        creado_por: user.id,
      })
      .select('id')
      .single()

    orden_id = orden?.id

    // Crear evento en calendario
    await supabase.from('eventos_calendario').insert({
      tipo: 'SERVICIO_PROGRAMADO',
      titulo: `OS: ${presupuesto.titulo}`,
      descripcion: `Orden generada desde presupuesto ${presupuesto.numero}`,
      fecha_inicio: new Date().toISOString(),
      entidad_tipo: 'orden',
      entidad_id: orden?.id,
      cliente_id: presupuesto.cliente_id,
      color: '#3b82f6',
      creado_por: user.id,
    })
  }

  await registrarAudit(supabase, {
    usuario_id: user.id,
    accion: 'UPDATE',
    entidad_tipo: 'presupuesto',
    entidad_id: id,
    datos_nuevos: { estado: 'APROBADO', orden_id },
  })

  revalidatePath('/presupuestos')
  revalidatePath(`/presupuestos/${id}`)
  if (orden_id) revalidatePath('/ordenes')

  return {
    data: { presupuesto: actualizado, orden_id },
    error: null,
    mensaje: generarOrden
      ? 'Presupuesto aprobado y Orden de Servicio generada'
      : 'Presupuesto aprobado',
  }
}

// ── Obtener presupuesto completo ──────────────────────────────

export async function obtenerPresupuestoCompleto(
  id: string
): Promise<ApiResponse<PresupuestoCompleto>> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('presupuestos')
    .select(`
      *,
      items:presupuestos_items(*),
      incidencias:presupuestos_incidencias(*)
    `)
    .eq('id', id)
    .single()

  if (error || !data) {
    return { data: null, error: 'Presupuesto no encontrado' }
  }

  return { data: data as PresupuestoCompleto, error: null }
}

// ── Obtener listado paginado ───────────────────────────────────

export async function obtenerPresupuestos(
  filtros: FiltrosPresupuesto = {}
): Promise<ApiResponse<PaginatedResponse<Presupuesto & { razon_social: string }>>> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const {
    busqueda, cliente_id, estado, fecha_desde, fecha_hasta,
    tipo_operacion, pagina = 1, por_pagina = 20,
    orden_por = 'creado_en', orden_dir = 'desc',
  } = filtros

  const desde = (pagina - 1) * por_pagina
  const hasta  = desde + por_pagina - 1

  const COLS_PERMITIDAS = ['numero', 'creado_en', 'total', 'fecha_validez'] as const
  const col = COLS_PERMITIDAS.includes(orden_por as any) ? orden_por : 'creado_en'

  let query = supabase
    .from('presupuestos')
    .select(`
      *,
      clientes!inner(razon_social)
    `, { count: 'exact' })

  if (busqueda) {
    query = query.or(
      `numero.ilike.%${busqueda}%,titulo.ilike.%${busqueda}%,clientes.razon_social.ilike.%${busqueda}%`
    )
  }
  if (cliente_id)     query = query.eq('cliente_id', cliente_id)
  if (estado)         query = query.eq('estado', estado)
  if (tipo_operacion) query = query.eq('tipo_operacion', tipo_operacion)
  if (fecha_desde)    query = query.gte('fecha_emision', fecha_desde)
  if (fecha_hasta)    query = query.lte('fecha_emision', fecha_hasta)

  const { data, error, count } = await query
    .order(col, { ascending: orden_dir === 'asc' })
    .range(desde, hasta)

  if (error) return { data: null, error: error.message }

  const rows = (data ?? []).map((row: any) => ({
    ...row,
    razon_social: row.clientes?.razon_social ?? '',
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

// ── Cambiar estado ────────────────────────────────────────────

const TRANSICIONES_PRESUPUESTO: Record<EstadoPresupuesto, EstadoPresupuesto[]> = {
  BORRADOR:  ['ENVIADO', 'RECHAZADO'],
  ENVIADO:   ['RECHAZADO'],   // APROBADO solo via aprobarPresupuesto()
  APROBADO:  [],              // estado final — no se cambia por esta función
  RECHAZADO: ['BORRADOR'],    // permite reabrir para editar
  VENCIDO:   ['BORRADOR'],    // permite reactivar
}

export async function cambiarEstadoPresupuesto(
  id: string,
  estado: EstadoPresupuesto
): Promise<ApiResponse<null>> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data: actual } = await supabase
    .from('presupuestos').select('estado').eq('id', id).single()
  if (!actual) return { data: null, error: 'Presupuesto no encontrado' }

  const transicionesValidas = TRANSICIONES_PRESUPUESTO[actual.estado as EstadoPresupuesto] ?? []
  if (!transicionesValidas.includes(estado)) {
    return { data: null, error: `No se puede cambiar un presupuesto "${actual.estado}" a "${estado}"` }
  }

  const { error } = await supabase
    .from('presupuestos')
    .update({ estado })
    .eq('id', id)

  if (error) return { data: null, error: error.message }

  await registrarAudit(supabase, {
    usuario_id: user.id,
    accion: 'UPDATE',
    entidad_tipo: 'presupuesto',
    entidad_id: id,
    datos_nuevos: { estado },
  })

  revalidatePath('/presupuestos')
  revalidatePath(`/presupuestos/${id}`)

  return { data: null, error: null, mensaje: `Estado actualizado a ${estado}` }
}

// ── Duplicar presupuesto ──────────────────────────────────────

export async function duplicarPresupuesto(
  id: string
): Promise<ApiResponse<{ id: string; numero: string }>> {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const original = await obtenerPresupuestoCompleto(id)
  if (!original.data) return { data: null, error: 'Presupuesto no encontrado' }

  const { data: numero } = await supabase.rpc('generar_numero_documento', { p_tipo: 'presupuesto' })
  if (!numero) return { data: null, error: 'Error al generar número' }

  const { items, incidencias, id: _id, numero: _num, estado: _est,
    aprobado_por: _ap, aprobado_en: _ae, creado_en: _ce, actualizado_en: _ue,
    creado_por: _cp, actualizado_por: _up, ...resto } = original.data

  const { data: nuevo, error } = await supabase
    .from('presupuestos')
    .insert({ ...resto, numero, estado: 'BORRADOR', creado_por: user.id })
    .select('id, numero')
    .single()

  if (error || !nuevo) return { data: null, error: error?.message ?? 'Error al duplicar' }

  if (items.length > 0) {
    await supabase.from('presupuestos_items').insert(
      items.map(({ id: _i, presupuesto_id: _p, ...item }) => ({ ...item, presupuesto_id: nuevo.id }))
    )
  }
  if (incidencias.length > 0) {
    await supabase.from('presupuestos_incidencias').insert(
      incidencias.map(({ id: _i, presupuesto_id: _p, ...inc }) => ({ ...inc, presupuesto_id: nuevo.id }))
    )
  }

  revalidatePath('/presupuestos')
  return { data: nuevo, error: null, mensaje: `Presupuesto ${numero} creado como copia` }
}
