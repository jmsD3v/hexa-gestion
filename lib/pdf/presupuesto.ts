// ============================================================
// /lib/pdf/presupuesto.ts
// Generador de PDF para Presupuestos
// Usa pdfkit — liviano, sin headless browser
// ============================================================

import PDFDocument from 'pdfkit'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatearMonto } from '@/lib/calculos'

/**
 * Genera el PDF de un presupuesto y retorna un Buffer.
 * Se regenera 100% desde base de datos — siempre actualizado.
 */
export async function generarPDFPresupuesto(
  supabase: SupabaseClient,
  id: string,
  opciones?: Record<string, unknown>
): Promise<Buffer> {
  // ── Obtener datos ─────────────────────────────────────────
  const { data: presupuesto } = await supabase
    .from('presupuestos')
    .select(`
      *,
      cliente:clientes(razon_social, cuit, condicion_iva, email, telefono),
      direccion:clientes_direcciones(etiqueta, calle, numero, ciudad, provincia),
      items:presupuestos_items(*),
      incidencias:presupuestos_incidencias(*)
    `)
    .eq('id', id)
    .single()

  if (!presupuesto) throw new Error('Presupuesto no encontrado')

  const { data: empresa } = await supabase
    .from('configuracion_empresa')
    .select('*')
    .single()

  const mostrarCostos = opciones?.incluir_costos === true
  const mostrarIncidencias = opciones?.incluir_incidencias !== false

  // ── Construir PDF ─────────────────────────────────────────
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Presupuesto ${presupuesto.numero}`,
        Author: empresa?.razon_social ?? 'HEXA',
      },
    })

    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const MARGEN = 50
    const ANCHO = doc.page.width - MARGEN * 2
    const AZUL = '#1e3a5f'
    const GRIS = '#6b7280'
    const LINEA = '#e5e7eb'

    // ── Encabezado ──────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 120).fill(AZUL)

    doc
      .fillColor('white')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(empresa?.nombre_fantasia ?? 'HEXA', MARGEN, 30)

    doc
      .fontSize(9)
      .font('Helvetica')
      .text(empresa?.razon_social ?? '', MARGEN, 58)
      .text(`CUIT: ${empresa?.cuit ?? ''}`, MARGEN, 70)
      .text(empresa?.domicilio_fiscal ?? '', MARGEN, 82)

    // Número de presupuesto
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('PRESUPUESTO', MARGEN + ANCHO - 150, 30, { align: 'right', width: 150 })
      .fontSize(18)
      .text(presupuesto.numero, MARGEN + ANCHO - 150, 48, { align: 'right', width: 150 })
      .fontSize(9)
      .font('Helvetica')
      .text(`Fecha: ${formatearFecha(presupuesto.fecha_emision)}`, MARGEN + ANCHO - 150, 72, {
        align: 'right',
        width: 150,
      })

    if (presupuesto.fecha_vencimiento) {
      doc.text(`Válido hasta: ${formatearFecha(presupuesto.fecha_vencimiento)}`, MARGEN + ANCHO - 150, 83, {
        align: 'right',
        width: 150,
      })
    }

    // ── Datos del cliente ───────────────────────────────────
    let y = 140

    doc.fillColor(AZUL).fontSize(10).font('Helvetica-Bold').text('CLIENTE', MARGEN, y)
    doc.moveTo(MARGEN, y + 14).lineTo(MARGEN + ANCHO, y + 14).strokeColor(LINEA).stroke()

    y += 20
    doc
      .fillColor('#111')
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(presupuesto.cliente?.razon_social ?? '', MARGEN, y)

    y += 14
    doc.fontSize(9).font('Helvetica').fillColor(GRIS)

    if (presupuesto.cliente?.cuit) {
      doc.text(`CUIT: ${presupuesto.cliente.cuit}`, MARGEN, y)
      y += 12
    }

    if (presupuesto.direccion) {
      const dir = presupuesto.direccion
      doc.text(
        `${dir.etiqueta}: ${dir.calle} ${dir.numero ?? ''}, ${dir.ciudad}, ${dir.provincia}`,
        MARGEN,
        y
      )
      y += 12
    }

    // ── Objeto del presupuesto ──────────────────────────────
    y += 16
    doc.fillColor(AZUL).fontSize(10).font('Helvetica-Bold').text('OBJETO', MARGEN, y)
    doc.moveTo(MARGEN, y + 14).lineTo(MARGEN + ANCHO, y + 14).strokeColor(LINEA).stroke()

    y += 22
    doc
      .fillColor('#111')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(presupuesto.titulo ?? '', MARGEN, y)

    if (presupuesto.objetivo_servicio) {
      y += 14
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(GRIS)
        .text(presupuesto.objetivo_servicio, MARGEN, y, { width: ANCHO })
      y += doc.heightOfString(presupuesto.objetivo_servicio, { width: ANCHO })
    }

    // ── Tabla de ítems ──────────────────────────────────────
    y += 20
    doc.fillColor(AZUL).fontSize(10).font('Helvetica-Bold').text('DETALLE', MARGEN, y)
    y += 16

    // Encabezado tabla
    const colDesc = MARGEN
    const colCant = MARGEN + ANCHO - 250
    const colUM = MARGEN + ANCHO - 190
    const colPrecio = MARGEN + ANCHO - 130
    const colTotal = MARGEN + ANCHO - 60

    doc.rect(MARGEN, y, ANCHO, 20).fill('#f1f5f9')

    doc.fillColor(AZUL).fontSize(8).font('Helvetica-Bold')
    doc.text('Descripción', colDesc + 4, y + 6)
    doc.text('Cant.', colCant, y + 6, { width: 40, align: 'right' })
    doc.text('U.M.', colUM, y + 6, { width: 40, align: 'center' })
    doc.text('P. Unit.', colPrecio, y + 6, { width: 60, align: 'right' })
    doc.text('Subtotal', colTotal, y + 6, { width: 60, align: 'right' })

    y += 20

    // Filas de ítems
    doc.fontSize(8).font('Helvetica').fillColor('#111')

    for (const item of presupuesto.items ?? []) {
      const filaAltura = 18

      if (y + filaAltura > doc.page.height - 120) {
        doc.addPage()
        y = 50
      }

      doc
        .text(item.descripcion, colDesc + 4, y + 4, { width: colCant - colDesc - 10 })

      doc.text(formatearNumero(item.cantidad), colCant, y + 4, { width: 40, align: 'right' })
      doc.text(item.unidad_medida, colUM, y + 4, { width: 40, align: 'center' })
      doc.text(formatearMonto(item.precio_unitario), colPrecio, y + 4, { width: 60, align: 'right' })
      doc.text(formatearMonto(item.subtotal), colTotal, y + 4, { width: 60, align: 'right' })

      y += filaAltura
      doc.moveTo(MARGEN, y).lineTo(MARGEN + ANCHO, y).strokeColor(LINEA).lineWidth(0.5).stroke()
    }

    // Incidencias (si aplica)
    if (mostrarIncidencias && presupuesto.incidencias?.some((i: { es_interno: boolean }) => !i.es_interno)) {
      y += 16
      doc.fillColor(AZUL).fontSize(9).font('Helvetica-Bold').text('INCIDENCIAS', MARGEN, y)
      y += 16

      for (const inc of presupuesto.incidencias.filter((i: { es_interno: boolean }) => !i.es_interno)) {
        doc.fillColor('#111').fontSize(8).font('Helvetica')
        doc.text(inc.descripcion, colDesc + 4, y + 4, { width: colCant - colDesc - 10 })
        doc.text(formatearMonto(inc.subtotal), colTotal, y + 4, { width: 60, align: 'right' })
        y += 18
      }
    }

    // ── Totales ─────────────────────────────────────────────
    y += 20
    const totalesX = MARGEN + ANCHO - 200

    const filaTotales = (label: string, monto: number, negrita = false) => {
      doc
        .fillColor(negrita ? AZUL : GRIS)
        .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(negrita ? 10 : 9)
        .text(label, totalesX, y, { width: 130 })
        .text(formatearMonto(monto), totalesX + 130, y, { width: 70, align: 'right' })
      y += 16
    }

    doc.moveTo(totalesX, y).lineTo(MARGEN + ANCHO, y).strokeColor(LINEA).stroke()
    y += 8

    filaTotales('Subtotal ítems:', presupuesto.subtotal_items)
    if (presupuesto.subtotal_incidencias > 0) {
      filaTotales('Incidencias:', presupuesto.subtotal_incidencias)
    }
    if (presupuesto.descuento_monto > 0) {
      filaTotales(`Descuento (${presupuesto.descuento_pct}%):`, -presupuesto.descuento_monto)
    }
    filaTotales(`IVA (${presupuesto.iva_pct}%):`, presupuesto.iva_monto)

    doc.moveTo(totalesX, y).lineTo(MARGEN + ANCHO, y).strokeColor(AZUL).lineWidth(1.5).stroke()
    y += 8
    filaTotales('TOTAL:', presupuesto.total, true)

    // ── Condiciones ──────────────────────────────────────────
    if (presupuesto.condiciones_pago || presupuesto.tiempo_ejecucion || presupuesto.garantia) {
      if (y + 80 > doc.page.height - 80) { doc.addPage(); y = MARGEN }
      y += 20
      doc.fillColor(AZUL).fontSize(10).font('Helvetica-Bold').text('CONDICIONES', MARGEN, y)
      doc.moveTo(MARGEN, y + 14).lineTo(MARGEN + ANCHO, y + 14).strokeColor(LINEA).stroke()
      y += 22

      const condRow = (label: string, valor: string) => {
        if (y + 24 > doc.page.height - 80) { doc.addPage(); y = MARGEN }
        const texto = `${label}${valor}`
        doc.fontSize(9).fillColor('#111')
        doc.font('Helvetica-Bold').text(label, MARGEN, y, { continued: true, lineBreak: false })
        doc.font('Helvetica').text(valor)
        y += doc.heightOfString(texto, { width: ANCHO }) + 4
      }

      if (presupuesto.condiciones_pago) condRow('Condiciones de pago: ', presupuesto.condiciones_pago)
      if (presupuesto.tiempo_ejecucion) condRow('Tiempo de ejecución: ', presupuesto.tiempo_ejecucion)
      if (presupuesto.garantia)         condRow('Garantía: ', presupuesto.garantia)
    }

    // ── Notas para el cliente ────────────────────────────────
    if (presupuesto.notas_cliente) {
      y += 20
      doc.fontSize(8).font('Helvetica').fillColor(GRIS)
        .text(presupuesto.notas_cliente, MARGEN, y, { width: ANCHO })
    }

    // ── Pie de página ────────────────────────────────────────
    const pieY = doc.page.height - 50
    doc.moveTo(MARGEN, pieY - 10).lineTo(MARGEN + ANCHO, pieY - 10).strokeColor(LINEA).stroke()
    doc
      .fontSize(7)
      .fillColor(GRIS)
      .text(
        empresa?.pie_pagina_pdf ?? `${empresa?.razon_social ?? ''} — ${empresa?.email ?? ''} — ${empresa?.telefono ?? ''}`,
        MARGEN,
        pieY,
        { align: 'center', width: ANCHO }
      )

    doc.end()
  })
}

// ── Helpers ───────────────────────────────────────────────────

function formatearFecha(fecha: string): string {
  return new Date(fecha + 'T00:00:00').toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatearNumero(n: number): string {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(n)
}
