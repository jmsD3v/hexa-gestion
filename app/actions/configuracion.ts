'use server';

// ============================================================
// /app/actions/configuracion.ts
// Server Actions — Configuración de empresa
// ============================================================

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { registrarAudit } from '@/lib/audit';
import { ensureProfileForUser } from '@/lib/profiles';
import type { ApiResponse } from '@/types';

export interface ConfiguracionEmpresa {
  id: string;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string;
  condicion_iva: string;
  ingresos_brutos: string | null;
  domicilio_fiscal: string | null;
  telefono: string | null;
  email: string | null;
  sitio_web: string | null;
  logo_url: string | null;
  punto_venta_default: number;
  pie_pagina_pdf: string | null;
  color_primario: string | null;
}

export interface ActualizarConfigDTO {
  razon_social?: string;
  nombre_fantasia?: string;
  cuit?: string;
  condicion_iva?: string;
  ingresos_brutos?: string;
  domicilio_fiscal?: string;
  telefono?: string;
  email?: string;
  sitio_web?: string;
  logo_url?: string;
  punto_venta_default?: number;
  pie_pagina_pdf?: string;
  color_primario?: string;
}

export async function obtenerConfiguracion(): Promise<
  ApiResponse<ConfiguracionEmpresa>
> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const { data, error } = await supabase
    .from('configuracion_empresa')
    .select('*')
    .single();

  if (error || !data) {
    // Si no existe, devolver defaults del schema
    return {
      data: {
        id: '',
        razon_social: 'Hexa Servicios Integrales SAS',
        nombre_fantasia: 'HEXA',
        cuit: '30-71703418-6',
        condicion_iva: 'RESPONSABLE_INSCRIPTO',
        ingresos_brutos: null,
        domicilio_fiscal: null,
        telefono: null,
        email: null,
        sitio_web: null,
        logo_url: null,
        punto_venta_default: 1,
        pie_pagina_pdf: null,
        color_primario: '#1e3a5f',
      },
      error: null,
    };
  }

  return { data, error: null };
}

export async function guardarConfiguracion(
  dto: ActualizarConfigDTO,
): Promise<ApiResponse<null>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  if (dto.razon_social !== undefined && !dto.razon_social.trim())
    return { data: null, error: 'La razón social es requerida' };
  if (dto.cuit !== undefined && !dto.cuit.trim())
    return { data: null, error: 'El CUIT es requerido' };

  const { data: existente } = await supabase
    .from('configuracion_empresa')
    .select('id')
    .single();

  const payload = {
    ...dto,
    actualizado_por: user.id,
    actualizado_en: new Date().toISOString(),
  };

  let error;
  if (existente?.id) {
    ({ error } = await supabase
      .from('configuracion_empresa')
      .update(payload)
      .eq('id', existente.id));
  } else {
    ({ error } = await supabase.from('configuracion_empresa').insert(payload));
  }

  if (error) return { data: null, error: error.message };

  await registrarAudit(supabase, {
    usuario_id: user.id,
    accion: 'UPDATE',
    entidad_tipo: 'configuracion_empresa',
    entidad_id: existente?.id ?? 'new',
    datos_nuevos: dto as Record<string, unknown>,
  });

  revalidatePath('/configuracion');
  revalidatePath('/'); // Dashboard usa datos empresa
  return { data: null, error: null, mensaje: 'Configuración guardada' };
}

// ── Perfil de usuario ─────────────────────────────────────────

export interface PerfilUsuario {
  id: string;
  nombre_completo: string | null;
  email: string | null;
  rol: string | null;
  avatar_url: string | null;
}

export async function obtenerPerfil(): Promise<ApiResponse<PerfilUsuario>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const data = await ensureProfileForUser({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  });

  return {
    data: {
      id: user.id,
      nombre_completo:
        [data?.nombre, data?.apellido].filter(Boolean).join(' ').trim() || null,
      email: user.email ?? null,
      rol: data?.rol ?? null,
      avatar_url: data?.avatar_url ?? null,
    },
    error: null,
  };
}

export async function actualizarPerfil(cambios: {
  nombre_completo?: string;
  avatar_url?: string;
}): Promise<ApiResponse<null>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const perfilAsegurado = await ensureProfileForUser({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  });

  if (!perfilAsegurado) {
    return { data: null, error: 'No se pudo preparar el perfil del usuario' };
  }

  const payload: Record<string, unknown> = {
    actualizado_en: new Date().toISOString(),
  };

  if (typeof cambios.avatar_url !== 'undefined') {
    payload.avatar_url = cambios.avatar_url;
  }

  if (typeof cambios.nombre_completo !== 'undefined') {
    const limpio = cambios.nombre_completo.trim().replace(/\s+/g, ' ');
    const partes = limpio ? limpio.split(' ') : [];
    payload.nombre = partes[0] ?? 'Usuario';
    payload.apellido = partes.length > 1 ? partes.slice(1).join(' ') : '-';
  }

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id);

  if (error) return { data: null, error: error.message };
  revalidatePath('/configuracion');
  revalidatePath('/');
  return { data: null, error: null, mensaje: 'Perfil actualizado' };
}
