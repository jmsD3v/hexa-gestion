// ============================================================
// lib/pdf-client.ts
// Utilidad client-side para descargar PDFs desde /api/documentos/pdf
// ============================================================

import type { TipoPDF } from '@/types/documentos'

export interface OpcionesPDF {
  incluir_costos?: boolean
  incluir_incidencias?: boolean
}

/**
 * Llama a la API de PDF, recibe el buffer y lo descarga en el browser.
 * Devuelve un string de error si falla, o null si OK.
 */
export async function descargarPDF(
  tipo: TipoPDF,
  id: string,
  nombre?: string,
  opciones?: OpcionesPDF,
): Promise<string | null> {
  try {
    const res = await fetch('/api/documentos/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo, id, opciones }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return body?.error ?? `HTTP ${res.status}`
    }

    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = nombre ?? `${tipo}-${id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
    return null
  } catch (err) {
    return err instanceof Error ? err.message : 'Error al generar PDF'
  }
}
