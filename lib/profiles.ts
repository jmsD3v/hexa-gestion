import { createAdminClient } from '@/lib/supabase/server';
import type { Profile } from '@/types/database';

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type ProfileRow = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  rol: string | null;
  avatar_url: string | null;
  activo?: boolean | null;
};

function deriveNames(user: AuthUserLike) {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (typeof metadata.full_name === 'string' && metadata.full_name.trim()) ||
    (typeof metadata.name === 'string' && metadata.name.trim()) ||
    '';
  const nameParts = fullName ? fullName.split(/\s+/) : [];
  const emailPrefix = (user.email ?? '').split('@')[0]?.trim() || 'Usuario';

  const nombre =
    (typeof metadata.nombre === 'string' && metadata.nombre.trim()) ||
    nameParts[0] ||
    emailPrefix;

  const apellido =
    (typeof metadata.apellido === 'string' && metadata.apellido.trim()) ||
    (nameParts.length > 1 ? nameParts.slice(1).join(' ') : '-');

  return { nombre, apellido };
}

export async function ensureProfileForUser(
  user: AuthUserLike,
): Promise<Profile | null> {
  const supabase = createAdminClient();

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, nombre, apellido, email, rol, avatar_url, activo')
    .eq('id', user.id)
    .maybeSingle();

  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true });

  let esUnicoUsuarioAuth = false;

  try {
    const { data: authUsersData, error: authUsersError } =
      await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 2,
      });

    if (!authUsersError) {
      const usuarios = authUsersData?.users ?? [];
      esUnicoUsuarioAuth = usuarios.length === 1 && usuarios[0]?.id === user.id;
    }
  } catch {
    esUnicoUsuarioAuth = false;
  }

  let rolObjetivo =
    existingProfile?.rol ??
    (count === 0 || esUnicoUsuarioAuth ? 'superadmin' : 'operador');

  if (esUnicoUsuarioAuth) {
    rolObjetivo = 'superadmin';
  }

  if (count === 1) {
    const { data: onlyProfile } = await supabase
      .from('profiles')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (onlyProfile?.id === user.id) {
      rolObjetivo = 'superadmin';
    }
  }

  const { nombre, apellido } = deriveNames(user);

  if (!existingProfile) {
    const { data: inserted } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        nombre,
        apellido,
        email: user.email ?? '',
        rol: rolObjetivo,
        activo: true,
      })
      .select('id, nombre, apellido, email, rol, avatar_url, activo')
      .single();

    return (inserted as Profile) ?? null;
  }

  const needsNameFix = !existingProfile.nombre || !existingProfile.apellido;
  const needsRoleFix = existingProfile.rol !== rolObjetivo;
  const needsEmailFix = !existingProfile.email && !!user.email;

  if (needsNameFix || needsRoleFix || needsEmailFix) {
    const { data: updated } = await supabase
      .from('profiles')
      .update({
        nombre: existingProfile.nombre || nombre,
        apellido: existingProfile.apellido || apellido,
        email: existingProfile.email || user.email || '',
        rol: rolObjetivo,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, nombre, apellido, email, rol, avatar_url, activo')
      .single();

    return (updated as Profile) ?? (existingProfile as Profile);
  }

  return existingProfile as Profile;
}
