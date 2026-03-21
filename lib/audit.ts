// ============================================================
// /lib/audit.ts
// Registro de auditoría centralizado
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js'

interface RegistrarAuditParams {
  usuario_id: string
  accion: 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'PRINT' | 'SEND' | 'APPROVE'
  entidad_tipo: string
  entidad_id: string
  datos_anteriores?: Record<string, unknown> | null
  datos_nuevos?: Record<string, unknown> | null
}

/**
 * Registra una entrada en el log de auditoría.
 * No lanza errores para no interrumpir el flujo principal.
 */
export async function registrarAudit(
  supabase: SupabaseClient,
  params: RegistrarAuditParams
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      usuario_id: params.usuario_id,
      accion: params.accion,
      entidad_tipo: params.entidad_tipo,
      entidad_id: params.entidad_id,
      datos_anteriores: params.datos_anteriores ?? null,
      datos_nuevos: params.datos_nuevos ?? null,
    })
  } catch (error) {
    // Audit no debe romper el flujo
    console.error('[AUDIT ERROR]', error)
  }
}
