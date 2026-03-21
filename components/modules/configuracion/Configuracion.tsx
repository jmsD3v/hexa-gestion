'use client';

// ============================================================
// /components/modules/configuracion/Configuracion.tsx
// Configuración de empresa y perfil de usuario
// ============================================================

import { useState, useEffect } from 'react';
import {
  Building2,
  User,
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
} from 'lucide-react';
import {
  obtenerConfiguracion,
  guardarConfiguracion,
  obtenerPerfil,
  actualizarPerfil,
} from '@/app/actions/configuracion';
import type {
  ConfiguracionEmpresa,
  PerfilUsuario,
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
      <label className='block text-xs font-semibold text-slate-600 mb-1.5'>
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
          className={`w-full text-sm border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl py-2.5 pr-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${
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
    <div className='bg-slate-800/70 rounded-2xl border border-slate-700/70 overflow-hidden shadow-sm backdrop-blur-sm'>
      <div className='px-5 py-4 border-b border-slate-700/20 flex items-center gap-2'>
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
            className='h-32 bg-slate-800/70 rounded-2xl animate-pulse'
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
              <label className='block text-xs font-semibold text-slate-600 mb-1.5'>
                Condición IVA
              </label>
              <select
                value={config.condicion_iva}
                onChange={(e) => set('condicion_iva', e.target.value)}
                className='w-full text-sm px-3 py-2.5 border border-slate-600 bg-slate-700 text-slate-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
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
                <label className='block text-xs font-semibold text-slate-600 mb-1.5'>
                  <span className='flex items-center gap-1.5'>
                    <Palette className='w-3.5 h-3.5' /> Color primario
                  </span>
                </label>
                <div className='flex items-center gap-3'>
                  <input
                    type='color'
                    value={config.color_primario ?? '#1e3a5f'}
                    onChange={(e) => set('color_primario', e.target.value)}
                    className='w-12 h-10 rounded-xl border border-slate-600 bg-slate-700 cursor-pointer p-0.5'
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
                <label className='text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5'>
                  <Globe className='w-3.5 h-3.5' /> URL del logo
                </label>
                <div className='flex flex-col gap-2 sm:flex-row'>
                  <input
                    type='url'
                    value={config.logo_url ?? ''}
                    onChange={(e) => set('logo_url', e.target.value)}
                    placeholder='https://…/logo.png'
                    className='flex-1 text-sm px-3 py-2.5 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                  {config.logo_url && (
                    <a
                      href={config.logo_url}
                      target='_blank'
                      className='flex items-center justify-center gap-1 px-3 py-2 border border-slate-600 bg-slate-700 rounded-xl text-sm text-slate-200 hover:bg-slate-600'
                    >
                      <ExternalLink className='w-3.5 h-3.5' />
                    </a>
                  )}
                </div>
                {config.logo_url && (
                  <div className='mt-2 p-2 bg-slate-900/70 border border-slate-700/60 rounded-xl inline-block'>
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
          className='flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl shadow-sm transition-colors'
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
        <div className='fixed bottom-5 right-5 z-50 bg-slate-800 text-white text-sm px-4 py-3 rounded-xl shadow-lg'>
          {toast}
        </div>
      )}

      <Seccion titulo='Tu perfil' icon={User}>
        <div className='grid grid-cols-1 lg:grid-cols-[88px_minmax(0,1fr)] gap-5 items-start'>
          {/* Avatar generativo */}
          <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-950/60'>
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
                <label className='block text-xs font-semibold text-slate-600 mb-1.5'>
                  Email
                </label>
                <input
                  type='email'
                  value={perfil?.email ?? ''}
                  readOnly
                  className='w-full text-sm px-3 py-2.5 border border-slate-700/60 rounded-xl bg-slate-800/80 text-slate-400 cursor-not-allowed'
                />
                <p className='text-xs text-slate-400 mt-1'>
                  El email no se puede cambiar desde aquí
                </p>
              </div>
              <div>
                <label className='block text-xs font-semibold text-slate-600 mb-1.5'>
                  Rol en el sistema
                </label>
                <input
                  type='text'
                  value={perfil?.rol ?? 'superadmin'}
                  readOnly
                  className='w-full text-sm px-3 py-2.5 border border-slate-700/60 rounded-xl bg-slate-800/80 text-slate-400 cursor-not-allowed'
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
          className='flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors'
        >
          <Save className='w-4 h-4' />
          {guardando ? 'Guardando…' : 'Guardar perfil'}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════

export default function Configuracion() {
  const [tab, setTab] = useState<'empresa' | 'perfil'>('empresa');

  return (
    <>
      <style>{`
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
      `}</style>
      <div
        className='min-h-screen bg-slate-900 px-3 py-5 pb-20 sm:px-5 sm:py-8 lg:px-6'
        style={{
          background:
            'radial-gradient(ellipse 90% 45% at 8% 0%, rgba(59,130,246,0.06), transparent 55%), #060d1a',
        }}
      >
        {/* Header */}
        <div className='bg-slate-800/70 backdrop-blur-sm border border-slate-700/60 rounded-2xl px-4 sm:px-6 py-5'>
          <div className='max-w-5xl mx-auto min-w-0'>
            <h1 className='text-xl font-bold text-slate-100'>Configuración</h1>
            <p className='text-sm text-slate-400 mt-0.5'>
              Datos de empresa, facturación y perfil de usuario
            </p>
          </div>
        </div>

        <div className='max-w-5xl mx-auto min-w-0 pt-5'>
          {/* Tabs */}
          <div className='flex border-b border-slate-700/20 mb-6'>
            {[
              { key: 'empresa', label: 'Empresa', icon: Building2 },
              { key: 'perfil', label: 'Mi perfil', icon: User },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key as any)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-blue-500 text-slate-100'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                <t.icon className='w-4 h-4' />
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'empresa' && <TabEmpresa />}
          {tab === 'perfil' && <TabPerfil />}
        </div>
      </div>
    </>
  );
}
