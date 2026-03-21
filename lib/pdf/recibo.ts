// ============================================================
// /lib/pdf/recibo.ts
// Generador de PDF para Recibos de cobro — PDFKit
// Formato A5 apaisado (dos copias por hoja A4):
// Original para cliente + Duplicado para archivo.
// ============================================================

import PDFDocument from 'pdfkit'
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatearMonto } from '@/lib/calculos'

const fmtF = (iso: string | null) =>
  iso ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) : '—'

const TIPO_PAGO_LABEL: Record<string, string> = {
  EFECTIVO:        'Efectivo',
  CHEQUE:          'Cheque',
  TRANSFERENCIA:   'Transferencia bancaria',
  TARJETA_DEBITO:  'Tarjeta de débito',
  TARJETA_CREDITO: 'Tarjeta de crédito',
  OTRO:            'Otro',
}

const TIPO_RECIBO_LABEL: Record<string, string> = {
  ANTICIPO:     'ANTICIPO',
  PAGO_PARCIAL: 'PAGO PARCIAL',
  PAGO_FINAL:   'PAGO FINAL',
  DEVOLUCION:   'DEVOLUCIÓN',
}

// ── Función interna para dibujar una copia del recibo ─────────

function dibujarRecibo(
  doc: PDFKit.PDFDocument,
  recibo: any,
  factura: any,
  cliente: any,
  empresa: any,
  offsetY: number,
  copia: 'ORIGINAL' | 'DUPLICADO'
) {
  const M     = 30
  const W     = doc.page.width - M * 2     // ~535px en A4
  const H     = 180                         // altura de cada copia
  const AZUL  = '#1e3a5f'
  const GRIS  = '#6b7280'
  const LINEA = '#e5e7eb'
  const VERDE = '#15803d'

  // Fondo completo de la copia
  doc.rect(M, offsetY, W, H).stroke(LINEA)

  // Banda superior
  doc.rect(M, offsetY, W, 36).fill(AZUL)

  // Empresa
  doc.fillColor('white').fontSize(13).font('Helvetica-Bold')
     .text(empresa?.nombre_fantasia ?? 'HEXA', M + 10, offsetY + 8)
  doc.fontSize(6.5).font('Helvetica').fillColor('rgba(255,255,255,0.65)')
     .text(`CUIT: ${empresa?.cuit ?? ''}  |  ${empresa?.domicilio_fiscal ?? ''}`, M + 10, offsetY + 23)

  // Título tipo recibo + número
  doc.fillColor('white').fontSize(9).font('Helvetica-Bold')
     .text('RECIBO', W - 30, offsetY + 6, { width: 60, align: 'right' })
  doc.fontSize(7).font('Helvetica').fillColor('rgba(255,255,255,0.7)')
     .text(recibo.numero, W - 30, offsetY + 18, { width: 60, align: 'right' })

  // Badge tipo recibo
  const tipoLabel = TIPO_RECIBO_LABEL[recibo.tipo] ?? recibo.tipo
  doc.rect(M + 10, offsetY + 40, 90, 14).fill(AZUL)
  doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold')
     .text(tipoLabel, M + 10, offsetY + 44, { width: 90, align: 'center' })

  // Badge COPIA
  doc.rect(W - 30, offsetY + 40, 65, 14)
     .fill(copia === 'ORIGINAL' ? VERDE : '#475569')
  doc.fillColor('white').fontSize(6.5).font('Helvetica-Bold')
     .text(copia, W - 30, offsetY + 44, { width: 65, align: 'center' })

  // ── Cuerpo ────────────────────────────────────────────────
  const bodyY = offsetY + 62

  // Columna izquierda: datos receptor + factura
  const col1W = W * 0.55

  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(GRIS)
     .text('RECIBÍ DE:', M + 10, bodyY)
  doc.fontSize(9).font('Helvetica-Bold').fillColor('#111827')
     .text(cliente?.razon_social ?? '—', M + 10, bodyY + 9, { width: col1W - 10 })
  doc.fontSize(7).font('Helvetica').fillColor(GRIS)
     .text(`CUIT: ${cliente?.cuit ?? '—'}`, M + 10, bodyY + 22)

  if (factura) {
    doc.fontSize(6.5).font('Helvetica').fillColor(GRIS)
       .text(`En concepto de: Factura ${factura.numero}`, M + 10, bodyY + 34)
  } else if (recibo.concepto) {
    doc.fontSize(6.5).font('Helvetica').fillColor(GRIS)
       .text(`Concepto: ${recibo.concepto}`, M + 10, bodyY + 34, { width: col1W - 10, ellipsis: true })
  }

  // Fecha
  doc.fontSize(6.5).font('Helvetica').fillColor(GRIS)
     .text(`Fecha: ${fmtF(recibo.fecha)}`, M + 10, bodyY + 46)

  // Medio de pago
  const medioLabel = TIPO_PAGO_LABEL[recibo.tipo_pago] ?? recibo.tipo_pago
  doc.text(`Forma de pago: ${medioLabel}`, M + 10, bodyY + 56)

  // Datos cheque (si aplica)
  if (recibo.tipo_pago === 'CHEQUE' && recibo.cheque_banco) {
    doc.text(`Banco: ${recibo.cheque_banco}   N°: ${recibo.cheque_numero ?? '—'}   Fecha: ${fmtF(recibo.cheque_fecha)}`, M + 10, bodyY + 66)
    if (recibo.cheque_titular)
       doc.text(`Titular: ${recibo.cheque_titular}`, M + 10, bodyY + 76)
  }

  // Columna derecha: MONTO GRANDE
  const col2X = M + col1W + 10
  const col2W = W - col1W - 20

  doc.rect(col2X, bodyY, col2W, 90).stroke(LINEA)
  doc.fontSize(6.5).font('Helvetica-Bold').fillColor(GRIS)
     .text('IMPORTE', col2X + 4, bodyY + 6, { width: col2W - 8, align: 'center' })

  // Monto grande
  doc.fontSize(22).font('Helvetica-Bold').fillColor(AZUL)
     .text(formatearMonto(recibo.monto), col2X + 4, bodyY + 20, { width: col2W - 8, align: 'center' })

  doc.fontSize(6.5).font('Helvetica').fillColor(GRIS)
     .text('ARS — Pesos argentinos', col2X + 4, bodyY + 52, { width: col2W - 8, align: 'center' })

  // ── Firma ─────────────────────────────────────────────────
  const firmaY = offsetY + H - 28
  doc.moveTo(M + 30, firmaY).lineTo(M + 180, firmaY).strokeColor(LINEA).stroke()
  doc.moveTo(W - 80, firmaY).lineTo(W - 30, firmaY).strokeColor(LINEA).stroke()
  doc.fontSize(6).font('Helvetica').fillColor(GRIS)
     .text('Firma y sello', M + 30, firmaY + 3, { width: 150, align: 'center' })
     .text('Aclaración', W - 80, firmaY + 3, { width: 50, align: 'center' })

  // Separador punteado entre copias (solo si es ORIGINAL)
  if (copia === 'ORIGINAL') {
    const sepY = offsetY + H + 8
    for (let x = M; x < M + W; x += 6) {
      doc.moveTo(x, sepY).lineTo(x + 3, sepY).strokeColor('#cbd5e1').lineWidth(0.5).stroke()
    }
    doc.fontSize(6).font('Helvetica').fillColor('#94a3b8')
       .text('✂  Recortar aquí', M + W / 2 - 30, sepY + 2)
  }
}

// ── Generador principal ───────────────────────────────────────

export async function generarPDFRecibo(
  supabase: SupabaseClient,
  id: string,
  _opciones?: Record<string, unknown>
): Promise<Buffer> {

  const { data: recibo } = await supabase
    .from('recibos')
    .select(`
      *,
      cliente:clientes(razon_social, cuit),
      factura:facturas(numero, tipo_comprobante, total)
    `)
    .eq('id', id)
    .single()

  if (!recibo) throw new Error('Recibo no encontrado')

  const { data: empresa } = await supabase
    .from('configuracion_empresa')
    .select('*')
    .single()

  return new Promise((resolve, reject) => {
    // A4 portrait — dos copias verticales
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: {
      Title: `Recibo ${recibo.numero}`,
      Author: empresa?.razon_social ?? 'HEXA',
    }})

    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end',  () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    const cliente = recibo.cliente
    const factura = recibo.factura

    // Original (arriba)
    dibujarRecibo(doc, recibo, factura, cliente, empresa, 40,  'ORIGINAL')
    // Duplicado (abajo)
    dibujarRecibo(doc, recibo, factura, cliente, empresa, 260, 'DUPLICADO')

    doc.end()
  })
}
