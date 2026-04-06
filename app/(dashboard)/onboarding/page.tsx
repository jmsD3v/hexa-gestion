'use client';

// ============================================================
// app/(dashboard)/onboarding/page.tsx
// Pantalla de bienvenida para usuarios invitados que deben
// completar su nombre antes de usar el sistema.
// ============================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { actualizarPerfil, obtenerPerfil } from '@/app/actions/configuracion';

export default function OnboardingPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    obtenerPerfil().then((r) => {
      if (r.data) {
        setEmail(r.data.email ?? '');
        setRol(r.data.rol ?? '');
        // Si el perfil ya está completo, redirigir al dashboard
        if (r.data.nombre_completo && r.data.nombre_completo !== 'Pendiente') {
          router.replace('/');
        }
      }
    });
  }, [router]);

  const handleGuardar = async () => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio || nombreLimpio.toLowerCase() === 'pendiente') {
      setError('Ingresá tu nombre completo');
      return;
    }
    setError('');
    setGuardando(true);
    const res = await actualizarPerfil({ nombre_completo: nombreLimpio });
    setGuardando(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setListo(true);
    setTimeout(() => router.replace('/'), 1200);
  };

  const iniciales = nombre
    .trim()
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  const ROL_LABELS: Record<string, string> = {
    superadmin: 'Super Admin',
    admin:      'Administrador',
    supervisor: 'Supervisor',
    operador:   'Operador',
    viewer:     'Visualizador',
  };

  return (
    <div className='min-h-full flex items-center justify-center p-6'>
      <div className='w-full max-w-md'>

        {/* Header */}
        <div className='text-center mb-8'>
          <div className='inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/20 mb-4'>
            <User className='w-6 h-6 text-blue-400' />
          </div>
          <h1 className='text-2xl font-bold text-slate-100 mb-1'>
            ¡Bienvenido/a a HEXA!
          </h1>
          <p className='text-sm text-slate-500'>
            Antes de comenzar, completá tu nombre para que el equipo te reconozca.
          </p>
        </div>

        {/* Card */}
        <div className='bg-slate-800/60 border border-slate-700/40 rounded-2xl p-6 space-y-5'>

          {/* Avatar preview */}
          <div className='flex items-center gap-4'>
            <div className='w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-950/60 transition-all duration-200'>
              <span className='text-white font-bold text-lg'>{iniciales}</span>
            </div>
            <div>
              <div className='text-sm font-semibold text-slate-200'>
                {nombre.trim() || 'Tu nombre'}
              </div>
              <div className='text-xs text-slate-500'>{email}</div>
              {rol && (
                <span className='inline-block mt-0.5 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-400'>
                  {ROL_LABELS[rol] ?? rol}
                </span>
              )}
            </div>
          </div>

          {/* Input */}
          <div>
            <label className='block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5'>
              Nombre completo
            </label>
            <input
              type='text'
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && !guardando && handleGuardar()}
              placeholder='Ej: Juan Pérez'
              autoFocus
              className='w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-900/60 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:bg-slate-900/80 transition-all'
            />
            {error && (
              <p className='text-xs text-red-400 mt-1.5'>{error}</p>
            )}
          </div>

          {/* Email (read-only) */}
          <div>
            <label className='block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1.5'>
              Email
            </label>
            <input
              type='email'
              value={email}
              readOnly
              className='w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-700/60 bg-slate-800/40 text-slate-500 cursor-not-allowed'
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleGuardar}
            disabled={guardando || listo}
            className='w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer disabled:cursor-not-allowed'
          >
            {listo ? (
              <>
                <CheckCircle2 className='w-4 h-4' />
                Perfil guardado, ingresando…
              </>
            ) : guardando ? (
              <>
                <Loader2 className='w-4 h-4 animate-spin' />
                Guardando…
              </>
            ) : (
              <>
                Continuar al sistema
                <ArrowRight className='w-4 h-4' />
              </>
            )}
          </button>
        </div>

        <p className='text-center text-xs text-slate-700 mt-4'>
          Podés cambiar tu nombre más adelante en{' '}
          <span className='text-slate-500'>Configuración → Mi perfil</span>
        </p>
      </div>
    </div>
  );
}
