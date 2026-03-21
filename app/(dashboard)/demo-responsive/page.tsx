'use client';

// ============================================================
// /app/(dashboard)/demo-responsive/page.tsx
// Página para testing responsive en diferentes breakpoints
// ============================================================

import { useState } from 'react';
import Dashboard from '@/components/modules/dashboard/Dashboard';
import { ChevronRight } from 'lucide-react';

const BREAKPOINTS = [
  { name: 'Mobile XS', width: 375, description: 'iPhone SE' },
  { name: 'Mobile SM', width: 425, description: 'iPhone Pro' },
  { name: 'Tablet', width: 768, description: 'iPad' },
  { name: 'Laptop', width: 1024, description: 'MacBook Air' },
  { name: 'Desktop', width: 1440, description: '1440p Monitor' },
  { name: 'Full', width: 2560, description: '4K Monitor' },
];

export default function ResponsivePreviewPage() {
  const [selectedBreakpoint, setSelectedBreakpoint] = useState(1024);
  const [zoom, setZoom] = useState(100);

  const currentBp = BREAKPOINTS.find((bp) => bp.width === selectedBreakpoint);
  const isSmall = selectedBreakpoint < 500;

  return (
    <div className='min-h-screen bg-slate-950 p-4'>
      <div className='max-w-full mx-auto'>
        {/* Header */}
        <div className='mb-6 bg-slate-900 border border-slate-700 rounded-xl p-4'>
          <h1 className='text-2xl font-bold text-slate-100 mb-3'>
            📱 Responsive Testing Suite
          </h1>
          <p className='text-sm text-slate-400 mb-4'>
            Selecciona un breakpoint para ver cómo se adapta el Dashboard.
            Verificá grids, altura de tarjetas, sidebar collapse y padding.
          </p>

          {/* Breakpoint Selector */}
          <div className='flex flex-wrap gap-2 mb-4'>
            {BREAKPOINTS.map((bp) => (
              <button
                key={bp.width}
                onClick={() => {
                  setSelectedBreakpoint(bp.width);
                  setZoom(bp.width < 500 ? 80 : 100);
                }}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedBreakpoint === bp.width
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                }`}
              >
                <div className='font-semibold'>{bp.name}</div>
                <div className='text-xs opacity-70'>{bp.width}px</div>
              </button>
            ))}
          </div>

          {/* Info Row */}
          <div className='flex flex-col sm:flex-row gap-3 text-xs text-slate-300'>
            <div className='px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700'>
              <span className='font-mono bg-slate-900 px-2 py-1 rounded'>
                {selectedBreakpoint}px
              </span>
              {currentBp && (
                <span className='ml-2 text-slate-400'>
                  {currentBp.description}
                </span>
              )}
            </div>

            {isSmall && (
              <div className='px-3 py-2 bg-amber-900/30 border border-amber-700 rounded-lg flex items-center gap-1'>
                <span>💡</span>
                <span>
                  Panel pequeño - scroll horizontal activado. Usa zoom:
                  <select
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className='ml-2 px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-200 text-xs'
                  >
                    <option value={60}>60%</option>
                    <option value={75}>75%</option>
                    <option value={80}>80%</option>
                    <option value={100}>100%</option>
                  </select>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard Preview */}
        <div className='bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-2xl'>
          <div className='bg-slate-800 px-4 py-3 text-xs text-slate-400 font-mono border-b border-slate-700 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <span>Preview @ {selectedBreakpoint}px</span>
              {isSmall && (
                <span className='text-amber-400 flex items-center gap-1'>
                  <ChevronRight className='w-3 h-3' /> scroll →
                </span>
              )}
            </div>
            {isSmall && <span className='text-slate-500'>zoom: {zoom}%</span>}
          </div>

          {/* Preview Container con scroll horizontal para pantallas pequeñas */}
          <div
            className={`${isSmall ? 'overflow-x-auto overscroll-x-contain' : 'overflow-hidden'} bg-slate-850`}
          >
            <div
              style={{
                width: `${selectedBreakpoint}px`,
                margin: isSmall ? '0' : '0 auto',
                transform: isSmall ? `scale(${zoom / 100})` : 'none',
                transformOrigin: 'top left',
              }}
              className='bg-slate-900'
            >
              <div className='overflow-hidden'>
                <Dashboard
                  nombreUsuario='Juan Martínez López'
                  useMocks={true}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Testing Info */}
        <div className='mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4'>
          <div className='lg:col-span-2 bg-slate-900 border border-slate-700 rounded-xl p-4'>
            <h3 className='text-sm font-semibold text-slate-100 mb-3'>
              ✅ Responsive Checklist
            </h3>
            <ul className='space-y-2 text-xs text-slate-400'>
              <li className='flex gap-2'>
                <span className='text-slate-600'>[ ]</span>
                <span>
                  <strong>Mobile XS/SM</strong> (375-425px): Sidebar oculto, 1
                  columna, botón menú visible
                </span>
              </li>
              <li className='flex gap-2'>
                <span className='text-slate-600'>[ ]</span>
                <span>
                  <strong>Tablet</strong> (768px): Sidebar oculto, 2 columnas,
                  toggle funciona
                </span>
              </li>
              <li className='flex gap-2'>
                <span className='text-slate-600'>[ ]</span>
                <span>
                  <strong>Desktop+</strong> (1024px+): Sidebar visible, 4
                  columnas, botón collapse
                </span>
              </li>
              <li className='flex gap-2'>
                <span className='text-slate-600'>[ ]</span>
                <span>Tarjetas KPI: Mismo alto en todas las resoluciones</span>
              </li>
              <li className='flex gap-2'>
                <span className='text-slate-600'>[ ]</span>
                <span>
                  Padding responsive:{' '}
                  <code className='bg-slate-800 px-1 rounded text-[10px]'>
                    p-4 sm:p-6
                  </code>
                </span>
              </li>
              <li className='flex gap-2'>
                <span className='text-slate-600'>[ ]</span>
                <span>
                  Sección actividad: Completa en móvil, 2/3 del ancho en desktop
                </span>
              </li>
              <li className='flex gap-2'>
                <span className='text-slate-600'>[ ]</span>
                <span>Quick actions: 2 cols móvil, 3 cols tablet/superior</span>
              </li>
            </ul>
          </div>

          <div className='bg-slate-900 border border-slate-700 rounded-xl p-4'>
            <h3 className='text-sm font-semibold text-slate-100 mb-3'>
              📊 Datos de Prueba
            </h3>
            <div className='space-y-3 text-xs text-slate-300'>
              <div>
                <p className='font-semibold text-slate-400'>KPIs:</p>
                <p className='text-slate-500'>12 valores</p>
              </div>
              <div>
                <p className='font-semibold text-slate-400'>Actividad:</p>
                <p className='text-slate-500'>12 registros</p>
              </div>
              <div>
                <p className='font-semibold text-slate-400'>Alertas:</p>
                <p className='text-slate-500'>3 ejemplos</p>
              </div>
              <div className='pt-2 border-t border-slate-700'>
                <p className='font-semibold text-slate-300'>
                  Total: 27 elementos
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
