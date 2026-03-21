// ============================================================
// /app/actions/clientes.ts
// Server Actions — Módulo de Clientes
//
// Patrón estándar de cada action:
//   1. Verificar sesión (getUser)
//   2. Validar input con Zod (safeParse)
//   3. Ejecutar lógica de negocio
//   4. Registrar auditoría
//   5. Revalidar caché (revalidatePath)
//   6. Retornar ApiResponse<T>
// ============================================================

'use server'

import { revalidatePath } from 'next/cache'
import { createClient }   from '@/lib/supabase/server'
import { registrarAudit } from '@/lib/audit'
import {
  ClienteSchema,
  DireccionSchema,
} from '@/lib/validations'
import type {
  ApiResponse,
  PaginatedResponse,
  Cliente,
  ClienteDireccion,
  ClienteConDirecciones,
  ClienteListaItem,
  ClienteKPIs,
  CrearClienteDTO,
  ActualizarClienteDTO,
  CrearDireccionDTO,
  FiltrosCliente,
  CondicionIVA,
} from '@/types'

// ─── Helpers internos ─────────────────────────────────────────────────────────

/** Verifica sesión server-side con getUser() (nunca getSession()) */
async function getAuthUser(supabase: ReturnType<typeof createClient>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

/**
 * Verifica que el CUIT no esté ya registrado en otro cliente.
 * Retorna el id del cliente duplicado, o null si está libre.
 */
async function verificarCUITUnico(
  supabase: ReturnType<typeof createClient>,
  cuit: string,
  excluirId?: string
): Promise<string | null> {
  let query = supabase
    .from('clientes')
    .select('id')
    .eq('cuit', cuit)

  if (excluirId) query = query.neq('id', excluirId)

  const { data } = await query.maybeSingle()
  return (data as { id: string } | null)?.id ?? null
}

// ─── LEER ─────────────────────────────────────────────────────────────────────

/**
 * Obtiene el listado paginado de clientes con filtros opcionales.
 * Búsqueda full-text por razón social, nombre de fantasía o CUIT.
 */
export async function obtenerClientes(
  filtros: FiltrosCliente = {}
): Promise<ApiResponse<PaginatedResponse<ClienteListaItem>>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  const {
    busqueda,
    condicion_iva,
    segmento,
    activo       = true,
    pagina       = 1,
    por_pagina   = 20,
    orden_por    = 'razon_social',
    orden_dir    = 'asc',
  } = filtros

  const paginaSanitizada    = Math.max(1, pagina)
  const porPaginaSanitizado = Math.min(100, Math.max(1, por_pagina))
  const from = (paginaSanitizada - 1) * porPaginaSanitizado
  const to   = from + porPaginaSanitizado - 1

  let query = supabase
    .from('clientes')
    .select(
      'id, razon_social, nombre_fantasia, cuit, condicion_iva, telefono, email, segmento, activo, actualizado_en',
      { count: 'exact' }
    )
    .eq('activo', activo)
    .order(orden_por as string, { ascending: orden_dir === 'asc' })
    .range(from, to)

  if (busqueda?.trim()) {
    const t = busqueda.trim()
    query = query.or(
      `razon_social.ilike.%${t}%,nombre_fantasia.ilike.%${t}%,cuit.ilike.%${t}%`
    )
  }

  if (condicion_iva) query = query.eq('condicion_iva', condicion_iva)
  if (segmento)      query = query.eq('segmento', segmento)

  const { data: clientes, error, count } = await query

  if (error) {
    console.error('[obtenerClientes]', error)
    return { data: null, error: 'Error al obtener clientes' }
  }

  const total         = count ?? 0
  const total_paginas = Math.ceil(total / porPaginaSanitizado)

  const items: ClienteListaItem[] = ((clientes ?? []) as any[]).map((c) => ({
    id:               c.id,
    razon_social:     c.razon_social,
    nombre_fantasia:  c.nombre_fantasia,
    cuit:             c.cuit,
    condicion_iva:    c.condicion_iva as CondicionIVA,
    telefono:         c.telefono,
    email:            c.email,
    segmento:         c.segmento,
    activo:           c.activo,
    ultima_actividad: c.actualizado_en,
    saldo_pendiente:  0, // TODO Fase 2: calcular desde vista agregada
  }))

  return {
    data: { data: items, total, pagina: paginaSanitizada, por_pagina: porPaginaSanitizado, total_paginas },
    error: null,
  }
}

/**
 * Obtiene la ficha completa de un cliente con todas sus direcciones.
 */
