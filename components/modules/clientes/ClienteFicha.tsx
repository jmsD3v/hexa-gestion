'use client';

// ============================================================
// components/modules/clientes/ClienteFicha.tsx
// Vista detalle de un cliente: KPIs, datos, direcciones,
// actividad reciente y acciones rápidas.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from 'react';
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
const IVA_COLOR: Record<CondicionIVA, string> = {
  RESPONSABLE_INSCRIPTO: '#60a5fa',
  MONOTRIBUTISTA: '#a78bfa',
  EXENTO: '#34d399',
  CONSUMIDOR_FINAL: '#94a3b8',
  NO_RESPONSABLE: '#64748b',
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

const card: CSSProperties = {
  background: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(148,163,184,0.08)',
  borderRadius: '12px',
  backdropFilter: 'blur(12px)',
};
const inputSt: CSSProperties = {
  width: '100%',
  padding: '8px 11px',
  background: 'rgba(8,16,35,0.6)',
  border: '1px solid rgba(148,163,184,0.1)',
  borderRadius: '7px',
  color: '#e2e8f0',
  fontSize: '12px',
  fontFamily: "'DM Sans',sans-serif",
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};
const labelSt: CSSProperties = {
  fontSize: '10px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#475569',
  display: 'block',
  marginBottom: '4px',
};

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
      style={{
        width: w,
        height: h,
        borderRadius: r,
        background: 'rgba(148,163,184,0.07)',
        animation: 'shimmer 1.4s ease infinite',
      }}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span
        style={{
          fontSize: '10px',
          fontWeight: '600',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#334155',
        }}
      >
        {label}
      </span>
      {children ?? (
        <span
          style={{
            fontSize: '12px',
            color: value ? '#94a3b8' : '#1e293b',
            fontFamily: mono ? "'DM Mono',monospace" : "'DM Sans',sans-serif",
          }}
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
  color = '#94a3b8',
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        ...card,
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
      }}
    >
      <span
        style={{
          fontSize: '10px',
          fontWeight: '600',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#334155',
        }}
      >
        {label}
      </span>
      {loading ? (
        <Skeleton w='80px' h='22px' />
      ) : (
        <span
          style={{
            fontSize: '20px',
            fontWeight: '700',
            color,
            fontFamily: "'DM Mono',monospace",
            letterSpacing: '-0.02em',
          }}
        >
          {value}
        </span>
      )}
      {sub && !loading && (
        <span style={{ fontSize: '11px', color: '#334155' }}>{sub}</span>
      )}
    </div>
  );
}

