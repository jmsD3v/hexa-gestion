'use server'

// ============================================================
// /app/actions/reportes.ts
// Series temporales y rankings para el módulo de Reportes
// ============================================================

import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────

export interface PuntoSerie {
  mes:      string   // 'YYYY-MM'
  label:    string   // 'Ene 25'
  valor:    number
  valor2?:  number   // segunda serie (ej: cobrado vs facturado)
}

export interface RankingItem {
  id:       string
  nombre:   string
  valor:    number
  cantidad: number
}

export interface ResumenPeriodo {
  facturado:        number
  cobrado:          number
  ordenes_cerradas: number
  presupuestos_aprobados: number
  tasa_conversion:  number   // %
  ticket_promedio:  number
}

// ── Helper: últimos N meses ───────────────────────────────────

function ultimosMeses(n: number): { inicio: string; fin: string; label: string; key: string }[] {
  const meses = []
  const ahora = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    meses.push({
      inicio: d.toISOString().split('T')[0],
      fin:    fin.toISOString().split('T')[0],
      label:  d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      key:    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  return meses
}

// ── Serie facturado vs cobrado (últimos 12 meses) ─────────────

export async function obtenerSerieFacturacion(
  meses = 12
): Promise<ApiResponse<PuntoSerie[]>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const periodos = ultimosMeses(meses)
  const inicio   = periodos[0].inicio
  const fin      = periodos[periodos.length - 1].fin

  const [{ data: facturas }, { data: recibos }] = await Promise.all([
    supabase.from('facturas')
      .select('fecha_emision, total')
      .in('estado', ['EMITIDA', 'COBRADA'])
      .gte('fecha_emision', inicio).lte('fecha_emision', fin),
    supabase.from('recibos')
      .select('fecha, monto')
      .gte('fecha', inicio).lte('fecha', fin),
  ])

  const serie: PuntoSerie[] = periodos.map(p => {
    const facturado = (facturas ?? [])
      .filter((f: any) => f.fecha_emision.startsWith(p.key))
      .reduce((a: number, f: any) => a + (f.total ?? 0), 0)
    const cobrado = (recibos ?? [])
      .filter((r: any) => r.fecha.startsWith(p.key))
      .reduce((a: number, r: any) => a + (r.monto ?? 0), 0)
    return { mes: p.key, label: p.label, valor: facturado, valor2: cobrado }
  })

  return { data: serie, error: null }
}

// ── Serie órdenes cerradas por mes ────────────────────────────

export async function obtenerSerieOrdenes(
  meses = 12
): Promise<ApiResponse<PuntoSerie[]>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const periodos = ultimosMeses(meses)
  const inicio   = periodos[0].inicio
  const fin      = periodos[periodos.length - 1].fin

  const [{ data: completadas }, { data: abiertas }] = await Promise.all([
    supabase.from('ordenes_servicio')
      .select('actualizado_en')
      .eq('estado', 'COMPLETADA')
      .gte('actualizado_en', inicio).lte('actualizado_en', fin),
    supabase.from('ordenes_servicio')
      .select('creado_en')
      .gte('creado_en', inicio).lte('creado_en', fin),
  ])

  const serie: PuntoSerie[] = periodos.map(p => ({
    mes: p.key, label: p.label,
    valor:  (completadas ?? []).filter((o: any) => o.actualizado_en.startsWith(p.key)).length,
    valor2: (abiertas    ?? []).filter((o: any) => o.creado_en.startsWith(p.key)).length,
  }))

  return { data: serie, error: null }
}

// ── Serie presupuestos (emitidos vs aprobados) ────────────────

export async function obtenerSeriePresupuestos(
  meses = 12
): Promise<ApiResponse<PuntoSerie[]>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const periodos = ultimosMeses(meses)
  const inicio   = periodos[0].inicio
  const fin      = periodos[periodos.length - 1].fin

  const { data: presups } = await supabase
    .from('presupuestos')
    .select('creado_en, estado')
    .gte('creado_en', inicio).lte('creado_en', fin)

  const serie: PuntoSerie[] = periodos.map(p => {
    const del_mes = (presups ?? []).filter((pr: any) => pr.creado_en.startsWith(p.key))
    return {
      mes: p.key, label: p.label,
      valor:  del_mes.length,
      valor2: del_mes.filter((pr: any) => pr.estado === 'APROBADO').length,
    }
  })

  return { data: serie, error: null }
}

// ── Ranking clientes por facturación ─────────────────────────

export async function obtenerRankingClientes(
  top = 10
): Promise<ApiResponse<RankingItem[]>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data: facturas } = await supabase
    .from('facturas')
    .select('cliente_id, total, clientes(razon_social)')
    .in('estado', ['EMITIDA', 'COBRADA'])

  const mapa: Record<string, { nombre: string; valor: number; cantidad: number }> = {}
  for (const f of facturas ?? []) {
    if (!mapa[f.cliente_id]) {
      mapa[f.cliente_id] = {
        nombre:   (f as any).clientes?.razon_social ?? f.cliente_id,
        valor:    0,
        cantidad: 0,
      }
    }
    mapa[f.cliente_id].valor    += f.total ?? 0
    mapa[f.cliente_id].cantidad += 1
  }

  const ranking = Object.entries(mapa)
    .map(([id, d]) => ({ id, ...d }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, top)

  return { data: ranking, error: null }
}