export async function obtenerCliente(
  id: string
): Promise<ApiResponse<ClienteConDirecciones>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  if (!id) return { data: null, error: 'ID requerido' }

  const { data: cliente, error } = await supabase
    .from('clientes')
    .select('*, direcciones:clientes_direcciones(*)')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return { data: null, error: 'Cliente no encontrado' }
    console.error('[obtenerCliente]', error)
    return { data: null, error: 'Error al obtener el cliente' }
  }

  return { data: cliente as ClienteConDirecciones, error: null }
}

/**
 * Obtiene los KPIs calculados de un cliente.
 */
export async function obtenerKPIsCliente(
  cliente_id: string
): Promise<ApiResponse<ClienteKPIs>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  const [{ data: presupuestos }, { data: ordenes }, { data: facturas }] =
    await Promise.all([
      supabase.from('presupuestos').select('id, estado').eq('cliente_id', cliente_id),
      supabase.from('ordenes_servicio').select('id, estado').eq('cliente_id', cliente_id),
      supabase
        .from('facturas')
        .select('id, estado, total, saldo_pendiente, creado_en')
        .eq('cliente_id', cliente_id)
        .neq('estado', 'ANULADA'),
    ])

  const pEmitidos  = presupuestos?.length ?? 0
  const pAprobados = presupuestos?.filter((p: any) => p.estado === 'APROBADO').length ?? 0
  const facturasArr = (facturas ?? []) as any[]

  const montoFacturado = facturasArr.reduce((acc, f) => acc + (f.total ?? 0), 0)
  const saldoPendiente = facturasArr.reduce((acc, f) => acc + (f.saldo_pendiente ?? 0), 0)

  const fechas = facturasArr.map((f) => f.creado_en as string).sort()

  const kpis: ClienteKPIs = {
    cliente_id,
    presupuestos_emitidos:  pEmitidos,
    presupuestos_aprobados: pAprobados,
    tasa_conversion:        pEmitidos > 0 ? Math.round((pAprobados / pEmitidos) * 100) : 0,
    facturas_emitidas:      facturasArr.length,
    servicios_realizados:   (ordenes ?? []).filter((o: any) => o.estado === 'COMPLETADA').length,
    servicios_facturados:   (ordenes ?? []).filter((o: any) => ['COMPLETADA', 'EN_PROGRESO'].includes(o.estado)).length,
    servicios_cobrados:     facturasArr.filter((f) => f.estado === 'COBRADA').length,
    monto_total_facturado:  montoFacturado,
    monto_total_cobrado:    montoFacturado - saldoPendiente,
    saldo_pendiente:        saldoPendiente,
    ultimo_servicio:        fechas[fechas.length - 1] ?? null,
    primera_operacion:      fechas[0] ?? null,
  }

  return { data: kpis, error: null }
}

// ─── CREAR ────────────────────────────────────────────────────────────────────

/**
 * Crea un nuevo cliente con su dirección principal opcional.
 * Verifica duplicado de CUIT antes de insertar.
 */
export async function crearCliente(
  data: CrearClienteDTO
): Promise<ApiResponse<Cliente>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  const parsed = ClienteSchema.safeParse(data)
  if (!parsed.success) {
    return {
      data:    null,
      error:   'Datos inválidos',
      mensaje: parsed.error.errors[0]?.message ?? 'Verificá los campos del formulario',
    }
  }

  const { direccion_principal, ...clienteData } = parsed.data

  if (clienteData.cuit) {
    const duplicadoId = await verificarCUITUnico(supabase, clienteData.cuit)
    if (duplicadoId) {
      return {
        data:    null,
        error:   `Ya existe un cliente registrado con el CUIT ${clienteData.cuit}`,
        mensaje: `ID del cliente existente: ${duplicadoId}`,
      }
    }
  }

  const { data: cliente, error } = await supabase
    .from('clientes')
    .insert({ ...clienteData, creado_por: user.id, activo: true })
    .select()
    .single()

  if (error || !cliente) {
    console.error('[crearCliente]', error)
    return { data: null, error: 'Error al crear el cliente' }
  }

  if (direccion_principal) {
    const { error: errorDir } = await supabase
      .from('clientes_direcciones')
      .insert({
        ...direccion_principal,
        cliente_id:  cliente.id,
        es_principal: true,
        pais:        direccion_principal.pais ?? 'Argentina',
      })
    if (errorDir) console.error('[crearCliente] Error al crear dirección:', errorDir)
  }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'CREATE',
    entidad_tipo: 'cliente',
    entidad_id:   cliente.id,
    datos_nuevos: cliente as Record<string, unknown>,
  })

  revalidatePath('/clientes')

  return { data: cliente as Cliente, error: null, mensaje: 'Cliente creado exitosamente' }
}

