'use server';

// ============================================================
// /app/actions/configuracion.ts
// Server Actions — Configuración de empresa
// ============================================================

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
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

// ══════════════════════════════════════════════════════════════
// GESTIÓN DE EQUIPO — usa Supabase Auth Admin API
// ══════════════════════════════════════════════════════════════

export interface UsuarioEquipo {
  id: string;
  email: string;
  nombre_completo: string | null;
  rol: string;
  activo: boolean;
  ultimo_acceso: string | null;
  creado_en: string;
}

async function getAdminContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, miRol: null, error: 'No autenticado' as string };

  const { data: profile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  const miRol = (profile?.rol ?? '') as string;
  if (!['superadmin', 'admin'].includes(miRol)) {
    return { user: null, miRol: null, error: 'Sin permisos suficientes' as string };
  }

  return { user, miRol, error: null as null };
}

export async function listarUsuarios(): Promise<ApiResponse<UsuarioEquipo[]>> {
  const { user, error: authError } = await getAdminContext();
  if (authError || !user) return { data: null, error: authError ?? 'Error' };

  const adminClient = createAdminClient();

  const { data: authData, error: listError } =
    await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) return { data: null, error: listError.message };

  const { data: profiles } = await adminClient
    .from('profiles')
    .select('id, nombre, apellido, rol, activo');

  const profilesMap = new Map(
    (profiles ?? []).map((p: {
      id: string;
      nombre: string | null;
      apellido: string | null;
      rol: string | null;
      activo: boolean | null;
    }) => [p.id, p]),
  );

  const ahora = new Date();

  type AuthUser = { id: string; email?: string; banned_until?: string | null; last_sign_in_at?: string | null; created_at: string };
  const usuarios: UsuarioEquipo[] = (authData.users as AuthUser[]).map((u) => {
    const p = profilesMap.get(u.id) as {
      nombre: string | null;
      apellido: string | null;
      rol: string | null;
      activo: boolean | null;
    } | undefined;

    const bannedUntil = u.banned_until ? new Date(u.banned_until) : null;
    const estaBaneado = bannedUntil !== null && bannedUntil > ahora;

    return {
      id: u.id,
      email: u.email ?? '',
      nombre_completo:
        p ? [p.nombre, p.apellido].filter(Boolean).join(' ').trim() || null : null,
      rol: p?.rol ?? 'operador',
      activo: !estaBaneado && (p?.activo ?? true),
      ultimo_acceso: u.last_sign_in_at ?? null,
      creado_en: u.created_at,
    };
  });

  return { data: usuarios, error: null };
}

export async function invitarUsuario(dto: {
  email: string;
  rol: string;
}): Promise<ApiResponse<null>> {
  const { user, miRol, error: authError } = await getAdminContext();
  if (authError || !user) return { data: null, error: authError ?? 'Error' };

  if (!dto.email?.trim()) return { data: null, error: 'El email es requerido' };

  const rolesValidos = ['superadmin', 'admin', 'supervisor', 'operador', 'viewer'];
  if (!rolesValidos.includes(dto.rol)) return { data: null, error: 'Rol inválido' };

  if (dto.rol === 'superadmin' && miRol !== 'superadmin') {
    return { data: null, error: 'Solo el superadmin puede asignar ese rol' };
  }

  const adminClient = createAdminClient();
  const email = dto.email.trim().toLowerCase();

  const { data: inviteData, error: inviteError } =
    await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { rol: dto.rol },
    });

  if (inviteError) return { data: null, error: inviteError.message };

  // Pre-crear profile con el rol correcto para que ensureProfileForUser no lo pise
  if (inviteData?.user) {
    await adminClient.from('profiles').upsert({
      id: inviteData.user.id,
      email,
      nombre: 'Pendiente',
      apellido: '',
      rol: dto.rol,
      activo: true,
    });
  }

  await registrarAudit(createClient(), {
    usuario_id: user.id,
    accion: 'CREATE',
    entidad_tipo: 'invitacion_usuario',
    entidad_id: inviteData?.user?.id ?? email,
    datos_nuevos: { email, rol: dto.rol },
  });

  revalidatePath('/configuracion');
  return { data: null, error: null, mensaje: `Invitación enviada a ${email}` };
}

