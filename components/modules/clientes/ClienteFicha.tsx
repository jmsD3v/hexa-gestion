'use client';

// ============================================================
// components/modules/clientes/ClienteFicha.tsx
// Vista detalle de un cliente: KPIs, datos, direcciones,
// actividad reciente y acciones rápidas.
// ============================================================

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { ArrowLeft, ClipboardList, BarChart3, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type {
  ClienteConDirecciones,
  ClienteKPIs,
  ClienteDireccion,
  CrearDireccionDTO,
  CondicionIVA,
} from '@/types';
import {
  obtenerCliente,
  obtenerKPIsCliente,
  desactivarCliente,
  reactivarCliente,
  agregarDireccion,
  actualizarDireccion,
  eliminarDireccion,
  establecerDireccionPrincipal,
} from '@/app/actions/clientes';
import {
  getMockClienteDetalle,
  getMockClienteKPIs,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';
import { cn } from '@/lib/utils';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  clienteId: string;
}

// ─── Tipos locales ────────────────────────────────────────────────────────────

type Tab = 'general' | 'direcciones' | 'actividad';

interface ToastState {
  mensaje: string;
  tipo: 'ok' | 'error';
}

interface DireccionFormState {
  etiqueta: string;
  calle: string;
  numero: string;
  piso_dpto: string;
  barrio: string;
  ciudad: string;
  provincia: string;
  codigo_postal: string;
  distancia_km: string;
  notas: string;
  es_principal: boolean;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const IVA_LABEL: Record<CondicionIVA, string> = {
  RESPONSABLE_INSCRIPTO: 'Responsable Inscripto',
  MONOTRIBUTISTA: 'Monotributista',
  EXENTO: 'Exento',
  CONSUMIDOR_FINAL: 'Consumidor Final',
  NO_RESPONSABLE: 'No Responsable',
};
const IVA_BADGE_CLS: Record<CondicionIVA, string> = {
  RESPONSABLE_INSCRIPTO:
    'text-blue-400 bg-blue-400/[0.08] border-blue-400/[0.19]',
  MONOTRIBUTISTA:
    'text-violet-400 bg-violet-400/[0.08] border-violet-400/[0.19]',
  EXENTO: 'text-emerald-400 bg-emerald-400/[0.08] border-emerald-400/[0.19]',
  CONSUMIDOR_FINAL:
    'text-slate-400 bg-slate-400/[0.08] border-slate-400/[0.19]',
  NO_RESPONSABLE: 'text-slate-500 bg-slate-500/[0.08] border-slate-500/[0.19]',
};
const PROVINCIAS = [
  'Buenos Aires',
  'Chaco',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
  'CABA',
];

const initialDirForm: DireccionFormState = {
  etiqueta: '',
  calle: '',
  numero: '',
  piso_dpto: '',
  barrio: '',
  ciudad: '',
  provincia: 'Chaco',
  codigo_postal: '',
  distancia_km: '',
  notas: '',
  es_principal: false,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avatarLetra = (s: string) => s.charAt(0).toUpperCase();
const avatarColor = (s: string) =>
  `hsl(${(s.charCodeAt(0) * 7) % 360},35%,20%)`;
const fmtFecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';
const fmtFechaCorta = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        year: '2-digit',
      })
    : '—';

// ─── Estilos base ─────────────────────────────────────────────────────────────

const cardClass =
  'bg-slate-900/70 border border-slate-400/10 rounded-xl backdrop-blur-sm';
const inputClass =
  'w-full px-3 py-2 bg-slate-950/60 border border-slate-400/10 rounded-lg text-slate-200 text-xs outline-none transition-colors';
const labelClass =
  'text-xs font-semibold tracking-widest uppercase text-slate-600 block mb-1';

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function Skeleton({
  w = '100%',
  h = '14px',
  r = '4px',
}: {
  w?: string;
  h?: string;
  r?: string;
}) {
  return (
    <div
      className={`bg-slate-400/[0.07] animate-pulse w-[${w}] h-[${h}] rounded-[${r}]`}
    />
  );
}

function InfoPar({
  label,
  value,
  mono = false,
  children,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className='flex flex-col gap-0.5'>
      <span className='text-xs font-semibold tracking-widest uppercase text-[#334155]'>
        {label}
      </span>
      {children ?? (
        <span
          className={cn(
            'text-xs',
            mono ? 'font-mono' : '',
            value ? 'text-slate-400' : 'text-slate-800',
          )}
        >
          {value || '—'}
        </span>
      )}
    </div>
  );
}

function KPICard({
  label,
  value,
  sub,
  colorCls = 'text-slate-400',
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  colorCls?: string;
  loading?: boolean;
}) {
  return (
    <div className={cn(cardClass, 'p-[14px] flex flex-col gap-[5px]')}>
      <span className='text-xs font-semibold tracking-widest uppercase text-[#334155]'>
        {label}
      </span>
      {loading ? (
        <Skeleton w='80px' h='22px' />
      ) : (
        <span
          className={`font-mono text-[20px] font-bold tracking-[-0.02em] ${colorCls}`}
        >
          {value}
        </span>
      )}
      {sub && !loading && <span className='text-xs text-[#334155]'>{sub}</span>}
    </div>
  );
}

function BadgeEstado({ activo }: { activo: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-[20px] text-xs font-semibold',
        activo
          ? 'bg-emerald-400/[0.08] border border-emerald-400/25 text-[#4ade80]'
          : 'bg-red-400/[0.08] border border-red-400/25 text-red-400',
      )}
    >
      <span className='inline-block w-[5px] h-[5px] rounded-full bg-current' />
      {activo ? 'Activo' : 'Inactivo'}
    </span>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-[18px] py-3 rounded-[10px] bg-slate-950/[0.97] backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.4)] max-w-[320px] animate-modal-in ${toast.tipo === 'ok' ? 'border border-emerald-400/30' : 'border border-red-400/30'}`}
    >
      <span
        className={`text-[13px] font-semibold ${toast.tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
      >
        {toast.tipo === 'ok' ? '✓' : '✕'}
      </span>
      <span
        className={`text-[13px] ${toast.tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
      >
        {toast.mensaje}
      </span>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className='flex items-center gap-1.5'>
      <span className='text-slate-500 flex items-center'>{icon}</span>
      <span className='text-xs font-bold tracking-widest uppercase text-slate-600'>
        {title}
      </span>
    </div>
  );
}

function BtnIcono({
  onClick,
  children,
  loading,
  danger,
  title,
}: {
  onClick: () => void;
  children: ReactNode;
  loading?: boolean;
  danger?: boolean;
  title?: string;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={`flex items-center justify-center w-[26px] h-[26px] rounded-md border border-slate-400/[0.08] bg-transparent transition-all ${danger && hov ? 'text-red-400' : 'text-slate-600'} ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      {loading ? (
        <svg
          width='10'
          height='10'
          viewBox='0 0 10 10'
          className='animate-spin'
        >
          <circle
            cx='5'
            cy='5'
            r='3.5'
            stroke='currentColor'
            strokeWidth='1.2'
            fill='none'
            strokeDasharray='11'
            strokeDashoffset='4'
          />
        </svg>
      ) : (
        children
      )}
    </button>
  );
}

