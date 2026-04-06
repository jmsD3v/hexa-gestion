'use client';

// ============================================================
// /components/layout/Sidebar.tsx — v3 (Responsive + Collapsible)
// Navegación lateral con grupos y rutas unificadas
// ============================================================

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileText,
  ClipboardList,
  Package,
  Receipt,
  Calendar,
  BarChart3,
  Settings,
  ChevronRight,
  X,
  ChevronLeft,
  HardHat,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSidebar } from '@/lib/sidebar-context';

type NavItem = {
  label: string;
  href: string;
  icon: React.FC<{ className?: string }>;
  badge?: string;
  exact?: boolean;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: 'Comercial',
    items: [
      { label: 'Clientes', href: '/clientes', icon: Users },
      { label: 'Presupuestos', href: '/presupuestos', icon: FileText },
      { label: 'Órdenes de Servicio', href: '/ordenes', icon: ClipboardList },
    ],
  },
  {
    label: 'Logística',
    items: [
      { label: 'Notas y Remitos', href: '/logistica', icon: Package },
      { label: 'Técnicos', href: '/tecnicos', icon: HardHat },
    ],
  },
  {
    label: 'Finanzas',
    items: [{ label: 'Facturación', href: '/facturas', icon: Receipt }],
  },
  {
    label: 'Planificación',
    items: [
      { label: 'Calendario', href: '/calendario', icon: Calendar },
      { label: 'Reportes', href: '/reportes', icon: BarChart3 },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { isOpen, close, isCollapsed, toggleCollapsed } = useSidebar();

  const isActive = (item: NavItem) =>
    item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + '/');

  return (
    <>
      {/* Overlay para móvil cuando está abierto */}
      {isOpen && (
        <div
          className='fixed inset-0 bg-black/50 z-40 md:hidden'
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed md:relative bg-slate-900 text-white flex flex-col h-full shrink-0 border-r border-slate-800 z-50 transition-all duration-300',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0 w-60 md:w-auto',
          isCollapsed ? 'md:w-20' : 'md:w-60',
        )}
      >
        {/* Logo */}
        <div className='h-14 border-b border-slate-800 flex items-center px-2 gap-1 transition-all duration-300'>
          <Link
            href='/'
            className={cn(
              'group flex min-w-0 items-center gap-3 px-1 flex-1 transition-all duration-300',
              isCollapsed ? 'md:justify-center' : '',
            )}
          >
            <div className='w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden shadow-md shadow-emerald-900/40 transition-shadow group-hover:shadow-emerald-800/60 flex-shrink-0 bg-slate-800'>
              <Image
                src='/HEXA-logo-white.webp'
                alt='HEXA'
                width={32}
                height={32}
                className='h-full w-full object-cover'
                priority
              />
            </div>
            <div className={`min-w-0 ${isCollapsed ? 'md:hidden' : ''}`}>
              <p className='font-bold text-sm tracking-wide leading-tight text-white'>
                HEXA
              </p>
              <p className='text-slate-500 text-xs leading-tight'>
                Servicios Integrales
              </p>
            </div>
          </Link>
          {/* Close button — mobile only */}
          <button
            onClick={close}
            className='p-1.5 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0 md:hidden'
            aria-label='Cerrar menú lateral'
          >
            <X className='w-4 h-4 text-slate-400' aria-hidden='true' />
          </button>
          {/* Collapse button — desktop only */}
          <button
            onClick={toggleCollapsed}
            className='p-1.5 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0 hidden md:flex'
            aria-label={isCollapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className='w-4 h-4 text-slate-400' />
            ) : (
              <ChevronLeft className='w-4 h-4 text-slate-400' />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className='flex-1 px-3 py-3 overflow-y-auto space-y-4' aria-label='Navegación principal'>
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p
                  className={`px-3 mb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-600 select-none ${isCollapsed ? 'md:hidden' : ''}`}
                >
                  {group.label}
                </p>
              )}
              <ul className='space-y-0.5'>
                {group.items.map((item) => {
                  const active = isActive(item);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group flex items-center gap-3 rounded-lg text-sm transition-all duration-150',
                          'px-3 py-2',
                          isCollapsed && 'md:px-2 md:py-2 md:justify-center',
                          active
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent',
                        )}
                      >
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-colors',
                            active
                              ? 'text-emerald-400'
                              : 'text-slate-500 group-hover:text-slate-300',
                          )}
                          aria-hidden='true'
                        />
                        <span
                          className={`flex-1 leading-none truncate ${isCollapsed ? 'md:hidden' : ''}`}
                        >
                          {item.label}
                        </span>
                        {!isCollapsed && item.badge ? (
                          <span className='px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold leading-none shrink-0'>
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className='px-3 py-3 border-t border-slate-800'>
          <Link
            href='/configuracion'
            onClick={close}
            className={cn(
              'flex items-center gap-3 rounded-lg text-sm transition-all duration-150',
              'px-3 py-2',
              isCollapsed && 'md:px-2 md:py-2 md:justify-center',
              pathname.startsWith('/configuracion')
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent',
            )}
          >
            <Settings className={cn('w-4 h-4 shrink-0 transition-colors', pathname.startsWith('/configuracion') ? 'text-emerald-400' : 'text-slate-500')} />
            <span className={`truncate ${isCollapsed ? 'md:hidden' : ''}`}>
              Configuración
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
