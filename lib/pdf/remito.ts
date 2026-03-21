// ============================================================
// /lib/pdf/remito.ts
// Generador de PDF para Remitos — pdfkit
// Formato A4: válido para remito R legal + interno
// ============================================================

import PDFDocument from 'pdfkit'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatearMonto } from '@/lib/calculos'

type TipoRemito = 'INTERNO_ENTRADA' | 'INTERNO_SALIDA' | 'LEGAL_ENTRADA' | 'LEGAL_SALIDA'
type EstadoRemito = 'BORRADOR' | 'EMITIDO' | 'ENTREGADO' | 'ANULADO'

const TIPO_LABEL: Record<TipoRemito, string> = {
  INTERNO_ENTRADA: 'Remito Interno — Entrada',
  INTERNO_SALIDA:  'Remito Interno — Salida',
  LEGAL_ENTRADA:   'Remito Legal — Entrada',
  LEGAL_SALIDA:    'Remito R — Salida',
}

const ESTADO_LABEL: Record<EstadoRemito, string> = {
  BORRADOR: 'BORRADOR', EMITIDO: 'EMITIDO', ENTREGADO: 'ENTREGADO', ANULADO: 'ANULADO',
}

export async function generarPDFRemito(
  supabase: SupabaseClient,
  id: string,
  _opciones?: Record<string, unknown>
): Promise<Buffer> {
  // ── Datos ────────────────────────────────────────────────
  const { data: remito } = await supabase
    .from('remitos')
    .select(`
      *,
      cliente:clientes(razon_social, cuit, condicion_iva, domicilio, localidad, provincia),
      orden:ordenes_servicio(numero, titulo),
      nota_pedido:notas_pedido(numero),
      items:remitos_items(*)
    `)
    .eq('id', id)
    .single()

  if (!remito) throw new Error('Remito no encontrado')

  const { data: empresa } = await supabase
    .from('configuracion_empresa')
    .select('*')
    .single()

  const items = (remito.items ?? []).sort((a: any, b: any) => a.orden - b.orden)
  const tienePrecios = items.some((i: any) => i.precio_unitario != null)
  const totalGeneral = items.reduce((acc: number, i: any) => acc + (i.subtotal ?? 0), 0)

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title: `Remito ${remito.numero}`,
      Author: empresa?.razon_social ?? 'HEXA',
    }})

    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const M    = 50
    const ANCHO = doc.page.width - M * 2
    const AZUL  = '#1e3a5f'
    const GRIS  = '#6b7280'
    const LINEA = '#e5e7eb'
    const fmtF  = (iso: string | null) =>
      iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'

    // ── Header banda ──────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 110).fill(AZUL)

    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
       .text(empresa?.nombre_fantasia ?? 'HEXA', M, 28)
    doc.fontSize(8).font('Helvetica')
       .text(empresa?.razon_social ?? '', M, 54)
       .text(`CUIT: ${empresa?.cuit ?? ''}`, M, 65)
       .text(empresa?.domicilio_fiscal ?? '', M, 76)
       .text(`Tel: ${empresa?.telefono ?? ''} | ${empresa?.email ?? ''}`, M, 87)

    // Caja tipo de remito (derecha)
    const boxW = 180
    const boxX = doc.page.width - M - boxW
    doc.rect(boxX, 14, boxW, 82).stroke('rgba(255,255,255,0.3)')
    doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
       .text(TIPO_LABEL[remito.tipo as TipoRemito] ?? remito.tipo, boxX + 8, 20, { width: boxW - 16 })
    doc.fontSize(20).font('Helvetica-Bold')
       .text(remito.numero, boxX + 8, 38, { width: boxW - 16 })
    doc.fontSize(8).font('Helvetica')
       .text(`Fecha: ${fmtF(remito.fecha_emision)}`, boxX + 8, 66)

    // Estado banner (solo BORRADOR y ANULADO)
    if (remito.estado === 'BORRADOR' || remito.estado === 'ANULADO') {
      doc.save()
      doc.rotate(-45, { origin: [doc.page.width / 2, doc.page.height / 2] })
      doc.fontSize(60).font('Helvetica-Bold')
         .fillColor(remito.estado === 'ANULADO' ? '#ef4444' : '#94a3b8')
         .opacity(0.08)
         .text(ESTADO_LABEL[remito.estado as EstadoRemito], 0, doc.page.height / 2 - 40, { width: doc.page.width, align: 'center' })
      doc.restore()
      doc.opacity(1)
    }

    let y = 128

    // ── Receptor / Remitente ──────────────────────────────
    const mitad = ANCHO / 2 - 8
    doc.rect(M, y, mitad, 75).stroke(LINEA)
    doc.rect(M + mitad + 16, y, mitad, 75).stroke(LINEA)

    const drawBox = (xOff: number, titulo: string, lineas: string[]) => {
      doc.fontSize(7).font('Helvetica-Bold').fillColor(GRIS)
         .text(titulo, xOff + 8, y + 7)
      doc.fontSize(9).font('Helvetica').fillColor('#111827')
      lineas.forEach((l, i) => doc.text(l, xOff + 8, y + 19 + i * 12, { width: mitad - 16, ellipsis: true }))
    }

    // Remitente = empresa emisora
    drawBox(M, 'REMITENTE', [
      empresa?.razon_social ?? '—',
      `CUIT: ${empresa?.cuit ?? '—'}`,
      empresa?.domicilio_fiscal ?? '—',
    ])

    // Destinatario = cliente o proveedor
    const dest = remito.cliente
    drawBox(M + mitad + 16, 'DESTINATARIO / RECEPTOR', [
      dest?.razon_social ?? remito.proveedor ?? '—',
      dest?.cuit ? `CUIT: ${dest.cuit}` : '',
      dest ? `${dest.localidad ?? ''} ${dest.provincia ?? ''}`.trim() : '',
    ])

    y += 85

    // ── Datos de la entrega ───────────────────────────────
    if (remito.direccion_entrega || remito.transportista || remito.patente_vehiculo || remito.chofer) {
      doc.rect(M, y, ANCHO, 28).fill('#f8fafc').stroke(LINEA)
      doc.fontSize(7).font('Helvetica-Bold').fillColor(GRIS)
         .text('DATOS DE ENTREGA', M + 8, y + 4)

      const campos = [
        remito.direccion_entrega  ? `Dirección: ${remito.direccion_entrega}` : '',
        remito.transportista      ? `Transportista: ${remito.transportista}` : '',
        remito.patente_vehiculo   ? `Patente: ${remito.patente_vehiculo}` : '',
        remito.chofer             ? `Chofer: ${remito.chofer}` : '',
      ].filter(Boolean).join('   ·   ')

      doc.fontSize(8).font('Helvetica').fillColor('#374151')
         .text(campos, M + 8, y + 14, { width: ANCHO - 16, ellipsis: true })
      y += 36
    }

    // ── Vínculos ──────────────────────────────────────────
    const vinculos: string[] = []
    if (remito.orden?.numero)        vinculos.push(`OS: ${remito.orden.numero} — ${remito.orden.titulo ?? ''}`)
    if (remito.nota_pedido?.numero)  vinculos.push(`Nota de pedido: ${remito.nota_pedido.numero}`)
    if (vinculos.length) {
      doc.fontSize(8).font('Helvetica').fillColor(GRIS)
         .text(vinculos.join('   |   '), M, y, { width: ANCHO })
      y += 14
    }

    y += 6

    // ── Tabla ítems ───────────────────────────────────────
    const COL = tienePrecios
      ? { idx: M, desc: M + 26, unidad: M + ANCHO * 0.58, cant: M + ANCHO * 0.72, precio: M + ANCHO * 0.83, sub: M + ANCHO * 0.93 }
      : { idx: M, desc: M + 26, unidad: M + ANCHO * 0.72, cant: M + ANCHO * 0.86 }

    // Cabecera tabla
    doc.rect(M, y, ANCHO, 18).fill(AZUL)
    doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
    doc.text('#',            COL.idx + 2,  y + 5)
    doc.text('DESCRIPCIÓN',  COL.desc,     y + 5)
    doc.text('UNIDAD',       COL.unidad,   y + 5)
    doc.text('CANTIDAD',     COL.cant,     y + 5, { width: 60, align: 'right' })
    if (tienePrecios) {
      doc.text('PRECIO',     (COL as any).precio,  y + 5, { width: 55, align: 'right' })
      doc.text('SUBTOTAL',   (COL as any).sub,     y + 5, { width: 55, align: 'right' })
    }
    y += 20

    // Filas
    items.forEach((item: any, idx: number) => {
      const rowH = 16
      if (y + rowH > doc.page.height - 80) {
        doc.addPage()
        y = M
      }
      const bg = idx % 2 === 0 ? '#f9fafb' : 'white'
      doc.rect(M, y, ANCHO, rowH).fill(bg)
      doc.fontSize(7).font('Helvetica').fillColor('#111827')
      doc.text(String(idx + 1),    COL.idx + 2,  y + 4)
      doc.text(item.descripcion,   COL.desc,     y + 4, { width: (COL.unidad as number) - (COL.desc as number) - 6, ellipsis: true })
      doc.text(item.unidad_medida, COL.unidad,   y + 4, { width: 50 })
      doc.text(String(item.cantidad), COL.cant,  y + 4, { width: 60, align: 'right' })
      if (tienePrecios) {
        doc.text(item.precio_unitario != null ? formatearMonto(item.precio_unitario) : '—',
          (COL as any).precio, y + 4, { width: 55, align: 'right' })
        doc.text(item.subtotal != null ? formatearMonto(item.subtotal) : '—',
          (COL as any).sub, y + 4, { width: 55, align: 'right' })
      }
      doc.rect(M, y, ANCHO, rowH).stroke(LINEA)
      y += rowH
    })

    // Total
    if (tienePrecios && totalGeneral > 0) {
      y += 4
      doc.rect(M + ANCHO * 0.75, y, ANCHO * 0.25, 20).fill(AZUL)
      doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
         .text('TOTAL', M + ANCHO * 0.75 + 6, y + 5)
         .text(formatearMonto(totalGeneral), M + ANCHO * 0.75 + 6, y + 5, { width: ANCHO * 0.25 - 10, align: 'right' })
      y += 24
    }

    // ── Notas ─────────────────────────────────────────────
    if (remito.notas) {
      y += 8
      doc.rect(M, y, ANCHO, 40).fill('#fffbeb').stroke('#fcd34d')
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#92400e')
         .text('OBSERVACIONES', M + 8, y + 6)
      doc.fontSize(8).font('Helvetica').fillColor('#78350f')
         .text(remito.notas, M + 8, y + 17, { width: ANCHO - 16, ellipsis: true })
      y += 48
    }

    // ── CAE / datos AFIP (legal) ──────────────────────────
    if (remito.cae) {
      y += 8
      doc.rect(M, y, ANCHO, 30).stroke(LINEA)
      doc.fontSize(7).font('Helvetica-Bold').fillColor(GRIS)
         .text('DATOS FISCALES AFIP', M + 8, y + 5)
      doc.fontSize(8).font('Helvetica').fillColor('#111827')
         .text(`CAE: ${remito.cae}`, M + 8, y + 14)
      if (remito.cae_vencimiento)
        doc.text(`Vencimiento CAE: ${fmtF(remito.cae_vencimiento)}`, M + 160, y + 14)
      if (remito.numero_afip)
        doc.text(`Nro. AFIP: ${remito.numero_afip}`, M + 320, y + 14)
      y += 38
    }

    // ── Firmas ────────────────────────────────────────────
    const firmaY = doc.page.height - 80
    doc.moveTo(M + 30, firmaY).lineTo(M + 190, firmaY).stroke(LINEA)
    doc.moveTo(doc.page.width - M - 190, firmaY).lineTo(doc.page.width - M - 30, firmaY).stroke(LINEA)
    doc.fontSize(7).font('Helvetica').fillColor(GRIS)
       .text('Firma y aclaración REMITENTE', M + 30, firmaY + 4, { width: 160, align: 'center' })
       .text('Firma y aclaración RECEPTOR', doc.page.width - M - 190, firmaY + 4, { width: 160, align: 'center' })

    // ── Footer ────────────────────────────────────────────
    doc.rect(0, doc.page.height - 26, doc.page.width, 26).fill(AZUL)
    doc.fontSize(7).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
       .text(
         `${empresa?.razon_social ?? 'HEXA'} — CUIT ${empresa?.cuit ?? ''}  |  ${empresa?.email ?? ''}  |  ${empresa?.telefono ?? ''}`,
         M, doc.page.height - 17, { width: ANCHO, align: 'center' }
       )

    doc.end()
  })
}
