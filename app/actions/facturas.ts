'use server'

// ============================================================
// /app/actions/facturas.ts
// Server Actions — Módulo de Facturas y Recibos
// ============================================================

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { registrarAudit } from '@/lib/audit'
import type {
  Factura, FacturaCompleta, Recibo,
  CrearFacturaDTO, CrearReciboDTO, FiltrosFactura,
} from '@/types'
import type { ApiResponse, PaginatedResponse } from '@/types'
import type { EstadoFactura } from '@/types'

// ─── Listado paginado ─────────────────────────────────────────────────────────

export async function obtenerFacturas(
  filtros: FiltrosFactura = {}
): Promise<ApiResponse<PaginatedResponse<Factura & { razon_social: string }>>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const {
    busqueda, cliente_id, estado, tipo_comprobante,
    fecha_desde, fecha_hasta, pagina = 1, por_pagina = 20,
  } = filtros

  const desde = (pagina - 1) * por_pagina
  const hasta  = desde + por_pagina - 1

  let query = supabase
    .from('facturas')
    .select(`*, clientes!inner(razon_social)`, { count: 'exact' })

  if (busqueda) {
    query = query.or(
      `numero.ilike.%${busqueda}%,clientes.razon_social.ilike.%${busqueda}%`
    )
  }
  if (cliente_id)       query = query.eq('cliente_id', cliente_id)
  if (estado)           query = query.eq('estado', estado)
  if (tipo_comprobante) query = query.eq('tipo_comprobante', tipo_comprobante)
  if (fecha_desde)      query = query.gte('fecha_emision', fecha_desde)
  if (fecha_hasta)      query = query.lte('fecha_emision', fecha_hasta)

  const { data, error, count } = await query
    .order('fecha_emision', { ascending: false })
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

// ─── Obtener factura completa ─────────────────────────────────────────────────