function BadgeEstado({ activo }: { activo: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '20px',
        fontSize: '10px',
        fontWeight: '600',
        background: activo ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
        border: activo
          ? '1px solid rgba(74,222,128,0.25)'
          : '1px solid rgba(248,113,113,0.25)',
        color: activo ? '#4ade80' : '#f87171',
      }}
    >
      <span
        style={{
          width: '5px',
          height: '5px',
          borderRadius: '50%',
          background: 'currentColor',
          display: 'inline-block',
        }}
      />
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
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 18px',
        borderRadius: '10px',
        background: 'rgba(15,23,42,0.97)',
        border: `1px solid ${toast.tipo === 'ok' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        maxWidth: '320px',
      }}
    >
      <span
        style={{
          fontSize: '13px',
          color: toast.tipo === 'ok' ? '#4ade80' : '#f87171',
          fontWeight: '600',
        }}
      >
        {toast.tipo === 'ok' ? '✓' : '✕'}
      </span>
      <span
        style={{
          fontSize: '13px',
          color: toast.tipo === 'ok' ? '#4ade80' : '#f87171',
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        {toast.mensaje}
      </span>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '12px' }}>{icon}</span>
      <span
        style={{
          fontSize: '11px',
          fontWeight: '700',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#475569',
        }}
      >
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
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '6px',
        border: '1px solid rgba(148,163,184,0.08)',
        background: 'transparent',
        color: danger && hov ? '#f87171' : '#475569',
        cursor: loading ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.12s',
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading ? (
        <svg
          width='10'
          height='10'
          viewBox='0 0 10 10'
          style={{ animation: 'spin 0.8s linear infinite' }}
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
      className='p-4 sm:p-[18px] animate-[slideUp_0.2s_ease]'
      style={{ ...card, border: '1px solid rgba(245,158,11,0.15)' }}
    >
      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {fields.map(({ k, label, ph, col }) => (
          <div key={k} style={{ gridColumn: col }}>
            <label
              style={{ ...labelSt, color: errors[k] ? '#f59e0b' : '#475569' }}
            >
              {label}
            </label>
            <input
              value={form[k] as string}
              onChange={(e) => set(k, e.target.value)}
              placeholder={ph}
              style={{
                ...inputSt,
                borderColor: errors[k]
                  ? 'rgba(245,158,11,0.4)'
                  : 'rgba(148,163,184,0.1)',
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.35)')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = errors[k]
                  ? 'rgba(245,158,11,0.4)'
                  : 'rgba(148,163,184,0.1)')
              }
            />
            {errors[k] && (
              <span style={{ fontSize: '10px', color: '#f59e0b' }}>
                {errors[k]}
              </span>
            )}
          </div>
        ))}
        <div>
          <label style={labelSt}>Provincia</label>
          <div style={{ position: 'relative' }}>
            <select
              value={form.provincia}
              onChange={(e) => set('provincia', e.target.value)}
              style={{
                ...inputSt,
                appearance: 'none',
                paddingRight: '26px',
                cursor: 'pointer',
              }}
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
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: '#475569',
              }}
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
          <label style={labelSt}>Distancia (km)</label>
          <input
            type='number'
            min='0'
            value={form.distancia_km}
            onChange={(e) => set('distancia_km', e.target.value)}
            placeholder='0'
            style={inputSt}
          />
        </div>
        <div className='col-[1/-1] flex items-center gap-2.5'>
          <div
            onClick={() => set('es_principal', !form.es_principal)}
            style={{
              width: '32px',
              height: '18px',
              borderRadius: '9px',
              cursor: 'pointer',
              background: form.es_principal
                ? 'rgba(245,158,11,0.4)'
                : 'rgba(148,163,184,0.12)',
              border: `1px solid ${form.es_principal ? 'rgba(245,158,11,0.5)' : 'rgba(148,163,184,0.15)'}`,
              position: 'relative',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '2px',
                left: form.es_principal ? '15px' : '2px',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: form.es_principal ? '#f59e0b' : '#475569',
                transition: 'all 0.2s',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '12px',
              color: form.es_principal ? '#f59e0b' : '#475569',
            }}
          >
            Marcar como dirección principal
          </span>
        </div>
        <div style={{ gridColumn: '1/-1' }}>
          <label style={labelSt}>Notas</label>
          <textarea
            value={form.notas}
            onChange={(e) => set('notas', e.target.value)}
            placeholder='Observaciones...'
            rows={2}
            style={{ ...inputSt, resize: 'vertical', lineHeight: '1.5' }}
          />
        </div>
      </div>
      <div className='mt-3.5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
        <button
          onClick={onCancel}
          style={{
            padding: '7px 14px',
            borderRadius: '7px',
            border: '1px solid rgba(148,163,184,0.12)',
            background: 'transparent',
            color: '#64748b',
            fontSize: '12px',
            cursor: 'pointer',
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            padding: '7px 16px',
            borderRadius: '7px',
            border: 'none',
            background: loading
              ? 'rgba(245,158,11,0.3)'
              : 'linear-gradient(135deg,rgba(245,158,11,0.9),rgba(217,119,6,0.9))',
            color: '#0f172a',
            fontSize: '12px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans',sans-serif",
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {loading && (
            <svg
              width='11'
              height='11'
              viewBox='0 0 11 11'
              style={{ animation: 'spin 0.8s linear infinite' }}
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
                fill='none'
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
      <div className='p-3 sm:p-3.5' style={{ ...card }}>
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
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: IVA_COLOR[cliente.condicion_iva],
                background: `${IVA_COLOR[cliente.condicion_iva]}14`,
                border: `1px solid ${IVA_COLOR[cliente.condicion_iva]}30`,
                padding: '1px 7px',
                borderRadius: '5px',
                display: 'inline-block',
                marginTop: '1px',
              }}
            >
              {IVA_LABEL[cliente.condicion_iva]}
            </span>
          </InfoPar>
          {cliente.ingresos_brutos && (
            <InfoPar label='Ing. Brutos' value={cliente.ingresos_brutos} mono />
          )}
        </div>
      </div>
      <div className='p-3.5 sm:p-4' style={{ ...card }}>
        <SectionTitle icon='📋' title='Datos Comerciales' />
        <div className='mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 sm:gap-3'>
          {cliente.contacto_nombre && (
            <InfoPar label='Contacto'>
              <div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                  {cliente.contacto_nombre}
                </div>
                {cliente.contacto_cargo && (
                  <div style={{ fontSize: '11px', color: '#475569' }}>
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
                style={{
                  fontSize: '13px',
                  color: '#60a5fa',
                  fontFamily: "'DM Mono',monospace",
                  textDecoration: 'none',
                }}
              >
                {cliente.telefono}
              </a>
            </InfoPar>
          )}
          {cliente.telefono_alt && (
            <InfoPar label='Tel. Alt.'>
              <a
                href={`tel:${cliente.telefono_alt}`}
                style={{
                  fontSize: '13px',
                  color: '#60a5fa',
                  fontFamily: "'DM Mono',monospace",
                  textDecoration: 'none',
                }}
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
        <div className='p-3.5 sm:p-4' style={{ ...card }}>
          <SectionTitle icon='🏷' title='Clasificación' />
          <div className='mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3 sm:gap-3'>
            {cliente.segmento && (
              <InfoPar label='Segmento'>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#94a3b8',
                    background: 'rgba(148,163,184,0.08)',
                    border: '1px solid rgba(148,163,184,0.12)',
                    borderRadius: '5px',
                    padding: '3px 8px',
                    display: 'inline-block',
                  }}
                >
                  {cliente.segmento}
                </span>
              </InfoPar>
            )}
            {cliente.origen && (
              <InfoPar label='Origen' value={cliente.origen} />
            )}
          </div>
          {cliente.notas && (
            <div
              style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid rgba(148,163,184,0.06)',
              }}
            >
              <label style={labelSt}>Notas internas</label>
              <p
                style={{
                  margin: 0,
                  fontSize: '12px',
                  color: '#64748b',
                  lineHeight: '1.55',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {cliente.notas}
              </p>
            </div>
          )}
        </div>
      )}
      <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
        <div className='px-3.5 py-3' style={{ ...card }}>
          <div
            style={{
              fontSize: '10px',
              color: '#334155',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Creado
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#475569',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {fmtFecha(cliente.creado_en)}
          </div>
        </div>
        <div className='px-3.5 py-3' style={{ ...card }}>
          <div
            style={{
              fontSize: '10px',
              color: '#334155',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            Última actualización
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#475569',
              fontFamily: "'DM Mono',monospace",
            }}
          >
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: '13px', color: '#64748b' }}>
          {cliente.direcciones.length} dirección
          {cliente.direcciones.length !== 1 ? 'es' : ''}
        </span>
        {!agregando && (
          <button
            onClick={() => setAgregando(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 12px',
              borderRadius: '7px',
              border: '1px solid rgba(245,158,11,0.25)',
              background: 'rgba(245,158,11,0.06)',
              color: '#f59e0b',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif",
            }}
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
        <div
          style={{
            padding: '24px',
            textAlign: 'center',
            border: '1px dashed rgba(148,163,184,0.1)',
            borderRadius: '10px',
          }}
        >
          <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
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
              style={{
                ...card,
                border: dir.es_principal
                  ? '1px solid rgba(245,158,11,0.2)'
                  : '1px solid rgba(148,163,184,0.08)',
                padding: '14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '13px' }}>📍</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: '#94a3b8',
                    }}
                  >
                    {dir.etiqueta}
                  </span>
                  {dir.es_principal && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#f59e0b',
                        background: 'rgba(245,158,11,0.1)',
                        border: '1px solid rgba(245,158,11,0.25)',
                        borderRadius: '4px',
                        padding: '1px 6px',
                      }}
                    >
                      Principal
                    </span>
                  )}
                  {dir.distancia_km != null && (
                    <span
                      style={{
                        fontSize: '10px',
                        color: '#475569',
                        fontFamily: "'DM Mono',monospace",
                        background: 'rgba(148,163,184,0.06)',
                        border: '1px solid rgba(148,163,184,0.1)',
                        borderRadius: '4px',
                        padding: '1px 6px',
                      }}
                    >
                      {dir.distancia_km} km
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
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
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  lineHeight: '1.8',
                }}
              >
                <div>
                  {[dir.calle, dir.numero, dir.piso_dpto]
                    .filter(Boolean)
                    .join(' ')}
                </div>
                {dir.barrio && (
                  <div style={{ color: '#475569' }}>{dir.barrio}</div>
                )}
                <div
                  style={{
                    fontFamily: "'DM Mono',monospace",
                    fontSize: '11px',
                    color: '#475569',
                  }}
                >
                  {[dir.ciudad, dir.provincia, dir.codigo_postal]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              {dir.notas && (
                <div
                  style={{
                    marginTop: '8px',
                    fontSize: '11px',
                    color: '#334155',
                    fontStyle: 'italic',
                  }}
                >
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
        <a
          href={`/presupuestos/nuevo?cliente=${clienteId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid rgba(245,158,11,0.25)',
            background: 'rgba(245,158,11,0.06)',
            color: '#f59e0b',
            fontSize: '12px',
            fontWeight: '600',
            textDecoration: 'none',
            fontFamily: "'DM Sans',sans-serif",
          }}
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
          <div key={s} style={{ ...card, overflow: 'hidden' }}>
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid rgba(148,163,184,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#64748b',
                  letterSpacing: '0.04em',
                }}
              >
                {s}
              </span>
              <span
                style={{
                  fontSize: '10px',
                  color: '#1e293b',
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                Próximamente
              </span>
            </div>
            <div style={{ padding: '18px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '12px', color: '#1e293b' }}>
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

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: '📋' },
    { id: 'direcciones', label: 'Direcciones', icon: '📍' },
    { id: 'actividad', label: 'Actividad', icon: '📊' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box}body{margin:0;background:#060d1a;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        option{background:#0f172a;color:#e2e8f0}input:focus,select:focus,textarea:focus{outline:none!important}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}@keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes scaleIn{from{transform:scale(0.96);opacity:0}to{transform:scale(1);opacity:1}}
      `}</style>

      <div className='px-3 py-2.5 pb-6 sm:px-5 sm:py-3 sm:pb-7 lg:px-5 lg:py-2 lg:pb-3'>
        <div style={{ width: '100%', margin: '0 auto' }}>
          {/* Breadcrumb */}
          <div className='mb-3 flex items-center gap-2 lg:mb-2.5'>
            <a
              href='/clientes'
              style={{
                fontSize: '11px',
                color: '#334155',
                textDecoration: 'none',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Clientes
            </a>
            <span style={{ color: '#1e293b' }}>›</span>
            <span
              style={{
                fontSize: '11px',
                color: '#475569',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {loadingDatos ? '...' : (cliente?.razon_social ?? 'Ficha')}
            </span>
          </div>

          {/* Header */}
          <div
            className='mb-3 p-3.5 sm:p-4 lg:mb-2.5 lg:p-3.5'
            style={{ ...card }}
          >
            {loadingDatos ? (
              <div className='flex flex-col items-start gap-3 sm:flex-row sm:items-center'>
                <Skeleton w='60px' h='60px' r='14px' />
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <Skeleton w='200px' h='20px' />
                  <Skeleton w='130px' h='14px' />
                </div>
              </div>
            ) : cliente ? (
              <div className='flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between'>
                <div className='flex min-w-0 flex-col gap-2.5 sm:flex-row sm:items-center'>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '12px',
                      flexShrink: 0,
                      background: avatarColor(cliente.razon_social),
                      border: '2px solid rgba(245,158,11,0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#f59e0b',
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    {avatarLetra(cliente.razon_social)}
                  </div>
                  <div className='min-w-0'>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '4px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <h1
                        className='min-w-0 break-words text-[17px] font-bold tracking-[-0.02em] text-slate-200 sm:text-[18px]'
                        style={{ margin: 0 }}
                      >
                        {cliente.razon_social}
                      </h1>
                      <BadgeEstado activo={cliente.activo} />
                    </div>
                    <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
                      {cliente.nombre_fantasia && (
                        <span style={{ fontSize: '13px', color: '#475569' }}>
                          {cliente.nombre_fantasia}
                        </span>
                      )}
                      {cliente.cuit && (
                        <span className='max-w-full break-all rounded-[5px] border border-slate-400/10 bg-slate-400/5 px-2 py-px text-[12px] font-mono text-slate-600'>
                          {cliente.cuit}
                        </span>
                      )}
                      {cliente.segmento && (
                        <span style={{ fontSize: '11px', color: '#64748b' }}>
                          {cliente.segmento}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className='flex w-full flex-wrap items-center gap-1.5 lg:w-auto lg:flex-nowrap'>
                  <a
                    href={`/clientes/${cliente.id}/editar`}
                    className='inline-flex basis-[calc(50%-4px)] items-center justify-center gap-1.5 rounded-lg border border-slate-400/15 bg-slate-900/60 px-3.5 py-1.75 text-[12px] font-semibold text-slate-500 no-underline sm:basis-auto'
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
                    Editar
                  </a>
                  <a
                    href={`/presupuestos/nuevo?cliente=${cliente.id}`}
                    className='inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-br from-amber-500/90 to-amber-600/90 px-3.5 py-1.75 text-[12px] font-bold text-slate-900 no-underline shadow-[0_4px_12px_rgba(245,158,11,0.15)] sm:flex-none'
                  >
                    <svg width='11' height='11' viewBox='0 0 11 11'>
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
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      border: cliente.activo
                        ? '1px solid rgba(248,113,113,0.2)'
                        : '1px solid rgba(74,222,128,0.2)',
                      background: 'transparent',
                      color: cliente.activo ? '#f87171' : '#4ade80',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
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
              <div
                style={{
                  textAlign: 'center',
                  padding: '20px',
                  color: '#475569',
                }}
              >
                Cliente no encontrado
              </div>
            )}
          </div>

          {/* KPIs */}
          <div className='mb-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-4 lg:mb-2.5'>
            <KPICard
              label='Total Facturado'
              value={kpis ? formatearMonto(kpis.monto_total_facturado) : '—'}
              sub={kpis ? `${kpis.facturas_emitidas} facturas` : undefined}
              color='#4ade80'
              loading={loadingKpis}
            />
            <KPICard
              label='Saldo Pendiente'
              value={kpis ? formatearMonto(kpis.saldo_pendiente) : '—'}
              color={kpis && kpis.saldo_pendiente > 0 ? '#f87171' : '#4ade80'}
              loading={loadingKpis}
            />
            <KPICard
              label='Presupuestos'
              value={kpis ? String(kpis.presupuestos_emitidos) : '—'}
              sub={kpis ? `${kpis.tasa_conversion}% conversión` : undefined}
              color='#60a5fa'
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
              color='#a78bfa'
              loading={loadingKpis}
            />
          </div>

          {/* Tabs */}
          {cliente && (
            <div className='overflow-hidden' style={{ ...card }}>
              <div className='overflow-x-auto border-b border-slate-400/10 bg-slate-950/30'>
                <div className='flex min-w-max'>
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setTabActiva(tab.id)}
                      className='flex items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent bg-transparent px-3.5 py-2 text-[12px] font-semibold transition-all sm:px-4'
                      style={{
                        color: tabActiva === tab.id ? '#e2e8f0' : '#334155',
                        borderBottomColor:
                          tabActiva === tab.id ? '#f59e0b' : 'transparent',
                      }}
                    >
                      <span style={{ fontSize: '13px' }}>{tab.icon}</span>
                      {tab.label}
                      {tab.id === 'direcciones' &&
                        cliente.direcciones.length > 0 && (
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: '700',
                              padding: '1px 5px',
                              borderRadius: '10px',
                              background:
                                tabActiva === tab.id
                                  ? 'rgba(245,158,11,0.15)'
                                  : 'rgba(148,163,184,0.08)',
                              color:
                                tabActiva === tab.id ? '#f59e0b' : '#475569',
                              fontFamily: "'DM Mono',monospace",
                            }}
                          >
                            {cliente.direcciones.length}
                          </span>
                        )}
                    </button>
                  ))}
                </div>
              </div>
              <div
                className='p-3.5 sm:p-4 lg:p-3.5'
                style={{ animation: 'fadeIn 0.15s ease' }}
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
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(148,163,184,0.12)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '360px',
              width: '90%',
              animation: 'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>
              {confirmar === 'desactivar' ? '⚠️' : '✅'}
            </div>
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: '15px',
                fontWeight: '700',
                color: '#e2e8f0',
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {confirmar === 'desactivar'
                ? 'Desactivar cliente'
                : 'Reactivar cliente'}
            </h3>
            <p
              style={{
                margin: '0 0 20px',
                fontSize: '13px',
                color: '#64748b',
                lineHeight: '1.6',
              }}
            >
              {confirmar === 'desactivar'
                ? `¿Desactivar a ${cliente.razon_social}? No aparecerá en nuevos documentos.`
                : `¿Reactivar a ${cliente.razon_social}? Volverá a estar disponible en el sistema.`}
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                onClick={() => setConfirmar(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(148,163,184,0.12)',
                  background: 'transparent',
                  color: '#64748b',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleToggleEstado}
                disabled={accionLoading}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background:
                    confirmar === 'desactivar'
                      ? 'rgba(248,113,113,0.15)'
                      : 'linear-gradient(135deg,rgba(74,222,128,0.8),rgba(34,197,94,0.8))',
                  color: confirmar === 'desactivar' ? '#f87171' : '#0f172a',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: accionLoading ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: accionLoading ? 0.6 : 1,
                }}
              >
                {accionLoading && (
                  <svg
                    width='12'
                    height='12'
                    viewBox='0 0 12 12'
                    style={{ animation: 'spin 0.8s linear infinite' }}
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
