'use client';

// ============================================================
// /components/modules/configuracion/Configuracion.tsx
// Configuración de empresa, perfil y equipo
// ============================================================

import { useState, useEffect } from 'react';
import {
  Building2,
  User,
  Users,
  Save,
  AlertCircle,
  CheckCircle2,
  Globe,
  Mail,
  Phone,
  MapPin,
  Hash,
  Receipt,
  FileText,
  Palette,
  ExternalLink,
  UserPlus,
  ShieldCheck,
  ChevronDown,
  Loader2,
  Trash2,
  UserX,
  UserCheck,
} from 'lucide-react';
import {
  obtenerConfiguracion,
  guardarConfiguracion,
  obtenerPerfil,
  actualizarPerfil,
  listarUsuarios,
  invitarUsuario,
  actualizarRolUsuario,
  desactivarUsuario,
  reactivarUsuario,
  eliminarUsuario,
} from '@/app/actions/configuracion';
import type {
  ConfiguracionEmpresa,
  PerfilUsuario,
  UsuarioEquipo,
} from '@/app/actions/configuracion';

// ── Field genérico ────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  icon: Icon,
  prefix,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  icon?: React.FC<any>;
  prefix?: string;
  helper?: string;
}) {
  return (
    <div>
      <label className='block text-xs font-semibold text-slate-400 mb-1.5'>
        {label}
      </label>
      <div className='relative'>
        {Icon && (
          <div className='absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none'>
            <Icon className='w-4 h-4 text-slate-400' />
          </div>
        )}
        {prefix && (
          <span className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm select-none'>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full text-sm border border-slate-400/10 bg-slate-800/50 text-slate-100 placeholder-slate-400 rounded-xl py-2.5 pr-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-shadow ${
            Icon ? 'pl-9' : prefix ? 'pl-8' : 'pl-3'
          }`}
        />
      </div>
      {helper && <p className='text-xs text-slate-400 mt-1'>{helper}</p>}
    </div>
  );
}

// ── Sección card ──────────────────────────────────────────────

function Seccion({
  titulo,
  icon: Icon,
  children,
}: {
  titulo: string;
  icon: React.FC<any>;
  children: React.ReactNode;
}) {
  return (
    <div className='bg-slate-900/70 rounded-lg border border-slate-400/10 overflow-hidden backdrop-blur-sm'>
      <div className='px-5 py-4 border-b border-slate-400/10 flex items-center gap-2'>
        <Icon className='w-4 h-4 text-slate-400' />
        <h2 className='text-sm font-semibold text-slate-100'>{titulo}</h2>
      </div>
      <div className='px-5 py-5'>{children}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════════════

function TabEmpresa() {
  const [config, setConfig] = useState<ConfiguracionEmpresa | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    obtenerConfiguracion().then((r) => {
      if (r.data) setConfig(r.data);
    });
  }, []);

  const set = (k: keyof ConfiguracionEmpresa, v: string | number) => {
    setConfig((prev) => (prev ? { ...prev, [k]: v } : prev));
    setDirty(true);
  };

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const handleGuardar = async () => {
    if (!config) return;
    setGuardando(true);
    const r = await guardarConfiguracion({
      razon_social: config.razon_social,
      nombre_fantasia: config.nombre_fantasia ?? undefined,
      cuit: config.cuit,
      condicion_iva: config.condicion_iva,
      ingresos_brutos: config.ingresos_brutos ?? undefined,
      domicilio_fiscal: config.domicilio_fiscal ?? undefined,
      telefono: config.telefono ?? undefined,
      email: config.email ?? undefined,
      sitio_web: config.sitio_web ?? undefined,
      logo_url: config.logo_url ?? undefined,
      punto_venta_default: config.punto_venta_default,
      pie_pagina_pdf: config.pie_pagina_pdf ?? undefined,
      color_primario: config.color_primario ?? undefined,
    });
    setGuardando(false);
    if (r.error) showToast(r.error, false);
    else {
      showToast(r.mensaje ?? 'Guardado', true);
      setDirty(false);
    }
  };

  if (!config)
    return (
      <div className='space-y-4'>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className='h-32 bg-slate-900/70 rounded-lg border border-slate-400/10 animate-pulse'
          />
        ))}
      </div>
    );

  return (
    <div className='space-y-5'>
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.ok ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
          }`}
        >
          {toast.ok ? (
            <CheckCircle2 className='w-4 h-4' />
          ) : (
            <AlertCircle className='w-4 h-4' />
          )}
          {toast.msg}
        </div>
      )}

      <div className='grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5 items-start'>
        <Seccion titulo='Datos fiscales' icon={Building2}>
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <Field
              label='Razón social *'
              value={config.razon_social}
              onChange={(v) => set('razon_social', v)}
              icon={Building2}
              placeholder='Hexa Servicios Integrales SAS'
            />
            <Field
              label='Nombre fantasía'
              value={config.nombre_fantasia ?? ''}
              onChange={(v) => set('nombre_fantasia', v)}
              placeholder='HEXA'
            />
            <Field
              label='CUIT *'
              value={config.cuit}
              onChange={(v) => set('cuit', v)}
              icon={Hash}
              placeholder='30-00000000-0'
              helper='Formato: 30-XXXXXXXX-X'
            />
            <div>
              <label className='block text-xs font-semibold text-slate-400 mb-1.5'>
                Condición IVA
              </label>
              <select
                value={config.condicion_iva}
                onChange={(e) => set('condicion_iva', e.target.value)}
                className='w-full text-sm px-3 py-2.5 border border-slate-400/10 bg-slate-800/50 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
              >
                <option value='RESPONSABLE_INSCRIPTO'>
                  Responsable Inscripto
                </option>
                <option value='MONOTRIBUTO'>Monotributo</option>
                <option value='EXENTO'>Exento</option>
                <option value='CONSUMIDOR_FINAL'>Consumidor Final</option>
              </select>
            </div>
            <Field
              label='Ingresos Brutos'
              value={config.ingresos_brutos ?? ''}
              onChange={(v) => set('ingresos_brutos', v)}
              icon={Receipt}
              placeholder='Número de IIBB'
            />
            <Field
              label='Domicilio fiscal'
              value={config.domicilio_fiscal ?? ''}
              onChange={(v) => set('domicilio_fiscal', v)}
              icon={MapPin}
              placeholder='Calle, número, localidad, provincia'
            />
          </div>
        </Seccion>

        <div className='space-y-5'>
          <Seccion titulo='Contacto' icon={Phone}>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1'>
              <Field
                label='Teléfono'
                value={config.telefono ?? ''}
                onChange={(v) => set('telefono', v)}
                icon={Phone}
                placeholder='+54 11 0000-0000'
              />
              <Field
                label='Email'
                value={config.email ?? ''}
                onChange={(v) => set('email', v)}
                icon={Mail}
                type='email'
                placeholder='contacto@hexa.com.ar'
              />
              <Field
                label='Sitio web'
                value={config.sitio_web ?? ''}
                onChange={(v) => set('sitio_web', v)}
                icon={Globe}
                placeholder='https://hexa.com.ar'
              />
            </div>
          </Seccion>

          <Seccion titulo='Facturación y documentos' icon={Receipt}>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <Field
                label='Punto de venta (AFIP)'
                value={String(config.punto_venta_default)}
                onChange={(v) => set('punto_venta_default', parseInt(v) || 1)}
                type='number'
                helper='Número de punto de venta habilitado en AFIP'
              />
              <div>
                <label className='block text-xs font-semibold text-slate-400 mb-1.5'>
                  <span className='flex items-center gap-1.5'>
                    <Palette className='w-3.5 h-3.5' /> Color primario
                  </span>
                </label>
                <div className='flex items-center gap-3'>
                  <input
                    type='color'
                    value={config.color_primario ?? '#1e3a5f'}
                    onChange={(e) => set('color_primario', e.target.value)}
                    className='w-12 h-10 rounded-xl border border-slate-400/10 bg-slate-800/50 cursor-pointer p-0.5'
                  />
                  <div className='min-w-0'>
                    <span className='text-sm text-slate-300 font-mono block'>
                      {config.color_primario ?? '#1e3a5f'}
                    </span>
                    <span className='text-xs text-slate-400 block'>
                      Usado en encabezados de PDFs
                    </span>
                  </div>
                </div>
              </div>
              <div className='md:col-span-2'>
                <Field
                  label='Pie de página en PDFs'
                  value={config.pie_pagina_pdf ?? ''}
                  onChange={(v) => set('pie_pagina_pdf', v)}
                  icon={FileText}
                  placeholder='Texto que aparece al pie de todos los documentos PDF'
                />
              </div>
              <div className='md:col-span-2'>
                <label className='text-xs font-semibold text-slate-400 mb-1.5 flex items-center gap-1.5'>
                  <Globe className='w-3.5 h-3.5' /> URL del logo
                </label>
                <div className='flex flex-col gap-2 sm:flex-row'>
                  <input
                    type='url'
                    value={config.logo_url ?? ''}
                    onChange={(e) => set('logo_url', e.target.value)}
                    placeholder='https://…/logo.png'
                    className='flex-1 text-sm px-3 py-2.5 border border-slate-400/10 bg-slate-800/50 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
                  />
                  {config.logo_url && (
                    <a
                      href={config.logo_url}
                      target='_blank'
                      className='flex items-center justify-center gap-1 px-3 py-2 border border-slate-400/10 bg-slate-800/50 rounded-xl text-sm text-slate-200 hover:bg-slate-400/10'
                    >
                      <ExternalLink className='w-3.5 h-3.5' />
                    </a>
                  )}
                </div>
                {config.logo_url && (
                  <div className='mt-2 p-2 bg-slate-900/70 border border-slate-400/10 rounded-xl inline-block'>
                    <img
                      src={config.logo_url}
                      alt='Logo'
                      className='h-10 object-contain'
                    />
                  </div>
                )}
              </div>
            </div>
          </Seccion>
        </div>
      </div>

      {/* Botón guardar */}
      <div className='flex items-center justify-end gap-3'>
        {dirty && (
          <p className='text-xs text-amber-600 font-medium'>
            Hay cambios sin guardar
          </p>
        )}
        <button
          onClick={handleGuardar}
          disabled={guardando || !dirty}
          className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 text-sm font-semibold rounded-xl shadow-sm transition-all'
        >
          <Save className='w-4 h-4' />
          {guardando ? 'Guardando…' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

// ── Tab Perfil ────────────────────────────────────────────────

function TabPerfil() {
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    obtenerPerfil().then((r) => {
      if (r.data) {
        setPerfil(r.data);
        setNombre(r.data.nombre_completo ?? '');
      }
    });
  }, []);

  const handleGuardar = async () => {
    setGuardando(true);
    const r = await actualizarPerfil({ nombre_completo: nombre.trim() });
    setGuardando(false);
    setToast(r.error ?? r.mensaje ?? 'Guardado');
    setTimeout(() => setToast(null), 3000);
  };

  // Iniciales para avatar generativo
  const iniciales =
    nombre
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';

  return (
    <div className='space-y-5'>
      {toast && (
        <div className='fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-sm px-4 py-3 rounded-xl shadow-lg'>
          {toast}
        </div>
      )}

      <Seccion titulo='Tu perfil' icon={User}>
        <div className='grid grid-cols-1 lg:grid-cols-[88px_minmax(0,1fr)] gap-5 items-start'>
          {/* Avatar generativo */}
          <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-950/60'>
            <span className='text-white font-bold text-xl'>{iniciales}</span>
          </div>
          <div className='flex-1 space-y-4'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <Field
                label='Nombre completo'
                value={nombre}
                onChange={setNombre}
                icon={User}
                placeholder='Luis Gastón Alarcón'
              />
              <div>
                <label className='block text-xs font-semibold text-slate-400 mb-1.5'>
                  Email
                </label>
                <input
                  type='email'
                  value={perfil?.email ?? ''}
                  readOnly
                  className='w-full text-sm px-3 py-2.5 border border-slate-400/10 rounded-xl bg-slate-800/50 text-slate-400 cursor-not-allowed'
                />
                <p className='text-xs text-slate-400 mt-1'>
                  El email no se puede cambiar desde aquí
                </p>
              </div>
              <div>
                <label className='block text-xs font-semibold text-slate-400 mb-1.5'>
                  Rol en el sistema
                </label>
                <input
                  type='text'
                  value={perfil?.rol ?? 'superadmin'}
                  readOnly
                  className='w-full text-sm px-3 py-2.5 border border-slate-400/10 rounded-xl bg-slate-800/50 text-slate-400 cursor-not-allowed'
                />
              </div>
            </div>
          </div>
        </div>
      </Seccion>

      <div className='flex justify-end'>
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className='flex items-center gap-2 px-6 py-2.5 bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 text-slate-950 text-sm font-semibold rounded-xl shadow-sm transition-all'
        >
          <Save className='w-4 h-4' />
          {guardando ? 'Guardando…' : 'Guardar perfil'}
        </button>
      </div>
    </div>
  );
}