export async function obtenerFactura(
  id: string
): Promise<ApiResponse<FacturaCompleta & { razon_social: string; numero_presupuesto: string | null; numero_orden: string | null }>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('facturas')
    .select(`
      *,
      clientes(razon_social, condicion_iva, cuit),
      presupuestos(numero),
      ordenes_servicio(numero),
      items:facturas_items(*),
      recibos(*)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return { data: null, error: 'Factura no encontrada' }

  return {
    data: {
      ...data,
      razon_social:       (data as any).clientes?.razon_social ?? '',
      numero_presupuesto: (data as any).presupuestos?.numero ?? null,
      numero_orden:       (data as any).ordenes_servicio?.numero ?? null,
      items:              (data as any).items ?? [],
      recibos:            (data as any).recibos ?? [],
    },
    error: null,
  }
}

// ─── Crear factura ────────────────────────────────────────────────────────────

export async function crearFactura(
  dto: CrearFacturaDTO
): Promise<ApiResponse<Factura>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  if (!dto.cliente_id)              return { data: null, error: 'El cliente es requerido' }
  if (!dto.tipo_comprobante)        return { data: null, error: 'El tipo de comprobante es requerido' }
  if (!dto.items || dto.items.length === 0) return { data: null, error: 'Debe incluir al menos un ítem' }

  // Calcular totales
  const { items, ...facturaData } = dto
  const subtotal = items.reduce((acc, item) => {
    return acc + item.cantidad * item.precio_unitario * (1 - (item.descuento_pct ?? 0) / 100)
  }, 0)
  const iva_pct    = dto.iva_pct ?? 21
  const iva_monto  = Math.round(subtotal * iva_pct) / 100
  const total      = Math.round((subtotal + iva_monto) * 100) / 100

  // Número correlativo
  const { data: numero } = await supabase.rpc('generar_numero_documento', { p_tipo: 'factura' })
  if (!numero) return { data: null, error: 'Error al generar número de factura' }

  // Punto de venta default
  const { data: config } = await supabase
    .from('configuracion_empresa')
    .select('punto_venta_default')
    .single()

  const { data: factura, error } = await supabase
    .from('facturas')
    .insert({
      ...facturaData,
      numero,
      punto_venta:     config?.punto_venta_default ?? 1,
      subtotal:        Math.round(subtotal * 100) / 100,
      descuento_monto: 0,
      iva_pct,
      iva_monto,
      otros_impuestos: 0,
      total,
      saldo_pendiente: total,
      estado:          'BORRADOR',
      fecha_emision:   dto.fecha_emision ?? new Date().toISOString().split('T')[0],
      creado_por:      user.id,
    })
    .select()
    .single()

  if (error || !factura) return { data: null, error: error?.message ?? 'Error al crear la factura' }

  // Insertar ítems
  const itemsConId = items.map((item, idx) => ({
    ...item,
    factura_id:     factura.id,
    iva_pct:        item.iva_pct ?? iva_pct,
    descuento_pct:  item.descuento_pct ?? 0,
    subtotal:       Math.round(item.cantidad * item.precio_unitario * (1 - (item.descuento_pct ?? 0) / 100) * 100) / 100,
    orden:          idx,
    unidad_medida:  item.unidad_medida ?? 'un',
  }))

  const { error: errorItems } = await supabase.from('facturas_items').insert(itemsConId)
  if (errorItems) {
    await supabase.from('facturas').delete().eq('id', factura.id)
    return { data: null, error: 'Error al guardar los ítems de la factura' }
  }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'CREATE',
    entidad_tipo: 'factura',
    entidad_id:   factura.id,
    datos_nuevos: { numero: factura.numero, total: factura.total },
  })

  revalidatePath('/facturas')
  return { data: factura, error: null, mensaje: `Factura ${numero} creada exitosamente` }
}

// ─── Emitir factura (BORRADOR → EMITIDA) ─────────────────────────────────────

export async function emitirFactura(
  id: string
): Promise<ApiResponse<Factura>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data: actual } = await supabase.from('facturas').select().eq('id', id).single()
  if (!actual) return { data: null, error: 'Factura no encontrada' }
  if (actual.estado !== 'BORRADOR') return { data: null, error: 'Solo se puede emitir una factura en borrador' }

  const { data: factura, error } = await supabase
    .from('facturas')
    .update({ estado: 'EMITIDA', actualizado_por: user.id })
    .eq('id', id)
    .select()
    .single()

  if (error || !factura) return { data: null, error: error?.message ?? 'Error al emitir' }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'UPDATE',
    entidad_tipo: 'factura',
    entidad_id:   id,
    datos_nuevos: { estado: 'EMITIDA' },
  })

  revalidatePath('/facturas')
  revalidatePath(`/facturas/${id}`)
  return { data: factura, error: null, mensaje: 'Factura emitida' }
}

// ─── Anular factura ───────────────────────────────────────────────────────────

export async function anularFactura(
  id: string,
  motivo?: string
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data: actual } = await supabase.from('facturas').select('estado,total').eq('id', id).single()
  if (!actual) return { data: null, error: 'Factura no encontrada' }
  if (actual.estado === 'ANULADA') return { data: null, error: 'La factura ya está anulada' }
  if (actual.estado === 'COBRADA') return { data: null, error: 'No se puede anular una factura cobrada' }

  const { error } = await supabase
    .from('facturas')
    .update({ estado: 'ANULADA', notas: motivo ? `ANULADA: ${motivo}` : null, actualizado_por: user.id })
    .eq('id', id)

  if (error) return { data: null, error: error.message }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'DELETE',
    entidad_tipo: 'factura',
    entidad_id:   id,
    datos_nuevos: { estado: 'ANULADA', motivo },
  })

  revalidatePath('/facturas')
  revalidatePath(`/facturas/${id}`)
  return { data: null, error: null, mensaje: 'Factura anulada' }
}

// ─── Registrar recibo de pago ─────────────────────────────────────────────────

export async function registrarRecibo(
  dto: CrearReciboDTO
): Promise<ApiResponse<Recibo>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  if (!dto.cliente_id)      return { data: null, error: 'El cliente es requerido' }
  if (!dto.monto || dto.monto <= 0) return { data: null, error: 'El monto debe ser mayor a cero' }

  // Validar cheque
  if (dto.tipo_pago === 'CHEQUE') {
    if (!dto.cheque_banco)  return { data: null, error: 'El banco del cheque es requerido' }
    if (!dto.cheque_numero) return { data: null, error: 'El número de cheque es requerido' }
    if (!dto.cheque_fecha)  return { data: null, error: 'La fecha del cheque es requerida' }
  }

  // Si tiene factura asociada, verificar que el monto no supere el saldo
  if (dto.factura_id) {
    const { data: factura } = await supabase
      .from('facturas')
      .select('saldo_pendiente, estado')
      .eq('id', dto.factura_id)
      .single()

    if (!factura) return { data: null, error: 'Factura no encontrada' }
    if (factura.estado === 'ANULADA') return { data: null, error: 'No se puede registrar cobro en una factura anulada' }
    if (dto.monto > factura.saldo_pendiente + 0.01) {
      return { data: null, error: `El monto (${dto.monto}) supera el saldo pendiente (${factura.saldo_pendiente})` }
    }
  }

  // Número de recibo
  const { data: numero } = await supabase.rpc('generar_numero_documento', { p_tipo: 'recibo' })
  if (!numero) return { data: null, error: 'Error al generar número de recibo' }

  const { data: recibo, error } = await supabase
    .from('recibos')
    .insert({
      ...dto,
      numero,
      fecha:      dto.fecha ?? new Date().toISOString().split('T')[0],
      creado_por: user.id,
    })
    .select()
    .single()

  if (error || !recibo) return { data: null, error: error?.message ?? 'Error al registrar el recibo' }

  // Actualizar saldo y estado de la factura si corresponde
  if (dto.factura_id) {
    const { data: factActual } = await supabase
      .from('facturas')
      .select('saldo_pendiente, total')
      .eq('id', dto.factura_id)
      .single()

    if (factActual) {
      const nuevoSaldo    = Math.max(0, Math.round((factActual.saldo_pendiente - dto.monto) * 100) / 100)
      const nuevoEstado: EstadoFactura = nuevoSaldo === 0 ? 'COBRADA' : nuevoSaldo < factActual.total ? 'COBRADA_PARCIAL' : 'PENDIENTE_COBRO'

      await supabase
        .from('facturas')
        .update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado, actualizado_por: user.id })
        .eq('id', dto.factura_id)

      revalidatePath(`/facturas/${dto.factura_id}`)
    }
  }

  await registrarAudit(supabase, {
    usuario_id:   user.id,
    accion:       'CREATE',
    entidad_tipo: 'recibo',
    entidad_id:   recibo.id,
    datos_nuevos: { numero: recibo.numero, monto: recibo.monto },
  })

  revalidatePath('/facturas')
  return { data: recibo, error: null, mensaje: `Recibo ${numero} registrado` }
}

// ─── Eliminar recibo ──────────────────────────────────────────────────────────

export async function eliminarRecibo(
  reciboId: string
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  // Obtener el recibo para revertir el saldo
  const { data: recibo } = await supabase
    .from('recibos')
    .select('monto, factura_id')
    .eq('id', reciboId)
    .single()

  if (!recibo) return { data: null, error: 'Recibo no encontrado' }

  const { error } = await supabase.from('recibos').delete().eq('id', reciboId)
  if (error) return { data: null, error: error.message }

  // Revertir saldo en la factura
  if (recibo.factura_id) {
    const { data: factura } = await supabase
      .from('facturas')
      .select('saldo_pendiente, total')
      .eq('id', recibo.factura_id)
      .single()

    if (factura) {
      const nuevoSaldo   = Math.min(factura.total, Math.round((factura.saldo_pendiente + recibo.monto) * 100) / 100)
      const nuevoEstado: EstadoFactura = nuevoSaldo >= factura.total ? 'EMITIDA' : nuevoSaldo > 0 ? 'COBRADA_PARCIAL' : 'COBRADA'

      await supabase
        .from('facturas')
        .update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado })
        .eq('id', recibo.factura_id)

      revalidatePath(`/facturas/${recibo.factura_id}`)
    }
  }

  revalidatePath('/facturas')
  return { data: null, error: null, mensaje: 'Recibo eliminado y saldo revertido' }
}

// ─── KPIs facturación ─────────────────────────────────────────────────────────

export async function obtenerKPIsFacturacion(): Promise<ApiResponse<{
  total_facturado_mes:  number
  total_cobrado_mes:    number
  saldo_total_pendiente: number
  facturas_vencidas:    number
  tasa_cobro:           number
}>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const hoy       = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const finMes    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).toISOString().split('T')[0]
  const hoyStr    = hoy.toISOString().split('T')[0]

  const [{ data: factsMes }, { data: recibosMes }, { data: pendientes }, { data: vencidas }] = await Promise.all([
    supabase.from('facturas').select('total, estado').gte('fecha_emision', inicioMes).lte('fecha_emision', finMes).neq('estado', 'ANULADA'),
    supabase.from('recibos').select('monto').gte('fecha', inicioMes).lte('fecha', finMes),
    supabase.from('facturas').select('saldo_pendiente').in('estado', ['EMITIDA','PENDIENTE_COBRO','COBRADA_PARCIAL']),
    supabase.from('facturas').select('id').lt('fecha_vencimiento', hoyStr).in('estado', ['EMITIDA','PENDIENTE_COBRO','COBRADA_PARCIAL']),
  ])

  const total_facturado_mes   = (factsMes ?? []).reduce((a, f) => a + f.total, 0)
  const total_cobrado_mes     = (recibosMes ?? []).reduce((a, r) => a + r.monto, 0)
  const saldo_total_pendiente = (pendientes ?? []).reduce((a, f) => a + f.saldo_pendiente, 0)
  const facturas_vencidas     = vencidas?.length ?? 0
  const tasa_cobro            = total_facturado_mes > 0 ? Math.round((total_cobrado_mes / total_facturado_mes) * 100) : 0

  return {
    data: { total_facturado_mes, total_cobrado_mes, saldo_total_pendiente, facturas_vencidas, tasa_cobro },
    error: null,
  }
}
