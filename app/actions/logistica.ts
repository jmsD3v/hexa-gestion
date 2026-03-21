'use server'

// ============================================================
// /app/actions/logistica.ts
// Server Actions — Notas de Pedido y Remitos
// ============================================================

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { registrarAudit } from '@/lib/audit'
import type {
  NotaPedido, NotaPedidoCompleta,
  Remito, RemitoCompleto,
  CrearNotaPedidoDTO, CrearRemitoDTO,
  EstadoNotaPedido,
} from '@/types'
import type { ApiResponse, PaginatedResponse } from '@/types'
import type { EstadoRemito, TipoRemito } from '@/types/database'

// ════════════════════════════════════════════════════════════
// NOTAS DE PEDIDO
// ════════════════════════════════════════════════════════════

export async function obtenerNotasPedido(filtros: {
  busqueda?: string
  estado?: EstadoNotaPedido
  orden_id?: string
  pagina?: number
  por_pagina?: number
} = {}): Promise<ApiResponse<PaginatedResponse<NotaPedido & {
  nombre_orden: string | null
  cantidad_items: number
}>>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { busqueda, estado, orden_id, pagina = 1, por_pagina = 20 } = filtros
  const desde = (pagina - 1) * por_pagina
  const hasta  = desde + por_pagina - 1

  let query = supabase
    .from('notas_pedido')
    .select(`*, ordenes_servicio(numero, titulo), items:notas_pedido_items(id)`, { count: 'exact' })

  if (busqueda) query = query.or(`numero.ilike.%${busqueda}%,proveedor.ilike.%${busqueda}%`)
  if (estado)   query = query.eq('estado', estado)
  if (orden_id) query = query.eq('orden_id', orden_id)

  const { data, error, count } = await query
    .order('creado_en', { ascending: false })
    .range(desde, hasta)

  if (error) return { data: null, error: error.message }

  const rows = (data ?? []).map((r: any) => ({
    ...r,
    nombre_orden:   r.ordenes_servicio ? `${r.ordenes_servicio.numero} — ${r.ordenes_servicio.titulo}` : null,
    cantidad_items: r.items?.length ?? 0,
  }))

  return {
    data: { data: rows, total: count ?? 0, pagina, por_pagina, total_paginas: Math.ceil((count ?? 0) / por_pagina) },
    error: null,
  }
}

export async function obtenerNotaPedido(id: string): Promise<ApiResponse<NotaPedidoCompleta & { nombre_orden: string | null }>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('notas_pedido')
    .select(`*, ordenes_servicio(numero, titulo), items:notas_pedido_items(*)`)
    .eq('id', id)
    .single()

  if (error || !data) return { data: null, error: 'Nota de pedido no encontrada' }

  return {
    data: {
      ...data,
      nombre_orden: (data as any).ordenes_servicio
        ? `${(data as any).ordenes_servicio.numero} — ${(data as any).ordenes_servicio.titulo}` : null,
      items: (data as any).items ?? [],
    },
    error: null,
  }
}

export async function crearNotaPedido(dto: CrearNotaPedidoDTO): Promise<ApiResponse<NotaPedido>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }
  if (!dto.items?.length) return { data: null, error: 'Debe incluir al menos un ítem' }

  const { data: numero } = await supabase.rpc('generar_numero_documento', { p_tipo: 'nota_pedido' })
  if (!numero) return { data: null, error: 'Error al generar número' }

  const { items, ...notaData } = dto

  const { data: nota, error } = await supabase
    .from('notas_pedido')
    .insert({ ...notaData, numero, fecha_pedido: new Date().toISOString().split('T')[0], estado: 'PENDIENTE', creado_por: user.id })
    .select().single()

  if (error || !nota) return { data: null, error: error?.message ?? 'Error al crear nota de pedido' }

  await supabase.from('notas_pedido_items').insert(
    items.map(it => ({
      nota_pedido_id: nota.id, descripcion: it.descripcion,
      unidad_medida: it.unidad_medida ?? 'un', cantidad_pedida: it.cantidad_pedida,
      cantidad_recibida: 0, precio_unitario: it.precio_unitario ?? null,
      subtotal: it.precio_unitario ? it.precio_unitario * it.cantidad_pedida : null,
      notas: it.notas ?? null,
    }))
  )

  await registrarAudit(supabase, { usuario_id: user.id, accion: 'CREATE', entidad_tipo: 'nota_pedido', entidad_id: nota.id, datos_nuevos: { numero: nota.numero } })
  revalidatePath('/logistica')
  return { data: nota, error: null, mensaje: `Nota de pedido ${numero} creada` }
}

