'use client'

// ============================================================
// /app/(auth)/login/page.tsx
// Página de inicio de sesión — Supabase Auth (email + password)
// ============================================================

import { useState, FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Building2, Mail, Lock, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const redirectTo   = searchParams.get('redirectTo') ?? '/'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password.trim()) {
      setError('Completá todos los campos')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    setLoading(false)

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        setError('Email o contraseña incorrectos')
      } else if (authError.message.includes('Email not confirmed')) {
        setError('Confirmá tu email antes de ingresar')
      } else {
        setError('Error al iniciar sesión. Intentá de nuevo.')
      }
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">

      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl items-center justify-center shadow-lg shadow-blue-900/40 mb-4">
          <Building2 className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">HEXA</h1>
        <p className="text-slate-400 text-sm mt-1">Servicios Integrales SAS</p>
      </div>

      {/* Card */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-7 shadow-2xl">
        <h2 className="text-lg font-semibold text-white mb-1">Iniciar sesión</h2>
        <p className="text-slate-400 text-sm mb-6">Acceso al sistema de gestión</p>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="usuario@hexa.com.ar"
                autoComplete="email"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full pl-9 pr-3 py-2.5 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-blue-900/30 mt-2"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Ingresando…</>
            ) : 'Ingresar'}
          </button>
        </form>
      </div>

      <p className="text-center text-xs text-slate-600 mt-6">
        Sistema de uso interno — acceso restringido
      </p>
    </div>
  )
}
