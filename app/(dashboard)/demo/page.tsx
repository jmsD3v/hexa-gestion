'use client';

// ============================================================
// /app/(dashboard)/demo/page.tsx
// Página de demostración con mocks completos
// ============================================================

import Dashboard from '@/components/modules/dashboard/Dashboard';

export default function DemoPage() {
  return (
    <>
      {/* Banner de Demo */}
      <div className='mb-6 px-4 sm:px-6 py-3 bg-blue-900/30 border border-blue-700 rounded-xl'>
        <div className='max-w-7xl mx-auto'>
          <p className='text-xs sm:text-sm text-blue-400 font-semibold'>
            🎨 MODO DEMO — Datos de prueba cargados desde mocks ({12 + 12 + 3}{' '}
            elementos)
          </p>
          <p className='text-xs text-blue-300 mt-1'>
            Usa esta página para testing visual, responsive design y
            screenshots. Ver{' '}
            <code className='bg-blue-950/50 px-2 py-0.5 rounded text-[11px]'>
              MOCKS-GUIDE.md
            </code>{' '}
            para más detalles.
          </p>
        </div>
      </div>

      {/* Dashboard con mocks */}
      <Dashboard nombreUsuario='Juan Martínez' useMocks={true} />
    </>
  );
}
