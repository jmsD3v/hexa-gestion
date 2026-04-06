// ============================================================
// /lib/pdf/factura.ts
// Generador de PDF para Facturas — PDFKit
// Cumple formato AFIP: encabezado con letra grande, datos
// fiscales, tabla de ítems con IVA discriminado (A) o no (B/C),
// CAE y vencimiento en el pie.
// ============================================================

import PDFDocument from 'pdfkit'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatearMonto } from '@/lib/calculos'

// ── Helpers ───────────────────────────────────────────────────

const fmtF = (iso: string | null) =>
  iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) : '—'

const fmtN = (n: number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(n)

// Letra AFIP según tipo de comprobante
const LETRA: Record<string, string> = {
  FACTURA_A: 'A', FACTURA_B: 'B', FACTURA_C: 'C',
  NOTA_DEBITO_A: 'A', NOTA_DEBITO_B: 'B',
  NOTA_CREDITO_A: 'A', NOTA_CREDITO_B: 'B',
}

const TITULO_COMPROBANTE: Record<string, string> = {
  FACTURA_A: 'FACTURA', FACTURA_B: 'FACTURA', FACTURA_C: 'FACTURA',
  NOTA_DEBITO_A: 'NOTA DE DÉBITO', NOTA_DEBITO_B: 'NOTA DE DÉBITO',
  NOTA_CREDITO_A: 'NOTA DE CRÉDITO', NOTA_CREDITO_B: 'NOTA DE CRÉDITO',
}

// ── Generador ─────────────────────────────────────────────────

export async function generarPDFFactura(
  supabase: SupabaseClient,
  id: string,
  opciones?: Record<string, unknown>
): Promise<Buffer> {

  // ── Datos ────────────────────────────────────────────────
  const { data: factura } = await supabase
    .from('facturas')
    .select(`
      *,
      cliente:clientes(razon_social, cuit, condicion_iva, email, telefono),
      items:facturas_items(*),
      recibos(*)
    `)
    .eq('id', id)
    .single()

  if (!factura) throw new Error('Factura no encontrada')

  const { data: empresa } = await supabase
    .from('configuracion_empresa')
    .select('*')
    .single()

  const items  = (factura.items  ?? []).sort((a: any, b: any) => a.orden - b.orden)
  const letra  = LETRA[factura.tipo_comprobante] ?? 'X'
  const titulo = TITULO_COMPROBANTE[factura.tipo_comprobante] ?? 'COMPROBANTE'
  const esFactA = letra === 'A'
  const incluirRecibos = opciones?.incluir_recibos !== false

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title: `${titulo} ${letra} ${factura.numero}`,
      Author: empresa?.razon_social ?? 'HEXA',
    }})

    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const M    = 50
    const PW   = doc.page.width
    const ANCHO = PW - M * 2
    const AZUL  = '#1e3a5f'
    const GRIS  = '#6b7280'
    const LINEA = '#e5e7eb'
    const VERDE = '#15803d'

    // ════════════════════════════════════════════════════════
    // ENCABEZADO — formato AFIP
    // Izquierda: datos empresa | Centro: letra grande | Derecha: datos comprobante
    // ════════════════════════════════════════════════════════

    const headerH = 110

    // Fondo header
    doc.rect(0, 0, PW, headerH).fill(AZUL)

    // Caja central letra AFIP
    const letraBoxW = 60
    const letraBoxX = (PW - letraBoxW) / 2
    doc.rect(letraBoxX, 8, letraBoxW, headerH - 16).fill('white')
    doc.fillColor(AZUL).fontSize(52).font('Helvetica-Bold')
       .text(letra, letraBoxX, 20, { width: letraBoxW, align: 'center' })
    doc.fillColor(GRIS).fontSize(7).font('Helvetica')
       .text('Cod. 0' + (['A','B','C'].indexOf(letra) + 1), letraBoxX, 73, { width: letraBoxW, align: 'center' })

    // Izquierda — empresa
    doc.fillColor('white').fontSize(16).font('Helvetica-Bold')
       .text(empresa?.nombre_fantasia ?? 'HEXA', M, 18, { width: letraBoxX - M - 10 })
    doc.fontSize(7.5).font('Helvetica')
       .text(empresa?.razon_social ?? '', M, 40)
       .text(`CUIT: ${empresa?.cuit ?? '—'}`, M, 51)
       .text(`IVA: ${empresa?.condicion_iva ?? 'Responsable Inscripto'}`, M, 62)
       .text(empresa?.domicilio_fiscal ?? '', M, 73)
       .text(`${empresa?.email ?? ''}  |  Tel: ${empresa?.telefono ?? ''}`, M, 84)

    // Derecha — datos del comprobante
    const rX = letraBoxX + letraBoxW + 10
    const rW  = PW - M - rX
    doc.fillColor('white').fontSize(11).font('Helvetica-Bold')
       .text(titulo, rX, 14, { width: rW, align: 'right' })
    doc.fontSize(18).font('Helvetica-Bold')
       .text(factura.numero, rX, 28, { width: rW, align: 'right' })
    doc.fontSize(7.5).font('Helvetica')
       .text(`Punto de venta: ${String(factura.punto_venta ?? 1).padStart(4, '0')}`, rX, 55, { width: rW, align: 'right' })
       .text(`Fecha: ${fmtF(factura.fecha_emision)}`, rX, 66, { width: rW, align: 'right' })
    if (factura.fecha_vencimiento)
       doc.text(`Vence: ${fmtF(factura.fecha_vencimiento)}`, rX, 77, { width: rW, align: 'right' })
    if (factura.periodo_desde)
       doc.text(`Período: ${fmtF(factura.periodo_desde)} al ${fmtF(factura.periodo_hasta)}`, rX, 88, { width: rW, align: 'right' })

    // Marca de agua BORRADOR / ANULADA
    if (factura.estado === 'BORRADOR' || factura.estado === 'ANULADA') {
      doc.save()
      doc.rotate(-42, { origin: [PW / 2, doc.page.height / 2] })
      doc.fontSize(72).font('Helvetica-Bold')
         .fillColor(factura.estado === 'ANULADA' ? '#ef4444' : '#94a3b8').opacity(0.07)
         .text(factura.estado, 0, doc.page.height / 2 - 50, { width: PW, align: 'center' })
      doc.restore().opacity(1)
    }

    // ════════════════════════════════════════════════════════
    // DATOS DEL RECEPTOR
    // ════════════════════════════════════════════════════════

    let y = headerH + 14

    doc.rect(M, y, ANCHO, 60).stroke(LINEA)
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRIS)
       .text('DATOS DEL RECEPTOR', M + 8, y + 5)

    const cli = factura.cliente
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827')
       .text(cli?.razon_social ?? '—', M + 8, y + 16)
    doc.fontSize(8).font('Helvetica').fillColor(GRIS)
       .text(`CUIT: ${cli?.cuit ?? '—'}`, M + 8, y + 29)
       .text(`Condición IVA: ${cli?.condicion_iva ?? '—'}`, M + 8, y + 40)
       .text(`Domicilio: —`, M + 160, y + 29)
    if (factura.condicion_venta)
       doc.text(`Cond. venta: ${factura.condicion_venta}`, M + 160, y + 40)

    y += 72

    // ════════════════════════════════════════════════════════
    // TABLA DE ÍTEMS
    // ════════════════════════════════════════════════════════

    // Columnas
    const COL = esFactA
      ? { desc: M, cant: M + ANCHO * 0.44, um: M + ANCHO * 0.54, pu: M + ANCHO * 0.64, dto: M + ANCHO * 0.74, iva: M + ANCHO * 0.82, sub: M + ANCHO * 0.91 }
      : { desc: M, cant: M + ANCHO * 0.52, um: M + ANCHO * 0.62, pu: M + ANCHO * 0.73, dto: M + ANCHO * 0.83, sub: M + ANCHO * 0.91 }

    const cabeceras = esFactA
      ? ['Descripción', 'Cant.', 'U.M.', 'P. Unit.', 'Dto%', 'IVA%', 'Subtotal']
      : ['Descripción', 'Cant.', 'U.M.', 'P. Unit.', 'Dto%', 'Subtotal']

    const colPositions = esFactA
      ? [COL.desc, COL.cant, COL.um, COL.pu, COL.dto, (COL as any).iva, COL.sub]
      : [COL.desc, COL.cant, COL.um, COL.pu, COL.dto, COL.sub]

    doc.rect(M, y, ANCHO, 18).fill('#f1f5f9')
    doc.fontSize(7.5).font('Helvetica-Bold').fillColor(AZUL)
    cabeceras.forEach((h, i) => {
      const align = i === 0 ? 'left' : 'right'
      const w = i < cabeceras.length - 1
        ? colPositions[i + 1] - colPositions[i] - 4
        : M + ANCHO - colPositions[i]
      doc.text(h, colPositions[i] + (i === 0 ? 4 : 0), y + 5, { width: w, align })
    })
    y += 18

    for (const item of items) {
      const rowH = 16
      if (y + rowH > doc.page.height - 120) { doc.addPage(); y = M }

      doc.fontSize(7.5).font('Helvetica').fillColor('#111827')
      const descW = COL.cant - COL.desc - 6
      doc.text(item.descripcion, COL.desc + 4, y + 3, { width: descW, ellipsis: true })
      doc.text(fmtN(item.cantidad),      COL.cant,          y + 3, { width: (COL as any).um - COL.cant - 2,   align: 'right' })
      doc.text(item.unidad_medida,       (COL as any).um,   y + 3, { width: (COL as any).pu - (COL as any).um - 2, align: 'right' })
      doc.text(formatearMonto(item.precio_unitario), (COL as any).pu, y + 3, { width: (COL as any).dto - (COL as any).pu - 2, align: 'right' })
      doc.text(`${item.descuento_pct}%`, (COL as any).dto,  y + 3, { width: (esFactA ? (COL as any).iva : COL.sub) - (COL as any).dto - 2, align: 'right' })
      if (esFactA)
        doc.text(`${item.iva_pct}%`,     (COL as any).iva,  y + 3, { width: COL.sub - (COL as any).iva - 2, align: 'right' })
      doc.text(formatearMonto(item.subtotal), COL.sub,      y + 3, { width: M + ANCHO - COL.sub, align: 'right' })

      y += rowH
      doc.moveTo(M, y).lineTo(M + ANCHO, y).strokeColor(LINEA).lineWidth(0.4).stroke()
    }

    // ════════════════════════════════════════════════════════
    // TOTALES
    // ════════════════════════════════════════════════════════

    y += 8
    const totX = M + ANCHO * 0.62
    const totW  = M + ANCHO - totX

    const filaTotal = (label: string, monto: number, bold = false, color = GRIS) => {
      if (y + 14 > doc.page.height - 100) { doc.addPage(); y = M }
      doc.fillColor(color).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 9 : 8)
         .text(label, totX, y, { width: totW * 0.55 })
         .text(formatearMonto(monto), totX + totW * 0.55, y, { width: totW * 0.45, align: 'right' })
      y += 13
    }

    doc.moveTo(totX, y).lineTo(M + ANCHO, y).strokeColor(LINEA).lineWidth(0.5).stroke()
    y += 6

    filaTotal('Subtotal:', factura.subtotal)
    if (factura.descuento_monto > 0)
      filaTotal('Descuento:', -factura.descuento_monto)

    if (esFactA) {
      // IVA discriminado por alícuota
      const ivaAgrupadp: Record<number, number> = {}
      for (const it of items) {
        ivaAgrupadp[it.iva_pct] = (ivaAgrupadp[it.iva_pct] ?? 0) +
          ((it.subtotal * (1 - it.descuento_pct / 100)) * (it.iva_pct / 100))
      }
      for (const [pct, monto] of Object.entries(ivaAgrupadp)) {
        filaTotal(`IVA ${pct}%:`, Number(monto))
      }
    }

    if (factura.otros_impuestos > 0)
      filaTotal('Otros impuestos:', factura.otros_impuestos)

    doc.moveTo(totX, y).lineTo(M + ANCHO, y).strokeColor(AZUL).lineWidth(1.5).stroke()
    y += 6
    filaTotal('TOTAL:', factura.total, true, AZUL)

    if (factura.saldo_pendiente < factura.total) {
      y += 4
      filaTotal('Cobrado:', factura.total - factura.saldo_pendiente)
      filaTotal('Saldo pendiente:', factura.saldo_pendiente, true, factura.saldo_pendiente > 0 ? '#b91c1c' : VERDE)
    }

    // ════════════════════════════════════════════════════════
    // RECIBOS (opcionales)
    // ════════════════════════════════════════════════════════

    const recibos = factura.recibos ?? []
    if (incluirRecibos && recibos.length > 0) {
      y += 16
      if (y + 20 > doc.page.height - 80) { doc.addPage(); y = M }
      doc.fillColor(AZUL).fontSize(8).font('Helvetica-Bold').text('COBROS REGISTRADOS', M, y)
      doc.moveTo(M, y + 11).lineTo(M + ANCHO, y + 11).strokeColor(LINEA).stroke()
      y += 16

      for (const r of recibos) {
        if (y + 14 > doc.page.height - 80) { doc.addPage(); y = M }
        doc.fontSize(7.5).font('Helvetica').fillColor(GRIS)
           .text(r.numero, M + 4, y)
           .text(fmtF(r.fecha), M + 80, y)
           .text(r.tipo_pago?.replace(/_/g, ' ') ?? '', M + 160, y)
           .text(r.concepto ?? '', M + 260, y, { width: 120, ellipsis: true })
           .text(formatearMonto(r.monto), M + ANCHO - 70, y, { width: 70, align: 'right' })
        y += 14
      }
    }

    // ════════════════════════════════════════════════════════
    // DATOS FISCALES AFIP — CAE
    // ════════════════════════════════════════════════════════

    if (factura.cae) {
      y += 14
      if (y + 36 > doc.page.height - 50) { doc.addPage(); y = M }
      doc.rect(M, y, ANCHO, 32).stroke(LINEA)
      doc.fontSize(7).font('Helvetica-Bold').fillColor(GRIS)
         .text('DATOS FISCALES AFIP', M + 8, y + 5)
      doc.fontSize(8).font('Helvetica').fillColor('#111827')
         .text(`CAE: ${factura.cae}`, M + 8, y + 16)
         .text(`Vencimiento CAE: ${fmtF(factura.cae_vencimiento)}`, M + 180, y + 16)
      if (factura.numero_afip)
         doc.text(`N° AFIP: ${factura.numero_afip}`, M + 360, y + 16)
    }

    // ════════════════════════════════════════════════════════
    // PIE
    // ════════════════════════════════════════════════════════

    const pieY = doc.page.height - 36
    doc.rect(0, pieY, PW, 36).fill(AZUL)
    doc.fontSize(7).font('Helvetica').fillColor('rgba(255,255,255,0.55)')
       .text(
         `${empresa?.razon_social ?? ''} — CUIT ${empresa?.cuit ?? ''}  |  ${empresa?.email ?? ''}  |  ${empresa?.telefono ?? ''}`,
         M, pieY + 13, { width: ANCHO, align: 'center' }
       )

    doc.end()
  })
}
