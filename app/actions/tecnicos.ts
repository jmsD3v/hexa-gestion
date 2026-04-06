'use server'

// ============================================================
// /app/actions/tecnicos.ts
// Server Actions — Catálogo de Técnicos
// ============================================================

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse } from '@/types'

export type Tecnico = {
  id: string
  nombre: string
  cargo: string | null
  especialidad: string | null
  telefono: string | null
  email: string | null
  activo: boolean
  notas: string | null
  creado_en: string
}

export type CrearTecnicoDTO = Omit<Tecnico, 'id' | 'creado_en'>

// ─── Listado ──────────────────────────────────────────────────────────────────

export async function obtenerTecnicos(
  soloActivos = false
): Promise<ApiResponse<Tecnico[]>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  let query = supabase
    .from('tecnicos')
    .select('*')
    .order('nombre', { ascending: true })

  if (soloActivos) query = query.eq('activo', true)

  const { data, error } = await query

  if (error) return { data: null, error: error.message }
  return { data: data ?? [], error: null }
}

// ─── Crear ────────────────────────────────────────────────────────────────────

export async function crearTecnico(
  dto: CrearTecnicoDTO
): Promise<ApiResponse<Tecnico>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  if (!dto.nombre?.trim()) return { data: null, error: 'El nombre es requerido' }

  const { data, error } = await supabase
    .from('tecnicos')
    .insert({ ...dto, creado_por: user.id })
    .select()
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Error al crear el técnico' }

  revalidatePath('/tecnicos')
  return { data, error: null, mensaje: 'Técnico creado correctamente' }
}

// ─── Actualizar ───────────────────────────────────────────────────────────────

export async function actualizarTecnico(
  id: string,
  dto: Partial<CrearTecnicoDTO>
): Promise<ApiResponse<Tecnico>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('tecnicos')
    .update(dto)
    .eq('id', id)
    .select()
    .single()

  if (error || !data) return { data: null, error: error?.message ?? 'Error al actualizar' }

  revalidatePath('/tecnicos')
  return { data, error: null, mensaje: 'Técnico actualizado' }
}

// ─── Toggle activo ────────────────────────────────────────────────────────────

export async function toggleActivoTecnico(
  id: string,
  activo: boolean
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  const { error } = await supabase
    .from('tecnicos')
    .update({ activo })
    .eq('id', id)

  if (error) return { data: null, error: error.message }

  revalidatePath('/tecnicos')
  return { data: null, error: null, mensaje: activo ? 'Técnico activado' : 'Técnico desactivado' }
}

// ─── Eliminar ─────────────────────────────────────────────────────────────────

export async function eliminarTecnico(
  id: string
): Promise<ApiResponse<null>> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: 'No autenticado' }

  // Verificar que no tenga asignaciones activas en órdenes
  const { count } = await supabase
    .from('ordenes_tecnicos')
    .select('id', { count: 'exact', head: true })
    .eq('tecnico_catalogo_id', id)

  if ((count ?? 0) > 0) {
    return { data: null, error: 'No se puede eliminar un técnico con asignaciones en órdenes. Desactivalo en su lugar.' }
  }

  const { error } = await supabase.from('tecnicos').delete().eq('id', id)
  if (error) return { data: null, error: error.message }

  revalidatePath('/tecnicos')
  return { data: null, error: null, mensaje: 'Técnico eliminado' }
}
