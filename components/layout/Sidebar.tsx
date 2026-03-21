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
      { label: 'Notas de Pedido y Remitos', href: '/logistica', icon: Package },
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
        <div className='relative h-14 border-b border-slate-800 flex items-center px-4 transition-all duration-300'>
          <Link
            href='/'
            className={cn(
              'group flex min-w-0 items-center gap-3 transition-all duration-300',
              isCollapsed ? 'md:w-full md:justify-center' : 'flex-1 pr-10',
            )}
          >
            <div className='w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden shadow-md shadow-blue-900/30 transition-shadow group-hover:shadow-blue-700/40 flex-shrink-0 bg-grey-100'>
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
              <p className='text-slate-500 text-[10px] leading-tight'>
                Servicios Integrales
              </p>
            </div>
          </Link>
          {/* Close button for mobile */}
          <button
            onClick={close}
            className='absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0 md:hidden'
            title='Cerrar menú'
          >
            <X className='w-4 h-4 text-slate-400' />
          </button>
          {/* Collapse button for desktop */}
          <button
            onClick={toggleCollapsed}
            className='absolute right-3 top-1/2 hidden -translate-y-1/2 p-1 hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0 md:flex'
            title={isCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {isCollapsed ? (
              <ChevronRight className='w-4 h-4 text-slate-400' />
            ) : (
              <ChevronLeft className='w-4 h-4 text-slate-400' />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className='flex-1 px-3 py-3 overflow-y-auto space-y-4'>
          <style>{`
          nav::-webkit-scrollbar {
            width: 6px;
          }
          nav::-webkit-scrollbar-track {
            background: transparent;
          }
          nav::-webkit-scrollbar-thumb {
            background: #475569;
            border-radius: 3px;
          }
          nav::-webkit-scrollbar-thumb:hover {
            background: #64748b;
          }
        `}</style>
          {navGroups.map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p
                  className={`px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-600 select-none ${isCollapsed ? 'md:hidden' : ''}`}
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
                        className={cn(
                          'group flex items-center gap-3 rounded-lg text-sm transition-all duration-150',
                          isCollapsed
                            ? 'md:px-2 md:py-2 md:justify-center'
                            : 'px-3 py-2',
                          active
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/30'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                        )}
                      >
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-colors',
                            active
                              ? 'text-white'
                              : 'text-slate-500 group-hover:text-slate-300',
                          )}
                        />
                        <span
                          className={`flex-1 leading-none ${isCollapsed ? 'md:hidden' : ''}`}
                        >
                          {item.label}
                        </span>
                        {!isCollapsed ? (
                          <>
                            {item.badge && (
                              <span className='px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold leading-none'>
                                {item.badge}
                              </span>
                            )}
                            {active && (
                              <ChevronRight className='w-3 h-3 text-blue-300 shrink-0' />
                            )}
                          </>
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
              isCollapsed ? 'md:px-2 md:py-2 md:justify-center' : 'px-3 py-2',
              pathname.startsWith('/configuracion')
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200',
            )}
          >
            <Settings className='w-4 h-4 shrink-0 text-slate-500' />
            <span className={isCollapsed ? 'md:hidden' : ''}>
              Configuración
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
