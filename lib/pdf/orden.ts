// ============================================================
// /lib/pdf/orden.ts
// Generador de PDF para Órdenes de Servicio — PDFKit
// Formato A4: encabezado, datos del cliente, equipo técnico,
// descripción técnica, avance y cierre.
// ============================================================

import PDFDocument from 'pdfkit'
import type { SupabaseClient } from '@supabase/supabase-js'

const fmtF = (iso: string | null) =>
  iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) : '—'

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE:   'PENDIENTE',
  EN_PROGRESO: 'EN PROGRESO',
  COMPLETADA:  'COMPLETADA',
  CANCELADA:   'CANCELADA',
}

const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE:   '#f59e0b',
  EN_PROGRESO: '#3b82f6',
  COMPLETADA:  '#16a34a',
  CANCELADA:   '#dc2626',
}

export async function generarPDFOrden(
  supabase: SupabaseClient,
  id: string,
  _opciones?: Record<string, unknown>
): Promise<Buffer> {

  const { data: orden } = await supabase
    .from('ordenes_servicio')
    .select(`
      *,
      cliente:clientes(razon_social, cuit, condicion_iva, email, telefono),
      direccion:clientes_direcciones(etiqueta, calle, numero, ciudad, provincia),
      presupuesto:presupuestos(numero),
      tecnicos:ordenes_tecnicos(*)
    `)
    .eq('id', id)
    .single()

  if (!orden) throw new Error('Orden de servicio no encontrada')

  const { data: empresa } = await supabase
    .from('configuracion_empresa')
    .select('*')
    .single()

  const tecnicos = orden.tecnicos ?? []

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, info: {
      Title: `OS ${orden.numero}`,
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
    const estadoColor = ESTADO_COLOR[orden.estado] ?? GRIS

    // ════════════════════════════════════════════════════════
    // ENCABEZADO
    // ════════════════════════════════════════════════════════

    doc.rect(0, 0, PW, 110).fill(AZUL)

    // Empresa (izquierda)
    doc.fillColor('white').fontSize(20).font('Helvetica-Bold')
       .text(empresa?.nombre_fantasia ?? 'HEXA', M, 22)
    doc.fontSize(7.5).font('Helvetica')
       .text(empresa?.razon_social ?? '', M, 48)
       .text(`CUIT: ${empresa?.cuit ?? ''}`, M, 59)
       .text(empresa?.domicilio_fiscal ?? '', M, 70)

    // Tipo + número (derecha)
    const rX = PW / 2 + 10
    const rW  = PW - M - rX
    doc.fontSize(10).font('Helvetica-Bold').fillColor('rgba(255,255,255,0.6)')
       .text('ORDEN DE SERVICIO', rX, 18, { width: rW, align: 'right' })
    doc.fontSize(22).font('Helvetica-Bold').fillColor('white')
       .text(orden.numero, rX, 34, { width: rW, align: 'right' })

    // Badge estado
    const badgeW = 100
    const badgeX = PW - M - badgeW
    doc.rect(badgeX, 68, badgeW, 20).fill(estadoColor)
    doc.fontSize(8).font('Helvetica-Bold').fillColor('white')
       .text(ESTADO_LABEL[orden.estado] ?? orden.estado, badgeX, 73, { width: badgeW, align: 'center' })

    let y = 126

    // ════════════════════════════════════════════════════════
    // DATOS CLIENTE + FECHAS (grid 2 columnas)
    // ════════════════════════════════════════════════════════

    const mitad = (ANCHO - 12) / 2

    // Cliente
    doc.rect(M, y, mitad, 72).stroke(LINEA)
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRIS)
       .text('CLIENTE', M + 8, y + 6)
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#111827')
       .text(orden.cliente?.razon_social ?? '—', M + 8, y + 18, { width: mitad - 16 })
    doc.fontSize(8).font('Helvetica').fillColor(GRIS)
    if (orden.cliente?.cuit)
       doc.text(`CUIT: ${orden.cliente.cuit}`, M + 8, y + 33)
    if (orden.cliente?.email)
       doc.text(orden.cliente.email, M + 8, y + 44)
    if (orden.cliente?.telefono)
       doc.text(`Tel: ${orden.cliente.telefono}`, M + 8, y + 55)

    // Fechas + avance
    const rCol = M + mitad + 12
    doc.rect(rCol, y, mitad, 72).stroke(LINEA)
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRIS)
       .text('FECHAS Y AVANCE', rCol + 8, y + 6)

    const datosF = [
      { label: 'Inicio:',       val: fmtF(orden.fecha_inicio) },
      { label: 'Fin estimado:', val: fmtF(orden.fecha_fin_estimada) },
      { label: 'Fin real:',     val: fmtF(orden.fecha_fin_real) },
    ]
    datosF.forEach((d, i) => {
      doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#374151')
         .text(d.label, rCol + 8, y + 18 + i * 13)
      doc.font('Helvetica').fillColor(GRIS)
         .text(d.val, rCol + 80, y + 18 + i * 13)
    })

    // Barra de avance
    const barY = y + 57
    const barW = mitad - 16
    const pct = orden.porcentaje_avance ?? 0
    doc.rect(rCol + 8, barY, barW, 7).fill('#f1f5f9')
    doc.rect(rCol + 8, barY, barW * (pct / 100), 7)
       .fill(pct >= 100 ? '#16a34a' : '#3b82f6')
    doc.fontSize(7).font('Helvetica-Bold').fillColor(GRIS)
       .text(`${pct}%`, rCol + barW + 12, barY - 1)

    // Presupuesto vinculado
    if (orden.presupuesto?.numero) {
      doc.fontSize(7).font('Helvetica').fillColor(GRIS)
         .text(`Presupuesto: ${orden.presupuesto.numero}`, M + 8, y + 80)
    }

    y += 88

    // ════════════════════════════════════════════════════════
    // OBJETO DEL SERVICIO
    // ════════════════════════════════════════════════════════

    const seccion = (titulo: string, offsetY: number) => {
      doc.fillColor(AZUL).fontSize(8).font('Helvetica-Bold')
         .text(titulo, M, offsetY)
      doc.moveTo(M, offsetY + 12).lineTo(M + ANCHO, offsetY + 12)
         .strokeColor(LINEA).lineWidth(0.5).stroke()
      return offsetY + 18
    }

    y = seccion('OBJETO DEL SERVICIO', y)
    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold')
       .text(orden.titulo ?? '', M, y, { width: ANCHO })
    y += doc.heightOfString(orden.titulo ?? '', { width: ANCHO }) + 6

    if (orden.descripcion) {
      doc.fontSize(8.5).font('Helvetica').fillColor(GRIS)
         .text(orden.descripcion, M, y, { width: ANCHO })
      y += doc.heightOfString(orden.descripcion, { width: ANCHO }) + 8
    }

    // ════════════════════════════════════════════════════════
    // OBJETIVO TÉCNICO
    // ════════════════════════════════════════════════════════

    if (orden.objetivo_tecnico) {
      if (y + 40 > doc.page.height - 100) { doc.addPage(); y = M }
      y = seccion('OBJETIVO TÉCNICO', y)
      doc.fontSize(8.5).font('Helvetica').fillColor('#374151')
         .text(orden.objetivo_tecnico, M, y, { width: ANCHO })
      y += doc.heightOfString(orden.objetivo_tecnico, { width: ANCHO }) + 12
    }

    // ════════════════════════════════════════════════════════
    // DIRECCIÓN DE TRABAJO
    // ════════════════════════════════════════════════════════

    const dir = orden.direccion
    if (dir) {
      if (y + 30 > doc.page.height - 100) { doc.addPage(); y = M }
      y = seccion('DIRECCIÓN DE TRABAJO', y)
      doc.fontSize(8.5).font('Helvetica').fillColor(GRIS)
         .text(`${dir.etiqueta}: ${dir.calle} ${dir.numero ?? ''}, ${dir.ciudad}, ${dir.provincia}`, M, y)
      y += 18
    }

    // ════════════════════════════════════════════════════════
    // EQUIPO TÉCNICO
    // ════════════════════════════════════════════════════════

    if (tecnicos.length > 0) {
      if (y + 30 > doc.page.height - 100) { doc.addPage(); y = M }
      y = seccion('EQUIPO TÉCNICO', y)

      doc.rect(M, y, ANCHO, 16).fill('#f1f5f9')
      doc.fontSize(7).font('Helvetica-Bold').fillColor(AZUL)
         .text('Nombre', M + 6, y + 4)
         .text('Rol', M + ANCHO * 0.35 + 6, y + 4)
         .text('Desde', M + ANCHO * 0.6 + 6, y + 4)
         .text('Hasta', M + ANCHO * 0.8 + 6, y + 4)
      y += 16

      for (const t of tecnicos) {
        if (y + 14 > doc.page.height - 80) { doc.addPage(); y = M }
        doc.fontSize(7.5).font('Helvetica').fillColor('#374151')
           .text(t.nombre, M + 6, y + 2, { width: ANCHO * 0.32, ellipsis: true })
           .text(t.rol ?? '—', M + ANCHO * 0.35 + 6, y + 2, { width: ANCHO * 0.22 })
           .text(fmtF(t.fecha_desde), M + ANCHO * 0.6 + 6, y + 2, { width: ANCHO * 0.18 })
           .text(fmtF(t.fecha_hasta), M + ANCHO * 0.8 + 6, y + 2)
        y += 14
        doc.moveTo(M, y).lineTo(M + ANCHO, y).strokeColor(LINEA).lineWidth(0.3).stroke()
      }
      y += 8
    }

    // ════════════════════════════════════════════════════════
    // NOTAS TÉCNICAS + OBSERVACIONES DE CIERRE
    // ════════════════════════════════════════════════════════

    if (orden.notas_tecnicas) {
      if (y + 30 > doc.page.height - 100) { doc.addPage(); y = M }
      y = seccion('NOTAS TÉCNICAS', y)
      doc.fontSize(8).font('Helvetica').fillColor(GRIS)
         .text(orden.notas_tecnicas, M, y, { width: ANCHO })
      y += doc.heightOfString(orden.notas_tecnicas, { width: ANCHO }) + 12
    }

    if (orden.observaciones_cierre) {
      if (y + 30 > doc.page.height - 100) { doc.addPage(); y = M }
      doc.rect(M, y, ANCHO, 8).fill('#dcfce7')
      doc.fillColor('#15803d').fontSize(7).font('Helvetica-Bold')
         .text('OBSERVACIONES DE CIERRE', M + 6, y + 1)
      y += 14
      doc.fontSize(8.5).font('Helvetica').fillColor('#166534')
         .text(orden.observaciones_cierre, M, y, { width: ANCHO })
      y += doc.heightOfString(orden.observaciones_cierre, { width: ANCHO }) + 12
    }

    // ════════════════════════════════════════════════════════
    // FIRMA CLIENTE
    // ════════════════════════════════════════════════════════

    // Si el contenido llegó muy abajo, agregar página nueva para dejar espacio a las firmas
    if (y > doc.page.height - 120) { doc.addPage(); y = M }

    const firmaY = doc.page.height - 90
    doc.moveTo(M + 30, firmaY).lineTo(M + 210, firmaY).strokeColor(LINEA).lineWidth(0.8).stroke()
    doc.moveTo(PW - M - 210, firmaY).lineTo(PW - M - 30, firmaY).strokeColor(LINEA).stroke()
    doc.fontSize(7).font('Helvetica').fillColor(GRIS)
       .text('Firma y aclaración TÉCNICO', M + 30, firmaY + 4, { width: 180, align: 'center' })
       .text('Firma y aclaración CLIENTE / RESPONSABLE', PW - M - 210, firmaY + 4, { width: 180, align: 'center' })

    doc.fontSize(7).fillColor(GRIS)
       .text('Fecha: ___/___/______', M + 50, firmaY + 14, { width: 140, align: 'center' })
       .text('Fecha: ___/___/______', PW - M - 190, firmaY + 14, { width: 140, align: 'center' })

    // ════════════════════════════════════════════════════════
    // PIE
    // ════════════════════════════════════════════════════════

    const pieY = doc.page.height - 36
    doc.rect(0, pieY, PW, 36).fill(AZUL)
    doc.fontSize(7).font('Helvetica').fillColor('rgba(255,255,255,0.5)')
       .text(
         `${empresa?.razon_social ?? ''} — CUIT ${empresa?.cuit ?? ''}  |  ${empresa?.email ?? ''}  |  ${empresa?.telefono ?? ''}`,
         M, pieY + 13, { width: ANCHO, align: 'center' }
       )

    doc.end()
  })
}