export async function recibirItemsNotaPedido(
  nota_id: string,
  recepciones: Array<{ item_id: string; cantidad_recibida: number }>
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  for (const r of recepciones) {
    await supabase.from('notas_pedido_items')
      .update({ cantidad_recibida: r.cantidad_recibida })
      .eq('id', r.item_id).eq('nota_pedido_id', nota_id)
  }

  const { data: items } = await supabase.from('notas_pedido_items')
    .select('cantidad_pedida, cantidad_recibida').eq('nota_pedido_id', nota_id)

  let estado: EstadoNotaPedido = 'PENDIENTE'
  if (items?.length) {
    const totalPedido   = items.reduce((a, i) => a + i.cantidad_pedida, 0)
    const totalRecibido = items.reduce((a, i) => a + (i.cantidad_recibida ?? 0), 0)
    if (totalRecibido === 0)              estado = 'PENDIENTE'
    else if (totalRecibido < totalPedido) estado = 'PARCIAL'
    else                                  estado = 'RECIBIDO'
  }

  const updates: Record<string, unknown> = { estado, actualizado_por: user.id }
  if (estado === 'RECIBIDO') updates.fecha_recepcion = new Date().toISOString().split('T')[0]

  await supabase.from('notas_pedido').update(updates).eq('id', nota_id)
  revalidatePath('/logistica')
  revalidatePath(`/logistica/notas/${nota_id}`)
  return { data: null, error: null, mensaje: 'Recepción registrada' }
}

export async function anularNotaPedido(id: string): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { error } = await supabase.from('notas_pedido').update({ estado: 'ANULADO', actualizado_por: user.id }).eq('id', id)
  if (error) return { data: null, error: error.message }

  revalidatePath('/logistica')
  return { data: null, error: null, mensaje: 'Nota de pedido anulada' }
}

// ════════════════════════════════════════════════════════════
// REMITOS
// ════════════════════════════════════════════════════════════

export async function obtenerRemitos(filtros: {
  busqueda?: string
  estado?: EstadoRemito
  tipo?: TipoRemito
  orden_id?: string
  pagina?: number
  por_pagina?: number
} = {}): Promise<ApiResponse<PaginatedResponse<Remito & {
  nombre_orden: string | null
  razon_social: string | null
  cantidad_items: number
}>>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { busqueda, estado, tipo, orden_id, pagina = 1, por_pagina = 20 } = filtros
  const desde = (pagina - 1) * por_pagina
  const hasta  = desde + por_pagina - 1

  let query = supabase
    .from('remitos')
    .select(`*, ordenes_servicio(numero, titulo), clientes(razon_social), items:remitos_items(id)`, { count: 'exact' })

  if (busqueda) query = query.or(`numero.ilike.%${busqueda}%,transportista.ilike.%${busqueda}%`)
  if (estado)   query = query.eq('estado', estado)
  if (tipo)     query = query.eq('tipo', tipo)
  if (orden_id) query = query.eq('orden_id', orden_id)

  const { data, error, count } = await query
    .order('fecha_emision', { ascending: false })
    .range(desde, hasta)

  if (error) return { data: null, error: error.message }

  const rows = (data ?? []).map((r: any) => ({
    ...r,
    nombre_orden:   r.ordenes_servicio?.numero ?? null,
    razon_social:   r.clientes?.razon_social ?? r.proveedor ?? null,
    cantidad_items: r.items?.length ?? 0,
  }))

  return {
    data: { data: rows, total: count ?? 0, pagina, por_pagina, total_paginas: Math.ceil((count ?? 0) / por_pagina) },
    error: null,
  }
}

export async function obtenerRemito(id: string): Promise<ApiResponse<RemitoCompleto & { nombre_orden: string | null; razon_social: string | null }>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('remitos')
    .select(`*, ordenes_servicio(numero, titulo), clientes(razon_social), items:remitos_items(*)`)
    .eq('id', id).single()

  if (error || !data) return { data: null, error: 'Remito no encontrado' }

  return {
    data: {
      ...data,
      nombre_orden: (data as any).ordenes_servicio?.numero ?? null,
      razon_social: (data as any).clientes?.razon_social ?? (data as any).proveedor ?? null,
      items: (data as any).items ?? [],
    },
    error: null,
  }
}

export async function crearRemito(dto: CrearRemitoDTO): Promise<ApiResponse<Remito>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }
  if (!dto.tipo)           return { data: null, error: 'El tipo de remito es requerido' }
  if (!dto.items?.length)  return { data: null, error: 'Debe incluir al menos un ítem' }

  const { data: numero } = await supabase.rpc('generar_numero_documento', { p_tipo: 'remito' })
  if (!numero) return { data: null, error: 'Error al generar número' }

  const { items, ...remitoData } = dto

  const { data: remito, error } = await supabase
    .from('remitos')
    .insert({ ...remitoData, numero, fecha_emision: dto.fecha_emision ?? new Date().toISOString().split('T')[0], estado: 'BORRADOR', creado_por: user.id })
    .select().single()

  if (error || !remito) return { data: null, error: error?.message ?? 'Error al crear el remito' }

  await supabase.from('remitos_items').insert(
    items.map((it, idx) => ({
      remito_id: remito.id, descripcion: it.descripcion,
      unidad_medida: it.unidad_medida ?? 'un', cantidad: it.cantidad,
      precio_unitario: it.precio_unitario ?? null,
      subtotal: it.precio_unitario ? it.precio_unitario * it.cantidad : null,
      orden: idx,
    }))
  )

  await registrarAudit(supabase, { usuario_id: user.id, accion: 'CREATE', entidad_tipo: 'remito', entidad_id: remito.id, datos_nuevos: { numero: remito.numero, tipo: remito.tipo } })
  revalidatePath('/logistica')
  return { data: remito, error: null, mensaje: `Remito ${numero} creado` }
}