// ─── ACTUALIZAR ───────────────────────────────────────────────────────────────

/**
 * Actualiza los datos de un cliente existente.
 */
export async function actualizarCliente(
  id: string,
  data: ActualizarClienteDTO
): Promise<ApiResponse<Cliente>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  if (!id) return { data: null, error: 'ID requerido' }

  const parsed = ClienteSchema.partial().safeParse(data)
  if (!parsed.success) {
    return {
      data:    null,
      error:   'Datos inválidos',
      mensaje: parsed.error.errors[0]?.message,
    }
  }

  const { direccion_principal, ...camposCliente } = parsed.data

  if (camposCliente.cuit) {
    const duplicadoId = await verificarCUITUnico(supabase, camposCliente.cuit, id)
    if (duplicadoId) {
      return { data: null, error: `Ya existe otro cliente con el CUIT ${camposCliente.cuit}` }
    }
  }

  const { data: anterior } = await supabase.from('clientes').select().eq('id', id).single()

  const { data: cliente, error } = await supabase
    .from('clientes')
    .update(camposCliente)
    .eq('id', id)
    .select()
    .single()

  if (error || !cliente) {
    console.error('[actualizarCliente]', error)
    return { data: null, error: 'Error al actualizar el cliente' }
  }

  await registrarAudit(supabase, {
    usuario_id:       user.id,
    accion:           'UPDATE',
    entidad_tipo:     'cliente',
    entidad_id:       id,
    datos_anteriores: anterior as Record<string, unknown>,
    datos_nuevos:     cliente  as Record<string, unknown>,
  })

  revalidatePath(`/clientes/${id}`)
  revalidatePath('/clientes')

  return { data: cliente as Cliente, error: null, mensaje: 'Cliente actualizado' }
}

/**
 * Reactiva un cliente previamente desactivado.
 */
export async function reactivarCliente(id: string): Promise<ApiResponse<null>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  const { error } = await supabase.from('clientes').update({ activo: true }).eq('id', id)
  if (error) return { data: null, error: 'Error al reactivar el cliente' }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'UPDATE',
    entidad_tipo: 'cliente',
    entidad_id:   id,
    datos_nuevos: { activo: true },
  })

  revalidatePath(`/clientes/${id}`)
  revalidatePath('/clientes')

  return { data: null, error: null, mensaje: 'Cliente reactivado' }
}

/**
 * Desactiva un cliente (soft delete).
 * Bloquea si tiene facturas activas pendientes de cobro.
 */
export async function desactivarCliente(id: string): Promise<ApiResponse<null>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  const { data: pendientes } = await supabase
    .from('facturas')
    .select('id')
    .eq('cliente_id', id)
    .in('estado', ['EMITIDA', 'PENDIENTE_COBRO', 'COBRADA_PARCIAL'])
    .limit(1)

  if (pendientes && pendientes.length > 0) {
    return {
      data:    null,
      error:   'No se puede desactivar el cliente',
      mensaje: 'Tiene facturas pendientes de cobro. Saldá la deuda antes de desactivarlo.',
    }
  }

  const { error } = await supabase.from('clientes').update({ activo: false }).eq('id', id)
  if (error) return { data: null, error: 'Error al desactivar el cliente' }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'DELETE',
    entidad_tipo: 'cliente',
    entidad_id:   id,
    datos_nuevos: { activo: false },
  })

  revalidatePath('/clientes')

  return { data: null, error: null, mensaje: 'Cliente desactivado' }
}

// ─── DIRECCIONES ──────────────────────────────────────────────────────────────

/**
 * Agrega una nueva dirección a un cliente.
 * Si se marca como principal, desplaza la anterior principal.
 */
export async function agregarDireccion(
  cliente_id: string,
  data: CrearDireccionDTO
): Promise<ApiResponse<ClienteDireccion>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  const parsed = DireccionSchema.safeParse(data)
  if (!parsed.success) {
    return {
      data:    null,
      error:   'Datos de dirección inválidos',
      mensaje: parsed.error.errors[0]?.message,
    }
  }

  if (parsed.data.es_principal) {
    await supabase
      .from('clientes_direcciones')
      .update({ es_principal: false })
      .eq('cliente_id', cliente_id)
  }

  const { data: direccion, error } = await supabase
    .from('clientes_direcciones')
    .insert({ ...parsed.data, cliente_id, pais: parsed.data.pais ?? 'Argentina' })
    .select()
    .single()

  if (error || !direccion) {
    console.error('[agregarDireccion]', error)
    return { data: null, error: 'Error al agregar la dirección' }
  }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'CREATE',
    entidad_tipo: 'cliente',
    entidad_id:   cliente_id,
    datos_nuevos: { direccion_agregada: direccion } as Record<string, unknown>,
  })

  revalidatePath(`/clientes/${cliente_id}`)

  return { data: direccion as ClienteDireccion, error: null, mensaje: 'Dirección agregada' }
}

