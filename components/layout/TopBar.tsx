'use client';

// ============================================================
// /components/layout/TopBar.tsx
// Barra superior: breadcrumb dinámico, notificaciones, perfil
// ============================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Bell, ChevronDown, LogOut, Settings, User, Menu } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useSidebar } from '@/lib/sidebar-context';

// ── Mapa de rutas a etiquetas legibles ────────────────────────
const RUTA_LABEL: Record<string, string> = {
  '': 'Dashboard',
  clientes: 'Clientes',
  presupuestos: 'Presupuestos',
  ordenes: 'Órdenes de Servicio',
  logistica: 'Logística',
  notas: 'Notas de Pedido',
  remitos: 'Remitos',
  facturas: 'Facturación',
  calendario: 'Calendario',
  reportes: 'Reportes',
  configuracion: 'Configuración',
  nuevo: 'Nuevo',
  nueva: 'Nueva',
  '[id]': 'Detalle',
};

const SUPERUSER_AVATAR_SRC = '/superman-logo.png';

interface ProfileData {
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  rol: string | null;
  avatar_url: string | null;
}

function getBreadcrumb(pathname: string): { label: string; href: string }[] {
  const partes = pathname.split('/').filter(Boolean);
  const crumbs = [{ label: 'Dashboard', href: '/' }];
  let ruta = '';
  for (const parte of partes) {
    ruta += `/${parte}`;
    // Si parece un UUID, mostrarlo como "Detalle"
    const esId = /^[0-9a-f-]{36}$/i.test(parte);
    crumbs.push({
      label: esId ? 'Detalle' : (RUTA_LABEL[parte] ?? parte),
      href: ruta,
    });
  }
  return crumbs;
}

function Iniciales({
  nombre,
  apellido,
  rol,
}: {
  nombre: string | null;
  apellido: string | null;
  rol?: string | null;
}) {
  const [imageError, setImageError] = useState(false);
  const rolNormalizado = (rol ?? '').trim().toLowerCase();
  const esSuperUsuario =
    rolNormalizado === 'superadmin' ||
    rolNormalizado === 'admin' ||
    rolNormalizado === 'administrador' ||
    rolNormalizado === 'superusuario' ||
    rolNormalizado === 'superuser';

  if (esSuperUsuario && !imageError) {
    return (
      <div
        className='w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden'
        title='Superadministrador'
      >
        <img
          src={SUPERUSER_AVATAR_SRC}
          alt='Superusuario'
          className='w-full h-full object-cover'
          onError={() => setImageError(true)}
        />
      </div>
    );
  }
  const ini = `${(nombre ?? '?')[0]}${(apellido ?? '')[0] ?? ''}`.toUpperCase();
  return (
    <div className='w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shadow-sm flex-shrink-0'>
      {ini}
    </div>
  );
}

export default function TopBar({ profile }: { profile: ProfileData | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const { toggle } = useSidebar();
  const [open, setOpen] = useState(false);
  const [profileState, setProfileState] = useState<ProfileData | null>(profile);
  const crumbs = getBreadcrumb(pathname);
  const perfilActivo = profileState ?? profile;
  const nombreCompleto =
    [perfilActivo?.nombre, perfilActivo?.apellido].filter(Boolean).join(' ') ||
    'Usuario';

  useEffect(() => {
    setProfileState(profile);
  }, [profile]);

  useEffect(() => {
    let cancelled = false;

    const loadProfile = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('nombre, apellido, email, rol, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (data && !cancelled) {
        setProfileState(data);
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [profile]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <header className='h-14 bg-slate-800 border-b border-slate-700 flex items-center px-4 sm:px-5 gap-2 sm:gap-4 shrink-0'>
      {/* Menu toggle para móvil */}
      <button
        onClick={toggle}
        className='md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors flex-shrink-0'
      >
        <Menu className='w-4 h-4' />
      </button>

      {/* Breadcrumb */}
      <nav className='flex-1 flex items-center gap-1.5 min-w-0'>
        {crumbs.map((c, i) => (
          <span key={c.href} className='flex items-center gap-1.5 min-w-0'>
            {i > 0 && (
              <span className='text-slate-600 text-sm select-none'>/</span>
            )}
            {i < crumbs.length - 1 ? (
              <Link
                href={c.href}
                className='text-sm text-slate-400 hover:text-slate-200 transition-colors truncate'
              >
                {c.label}
              </Link>
            ) : (
              <span className='text-sm font-semibold text-slate-100 truncate'>
                {c.label}
              </span>
            )}
          </span>
        ))}
      </nav>

      {/* Acciones */}
      <div className='flex items-center gap-2 flex-shrink-0'>
        {/* Notificaciones (placeholder — Fase 2) */}
        <button className='relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors'>
          <Bell className='w-4 h-4' />
        </button>

        {/* Perfil dropdown */}
        <div className='relative'>
          <button
            onClick={() => setOpen((v) => !v)}
            className='flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-700 transition-colors'
          >
            <Iniciales
              nombre={perfilActivo?.nombre ?? null}
              apellido={perfilActivo?.apellido ?? null}
              rol={perfilActivo?.rol ?? null}
            />
            <div className='hidden sm:block text-left'>
              <p className='text-xs font-semibold text-slate-100 leading-tight'>
                {nombreCompleto}
              </p>
              <p className='text-[10px] text-slate-400 leading-tight capitalize'>
                {perfilActivo?.rol ?? 'operador'}
              </p>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {open && (
            <>
              <div
                className='fixed inset-0 z-30'
                onClick={() => setOpen(false)}
              />
              <div className='absolute right-0 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-lg z-40 overflow-hidden py-1'>
                {/* Info usuario */}
                <div className='px-3 py-2.5 border-b border-slate-700'>
                  <p className='text-xs font-semibold text-slate-100 truncate'>
                    {nombreCompleto}
                  </p>
                  <p className='text-[11px] text-slate-400 truncate'>
                    {perfilActivo?.email ?? ''}
                  </p>
                </div>

                <Link
                  href='/configuracion'
                  onClick={() => setOpen(false)}
                  className='flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors'
                >
                  <Settings className='w-4 h-4 text-slate-400' />
                  Configuración
                </Link>

                <Link
                  href='/configuracion#perfil'
                  onClick={() => setOpen(false)}
                  className='flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors'
                >
                  <User className='w-4 h-4 text-slate-400' />
                  Mi perfil
                </Link>

                <div className='border-t border-slate-700 mt-1 pt-1'>
                  <button
                    onClick={handleLogout}
                    className='w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 transition-colors'
                  >
                    <LogOut className='w-4 h-4' />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