export async function cambiarEstadoRemito(id: string, estado: EstadoRemito): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { error } = await supabase.from('remitos').update({ estado, actualizado_por: user.id }).eq('id', id)
  if (error) return { data: null, error: error.message }

  await registrarAudit(supabase, { usuario_id: user.id, accion: 'UPDATE', entidad_tipo: 'remito', entidad_id: id, datos_nuevos: { estado } })
  revalidatePath('/logistica')
  revalidatePath(`/logistica/remitos/${id}`)

  const labels: Record<EstadoRemito, string> = { BORRADOR: 'Borrador', EMITIDO: 'Emitido', ENTREGADO: 'Entregado', ANULADO: 'Anulado' }
  return { data: null, error: null, mensaje: `Remito ${labels[estado]}` }
}

export async function obtenerKPIsLogistica(): Promise<ApiResponse<{
  notas_pendientes: number
  notas_parciales: number
  remitos_emitidos_mes: number
  remitos_entregados_mes: number
}>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const inicioMes = new Date()
  inicioMes.setDate(1)
  const inicioMesStr = inicioMes.toISOString().split('T')[0]

  const [{ data: notasPend }, { data: notasParcial }, { data: remitosEmit }, { data: remitosEntregados }] = await Promise.all([
    supabase.from('notas_pedido').select('id').eq('estado', 'PENDIENTE'),
    supabase.from('notas_pedido').select('id').eq('estado', 'PARCIAL'),
    supabase.from('remitos').select('id').eq('estado', 'EMITIDO').gte('fecha_emision', inicioMesStr),
    supabase.from('remitos').select('id').eq('estado', 'ENTREGADO').gte('fecha_emision', inicioMesStr),
  ])

  return {
    data: {
      notas_pendientes:       notasPend?.length ?? 0,
      notas_parciales:        notasParcial?.length ?? 0,
      remitos_emitidos_mes:   remitosEmit?.length ?? 0,
      remitos_entregados_mes: remitosEntregados?.length ?? 0,
    },
    error: null,
  }
}

// ── Aliases / helpers extras para NotaPedidoFicha ─────────────────────────────

export async function cambiarEstadoNotaPedido(
  id: string,
  estado: EstadoNotaPedido
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const updates: Record<string, unknown> = { estado, actualizado_por: user.id }
  if (estado === 'RECIBIDO') updates.fecha_recepcion = new Date().toISOString().split('T')[0]

  const { error } = await supabase.from('notas_pedido').update(updates).eq('id', id)
  if (error) return { data: null, error: error.message }

  await registrarAudit(supabase, {
    usuario_id: user.id, accion: 'UPDATE',
    entidad_tipo: 'nota_pedido', entidad_id: id,
    datos_nuevos: { estado },
  })

  revalidatePath('/logistica')
  revalidatePath(`/logistica/notas/${id}`)
  const labels: Record<EstadoNotaPedido, string> = {
    PENDIENTE: 'Pendiente', PARCIAL: 'Parcial', RECIBIDO: 'Recibido', ANULADO: 'Anulado',
  }
  return { data: null, error: null, mensaje: `Estado actualizado: ${labels[estado]}` }
}

export async function actualizarRecepcionItem(
  item_id: string,
  nota_pedido_id: string,
  cantidad_recibida: number
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  // IDOR guard: el item debe pertenecer a esa nota
  const { error } = await supabase
    .from('notas_pedido_items')
    .update({ cantidad_recibida })
    .eq('id', item_id)
    .eq('nota_pedido_id', nota_pedido_id)

  if (error) return { data: null, error: error.message }

  // Recalcular estado de la nota
  const { data: items } = await supabase
    .from('notas_pedido_items')
    .select('cantidad_pedida, cantidad_recibida')
    .eq('nota_pedido_id', nota_pedido_id)

  let estado: EstadoNotaPedido = 'PENDIENTE'
  if (items?.length) {
    const totalPedido   = items.reduce((a, i) => a + i.cantidad_pedida, 0)
    const totalRecibido = items.reduce((a, i) => a + (i.cantidad_recibida ?? 0), 0)
    if (totalRecibido === 0)              estado = 'PENDIENTE'
    else if (totalRecibido < totalPedido) estado = 'PARCIAL'
    else                                  estado = 'RECIBIDO'
  }

  const updates: Record<string, unknown> = { estado, actualizado_por: user.id }
  if (estado === 'RECIBIDO') updates.fecha_recepcion = new Date().toISOString().split('T')[0]

  await supabase.from('notas_pedido').update(updates).eq('id', nota_pedido_id)

  revalidatePath('/logistica')
  revalidatePath(`/logistica/notas/${nota_pedido_id}`)
  return { data: null, error: null, mensaje: 'Recepción actualizada' }
}