/**
 * Actualiza los datos de una dirección existente.
 */
export async function actualizarDireccion(
  direccion_id: string,
  cliente_id: string,
  data: Partial<CrearDireccionDTO>
): Promise<ApiResponse<ClienteDireccion>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  const parsed = DireccionSchema.partial().safeParse(data)
  if (!parsed.success) {
    return {
      data:    null,
      error:   'Datos inválidos',
      mensaje: parsed.error.errors[0]?.message,
    }
  }

  if (parsed.data.es_principal) {
    await supabase
      .from('clientes_direcciones')
      .update({ es_principal: false })
      .eq('cliente_id', cliente_id)
      .neq('id', direccion_id)
  }

  const { data: direccion, error } = await supabase
    .from('clientes_direcciones')
    .update(parsed.data)
    .eq('id', direccion_id)
    .eq('cliente_id', cliente_id) // IDOR: garantizar pertenencia
    .select()
    .single()

  if (error || !direccion) {
    console.error('[actualizarDireccion]', error)
    return { data: null, error: 'Error al actualizar la dirección' }
  }

  revalidatePath(`/clientes/${cliente_id}`)

  return { data: direccion as ClienteDireccion, error: null }
}

/**
 * Elimina una dirección. Bloquea si es la única o si es la principal.
 */
export async function eliminarDireccion(
  direccion_id: string,
  cliente_id: string
): Promise<ApiResponse<null>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  const { count } = await supabase
    .from('clientes_direcciones')
    .select('id', { count: 'exact', head: true })
    .eq('cliente_id', cliente_id)

  if ((count ?? 0) <= 1) {
    return { data: null, error: 'No se puede eliminar la única dirección del cliente' }
  }

  const { data: dir } = await supabase
    .from('clientes_direcciones')
    .select('es_principal')
    .eq('id', direccion_id)
    .eq('cliente_id', cliente_id) // IDOR
    .single()

  if (!dir) return { data: null, error: 'Dirección no encontrada' }

  if ((dir as any).es_principal) {
    return {
      data:    null,
      error:   'No se puede eliminar la dirección principal',
      mensaje: 'Establecé otra dirección como principal antes de eliminar esta.',
    }
  }

  const { error } = await supabase
    .from('clientes_direcciones')
    .delete()
    .eq('id', direccion_id)
    .eq('cliente_id', cliente_id)

  if (error) return { data: null, error: 'Error al eliminar la dirección' }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'DELETE',
    entidad_tipo: 'cliente',
    entidad_id:   cliente_id,
    datos_nuevos: { direccion_eliminada_id: direccion_id } as Record<string, unknown>,
  })

  revalidatePath(`/clientes/${cliente_id}`)

  return { data: null, error: null, mensaje: 'Dirección eliminada' }
}

/**
 * Establece una dirección como principal del cliente.
 * Desplaza automáticamente la anterior.
 */
export async function establecerDireccionPrincipal(
  direccion_id: string,
  cliente_id: string
): Promise<ApiResponse<null>> {
  const supabase = createClient()

  const user = await getAuthUser(supabase)
  if (!user) return { data: null, error: 'No autenticado' }

  // IDOR: verificar que la dirección pertenece al cliente
  const { data: dir } = await supabase
    .from('clientes_direcciones')
    .select('id')
    .eq('id', direccion_id)
    .eq('cliente_id', cliente_id)
    .single()

  if (!dir) return { data: null, error: 'Dirección no encontrada' }

  await supabase
    .from('clientes_direcciones')
    .update({ es_principal: false })
    .eq('cliente_id', cliente_id)

  const { error } = await supabase
    .from('clientes_direcciones')
    .update({ es_principal: true })
    .eq('id', direccion_id)

  if (error) return { data: null, error: 'Error al actualizar la dirección principal' }

  revalidatePath(`/clientes/${cliente_id}`)

  return { data: null, error: null, mensaje: 'Dirección principal actualizada' }
}