// ── Helpers de equipo ─────────────────────────────────────────

const ROL_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  admin: 'Administrador',
  supervisor: 'Supervisor',
  operador: 'Operador',
  viewer: 'Observador',
};

const ROL_COLORS: Record<string, string> = {
  superadmin: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  admin: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  supervisor: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  operador: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  viewer: 'bg-slate-500/20 text-slate-300 border border-slate-600/40',
};

function RolBadge({ rol }: { rol: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${ROL_COLORS[rol] ?? ROL_COLORS.viewer}`}
    >
      <ShieldCheck className='w-3 h-3' />
      {ROL_LABELS[rol] ?? rol}
    </span>
  );
}

function AvatarInicial({ nombre, rol }: { nombre: string | null; rol: string }) {
  const gradients: Record<string, string> = {
    superadmin: 'from-amber-500 to-orange-600',
    admin: 'from-orange-500 to-red-600',
    supervisor: 'from-blue-500 to-blue-700',
    operador: 'from-emerald-500 to-teal-700',
    viewer: 'from-slate-500 to-slate-700',
  };
  const iniciales = nombre
    ? nombre.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';
  return (
    <div
      className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradients[rol] ?? gradients.viewer} flex items-center justify-center flex-shrink-0`}
    >
      <span className='text-white font-bold text-xs'>{iniciales}</span>
    </div>
  );
}

