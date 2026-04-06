// ============================================================
// /app/api/documentos/pdf/route.ts
// POST /api/documentos/pdf — Genera un PDF y lo devuelve
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generarPDFPresupuesto } from '@/lib/pdf/presupuesto'
import { generarPDFFactura } from '@/lib/pdf/factura'
import { generarPDFOrden } from '@/lib/pdf/orden'
import { generarPDFRemito } from '@/lib/pdf/remito'
import { generarPDFRecibo } from '@/lib/pdf/recibo'
import type { TipoPDF } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { tipo, id, opciones } = await request.json() as {
    tipo: TipoPDF
    id: string
    opciones?: Record<string, unknown>
  }

  if (!tipo || !id) {
    return NextResponse.json({ error: 'tipo e id son requeridos' }, { status: 400 })
  }

  try {
    let pdfBuffer: Buffer

    switch (tipo) {
      case 'presupuesto':
        pdfBuffer = await generarPDFPresupuesto(supabase, id, opciones)
        break
      case 'factura':
        pdfBuffer = await generarPDFFactura(supabase, id, opciones)
        break
      case 'orden_servicio':
        pdfBuffer = await generarPDFOrden(supabase, id, opciones)
        break
      case 'remito':
        pdfBuffer = await generarPDFRemito(supabase, id, opciones)
        break
      case 'recibo':
        pdfBuffer = await generarPDFRecibo(supabase, id, opciones)
        break
      default:
        return NextResponse.json({ error: `Tipo PDF no soportado: ${tipo}` }, { status: 400 })
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${tipo}-${id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[PDF ERROR]', msg)
    return NextResponse.json(
      { error: process.env.NODE_ENV === 'development' ? msg : 'Error al generar el PDF' },
      { status: 500 }
    )
  }
}