// ── Exportación detallada ─────────────────────────────────────

export interface FilaExportFacturas {
  numero:            string
  fecha_emision:     string
  tipo_comprobante:  string
  cliente:           string
  estado:            string
  subtotal:          number
  iva_monto:         number
  total:             number
  saldo_pendiente:   number
  cobrado:           number
}

export interface FilaExportOrdenes {
  numero:         string
  titulo:         string
  cliente:        string
  estado:         string
  fecha_inicio:   string
  fecha_fin_real: string
  presupuesto:    string
}

export async function exportarFacturasPeriodo(
  desde: string,
  hasta: string,
): Promise<ApiResponse<FilaExportFacturas[]>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('facturas')
    .select('numero, fecha_emision, tipo_comprobante, estado, subtotal, iva_monto, total, saldo_pendiente, clientes(razon_social)')
    .gte('fecha_emision', desde)
    .lte('fecha_emision', hasta)
    .neq('estado', 'ANULADA')
    .order('fecha_emision', { ascending: false })

  if (error) return { data: null, error: error.message }

  const filas: FilaExportFacturas[] = (data ?? []).map((f: any) => ({
    numero:           f.numero,
    fecha_emision:    f.fecha_emision,
    tipo_comprobante: f.tipo_comprobante?.replace(/_/g, ' ') ?? '',
    cliente:          f.clientes?.razon_social ?? '',
    estado:           f.estado,
    subtotal:         f.subtotal ?? 0,
    iva_monto:        f.iva_monto ?? 0,
    total:            f.total ?? 0,
    saldo_pendiente:  f.saldo_pendiente ?? 0,
    cobrado:          Math.max(0, (f.total ?? 0) - (f.saldo_pendiente ?? 0)),
  }))

  return { data: filas, error: null }
}

export async function exportarOrdenesPeriodo(
  desde: string,
  hasta: string,
): Promise<ApiResponse<FilaExportOrdenes[]>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ordenes_servicio')
    .select('numero, titulo, estado, fecha_inicio, fecha_fin_real, clientes(razon_social), presupuestos(numero)')
    .gte('creado_en', desde)
    .lte('creado_en', hasta)
    .order('creado_en', { ascending: false })

  if (error) return { data: null, error: error.message }

  const filas: FilaExportOrdenes[] = (data ?? []).map((o: any) => ({
    numero:         o.numero,
    titulo:         o.titulo ?? '',
    cliente:        o.clientes?.razon_social ?? '',
    estado:         o.estado,
    fecha_inicio:   o.fecha_inicio ?? '',
    fecha_fin_real: o.fecha_fin_real ?? '',
    presupuesto:    o.presupuestos?.numero ?? '',
  }))

  return { data: filas, error: null }
}

// ── Resumen del período seleccionado ─────────────────────────

export async function obtenerResumenPeriodo(
  desde: string,
  hasta: string
): Promise<ApiResponse<ResumenPeriodo>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const [
    { data: facturas },
    { data: recibos },
    { data: ordenesOk },
    { data: presEnviados },
    { data: presAprobados },
  ] = await Promise.all([
    supabase.from('facturas').select('total').in('estado', ['EMITIDA','COBRADA']).gte('fecha_emision', desde).lte('fecha_emision', hasta),
    supabase.from('recibos').select('monto').gte('fecha', desde).lte('fecha', hasta),
    supabase.from('ordenes_servicio').select('id').eq('estado', 'COMPLETADA').gte('actualizado_en', desde).lte('actualizado_en', hasta),
    supabase.from('presupuestos').select('id').in('estado', ['ENVIADO','APROBADO','RECHAZADO']).gte('creado_en', desde).lte('creado_en', hasta),
    supabase.from('presupuestos').select('total').eq('estado', 'APROBADO').gte('creado_en', desde).lte('creado_en', hasta),
  ])

  const facturado   = (facturas ?? []).reduce((a: number, f: any) => a + (f.total ?? 0), 0)
  const cobrado     = (recibos  ?? []).reduce((a: number, r: any) => a + (r.monto ?? 0), 0)
  const totalPres   = presAprobados?.reduce((a: number, p: any) => a + (p.total ?? 0), 0) ?? 0
  const cantAprobados = presAprobados?.length ?? 0
  const totalEnviados = (presEnviados?.length ?? 0)

  return {
    data: {
      facturado,
      cobrado,
      ordenes_cerradas:       ordenesOk?.length ?? 0,
      presupuestos_aprobados: cantAprobados,
      tasa_conversion:        totalEnviados > 0 ? Math.round((cantAprobados / totalEnviados) * 100) : 0,
      ticket_promedio:        cantAprobados > 0 ? Math.round(totalPres / cantAprobados) : 0,
    },
    error: null,
  }
}