// ─── Formulario dirección ─────────────────────────────────────────────────────

function DireccionForm({
  initial,
  onSave,
  onCancel,
  loading,
}: {
  initial?: DireccionFormState;
  onSave: (d: DireccionFormState) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<DireccionFormState>(
    initial ?? initialDirForm,
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof DireccionFormState, string>>
  >({});
  const set = (k: keyof DireccionFormState, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    const e: typeof errors = {};
    if (!form.etiqueta.trim()) e.etiqueta = 'Requerido';
    if (!form.calle.trim()) e.calle = 'Requerido';
    if (!form.ciudad.trim()) e.ciudad = 'Requerido';
    setErrors(e);
    if (!Object.keys(e).length) onSave(form);
  };

  const fields: {
    k: keyof DireccionFormState;
    label: string;
    ph: string;
    col?: string;
  }[] = [
    { k: 'etiqueta', label: 'Etiqueta', ph: 'Casa Central', col: '1/-1' },
    { k: 'calle', label: 'Calle', ph: 'Av. Sarmiento' },
    { k: 'numero', label: 'Número', ph: '1450' },
    { k: 'piso_dpto', label: 'Piso/Dpto', ph: 'Piso 3B' },
    { k: 'barrio', label: 'Barrio', ph: 'Centro' },
    { k: 'ciudad', label: 'Ciudad', ph: 'Resistencia' },
    { k: 'codigo_postal', label: 'CP', ph: 'H3500' },
  ];

  return (
    <div
      className={cn(
        cardClass,
        'p-4 sm:p-[18px] animate-[slideUp_0.2s_ease] border-amber-500/15',
      )}
    >
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {fields.map(({ k, label, ph, col }) => (
          <div key={k} className={col ? 'col-[1/-1]' : ''}>
            <label
              className={cn(
                labelClass,
                errors[k] ? 'text-amber-500' : 'text-slate-600',
              )}
            >
              {label}
            </label>
            <input
              value={form[k] as string}
              onChange={(e) => set(k, e.target.value)}
              placeholder={ph}
              className={`w-full px-3 py-2 bg-slate-950/60 rounded-lg text-slate-200 text-xs outline-none transition-colors focus:border-amber-500/35 border ${errors[k] ? 'border-amber-500/40' : 'border-slate-400/10'}`}
            />
            {errors[k] && (
              <span className='text-xs text-amber-500'>{errors[k]}</span>
            )}
          </div>
        ))}
        <div>
          <label className={labelClass}>Provincia</label>
          <div className='relative'>
            <select
              value={form.provincia}
              onChange={(e) => set('provincia', e.target.value)}
              className={cn(
                inputClass,
                'appearance-none pr-[26px] cursor-pointer',
              )}
            >
              {PROVINCIAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <svg
              width='10'
              height='10'
              viewBox='0 0 10 10'
              fill='none'
              className='absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
            >
              <path
                d='M2 4L5 7L8 4'
                stroke='currentColor'
                strokeWidth='1.3'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </div>
        </div>
        <div>
          <label className={labelClass}>Distancia (km)</label>
          <input
            type='number'
            min='0'
            value={form.distancia_km}
            onChange={(e) => set('distancia_km', e.target.value)}
            placeholder='0'
            className={inputClass}
          />
        </div>
        <div className='col-[1/-1] flex items-center gap-2.5'>
          <div
            onClick={() => set('es_principal', !form.es_principal)}
            className={`relative shrink-0 cursor-pointer rounded-[9px] transition-all w-8 h-[18px] border ${form.es_principal ? 'bg-amber-500/40 border-amber-500/50' : 'bg-slate-400/[0.12] border-slate-400/15'}`}
          >
            <div
              className={`absolute top-0.5 rounded-full w-3 h-3 transition-all ${form.es_principal ? 'left-[15px] bg-amber-500' : 'left-[2px] bg-slate-600'}`}
            />
          </div>
          <span
            className={`text-xs ${form.es_principal ? 'text-amber-500' : 'text-slate-600'}`}
          >
            Marcar como dirección principal
          </span>
        </div>
        <div className='col-[1/-1]'>
          <label className={labelClass}>Notas</label>
          <textarea
            value={form.notas}
            onChange={(e) => set('notas', e.target.value)}
            placeholder='Observaciones...'
            rows={2}
            className={cn(inputClass, 'resize-y leading-relaxed')}
          />
        </div>
      </div>
      <div className='mt-3.5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
        <button
          onClick={onCancel}
          className='px-[14px] py-[7px] rounded-[7px] border border-slate-400/[0.12] bg-transparent text-slate-500 text-xs cursor-pointer'
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className={`flex items-center gap-1.5 px-4 py-[7px] rounded-[7px] border-none text-slate-900 text-xs font-bold ${loading ? 'bg-emerald-600/30 cursor-not-allowed' : 'bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 cursor-pointer'}`}
        >
          {loading && (
            <svg
              width='11'
              height='11'
              viewBox='0 0 11 11'
              className='animate-spin'
            >
              <circle
                cx='5.5'
                cy='5.5'
                r='4'
                stroke='rgba(15,23,42,0.5)'
                strokeWidth='1.5'
                fill='none'
              />
              <path
                d='M5.5 1.5A4 4 0 0 1 9.5 5.5'
                stroke='#0f172a'
                strokeWidth='1.5'
                strokeLinecap='round'
              />
            </svg>
          )}
          Guardar
        </button>
      </div>
    </div>
  );
}

// ─── Tab General ──────────────────────────────────────────────────────────────

function TabGeneral({ cliente }: { cliente: ClienteConDirecciones }) {
  return (
    <div className='flex flex-col gap-3'>
      <div className={cn(cardClass, 'p-3 sm:p-3.5')}>
        <SectionTitle icon='🏛' title='Datos Fiscales' />
        <div className='mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 sm:gap-2.5'>
          <InfoPar label='Razón Social' value={cliente.razon_social} />
          {cliente.nombre_fantasia && (
            <InfoPar label='Nombre Fantasía' value={cliente.nombre_fantasia} />
          )}
          <InfoPar label='CUIT' value={cliente.cuit} mono />
          <InfoPar label='Tipo Doc.' value={cliente.tipo_documento} />
          <InfoPar label='Nº Documento' value={cliente.numero_documento} mono />
          <InfoPar label='Condición IVA'>
            <span
              className={`inline-block mt-px px-[7px] py-px rounded-[5px] text-xs font-semibold border ${IVA_BADGE_CLS[cliente.condicion_iva]}`}
            >
              {IVA_LABEL[cliente.condicion_iva]}
            </span>
          </InfoPar>
          {cliente.ingresos_brutos && (
            <InfoPar label='Ing. Brutos' value={cliente.ingresos_brutos} mono />
          )}
        </div>
      </div>
      <div className={cn(cardClass, 'p-3.5 sm:p-4')}>
        <SectionTitle icon={<ClipboardList className='w-3.5 h-3.5' />} title='Datos Comerciales' />
        <div className='mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 sm:gap-3'>
          {cliente.contacto_nombre && (
            <InfoPar label='Contacto'>
              <div>
                <div className='text-[13px] text-slate-400'>
                  {cliente.contacto_nombre}
                </div>
                {cliente.contacto_cargo && (
                  <div className='text-xs text-slate-600'>
                    {cliente.contacto_cargo}
                  </div>
                )}
              </div>
            </InfoPar>
          )}
          {cliente.telefono && (
            <InfoPar label='Teléfono'>
              <a
                href={`tel:${cliente.telefono}`}
                className='text-[13px] text-blue-400 font-mono no-underline'
              >
                {cliente.telefono}
              </a>
            </InfoPar>
          )}
          {cliente.telefono_alt && (
            <InfoPar label='Tel. Alt.'>
              <a
                href={`tel:${cliente.telefono_alt}`}
                className='text-[13px] text-blue-400 font-mono no-underline'
              >
                {cliente.telefono_alt}
              </a>
            </InfoPar>
          )}
          {cliente.email && (
            <InfoPar label='Email'>
              <a
                href={`mailto:${cliente.email}`}
                className='block break-all text-[13px] text-blue-400 no-underline sm:truncate'
              >
                {cliente.email}
              </a>
            </InfoPar>
          )}
          {cliente.email_facturacion && (
            <InfoPar label='Email Facturación'>
              <a
                href={`mailto:${cliente.email_facturacion}`}
                className='block break-all text-[13px] text-blue-400 no-underline sm:truncate'
              >
                {cliente.email_facturacion}
              </a>
            </InfoPar>
          )}
          {cliente.sitio_web && (
            <InfoPar label='Sitio Web'>
              <a
                href={cliente.sitio_web}
                target='_blank'
                rel='noopener noreferrer'
                className='block break-all text-[13px] text-blue-400 no-underline sm:truncate'
              >
                {cliente.sitio_web.replace(/^https?:\/\//, '')}
              </a>
            </InfoPar>
          )}
        </div>
      </div>
      {(cliente.segmento || cliente.origen || cliente.notas) && (
        <div className={cn(cardClass, 'p-3.5 sm:p-4')}>
          <SectionTitle icon='🏷' title='Clasificación' />
          <div className='mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 sm:gap-3'>
            {cliente.segmento && (
              <InfoPar label='Segmento'>
                <span className='inline-block text-xs text-slate-400 bg-slate-400/[0.08] border border-slate-400/[0.12] rounded-[5px] px-2 py-[3px]'>
                  {cliente.segmento}
                </span>
              </InfoPar>
            )}
            {cliente.origen && (
              <InfoPar label='Origen' value={cliente.origen} />
            )}
          </div>
          {cliente.notas && (
            <div className='mt-[10px] pt-[10px] border-t border-slate-400/[0.06]'>
              <label className={labelClass}>Notas internas</label>
              <p className='m-0 text-xs text-slate-500 leading-[1.55] whitespace-pre-wrap'>
                {cliente.notas}
              </p>
            </div>
          )}
        </div>
      )}
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <div className={cn(cardClass, 'px-3.5 py-3')}>
          <div className='text-xs font-semibold tracking-widest uppercase text-[#334155] mb-[6px]'>
            Creado
          </div>
          <div className='text-xs text-slate-600 font-mono'>
            {fmtFecha(cliente.creado_en)}
          </div>
        </div>
        <div className={cn(cardClass, 'px-3.5 py-3')}>
          <div className='text-xs font-semibold tracking-widest uppercase text-[#334155] mb-[6px]'>
            Última actualización
          </div>
          <div className='text-xs text-slate-600 font-mono'>
            {fmtFecha(cliente.actualizado_en)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tab Direcciones ──────────────────────────────────────────────────────────

function TabDirecciones({
  cliente,
  onRefresh,
  showToast,
}: {
  cliente: ClienteConDirecciones;
  onRefresh: () => void;
  showToast: (m: string, t: 'ok' | 'error') => void;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const toDto = (form: DireccionFormState): CrearDireccionDTO => ({
    etiqueta: form.etiqueta,
    calle: form.calle,
    ciudad: form.ciudad,
    numero: form.numero || undefined,
    piso_dpto: form.piso_dpto || undefined,
    barrio: form.barrio || undefined,
    provincia: form.provincia || undefined,
    codigo_postal: form.codigo_postal || undefined,
    distancia_km: form.distancia_km ? parseFloat(form.distancia_km) : undefined,
    notas: form.notas || undefined,
    es_principal: form.es_principal,
  });

  const handleAgregar = async (form: DireccionFormState) => {
    setLoadingId('nueva');
    const res = await agregarDireccion(cliente.id, toDto(form));
    setLoadingId(null);
    if (res.error) {
      showToast(res.mensaje ?? res.error, 'error');
      return;
    }
    showToast('Dirección agregada', 'ok');
    setAgregando(false);
    onRefresh();
  };

  const handleEditar = async (dirId: string, form: DireccionFormState) => {
    setLoadingId(dirId);
    const res = await actualizarDireccion(dirId, cliente.id, toDto(form));
    setLoadingId(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast('Dirección actualizada', 'ok');
    setEditandoId(null);
    onRefresh();
  };

  const handleEliminar = async (dirId: string) => {
    setLoadingId(dirId);
    const res = await eliminarDireccion(dirId, cliente.id);
    setLoadingId(null);
    if (res.error) {
      showToast(res.mensaje ?? res.error, 'error');
      return;
    }
    showToast('Dirección eliminada', 'ok');
    onRefresh();
  };

  const handleSetPrincipal = async (dirId: string) => {
    setLoadingId(dirId);
    const res = await establecerDireccionPrincipal(dirId, cliente.id);
    setLoadingId(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast('Dirección principal actualizada', 'ok');
    onRefresh();
  };

  const fromDir = (d: ClienteDireccion): DireccionFormState => ({
    etiqueta: d.etiqueta,
    calle: d.calle,
    numero: d.numero ?? '',
    piso_dpto: d.piso_dpto ?? '',
    barrio: d.barrio ?? '',
    ciudad: d.ciudad,
    provincia: d.provincia,
    codigo_postal: d.codigo_postal ?? '',
    distancia_km: d.distancia_km != null ? String(d.distancia_km) : '',
    notas: d.notas ?? '',
    es_principal: d.es_principal,
  });

  const sorted = [...cliente.direcciones].sort(
    (a, b) => (b.es_principal ? 1 : 0) - (a.es_principal ? 1 : 0),
  );

  return (
    <div className='flex flex-col gap-2.5'>
      <div className='flex items-center justify-between'>
        <span className='text-[13px] text-slate-500'>
          {cliente.direcciones.length} dirección
          {cliente.direcciones.length !== 1 ? 'es' : ''}
        </span>
        {!agregando && (
          <button
            onClick={() => setAgregando(true)}
            className='flex items-center gap-[5px] px-3 py-1.5 rounded-[7px] border border-amber-500/25 bg-amber-500/[0.06] text-amber-500 text-xs font-semibold cursor-pointer'
          >
            <svg width='11' height='11' viewBox='0 0 11 11'>
              <path
                d='M5.5 1V10M1 5.5H10'
                stroke='currentColor'
                strokeWidth='1.6'
                strokeLinecap='round'
              />
            </svg>
            Nueva dirección
          </button>
        )}
      </div>
      {agregando && (
        <DireccionForm
          onSave={handleAgregar}
          onCancel={() => setAgregando(false)}
          loading={loadingId === 'nueva'}
        />
      )}
      {cliente.direcciones.length === 0 && !agregando && (
        <div className='p-6 text-center border border-dashed border-slate-400/10 rounded-[10px]'>
          <p className='m-0 text-[13px] text-[#334155]'>
            Sin direcciones registradas
          </p>
        </div>
      )}
      {sorted.map((dir) => (
        <div key={dir.id}>
          {editandoId === dir.id ? (
            <DireccionForm
              initial={fromDir(dir)}
              onSave={(f) => handleEditar(dir.id, f)}
              onCancel={() => setEditandoId(null)}
              loading={loadingId === dir.id}
            />
          ) : (
            <div
              className={cn(
                'bg-slate-900/70 rounded-xl backdrop-blur-sm p-[14px]',
                dir.es_principal
                  ? 'border border-amber-500/20'
                  : 'border border-slate-400/[0.08]',
              )}
            >
              <div className='flex items-start justify-between mb-2'>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span className='text-[13px]'>📍</span>
                  <span className='text-[13px] font-bold text-slate-400'>
                    {dir.etiqueta}
                  </span>
                  {dir.es_principal && (
                    <span className='text-[9px] font-bold tracking-widest uppercase text-amber-500 bg-amber-500/10 border border-amber-500/25 rounded px-[6px] py-px'>
                      Principal
                    </span>
                  )}
                  {dir.distancia_km != null && (
                    <span className='text-xs text-slate-600 font-mono bg-slate-400/[0.06] border border-slate-400/10 rounded px-[6px] py-px'>
                      {dir.distancia_km} km
                    </span>
                  )}
                </div>
                <div className='flex gap-1'>
                  {!dir.es_principal && (
                    <BtnIcono
                      onClick={() => handleSetPrincipal(dir.id)}
                      loading={loadingId === dir.id}
                      title='Marcar como principal'
                    >
                      <svg width='12' height='12' viewBox='0 0 12 12'>
                        <path
                          d='M6 1L7.5 4.5H11L8 6.5L9 10L6 8L3 10L4 6.5L1 4.5H4.5L6 1Z'
                          stroke='currentColor'
                          strokeWidth='1.2'
                          strokeLinejoin='round'
                        />
                      </svg>
                    </BtnIcono>
                  )}
                  <BtnIcono
                    onClick={() => setEditandoId(dir.id)}
                    title='Editar'
                  >
                    <svg width='12' height='12' viewBox='0 0 12 12'>
                      <path
                        d='M2 10L3.5 6.5L8.5 1.5C9 1 10 1 10.5 1.5C11 2 11 3 10.5 3.5L5.5 8.5L2 10Z'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinejoin='round'
                        strokeLinecap='round'
                      />
                    </svg>
                  </BtnIcono>
                  {!dir.es_principal && (
                    <BtnIcono
                      onClick={() => handleEliminar(dir.id)}
                      loading={loadingId === dir.id}
                      danger
                      title='Eliminar'
                    >
                      <svg width='12' height='12' viewBox='0 0 12 12'>
                        <path
                          d='M2 2L10 10M10 2L2 10'
                          stroke='currentColor'
                          strokeWidth='1.4'
                          strokeLinecap='round'
                        />
                      </svg>
                    </BtnIcono>
                  )}
                </div>
              </div>
              <div className='text-xs text-slate-500 leading-[1.8]'>
                <div>
                  {[dir.calle, dir.numero, dir.piso_dpto]
                    .filter(Boolean)
                    .join(' ')}
                </div>
                {dir.barrio && (
                  <div className='text-slate-600'>{dir.barrio}</div>
                )}
                <div className='font-mono text-xs text-slate-600'>
                  {[dir.ciudad, dir.provincia, dir.codigo_postal]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              {dir.notas && (
                <div className='mt-2 text-xs text-[#334155] italic'>
                  {dir.notas}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Tab Actividad ────────────────────────────────────────────────────────────

function TabActividad({ clienteId }: { clienteId: string }) {
  return (
    <div className='flex flex-col gap-2.5 items-start'>
      <div>
        <a
          href={`/presupuestos/nuevo?cliente=${clienteId}`}
          className='inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] text-amber-500 text-xs font-semibold no-underline transition-colors hover:bg-amber-500/10'
        >
          <svg width='11' height='11' viewBox='0 0 11 11'>
            <path
              d='M5.5 1V10M1 5.5H10'
              stroke='currentColor'
              strokeWidth='1.6'
              strokeLinecap='round'
            />
          </svg>
          Nuevo presupuesto
        </a>
      </div>
      {(['Presupuestos', 'Órdenes de Servicio', 'Facturas'] as const).map(
        (s) => (
          <div key={s} className={cn(cardClass, 'overflow-hidden w-full')}>
            <div className='px-4 py-3 border-b border-slate-400/[0.06] flex items-center justify-between'>
              <span className='text-xs font-bold text-slate-500 tracking-[0.04em]'>
                {s}
              </span>
              <span className='text-xs text-[#1e293b] font-mono'>
                Próximamente
              </span>
            </div>
            <div className='p-[18px] text-center'>
              <p className='m-0 text-xs text-[#1e293b]'>
                Se cargará cuando el módulo esté disponible
              </p>
            </div>
          </div>
        ),
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ClienteFicha({ clienteId }: Props) {
  const [cliente, setCliente] = useState<ClienteConDirecciones | null>(null);
  const [kpis, setKpis] = useState<ClienteKPIs | null>(null);
  const [loadingDatos, setLoadingDatos] = useState(true);
  const [loadingKpis, setLoadingKpis] = useState(true);
  const [tabActiva, setTabActiva] = useState<Tab>('general');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [accionLoading, setAccionLoading] = useState(false);
  const [confirmar, setConfirmar] = useState<'desactivar' | 'reactivar' | null>(
    null,
  );

  const showToast = useCallback(
    (mensaje: string, tipo: 'ok' | 'error') => setToast({ mensaje, tipo }),
    [],
  );

  const cargarCliente = useCallback(async () => {
    setLoadingDatos(true);
    if (shouldUsePlatformMocks) {
      setCliente(getMockClienteDetalle(clienteId));
      setLoadingDatos(false);
      return;
    }
    const res = await obtenerCliente(clienteId);
    setLoadingDatos(false);
    if (res.data) setCliente(res.data);
  }, [clienteId]);

  const cargarKpis = useCallback(async () => {
    setLoadingKpis(true);
    if (shouldUsePlatformMocks) {
      setKpis(getMockClienteKPIs(clienteId));
      setLoadingKpis(false);
      return;
    }
    const res = await obtenerKPIsCliente(clienteId);
    setLoadingKpis(false);
    if (res.data) setKpis(res.data);
  }, [clienteId]);

  useEffect(() => {
    cargarCliente();
    cargarKpis();
  }, [cargarCliente, cargarKpis]);

  const handleToggleEstado = async () => {
    if (!cliente) return;
    if (shouldUsePlatformMocks) {
      setCliente((prev) => (prev ? { ...prev, activo: !prev.activo } : prev));
      setConfirmar(null);
      showToast('Estado actualizado en modo mock', 'ok');
      return;
    }
    setAccionLoading(true);
    const res = cliente.activo
      ? await desactivarCliente(cliente.id)
      : await reactivarCliente(cliente.id);
    setAccionLoading(false);
    setConfirmar(null);
    if (res.error) {
      showToast(res.mensaje ?? res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Estado actualizado', 'ok');
    cargarCliente();
  };

  const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
    { id: 'general', label: 'General', icon: <ClipboardList className='w-3.5 h-3.5' /> },
    { id: 'direcciones', label: 'Direcciones', icon: '📍' },
    { id: 'actividad', label: 'Actividad', icon: <BarChart3 className='w-3.5 h-3.5' /> },
  ];

  return (
    <>
      <div className='px-3 py-2.5 pb-6 sm:px-5 sm:py-3 sm:pb-7 lg:px-5 lg:py-2 lg:pb-3'>
        <div className='w-full mx-auto'>
          {/* Breadcrumb */}
          <div className='mb-3 flex items-center gap-2 lg:mb-2.5'>
            <a
              href='/clientes'
              className='flex items-center gap-1 text-xs text-[#334155] no-underline tracking-widest uppercase hover:text-slate-400 transition-colors'
            >
              <ArrowLeft className='w-3 h-3' />
              Clientes
            </a>
            <span className='text-[#1e293b]'>›</span>
            <span className='text-xs text-slate-600 tracking-widest uppercase'>
              {loadingDatos ? '...' : (cliente?.razon_social ?? 'Ficha')}
            </span>
          </div>

          {/* Header */}
          <div
            className={cn(cardClass, 'mb-3 p-3.5 sm:p-4 lg:mb-2.5 lg:p-3.5')}
          >
            {loadingDatos ? (
              <div className='flex flex-col items-start gap-3 sm:flex-row sm:items-center'>
                <Skeleton w='60px' h='60px' r='14px' />
                <div className='flex-1 flex flex-col gap-2'>
                  <Skeleton w='200px' h='20px' />
                  <Skeleton w='130px' h='14px' />
                </div>
              </div>
            ) : cliente ? (
              <div className='flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between'>
                <div className='flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center'>
                  <div
                    className={`shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-[20px] font-bold text-amber-500 border-2 border-amber-500/20 bg-[${avatarColor(cliente.razon_social)}]`}
                  >
                    {avatarLetra(cliente.razon_social)}
                  </div>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2.5 mb-1 flex-wrap'>
                      <h1 className='m-0 min-w-0 break-words text-[17px] font-bold tracking-[-0.02em] text-slate-200 sm:text-[18px]'>
                        {cliente.razon_social}
                      </h1>
                      <BadgeEstado activo={cliente.activo} />
                    </div>
                    <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
                      {cliente.nombre_fantasia && (
                        <span className='text-[13px] text-slate-600'>
                          {cliente.nombre_fantasia}
                        </span>
                      )}
                      {cliente.cuit && (
                        <span className='max-w-full break-all rounded-[5px] border border-slate-400/10 bg-slate-400/5 px-2 py-px text-[12px] font-mono text-slate-600'>
                          {cliente.cuit}
                        </span>
                      )}
                      {cliente.segmento && (
                        <span className='text-xs text-slate-500'>
                          {cliente.segmento}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-1.5'>
                  <a
                    href={`/clientes/${cliente.id}/editar`}
                    className='inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-400/15 bg-slate-900/60 px-3.5 py-2 text-[12px] font-semibold text-slate-500 no-underline'
                  >
                    <svg width='12' height='25' viewBox='0 0 12 12'>
                      <path
                        d='M2 10L3.5 6.5L8.5 1.5C9 1 10 1 10.5 1.5C11 2 11 3 10.5 3.5L5.5 8.5L2 10Z'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinejoin='round'
                        strokeLinecap='round'
                      />
                    </svg>
                    Editar
                  </a>
                  <a
                    href={`/presupuestos/nuevo?cliente=${cliente.id}`}
                    className='inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-emerald-600/80 to-emerald-700/80 hover:from-emerald-600 hover:to-emerald-700 px-3.5 py-2 text-[12px] font-bold text-slate-900 no-underline shadow-sm shadow-emerald-600/15'
                  >
                    <svg width='11' height='25' viewBox='0 0 11 11'>
                      <path
                        d='M5.5 1V10M1 5.5H10'
                        stroke='currentColor'
                        strokeWidth='1.8'
                        strokeLinecap='round'
                      />
                    </svg>
                    Nuevo presupuesto
                  </a>
                  <button
                    onClick={() =>
                      setConfirmar(cliente.activo ? 'desactivar' : 'reactivar')
                    }
                    title={cliente.activo ? 'Desactivar' : 'Reactivar'}
                    className={`w-10 h-10 rounded-lg bg-transparent flex items-center justify-center cursor-pointer border ${cliente.activo ? 'border-red-400/20 text-red-400' : 'border-green-400/20 text-green-400'}`}
                  >
                    {cliente.activo ? (
                      <svg width='14' height='14' viewBox='0 0 14 14'>
                        <circle
                          cx='7'
                          cy='7'
                          r='5.5'
                          stroke='currentColor'
                          strokeWidth='1.4'
                        />
                        <line
                          x1='4'
                          y1='4'
                          x2='10'
                          y2='10'
                          stroke='currentColor'
                          strokeWidth='1.4'
                          strokeLinecap='round'
                        />
                      </svg>
                    ) : (
                      <svg width='14' height='14' viewBox='0 0 14 14'>
                        <circle
                          cx='7'
                          cy='7'
                          r='5.5'
                          stroke='currentColor'
                          strokeWidth='1.4'
                        />
                        <path
                          d='M5 7L6.5 8.5L9 5.5'
                          stroke='currentColor'
                          strokeWidth='1.4'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className='text-center p-5 text-slate-600'>
                Cliente no encontrado
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className='mb-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4 lg:mb-2.5'>
            <KPICard
              label='Total Facturado'
              value={kpis ? formatearMonto(kpis.monto_total_facturado) : '—'}
              sub={kpis ? `${kpis.facturas_emitidas} facturas` : undefined}
              colorCls='text-emerald-400'
              loading={loadingKpis}
            />
            <KPICard
              label='Saldo Pendiente'
              value={kpis ? formatearMonto(kpis.saldo_pendiente) : '—'}
              colorCls={
                kpis && kpis.saldo_pendiente > 0
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }
              loading={loadingKpis}
            />
            <KPICard
              label='Presupuestos'
              value={kpis ? String(kpis.presupuestos_emitidos) : '—'}
              sub={kpis ? `${kpis.tasa_conversion}% conversión` : undefined}
              colorCls='text-blue-400'
              loading={loadingKpis}
            />
            <KPICard
              label='Servicios Realizados'
              value={kpis ? String(kpis.servicios_realizados) : '—'}
              sub={
                kpis?.primera_operacion
                  ? `desde ${fmtFechaCorta(kpis.primera_operacion)}`
                  : undefined
              }
              colorCls='text-violet-400'
              loading={loadingKpis}
            />
          </div>

          {/* Tabs */}
          {cliente && (
            <div className={cn(cardClass, 'overflow-hidden')}>
              <div className='overflow-x-auto border-b border-slate-400/10 bg-slate-950/30'>
                <div className='flex min-w-max'>
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTabActiva(tab.id)}
                      className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 bg-transparent px-3.5 py-2 text-[12px] font-semibold transition-all sm:px-4 ${tabActiva === tab.id ? 'text-slate-200 border-amber-500' : 'text-slate-700 border-transparent'}`}
                    >
                      <span className='flex items-center text-[13px]'>{tab.icon}</span>
                      {tab.label}
                      {tab.id === 'direcciones' &&
                        cliente.direcciones.length > 0 && (
                          <span
                            className={`text-[9px] font-bold px-[5px] py-px rounded-[10px] font-mono ${tabActiva === tab.id ? 'bg-amber-500/[0.15] text-amber-500' : 'bg-slate-400/[0.08] text-slate-600'}`}
                          >
                            {cliente.direcciones.length}
                          </span>
                        )}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className='p-3.5 sm:p-4 lg:p-3.5 animate-fade-in'
                key={tabActiva}
              >
                {tabActiva === 'general' && <TabGeneral cliente={cliente} />}
                {tabActiva === 'direcciones' && (
                  <TabDirecciones
                    cliente={cliente}
                    onRefresh={cargarCliente}
                    showToast={showToast}
                  />
                )}
                {tabActiva === 'actividad' && (
                  <TabActividad clienteId={cliente.id} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal confirmar */}
      {confirmar && cliente && (
        <div className='fixed inset-0 flex items-center justify-center z-[100] bg-black/70 backdrop-blur-sm animate-fade-in'>
          <div className='bg-slate-950 border border-slate-400/[0.12] rounded-2xl p-7 w-[90%] max-w-[360px] animate-modal-in'>
            <div className='mb-3 flex items-center'>
              {confirmar === 'desactivar'
                ? <AlertTriangle className='w-8 h-8 text-amber-400' />
                : <CheckCircle2 className='w-8 h-8 text-emerald-400' />}
            </div>
            <h3 className='mt-0 mx-0 mb-2 text-[15px] font-bold text-slate-200'>
              {confirmar === 'desactivar'
                ? 'Desactivar cliente'
                : 'Reactivar cliente'}
            </h3>
            <p className='mt-0 mx-0 mb-5 text-[13px] text-slate-500 leading-[1.6]'>
              {confirmar === 'desactivar'
                ? `¿Desactivar a ${cliente.razon_social}? No aparecerá en nuevos documentos.`
                : `¿Reactivar a ${cliente.razon_social}? Volverá a estar disponible en el sistema.`}
            </p>
            <div className='flex justify-end gap-2.5'>
              <button
                onClick={() => setConfirmar(null)}
                className='px-4 py-2 rounded-lg border border-slate-400/[0.12] bg-transparent text-slate-500 text-[13px] cursor-pointer'
              >
                Cancelar
              </button>
              <button
                onClick={handleToggleEstado}
                disabled={accionLoading}
                className={`flex items-center gap-1.5 px-[18px] py-2 rounded-lg border-none text-[13px] font-bold ${confirmar === 'desactivar' ? 'bg-red-400/[0.15] text-red-400' : 'bg-gradient-to-br from-green-400/80 to-green-500/80 text-slate-900'} ${accionLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
              >
                {accionLoading && (
                  <svg
                    width='12'
                    height='12'
                    viewBox='0 0 12 12'
                    className='animate-spin'
                  >
                    <circle
                      cx='6'
                      cy='6'
                      r='4.5'
                      stroke='currentColor'
                      strokeWidth='1.5'
                      fill='none'
                      strokeDasharray='14'
                      strokeDashoffset='5'
                    />
                  </svg>
                )}
                {confirmar === 'desactivar' ? 'Desactivar' : 'Reactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </>
  );
}
