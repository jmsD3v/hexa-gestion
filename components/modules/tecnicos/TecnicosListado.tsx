'use client'

// ============================================================
// components/modules/tecnicos/TecnicosListado.tsx
// Catálogo de técnicos — CRUD completo
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import {
  obtenerTecnicos,
  crearTecnico,
  actualizarTecnico,
  toggleActivoTecnico,
  eliminarTecnico,
  type Tecnico,
  type CrearTecnicoDTO,
} from '@/app/actions/tecnicos'

// ─── Constantes ───────────────────────────────────────────────────────────────

const CARGOS = [
  'Jefe Técnico',
  'Técnico Instalador',
  'Técnico de Servicio',
  'Auxiliar Técnico',
  'Supervisor',
  'Otro',
]

const CARGO_CFG: Record<string, { badge: string }> = {
  'Jefe Técnico':        { badge: 'text-purple-400 bg-purple-400/[0.08] border-purple-400/20' },
  'Técnico Instalador':  { badge: 'text-blue-400 bg-blue-400/[0.08] border-blue-400/20' },
  'Técnico de Servicio': { badge: 'text-cyan-400 bg-cyan-400/[0.08] border-cyan-400/20' },
  'Auxiliar Técnico':    { badge: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/15' },
  'Supervisor':          { badge: 'text-amber-500 bg-amber-500/[0.08] border-amber-500/20' },
  'Otro':                { badge: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/15' },
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = '13px', r = '4px' }: { w?: string; h?: string; r?: string }) {
  return <div className={`bg-slate-400/10 animate-pulse w-[${w}] h-[${h}] rounded-[${r}]`} />
}

function KPICard({
  label, value, sub, textCls = 'text-slate-400', loading,
}: {
  label: string; value: string; sub?: string; textCls?: string; loading?: boolean;
}) {
  return (
    <div className='bg-slate-900/70 border border-slate-400/10 rounded-lg backdrop-blur-xl p-4'>
      <span className='text-[10px] font-semibold tracking-widest uppercase block mb-1.5 text-slate-700'>
        {label}
      </span>
      {loading
        ? <Skeleton w='60px' h='22px' />
        : <span className={`text-xl font-black font-mono tracking-tighter block ${textCls}`}>{value}</span>
      }
      {sub && !loading && <span className='text-xs text-slate-700 mt-0.5 block'>{sub}</span>}
    </div>
  )
}

function BadgeCargo({ cargo }: { cargo: string | null }) {
  if (!cargo) return <span className='text-slate-700 text-xs'>—</span>
  const cfg = CARGO_CFG[cargo] ?? { badge: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/15' }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-2xl text-[10px] font-bold tracking-wide border whitespace-nowrap ${cfg.badge}`}>
      {cargo}
    </span>
  )
}

function BadgeActivo({ activo }: { activo: boolean }) {
  return activo
    ? <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-2xl text-[10px] font-bold tracking-wide border text-emerald-400 bg-emerald-400/[0.08] border-emerald-400/20 whitespace-nowrap'><span className='w-1 h-1 rounded-full inline-block bg-emerald-400' />Activo</span>
    : <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-2xl text-[10px] font-bold tracking-wide border text-slate-500 bg-slate-400/[0.08] border-slate-400/15 whitespace-nowrap'><span className='w-1 h-1 rounded-full inline-block bg-slate-500' />Inactivo</span>
}

function MenuAcciones({
  tecnico,
  onEdit,
  onToggle,
  onDelete,
}: {
  tecnico: Tecnico
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const item = (label: string, onClick: () => void, danger = false) => (
    <button
      key={label}
      onClick={() => { setAbierto(false); onClick() }}
      className={`flex items-center gap-2 w-full text-left px-2.5 py-1.75 rounded text-xs font-sans transition-colors duration-100 bg-transparent border-0 cursor-pointer
        ${danger ? 'text-red-400 hover:bg-red-400/5 hover:text-red-300' : 'text-slate-400 hover:bg-slate-400/5 hover:text-slate-100'}`}
    >
      {label}
    </button>
  )

  return (
    <div ref={ref} className='relative'>
      <button
        onClick={() => setAbierto(p => !p)}
        className='w-7 h-7 rounded-[7px] border border-slate-400/10 bg-transparent text-slate-600 cursor-pointer flex items-center justify-center transition-all duration-120 hover:bg-slate-400/5 hover:text-slate-400'
      >
        <svg width='13' height='13' viewBox='0 0 13 13'>
          <circle cx='6.5' cy='2.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='6.5' r='1' fill='currentColor' />
          <circle cx='6.5' cy='10.5' r='1' fill='currentColor' />
        </svg>
      </button>
      {abierto && (
        <div className='absolute right-0 top-[calc(100%+4px)] z-30 bg-slate-950 border border-slate-400/15 rounded-[9px] p-1 w-44 shadow-2xl animate-in fade-in duration-120 scale-95'>
          {item('Editar', onEdit)}
          {item(tecnico.activo ? 'Desactivar' : 'Activar', onToggle)}
          {item('Eliminar', onDelete, true)}
        </div>
      )}
    </div>
  )
}

// ─── Modal formulario ─────────────────────────────────────────────────────────

function TecnicoModal({
  tecnico,
  onClose,
  onSaved,
}: {
  tecnico: Tecnico | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<CrearTecnicoDTO>({
    nombre:      tecnico?.nombre      ?? '',
    cargo:       tecnico?.cargo       ?? '',
    especialidad: tecnico?.especialidad ?? '',
    telefono:    tecnico?.telefono    ?? '',
    email:       tecnico?.email       ?? '',
    activo:      tecnico?.activo      ?? true,
    notas:       tecnico?.notas       ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const upd = (k: keyof CrearTecnicoDTO, v: string | boolean) =>
    setForm(prev => ({ ...prev, [k]: v }))

  const handleSave = async () => {
    setError('')
    setSaving(true)
    const res = tecnico
      ? await actualizarTecnico(tecnico.id, form)
      : await crearTecnico(form)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onSaved()
    onClose()
  }

  const inputCls = 'w-full bg-slate-800/50 border border-slate-400/10 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 font-sans transition-all duration-120 focus:border-emerald-500/40 focus:bg-slate-800/70 focus:outline-none'
  const labelCls = 'text-[10px] font-semibold tracking-widest uppercase block mb-1 text-slate-500'

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4'>
      <div className='bg-slate-950 border border-slate-400/15 rounded-[12px] w-full max-w-lg shadow-2xl'>
        <div className='flex items-center justify-between px-5 py-4 border-b border-slate-400/10'>
          <h2 className='text-sm font-bold text-slate-100'>
            {tecnico ? 'Editar técnico' : 'Nuevo técnico'}
          </h2>
          <button onClick={onClose} className='bg-transparent border-0 cursor-pointer text-slate-600 hover:text-slate-300 transition-colors'>
            <X className='w-4 h-4' />
          </button>
        </div>

        <div className='px-5 py-4 space-y-3.5'>
          <div>
            <label className={labelCls}>Nombre *</label>
            <input value={form.nombre} onChange={e => upd('nombre', e.target.value)} placeholder='Ej: Juan García' className={inputCls} />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className={labelCls}>Cargo</label>
              <select
                value={form.cargo ?? ''}
                onChange={e => upd('cargo', e.target.value)}
                className={inputCls}
              >
                <option value=''>Sin cargo</option>
                {CARGOS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Especialidad</label>
              <input value={form.especialidad ?? ''} onChange={e => upd('especialidad', e.target.value)} placeholder='Ej: Electrónica' className={inputCls} />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className={labelCls}>Teléfono</label>
              <input value={form.telefono ?? ''} onChange={e => upd('telefono', e.target.value)} placeholder='11-1234-5678' className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type='email' value={form.email ?? ''} onChange={e => upd('email', e.target.value)} placeholder='tec@empresa.com' className={inputCls} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notas</label>
            <textarea value={form.notas ?? ''} onChange={e => upd('notas', e.target.value)} rows={2} placeholder='Información adicional...' className={`${inputCls} resize-none`} />
          </div>

          {error && <p className='text-xs text-red-400'>{error}</p>}
        </div>

        <div className='flex justify-end gap-2 px-5 py-4 border-t border-slate-400/10'>
          <button
            onClick={onClose}
            className='px-3 py-1.75 rounded-[7px] text-[11px] font-semibold text-slate-500 cursor-pointer bg-transparent border border-slate-400/10 transition-colors hover:text-slate-300'
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className='flex items-center gap-1.75 rounded-[9px] bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 px-4 py-1.75 text-[11px] font-bold text-slate-950 shadow-lg shadow-emerald-600/15 transition-all duration-120 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 cursor-pointer border-0'
          >
            {saving ? (
              <svg width='12' height='12' viewBox='0 0 12 12' className='animate-spin'>
                <circle cx='6' cy='6' r='4' stroke='currentColor' strokeWidth='1.5' fill='none' strokeDasharray='18' strokeDashoffset='6' />
              </svg>
            ) : (
              <svg width='11' height='11' viewBox='0 0 11 11'>
                <path d='M2 5.5L4.5 8L9 3' stroke='currentColor' strokeWidth='1.6' strokeLinecap='round' strokeLinejoin='round' fill='none' />
              </svg>
            )}
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Confirm delete modal ─────────────────────────────────────────────────────

function ConfirmDelete({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4'>
      <div className='bg-slate-950 border border-slate-400/15 rounded-[12px] p-5 max-w-sm w-full shadow-2xl'>
        <h3 className='text-sm font-bold text-slate-100 mb-1.5'>¿Eliminar técnico?</h3>
        <p className='text-xs text-slate-500 mb-5'>
          Esta acción es irreversible. Si el técnico tiene asignaciones en órdenes no podrá eliminarse.
        </p>
        <div className='flex justify-end gap-2'>
          <button
            onClick={onCancel}
            className='px-3 py-1.75 rounded-[7px] text-[11px] font-semibold text-slate-500 cursor-pointer bg-transparent border border-slate-400/10 hover:text-slate-300 transition-colors'
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className='px-4 py-1.75 rounded-[7px] text-[11px] font-bold bg-red-500/15 border border-red-500/25 text-red-400 cursor-pointer hover:bg-red-500/25 transition-colors'
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function TecnicosListado() {
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([])
  const [loading, setLoading] = useState(true)
  const [soloActivos, setSoloActivos] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [modal, setModal] = useState<'new' | Tecnico | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Tecnico | null>(null)
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null)
  const busquedaTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = (msg: string, tipo: 'ok' | 'error' = 'ok') => {
    setToast({ msg, tipo })
    setTimeout(() => setToast(null), 3500)
  }

  const cargar = useCallback(async () => {
    setLoading(true)
    const res = await obtenerTecnicos(soloActivos)
    setLoading(false)
    if (res.data) setTecnicos(res.data)
  }, [soloActivos])

  useEffect(() => { cargar() }, [cargar])

  const handleToggle = async (t: Tecnico) => {
    const res = await toggleActivoTecnico(t.id, !t.activo)
    if (res.error) { showToast(res.error, 'error'); return }
    showToast(res.mensaje ?? '', 'ok')
    cargar()
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    const res = await eliminarTecnico(confirmDelete.id)
    setConfirmDelete(null)
    if (res.error) { showToast(res.error, 'error'); return }
    showToast('Técnico eliminado', 'ok')
    cargar()
  }

  const handleBusqueda = (v: string) => {
    setBusqueda(v)
    if (busquedaTimer.current) clearTimeout(busquedaTimer.current)
    busquedaTimer.current = setTimeout(() => {}, 350)
  }

  const filas = tecnicos.filter(t =>
    !busqueda ||
    t.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (t.cargo ?? '').toLowerCase().includes(busqueda.toLowerCase()) ||
    (t.especialidad ?? '').toLowerCase().includes(busqueda.toLowerCase())
  )

  const total   = tecnicos.length
  const activos = tecnicos.filter(t => t.activo).length

  return (
    <>
      <div className='min-h-screen bg-slate-950 bg-gradient-to-b from-blue-950/5 to-slate-950 px-3 py-5 pb-20 sm:px-5 sm:py-8 lg:px-6'>
        <div className='mx-auto max-w-5xl min-w-0'>

          {/* Header */}
          <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between'>
            <div className='min-w-0'>
              <div className='mb-1 flex items-center gap-2 overflow-x-auto whitespace-nowrap'>
                <span className='text-[11px] text-slate-500 tracking-widest uppercase'>Hexa Gestión</span>
                <span className='text-slate-800'>›</span>
                <span className='text-[11px] text-slate-600 tracking-widest uppercase'>Logística</span>
                <span className='text-slate-800'>›</span>
                <span className='text-[11px] text-slate-600 tracking-widest uppercase'>Técnicos</span>
              </div>
              <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
                <h1 className='m-0 text-[32px] leading-none font-bold tracking-tight text-slate-100 max-[780px]:text-[22px]'>
                  Técnicos
                </h1>
                {!loading && (
                  <span className='rounded-2xl border border-slate-400/10 bg-slate-400/7 px-2.25 py-0.5 font-mono text-[11px] text-slate-500'>
                    {total}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setModal('new')}
              className='inline-flex w-full items-center justify-center gap-1.75 rounded-[9px] bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 px-4 py-2.5 text-sm font-bold text-slate-950 no-underline shadow-lg shadow-emerald-600/15 transition-all duration-120 hover:from-emerald-600 hover:to-emerald-700 sm:w-auto border-0 cursor-pointer'
            >
              <svg width='11' height='11' viewBox='0 0 11 11'>
                <path d='M5.5 1V10M1 5.5H10' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
              </svg>
              Nuevo técnico
            </button>
          </div>

          {/* KPIs */}
          <div className='mb-5 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3'>
            <KPICard label='Total registrados' value={String(total)} textCls='text-slate-300' loading={loading} />
            <KPICard label='Activos' value={String(activos)} textCls='text-emerald-400' loading={loading} />
            <KPICard label='Inactivos' value={String(total - activos)} textCls='text-slate-500' loading={loading} />
          </div>

          {/* Filtros */}
          <div className='mb-4 rounded-lg border border-slate-400/10 bg-slate-900/70 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-4'>
            <div className='flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center'>
              {/* Búsqueda */}
              <div className='relative w-full min-w-0 flex-1 sm:min-w-[220px]'>
                <svg width='13' height='13' viewBox='0 0 13 13' fill='none' className='absolute left-2.75 top-1/2 -translate-y-1/2 text-slate-500'>
                  <circle cx='5.5' cy='5.5' r='4' stroke='currentColor' strokeWidth='1.3' />
                  <path d='M9 9L11.5 11.5' stroke='currentColor' strokeWidth='1.3' strokeLinecap='round' />
                </svg>
                <input
                  value={busqueda}
                  onChange={e => handleBusqueda(e.target.value)}
                  placeholder='Buscar por nombre, cargo, especialidad...'
                  className='w-full bg-slate-800/50 border border-slate-400/10 rounded-lg px-8 py-2.75 text-sm text-slate-100 placeholder-slate-600 font-sans transition-all duration-120 focus:border-emerald-500/40 focus:bg-slate-800/70 focus:outline-none'
                />
                {busqueda && (
                  <button
                    onClick={() => setBusqueda('')}
                    className='absolute right-2.25 top-1/2 -translate-y-1/2 bg-transparent border-0 text-slate-500 cursor-pointer px-0.5 py-0.5 flex items-center hover:text-slate-300 transition-colors duration-120'
                  >
                    <svg width='11' height='11' viewBox='0 0 11 11'>
                      <path d='M1 1L10 10M10 1L1 10' stroke='currentColor' strokeWidth='1.4' strokeLinecap='round' />
                    </svg>
                  </button>
                )}
              </div>

              {/* Toggle solo activos */}
              <div className='flex gap-1.5 flex-wrap'>
                {[
                  { label: 'Todos', value: false },
                  { label: 'Solo activos', value: true },
                ].map(f => (
                  <button
                    key={String(f.value)}
                    onClick={() => setSoloActivos(f.value)}
                    className={`px-2.75 py-1.5 rounded text-[11px] font-semibold font-sans cursor-pointer transition-all duration-120 whitespace-nowrap border
                      ${soloActivos === f.value
                        ? 'text-emerald-500 bg-emerald-500/[0.07] border-emerald-500/30'
                        : 'border-slate-400/10 bg-transparent text-slate-600'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className='rounded-[10px] border border-slate-400/10 bg-slate-900/50 overflow-hidden backdrop-blur-xl'>
            {/* Cabecera */}
            <div className='grid grid-cols-[1fr_auto_auto_auto_auto] gap-0 border-b border-slate-400/[0.07] px-4 py-2.5'>
              {['Técnico', 'Cargo', 'Especialidad', 'Contacto', ''].map((col, i) => (
                <span key={i} className='text-[10px] font-semibold tracking-widest uppercase text-slate-700'>
                  {col}
                </span>
              ))}
            </div>

            {loading ? (
              <div className='px-4 py-3 space-y-2.5'>
                {[...Array(5)].map((_, i) => (
                  <div key={i} className='flex items-center gap-3 py-1'>
                    <Skeleton w='28px' h='28px' r='50%' />
                    <div className='flex-1 space-y-1.5'>
                      <Skeleton w='45%' h='11px' />
                      <Skeleton w='30%' h='9px' />
                    </div>
                  </div>
                ))}
              </div>
            ) : filas.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-16 gap-3'>
                <svg width='40' height='40' viewBox='0 0 40 40' fill='none' className='text-slate-700'>
                  <circle cx='20' cy='14' r='7' stroke='currentColor' strokeWidth='1.5' />
                  <path d='M6 36c0-7.732 6.268-14 14-14s14 6.268 14 14' stroke='currentColor' strokeWidth='1.5' strokeLinecap='round' />
                </svg>
                <p className='text-sm text-slate-600'>
                  {busqueda ? 'Sin resultados para la búsqueda' : 'No hay técnicos registrados'}
                </p>
                {!busqueda && (
                  <button
                    onClick={() => setModal('new')}
                    className='inline-flex items-center gap-1.75 rounded-[9px] bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 px-4 py-2 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-600/15 transition-all hover:from-emerald-600 hover:to-emerald-700 border-0 cursor-pointer mt-1'
                  >
                    Agregar el primero
                  </button>
                )}
              </div>
            ) : (
              <div>
                {filas.map((t, idx) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors duration-100 hover:bg-slate-400/3 ${idx < filas.length - 1 ? 'border-b border-slate-400/[0.05]' : ''} ${!t.activo ? 'opacity-50' : ''}`}
                  >
                    {/* Avatar */}
                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black
                      ${t.activo ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-600'}`}>
                      {t.nombre.charAt(0).toUpperCase()}
                    </div>

                    {/* Nombre + notas */}
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center gap-2'>
                        <span className='text-sm font-semibold text-slate-200 truncate'>{t.nombre}</span>
                        <BadgeActivo activo={t.activo} />
                      </div>
                      {t.notas && (
                        <p className='text-[11px] text-slate-600 truncate mt-0.5'>{t.notas}</p>
                      )}
                    </div>

                    {/* Cargo */}
                    <div className='hidden sm:flex w-36 shrink-0'>
                      <BadgeCargo cargo={t.cargo} />
                    </div>

                    {/* Especialidad */}
                    <div className='hidden md:block w-32 shrink-0'>
                      <span className='text-xs text-slate-500'>{t.especialidad ?? '—'}</span>
                    </div>

                    {/* Contacto */}
                    <div className='hidden lg:block w-40 shrink-0 space-y-0.5'>
                      {t.telefono && (
                        <div className='flex items-center gap-1 text-[11px] text-slate-600'>
                          <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
                            <path d='M2 1.5C2 1.5 3 3 3 4.5C3 6 2 7.5 2 7.5L3.5 9C3.5 9 5 7.5 6.5 7.5C8 7.5 9.5 8.5 9.5 8.5L8.5 7C8.5 7 7 6 7 4.5C7 3 8.5 2 8.5 2L7 1' stroke='currentColor' strokeWidth='1' strokeLinecap='round' />
                          </svg>
                          {t.telefono}
                        </div>
                      )}
                      {t.email && (
                        <div className='flex items-center gap-1 text-[11px] text-slate-600 truncate'>
                          <svg width='10' height='10' viewBox='0 0 10 10' fill='none'>
                            <rect x='1' y='2.5' width='8' height='5.5' rx='1' stroke='currentColor' strokeWidth='1' />
                            <path d='M1.5 3L5 6L8.5 3' stroke='currentColor' strokeWidth='1' strokeLinecap='round' />
                          </svg>
                          {t.email}
                        </div>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className='shrink-0'>
                      <MenuAcciones
                        tecnico={t}
                        onEdit={() => setModal(t)}
                        onToggle={() => handleToggle(t)}
                        onDelete={() => setConfirmDelete(t)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer count */}
          {!loading && filas.length > 0 && (
            <div className='mt-3 flex items-center justify-between px-1'>
              <span className='text-[11px] text-slate-700'>
                {filas.length} técnico{filas.length !== 1 ? 's' : ''}
                {busqueda ? ` · "${busqueda}"` : ''}
              </span>
            </div>
          )}

        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-[10px] text-xs font-semibold shadow-2xl transition-all animate-in slide-in-from-bottom-2 duration-200
          ${toast.tipo === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Modales */}
      {modal && (
        <TecnicoModal
          tecnico={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={cargar}
        />
      )}
      {confirmDelete && (
        <ConfirmDelete onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </>
  )
}