function formatFecha(iso: string | null) {
  if (!iso) return 'Nunca';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ── Tab Equipo ────────────────────────────────────────────────

function TabEquipo({ miId, miRol }: { miId: string; miRol: string }) {
  const [usuarios, setUsuarios] = useState<UsuarioEquipo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [mostrarInvitar, setMostrarInvitar] = useState(false);
  const [emailInvite, setEmailInvite] = useState('');
  const [rolInvite, setRolInvite] = useState('operador');
  const [enviando, setEnviando] = useState(false);
  const [cargandoId, setCargandoId] = useState<string | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const cargar = async () => {
    setCargando(true);
    const r = await listarUsuarios();
    if (r.data) setUsuarios(r.data);
    else showToast(r.error ?? 'Error al cargar usuarios', false);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const handleInvitar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    const r = await invitarUsuario({ email: emailInvite, rol: rolInvite });
    setEnviando(false);
    if (r.error) {
      showToast(r.error, false);
    } else {
      showToast(r.mensaje ?? 'Invitación enviada', true);
      setEmailInvite('');
      setRolInvite('operador');
      setMostrarInvitar(false);
      cargar();
    }
  };

  const handleCambiarRol = async (usuarioId: string, rol: string) => {
    setCargandoId(usuarioId);
    const r = await actualizarRolUsuario({ usuarioId, rol });
    setCargandoId(null);
    showToast(r.error ?? r.mensaje ?? 'Actualizado', !r.error);
    if (!r.error) cargar();
  };

  const handleToggleActivo = async (u: UsuarioEquipo) => {
    setCargandoId(u.id);
    const r = u.activo
      ? await desactivarUsuario({ usuarioId: u.id })
      : await reactivarUsuario({ usuarioId: u.id });
    setCargandoId(null);
    showToast(r.error ?? r.mensaje ?? 'Actualizado', !r.error);
    if (!r.error) cargar();
  };

  const handleEliminar = async (u: UsuarioEquipo) => {
    if (!confirm(`¿Eliminar permanentemente a ${u.email}? Esta acción no se puede deshacer.`)) return;
    setCargandoId(u.id);
    const r = await eliminarUsuario({ usuarioId: u.id });
    setCargandoId(null);
    showToast(r.error ?? r.mensaje ?? 'Eliminado', !r.error);
    if (!r.error) cargar();
  };

  const rolesAsignables = miRol === 'superadmin'
    ? ['superadmin', 'admin', 'supervisor', 'operador', 'viewer']
    : ['admin', 'supervisor', 'operador', 'viewer'];

  return (
    <div className='space-y-5'>
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.ok ? 'bg-emerald-700 text-white' : 'bg-red-700 text-white'
          }`}
        >
          {toast.ok ? <CheckCircle2 className='w-4 h-4' /> : <AlertCircle className='w-4 h-4' />}
          {toast.msg}
        </div>
      )}

      {/* Header + botón invitar */}
      <div className='bg-slate-900/70 rounded-lg border border-slate-400/10 overflow-hidden backdrop-blur-sm'>
        <div className='px-5 py-4 border-b border-slate-400/10 flex items-center justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <Users className='w-4 h-4 text-slate-400' />
            <h2 className='text-sm font-semibold text-slate-100'>
              Miembros del equipo
            </h2>
            {!cargando && (
              <span className='text-xs text-slate-500 bg-slate-400/10 px-2 py-0.5 rounded-full'>
                {usuarios.length}
              </span>
            )}
          </div>
          <button
            onClick={() => setMostrarInvitar((v) => !v)}
            className='flex items-center gap-2 px-3 py-2 bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 text-slate-950 text-xs font-semibold rounded-xl transition-all'
          >
            <UserPlus className='w-3.5 h-3.5' />
            Invitar usuario
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${mostrarInvitar ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Formulario de invitación */}
        {mostrarInvitar && (
          <form
            onSubmit={handleInvitar}
            className='px-5 py-4 border-b border-slate-400/10 bg-slate-950/40'
          >
            <p className='text-xs text-slate-400 mb-3'>
              El usuario recibirá un email con un link para activar su cuenta.
            </p>
            <div className='flex flex-col sm:flex-row gap-3'>
              <input
                type='email'
                required
                value={emailInvite}
                onChange={(e) => setEmailInvite(e.target.value)}
                placeholder='correo@empresa.com'
                className='flex-1 text-sm px-3 py-2 border border-slate-400/10 bg-slate-800/50 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
              />
              <select
                value={rolInvite}
                onChange={(e) => setRolInvite(e.target.value)}
                className='text-sm px-3 py-2 border border-slate-400/10 bg-slate-800/50 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
              >
                {rolesAsignables.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABELS[r]}
                  </option>
                ))}
              </select>
              <button
                type='submit'
                disabled={enviando}
                className='flex items-center gap-2 px-4 py-2 bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 text-slate-950 text-sm font-semibold rounded-xl transition-all'
              >
                {enviando ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <UserPlus className='w-4 h-4' />
                )}
                {enviando ? 'Enviando…' : 'Enviar invitación'}
              </button>
            </div>
          </form>
        )}

        {/* Tabla de usuarios */}
        <div className='px-5 py-3'>
          {cargando ? (
            <div className='space-y-3 py-2'>
              {[1, 2, 3].map((i) => (
                <div key={i} className='h-12 bg-slate-400/10 rounded-xl animate-pulse' />
              ))}
            </div>
          ) : usuarios.length === 0 ? (
            <p className='text-sm text-slate-500 py-6 text-center'>
              No hay usuarios registrados.
            </p>
          ) : (
            <div className='divide-y divide-slate-400/10'>
              {usuarios.map((u) => {
                const esMismo = u.id === miId;
                const esSuperadmin = u.rol === 'superadmin';
                const puedeEditar = !esMismo && (miRol === 'superadmin' || !esSuperadmin);
                const puedeEliminar = miRol === 'superadmin' && !esMismo;
                const cargandoEste = cargandoId === u.id;

                return (
                  <div
                    key={u.id}
                    className={`py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 ${
                      !u.activo ? 'opacity-60' : ''
                    }`}
                  >
                    {/* Avatar + info */}
                    <div className='flex items-center gap-3 flex-1 min-w-0'>
                      <AvatarInicial nombre={u.nombre_completo} rol={u.rol} />
                      <div className='min-w-0'>
                        <div className='flex items-center gap-2 flex-wrap'>
                          <span className='text-sm font-medium text-slate-100 truncate'>
                            {u.nombre_completo ?? 'Sin nombre'}
                          </span>
                          {esMismo && (
                            <span className='text-xs text-slate-500'>(vos)</span>
                          )}
                        </div>
                        <span className='text-xs text-slate-400 truncate block'>
                          {u.email}
                        </span>
                      </div>
                    </div>

                    {/* Rol + estado + último acceso */}
                    <div className='flex items-center gap-2 flex-wrap sm:flex-nowrap'>
                      <span className='text-xs text-slate-500 hidden lg:inline whitespace-nowrap'>
                        Último: {formatFecha(u.ultimo_acceso)}
                      </span>

                      {/* Estado */}
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                          u.activo
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border-red-500/30'
                        }`}
                      >
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>

                      {/* Rol — select si puede editar */}
                      {puedeEditar ? (
                        <div className='relative'>
                          <select
                            value={u.rol}
                            disabled={cargandoEste}
                            onChange={(e) => handleCambiarRol(u.id, e.target.value)}
                            className='text-xs px-2 py-1 border border-slate-400/10 bg-slate-800/50 text-slate-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500/40 cursor-pointer disabled:opacity-50'
                          >
                            {rolesAsignables.map((r) => (
                              <option key={r} value={r}>
                                {ROL_LABELS[r]}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <RolBadge rol={u.rol} />
                      )}
                    </div>

                    {/* Acciones */}
                    <div className='flex items-center gap-1.5 flex-shrink-0'>
                      {cargandoEste && (
                        <Loader2 className='w-4 h-4 text-slate-400 animate-spin' />
                      )}
                      {puedeEditar && (
                        <button
                          onClick={() => handleToggleActivo(u)}
                          disabled={cargandoEste}
                          title={u.activo ? 'Desactivar usuario' : 'Reactivar usuario'}
                          className='p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-400/10 disabled:opacity-40 transition-colors'
                        >
                          {u.activo ? (
                            <UserX className='w-4 h-4' />
                          ) : (
                            <UserCheck className='w-4 h-4' />
                          )}
                        </button>
                      )}
                      {puedeEliminar && (
                        <button
                          onClick={() => handleEliminar(u)}
                          disabled={cargandoEste}
                          title='Eliminar usuario permanentemente'
                          className='p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function Configuracion() {
  const [tab, setTab] = useState<'empresa' | 'perfil' | 'equipo'>('empresa');
  const [miId, setMiId] = useState('');
  const [miRol, setMiRol] = useState('');

  useEffect(() => {
    obtenerPerfil().then((r) => {
      if (r.data) {
        setMiId(r.data.id);
        setMiRol(r.data.rol ?? '');
      }
    });
  }, []);

  const esAdmin = ['superadmin', 'admin'].includes(miRol);

  return (
    <>
      <div
        className='min-h-screen bg-slate-950 bg-gradient-to-b from-blue-950/5 to-slate-950 px-3 py-5 pb-20 sm:px-5 sm:py-8 lg:px-6'
      >
        {/* Header */}
        <div className='mb-6'>
          <div className='max-w-5xl mx-auto min-w-0'>
            <nav className='flex items-center gap-1.5 mb-3'>
              <span className='text-[11px] text-slate-500 tracking-widest uppercase'>Hexa Gestión</span>
              <span className='text-slate-500'>›</span>
              <span className='text-[11px] text-slate-600 tracking-widest uppercase'>Configuración</span>
            </nav>
            <h1 className='text-[32px] leading-none font-bold tracking-tight text-slate-100'>
              Configuración
            </h1>
            <p className='text-sm text-slate-400 mt-1.5'>
              Datos de empresa, facturación y perfil de usuario
            </p>
          </div>
        </div>

        <div className='max-w-5xl mx-auto min-w-0'>
          {/* Tabs */}
          <div className='flex border-b border-slate-400/10 mb-6'>
            {[
              { key: 'empresa', label: 'Empresa', icon: Building2, visible: true },
              { key: 'perfil', label: 'Mi perfil', icon: User, visible: true },
              { key: 'equipo', label: 'Equipo', icon: Users, visible: esAdmin },
            ]
              .filter((t) => t.visible)
              .map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as 'empresa' | 'perfil' | 'equipo')}
                  className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tab === t.key
                      ? 'border-emerald-500 text-slate-100'
                      : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-400/20'
                  }`}
                >
                  <t.icon className='w-4 h-4' />
                  {t.label}
                </button>
              ))}
          </div>

          {tab === 'empresa' && <TabEmpresa />}
          {tab === 'perfil' && <TabPerfil />}
          {tab === 'equipo' && esAdmin && (
            <TabEquipo miId={miId} miRol={miRol} />
          )}
        </div>
      </div>
    </>
  );
}