export async function actualizarRolUsuario(dto: {
  usuarioId: string;
  rol: string;
}): Promise<ApiResponse<null>> {
  const { user, miRol, error: authError } = await getAdminContext();
  if (authError || !user) return { data: null, error: authError ?? 'Error' };

  if (dto.usuarioId === user.id) {
    return { data: null, error: 'No podés cambiar tu propio rol' };
  }

  const rolesValidos = ['superadmin', 'admin', 'supervisor', 'operador', 'viewer'];
  if (!rolesValidos.includes(dto.rol)) return { data: null, error: 'Rol inválido' };

  if (dto.rol === 'superadmin' && miRol !== 'superadmin') {
    return { data: null, error: 'Solo el superadmin puede asignar ese rol' };
  }

  const adminClient = createAdminClient();

  if (miRol !== 'superadmin') {
    const { data: targetProfile } = await adminClient
      .from('profiles')
      .select('rol')
      .eq('id', dto.usuarioId)
      .single();
    if (targetProfile?.rol === 'superadmin') {
      return { data: null, error: 'No podés modificar el rol de un superadmin' };
    }
  }

  const { error } = await adminClient
    .from('profiles')
    .update({ rol: dto.rol, actualizado_en: new Date().toISOString() })
    .eq('id', dto.usuarioId);

  if (error) return { data: null, error: error.message };

  await registrarAudit(createClient(), {
    usuario_id: user.id,
    accion: 'UPDATE',
    entidad_tipo: 'profile_rol',
    entidad_id: dto.usuarioId,
    datos_nuevos: { rol: dto.rol },
  });

  revalidatePath('/configuracion');
  return { data: null, error: null, mensaje: 'Rol actualizado' };
}

export async function desactivarUsuario(dto: {
  usuarioId: string;
}): Promise<ApiResponse<null>> {
  const { user, error: authError } = await getAdminContext();
  if (authError || !user) return { data: null, error: authError ?? 'Error' };

  if (dto.usuarioId === user.id) {
    return { data: null, error: 'No podés desactivarte a vos mismo' };
  }

  const adminClient = createAdminClient();

  const { error: banError } = await adminClient.auth.admin.updateUserById(
    dto.usuarioId,
    { ban_duration: '876600h' },
  );
  if (banError) return { data: null, error: banError.message };

  await adminClient
    .from('profiles')
    .update({ activo: false, actualizado_en: new Date().toISOString() })
    .eq('id', dto.usuarioId);

  await registrarAudit(createClient(), {
    usuario_id: user.id,
    accion: 'UPDATE',
    entidad_tipo: 'usuario_estado',
    entidad_id: dto.usuarioId,
    datos_nuevos: { activo: false },
  });

  revalidatePath('/configuracion');
  return { data: null, error: null, mensaje: 'Usuario desactivado' };
}

export async function reactivarUsuario(dto: {
  usuarioId: string;
}): Promise<ApiResponse<null>> {
  const { user, error: authError } = await getAdminContext();
  if (authError || !user) return { data: null, error: authError ?? 'Error' };

  const adminClient = createAdminClient();

  const { error: unbanError } = await adminClient.auth.admin.updateUserById(
    dto.usuarioId,
    { ban_duration: 'none' },
  );
  if (unbanError) return { data: null, error: unbanError.message };

  await adminClient
    .from('profiles')
    .update({ activo: true, actualizado_en: new Date().toISOString() })
    .eq('id', dto.usuarioId);

  await registrarAudit(createClient(), {
    usuario_id: user.id,
    accion: 'UPDATE',
    entidad_tipo: 'usuario_estado',
    entidad_id: dto.usuarioId,
    datos_nuevos: { activo: true },
  });

  revalidatePath('/configuracion');
  return { data: null, error: null, mensaje: 'Usuario reactivado' };
}

export async function eliminarUsuario(dto: {
  usuarioId: string;
}): Promise<ApiResponse<null>> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: 'No autenticado' };

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('rol')
    .eq('id', user.id)
    .single();

  if (myProfile?.rol !== 'superadmin') {
    return { data: null, error: 'Solo el superadmin puede eliminar usuarios' };
  }

  if (dto.usuarioId === user.id) {
    return { data: null, error: 'No podés eliminarte a vos mismo' };
  }

  const adminClient = createAdminClient();

  // Eliminar profile primero (por si no hay CASCADE configurado)
  await adminClient.from('profiles').delete().eq('id', dto.usuarioId);

  const { error } = await adminClient.auth.admin.deleteUser(dto.usuarioId);
  if (error) return { data: null, error: error.message };

  await registrarAudit(supabase, {
    usuario_id: user.id,
    accion: 'DELETE',
    entidad_tipo: 'usuario',
    entidad_id: dto.usuarioId,
    datos_nuevos: {},
  });

  revalidatePath('/configuracion');
  return { data: null, error: null, mensaje: 'Usuario eliminado' };
}
