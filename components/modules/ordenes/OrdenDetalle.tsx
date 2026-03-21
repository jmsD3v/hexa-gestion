'use client';

// ============================================================
// components/modules/ordenes/OrdenDetalle.tsx
// Vista detalle de OS: avance deslizable, técnicos CRUD,
// notas técnicas, cambio de estado y cierre de orden.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { OrdenServicioCompleta, OrdenTecnico, EstadoOrden } from '@/types';
import {
  obtenerOrden,
  cambiarEstadoOrden,
  actualizarAvance,
  agregarTecnico,
  eliminarTecnico,
  actualizarNotasTecnicas,
} from '@/app/actions/ordenes';
import {
  getMockOrdenDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type OrdenCompleta = OrdenServicioCompleta & {
  razon_social: string;
  numero_presupuesto: string | null;
};

interface Props {
  ordenId: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<
  EstadoOrden,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.15)',
    icon: '⏳',
  },
  EN_PROGRESO: {
    label: 'En Progreso',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
    icon: '⚙️',
  },
  COMPLETADA: {
    label: 'Completada',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
    icon: '✅',
  },
  CANCELADA: {
    label: 'Cancelada',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
    icon: '❌',
  },
  SUSPENDIDA: {
    label: 'Suspendida',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    icon: '⏸',
  },
};

const TRANSICIONES: Partial<Record<EstadoOrden, EstadoOrden[]>> = {
  PENDIENTE: ['EN_PROGRESO', 'CANCELADA'],
  EN_PROGRESO: ['COMPLETADA', 'SUSPENDIDA', 'CANCELADA'],
  SUSPENDIDA: ['EN_PROGRESO', 'CANCELADA'],
  CANCELADA: ['PENDIENTE'],
  COMPLETADA: [],
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtFecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';
const avatarLetra = (s: string) => s.charAt(0).toUpperCase();
const avatarColor = (s: string) =>
  `hsl(${(s.charCodeAt(0) * 13) % 360},40%,18%)`;
const diasRestantes = (fin: string | null) => {
  if (!fin) return null;
  return Math.ceil((new Date(fin).getTime() - Date.now()) / 86400000);
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
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
            fontSize: '13px',
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

function BadgeEstado({ estado }: { estado: EstadoOrden }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '3px 10px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: '600',
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
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
      {cfg.label}
    </span>
  );
}

function Toast({
  mensaje,
  tipo,
  onClose,
}: {
  mensaje: string;
  tipo: 'ok' | 'error';
  onClose: () => void;
}) {
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
        border: `1px solid ${tipo === 'ok' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}
    >
      <span
        style={{
          fontSize: '13px',
          color: tipo === 'ok' ? '#4ade80' : '#f87171',
          fontWeight: '600',
        }}
      >
        {tipo === 'ok' ? '✓' : '✕'}
      </span>
      <span
        style={{
          fontSize: '13px',
          color: tipo === 'ok' ? '#4ade80' : '#f87171',
          fontFamily: "'DM Sans',sans-serif",
        }}
      >
        {mensaje}
      </span>
    </div>
  );
}

// ─── Panel de avance ──────────────────────────────────────────────────────────

function PanelAvance({
  orden,
  onUpdate,
}: {
  orden: OrdenCompleta;
  onUpdate: () => void;
}) {
  const [valor, setValor] = useState(orden.porcentaje_avance);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setValor(orden.porcentaje_avance);
  }, [orden.porcentaje_avance]);

  const handleChange = (v: number) => {
    setValor(v);
    setDirty(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      await actualizarAvance(orden.id, v);
      setLoading(false);
      setDirty(false);
      onUpdate();
    }, 800);
  };

  const color = valor === 100 ? '#4ade80' : valor >= 50 ? '#60a5fa' : '#f59e0b';

  return (
    <div style={{ ...card, padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#475569',
          }}
        >
          Avance de la orden
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {loading && (
            <svg
              width='12'
              height='12'
              viewBox='0 0 12 12'
              style={{
                animation: 'spin 0.8s linear infinite',
                color: '#475569',
              }}
            >
              <circle
                cx='6'
                cy='6'
                r='4.5'
                stroke='currentColor'
                strokeWidth='1.4'
                fill='none'
                strokeDasharray='14'
                strokeDashoffset='5'
              />
            </svg>
          )}
          <span
            style={{
              fontSize: '28px',
              fontWeight: '800',
              color,
              fontFamily: "'DM Mono',monospace",
              letterSpacing: '-0.03em',
              transition: 'color 0.3s',
            }}
          >
            {valor}%
          </span>
        </div>
      </div>

      {/* Slider */}
      {orden.estado !== 'COMPLETADA' && orden.estado !== 'CANCELADA' ? (
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <div
            style={{
              height: '8px',
              background: 'rgba(148,163,184,0.08)',
              borderRadius: '4px',
              position: 'relative',
              overflow: 'visible',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${valor}%`,
                background: `linear-gradient(to right, #f59e0b, ${color})`,
                borderRadius: '4px',
                transition: 'width 0.2s',
              }}
            />
          </div>
          <input
            type='range'
            min={0}
            max={100}
            step={5}
            value={valor}
            onChange={(e) => handleChange(Number(e.target.value))}
            style={{
              position: 'absolute',
              top: '-6px',
              left: 0,
              width: '100%',
              height: '20px',
              opacity: 0,
              cursor: 'pointer',
              zIndex: 1,
              margin: 0,
            }}
          />
          {/* Thumb visual */}
          <div
            style={{
              position: 'absolute',
              top: '-3px',
              left: `calc(${valor}% - 7px)`,
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: color,
              border: '2px solid #0f172a',
              boxShadow: `0 0 0 3px ${color}30`,
              transition: 'left 0.2s, background 0.3s',
              pointerEvents: 'none',
            }}
          />
        </div>
      ) : (
        <div
          style={{
            height: '8px',
            background: 'rgba(148,163,184,0.08)',
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '14px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${valor}%`,
              background: color,
              borderRadius: '4px',
            }}
          />
        </div>
      )}

      {/* Hitos */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {[0, 25, 50, 75, 100].map((h) => (
          <button
            key={h}
            disabled={
              orden.estado === 'COMPLETADA' || orden.estado === 'CANCELADA'
            }
            onClick={() => handleChange(h)}
            style={{
              padding: '3px 7px',
              borderRadius: '5px',
              cursor: 'pointer',
              border:
                valor === h
                  ? `1px solid ${color}50`
                  : '1px solid rgba(148,163,184,0.08)',
              background: valor === h ? `${color}12` : 'transparent',
              color: valor === h ? color : '#334155',
              fontSize: '10px',
              fontWeight: '600',
              fontFamily: "'DM Mono',monospace",
              transition: 'all 0.15s',
            }}
          >
            {h}%
          </button>
        ))}
      </div>

      {valor === 100 && orden.estado !== 'COMPLETADA' && (
        <div
          style={{
            marginTop: '14px',
            padding: '10px 14px',
            background: 'rgba(74,222,128,0.06)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#4ade80',
          }}
        >
          Al guardar el 100%, la orden se marcará como completada
          automáticamente.
        </div>
      )}
    </div>
  );
}

// ─── Panel de técnicos ────────────────────────────────────────────────────────

function PanelTecnicos({
  orden,
  onUpdate,
  showToast,
}: {
  orden: OrdenCompleta;
  onUpdate: () => void;
  showToast: (m: string, t: 'ok' | 'error') => void;
}) {
  const [agregando, setAgregando] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: '',
    rol: '',
    fecha_desde: '',
    fecha_hasta: '',
    notas: '',
  });
  const [errors, setErrors] = useState<{ nombre?: string }>({});

  const handleAgregar = async () => {
    if (!form.nombre.trim()) {
      setErrors({ nombre: 'Requerido' });
      return;
    }
    setLoadingId('nueva');
    const res = await agregarTecnico(orden.id, {
      nombre: form.nombre,
      rol: form.rol || undefined,
      fecha_desde: form.fecha_desde || undefined,
      fecha_hasta: form.fecha_hasta || undefined,
      notas: form.notas || undefined,
    });
    setLoadingId(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast('Técnico agregado', 'ok');
    setForm({
      nombre: '',
      rol: '',
      fecha_desde: '',
      fecha_hasta: '',
      notas: '',
    });
    setAgregando(false);
    onUpdate();
  };

  const handleEliminar = async (tecId: string) => {
    setLoadingId(tecId);
    const res = await eliminarTecnico(tecId, orden.id);
    setLoadingId(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast('Técnico eliminado', 'ok');
    onUpdate();
  };

  const canEdit = !['COMPLETADA', 'CANCELADA'].includes(orden.estado);

  return (
    <div style={{ ...card, padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '13px' }}>👷</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#475569',
            }}
          >
            Equipo técnico
          </span>
          {orden.tecnicos.length > 0 && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: '700',
                color: '#475569',
                background: 'rgba(148,163,184,0.08)',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: '10px',
                padding: '1px 6px',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {orden.tecnicos.length}
            </span>
          )}
        </div>
        {canEdit && !agregando && (
          <button
            onClick={() => setAgregando(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(96,165,250,0.25)',
              background: 'rgba(96,165,250,0.06)',
              color: '#60a5fa',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer',
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            <svg width='10' height='10' viewBox='0 0 10 10'>
              <path
                d='M5 1V9M1 5H9'
                stroke='currentColor'
                strokeWidth='1.6'
                strokeLinecap='round'
              />
            </svg>
            Agregar
          </button>
        )}
      </div>

      {orden.tecnicos.length === 0 && !agregando && (
        <div
          style={{
            padding: '20px',
            textAlign: 'center',
            border: '1px dashed rgba(148,163,184,0.1)',
            borderRadius: '8px',
          }}
        >
          <p style={{ margin: 0, fontSize: '12px', color: '#334155' }}>
            Sin técnicos asignados
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {orden.tecnicos.map((tec) => (
          <div
            key={tec.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              background: 'rgba(8,16,35,0.4)',
              border: '1px solid rgba(148,163,184,0.07)',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: avatarColor(tec.nombre),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: '700',
                color: '#94a3b8',
                flexShrink: 0,
              }}
            >
              {avatarLetra(tec.nombre)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#94a3b8',
                }}
              >
                {tec.nombre}
              </div>
              {tec.rol && (
                <div style={{ fontSize: '11px', color: '#475569' }}>
                  {tec.rol}
                </div>
              )}
              {(tec.fecha_desde || tec.fecha_hasta) && (
                <div
                  style={{
                    fontSize: '10px',
                    color: '#334155',
                    fontFamily: "'DM Mono',monospace",
                    marginTop: '2px',
                  }}
                >
                  {tec.fecha_desde ? fmtFecha(tec.fecha_desde) : '—'} →{' '}
                  {tec.fecha_hasta ? fmtFecha(tec.fecha_hasta) : '—'}
                </div>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => handleEliminar(tec.id)}
                disabled={loadingId === tec.id}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '5px',
                  border: '1px solid rgba(148,163,184,0.08)',
                  background: 'transparent',
                  color: '#334155',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#f87171';
                  e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#334155';
                  e.currentTarget.style.borderColor = 'rgba(148,163,184,0.08)';
                }}
              >
                {loadingId === tec.id ? (
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
                  <svg width='10' height='10' viewBox='0 0 10 10'>
                    <path
                      d='M2 2L8 8M8 2L2 8'
                      stroke='currentColor'
                      strokeWidth='1.4'
                      strokeLinecap='round'
                    />
                  </svg>
                )}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Form nuevo técnico */}
      {agregando && (
        <div
          style={{
            marginTop: '10px',
            padding: '14px',
            background: 'rgba(8,16,35,0.5)',
            border: '1px solid rgba(96,165,250,0.15)',
            borderRadius: '9px',
            animation: 'slideUp 0.2s ease',
          }}
        >
          <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2 mb-2.5'>
            <div>
              <label
                style={{
                  ...labelSt,
                  color: errors.nombre ? '#f59e0b' : '#475569',
                }}
              >
                Nombre *
              </label>
              <input
                value={form.nombre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nombre: e.target.value }))
                }
                placeholder='Ej: Juan Pérez'
                style={{
                  ...inputSt,
                  borderColor: errors.nombre
                    ? 'rgba(245,158,11,0.4)'
                    : 'rgba(148,163,184,0.1)',
                }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = 'rgba(96,165,250,0.35)')
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = errors.nombre
                    ? 'rgba(245,158,11,0.4)'
                    : 'rgba(148,163,184,0.1)')
                }
              />
              {errors.nombre && (
                <span style={{ fontSize: '10px', color: '#f59e0b' }}>
                  {errors.nombre}
                </span>
              )}
            </div>
            <div>
              <label style={labelSt}>Rol / función</label>
              <input
                value={form.rol}
                onChange={(e) =>
                  setForm((p) => ({ ...p, rol: e.target.value }))
                }
                placeholder='Ej: Electricista'
                style={inputSt}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = 'rgba(96,165,250,0.35)')
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)')
                }
              />
            </div>
            <div>
              <label style={labelSt}>Desde</label>
              <input
                type='date'
                value={form.fecha_desde}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha_desde: e.target.value }))
                }
                style={{ ...inputSt, colorScheme: 'dark' }}
              />
            </div>
            <div>
              <label style={labelSt}>Hasta</label>
              <input
                type='date'
                value={form.fecha_hasta}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha_hasta: e.target.value }))
                }
                style={{ ...inputSt, colorScheme: 'dark' }}
              />
            </div>
          </div>
          <div
            style={{ display: 'flex', justifyContent: 'flex-end', gap: '7px' }}
          >
            <button
              onClick={() => {
                setAgregando(false);
                setErrors({});
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(148,163,184,0.12)',
                background: 'transparent',
                color: '#64748b',
                fontSize: '11px',
                cursor: 'pointer',
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleAgregar}
              disabled={loadingId === 'nueva'}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: 'rgba(96,165,250,0.15)',
                color: '#60a5fa',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: "'DM Sans',sans-serif",
              }}
            >
              {loadingId === 'nueva' ? 'Guardando...' : 'Agregar técnico'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel notas técnicas ─────────────────────────────────────────────────────

function PanelNotas({
  orden,
  onUpdate,
  showToast,
}: {
  orden: OrdenCompleta;
  onUpdate: () => void;
  showToast: (m: string, t: 'ok' | 'error') => void;
}) {
  const [texto, setTexto] = useState(orden.notas_tecnicas ?? '');
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setTexto(orden.notas_tecnicas ?? '');
  }, [orden.notas_tecnicas]);

  const handleChange = (v: string) => {
    setTexto(v);
    setDirty(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await actualizarNotasTecnicas(orden.id, v);
      setLoading(false);
      setDirty(false);
      if (res.error) showToast(res.error, 'error');
    }, 1200);
  };

  const canEdit = !['COMPLETADA', 'CANCELADA'].includes(orden.estado);

  return (
    <div style={{ ...card, padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '13px' }}>🔧</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#475569',
            }}
          >
            Notas técnicas
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {loading && (
            <svg
              width='11'
              height='11'
              viewBox='0 0 11 11'
              style={{
                animation: 'spin 0.8s linear infinite',
                color: '#475569',
              }}
            >
              <circle
                cx='5.5'
                cy='5.5'
                r='4'
                stroke='currentColor'
                strokeWidth='1.4'
                fill='none'
                strokeDasharray='12'
                strokeDashoffset='4'
              />
            </svg>
          )}
          {dirty && !loading && (
            <span style={{ fontSize: '10px', color: '#475569' }}>
              Guardando...
            </span>
          )}
          {!dirty && !loading && texto && (
            <span style={{ fontSize: '10px', color: '#334155' }}>
              ✓ Guardado
            </span>
          )}
        </div>
      </div>
      <textarea
        value={texto}
        onChange={(e) => canEdit && handleChange(e.target.value)}
        readOnly={!canEdit}
        placeholder={
          canEdit
            ? 'Registrá el trabajo realizado, materiales usados, incidencias técnicas...'
            : 'Sin notas técnicas'
        }
        rows={6}
        style={{
          ...inputSt,
          resize: 'vertical',
          lineHeight: '1.7',
          minHeight: '120px',
          fontSize: '13px',
          color: texto ? '#94a3b8' : '#334155',
          cursor: canEdit ? 'text' : 'default',
          borderColor: dirty
            ? 'rgba(96,165,250,0.25)'
            : 'rgba(148,163,184,0.1)',
        }}
      />
    </div>
  );
}

// ─── Modal de cierre ──────────────────────────────────────────────────────────

function ModalCierre({
  onConfirmar,
  onCancelar,
  loading,
}: {
  onConfirmar: (obs: string, fecha: string) => void;
  onCancelar: () => void;
  loading: boolean;
}) {
  const [obs, setObs] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);

  return (
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
          maxWidth: '420px',
          width: '90%',
          animation: 'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>✅</div>
        <h3
          style={{
            margin: '0 0 6px',
            fontSize: '15px',
            fontWeight: '700',
            color: '#e2e8f0',
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          Cerrar orden de servicio
        </h3>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: '13px',
            color: '#64748b',
            lineHeight: '1.6',
          }}
        >
          La orden se marcará como completada. Este estado no se puede revertir
          fácilmente.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelSt}>Fecha de cierre real</label>
            <input
              type='date'
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{ ...inputSt, colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label style={labelSt}>Observaciones de cierre</label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder='Trabajo completado, entregables, observaciones finales...'
              rows={3}
              style={{ ...inputSt, resize: 'vertical', lineHeight: '1.6' }}
            />
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px',
          }}
        >
          <button
            onClick={onCancelar}
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
            onClick={() => onConfirmar(obs, fecha)}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background:
                'linear-gradient(135deg,rgba(74,222,128,0.8),rgba(34,197,94,0.8))',
              color: '#0f172a',
              fontSize: '13px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans',sans-serif",
              opacity: loading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {loading && (
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
            Confirmar cierre
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function OrdenDetalle({ ordenId }: Props) {
  const [orden, setOrden] = useState<OrdenCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionLoading, setAccionLoading] = useState(false);
  const [toast, setToast] = useState<{
    mensaje: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [modalCierre, setModalCierre] = useState(false);

  const showToast = useCallback(
    (mensaje: string, tipo: 'ok' | 'error') => setToast({ mensaje, tipo }),
    [],
  );

  const cargar = useCallback(async () => {
    if (shouldUsePlatformMocks) {
      setOrden(getMockOrdenDetalle(ordenId));
      setLoading(false);
      return;
    }
    const res = await obtenerOrden(ordenId);
    setLoading(false);
    if (res.data) setOrden(res.data);
  }, [ordenId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleCambioEstado = async (
    nuevoEstado: EstadoOrden,
    opciones?: { observaciones_cierre?: string; fecha_fin_real?: string },
  ) => {
    if (!orden) return;
    setAccionLoading(true);
    const res = await cambiarEstadoOrden(orden.id, nuevoEstado, opciones);
    setAccionLoading(false);
    setModalCierre(false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Estado actualizado', 'ok');
    cargar();
  };

  const trans = orden ? (TRANSICIONES[orden.estado] ?? []) : [];
  const dias = orden ? diasRestantes(orden.fecha_fin_estimada) : null;
  const vencida = dias !== null && dias < 0 && orden?.estado === 'EN_PROGRESO';

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
        input[type=range]{-webkit-appearance:none;appearance:none;background:transparent}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:0;height:0}
      `}</style>

      <div className='px-3 py-3 pb-10 sm:px-5 sm:py-4 sm:pb-12 lg:px-5'>
        <div style={{ width: '100%', margin: '0 auto' }}>
          {/* Breadcrumb */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
            }}
          >
            <a
              href='/ordenes'
              style={{
                fontSize: '11px',
                color: '#334155',
                textDecoration: 'none',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Órdenes
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
              {loading ? '...' : orden?.numero}
            </span>
          </div>

          {/* Header */}
          <div style={{ ...card, padding: '24px', marginBottom: '20px' }}>
            {loading ? (
              <div
                style={{ display: 'flex', gap: '14px', alignItems: 'center' }}
              >
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <Skeleton w='150px' h='13px' />
                  <Skeleton w='300px' h='20px' />
                  <Skeleton w='200px' h='13px' />
                </div>
              </div>
            ) : orden ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginBottom: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: '700',
                        color: '#60a5fa',
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {orden.numero}
                    </span>
                    {orden.numero_presupuesto && (
                      <a
                        href={`/presupuestos/${orden.presupuesto_id}`}
                        style={{
                          fontSize: '11px',
                          color: '#475569',
                          fontFamily: "'DM Mono',monospace",
                          textDecoration: 'none',
                          background: 'rgba(245,158,11,0.06)',
                          border: '1px solid rgba(245,158,11,0.15)',
                          borderRadius: '4px',
                          padding: '1px 7px',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = '#f59e0b')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = '#475569')
                        }
                      >
                        📄 {orden.numero_presupuesto}
                      </a>
                    )}
                    <BadgeEstado estado={orden.estado} />
                    {vencida && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#f87171',
                          background: 'rgba(248,113,113,0.08)',
                          border: '1px solid rgba(248,113,113,0.2)',
                          borderRadius: '4px',
                          padding: '1px 7px',
                          fontWeight: '600',
                        }}
                      >
                        ⚠ Vencida hace {Math.abs(dias!)} días
                      </span>
                    )}
                  </div>
                  <h1
                    style={{
                      margin: '0 0 6px',
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#e2e8f0',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {orden.titulo}
                  </h1>
                  <a
                    href={`/clientes/${orden.cliente_id}`}
                    style={{
                      fontSize: '13px',
                      color: '#64748b',
                      textDecoration: 'none',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.color = '#94a3b8')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.color = '#64748b')
                    }
                  >
                    👤 {orden.razon_social}
                  </a>
                </div>

                {/* Acciones de estado */}
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    flexShrink: 0,
                  }}
                >
                  <a
                    href={`/ordenes/${orden.id}/editar`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid rgba(148,163,184,0.15)',
                      background: 'rgba(15,23,42,0.6)',
                      color: '#64748b',
                      fontSize: '12px',
                      fontWeight: '600',
                      textDecoration: 'none',
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    <svg width='11' height='11' viewBox='0 0 11 11'>
                      <path
                        d='M2 9L3.5 5.5L8.5 0.5C9 0 10 0 10.5 0.5C11 1 11 2 10.5 2.5L5.5 7.5L2 9Z'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinejoin='round'
                        strokeLinecap='round'
                      />
                    </svg>
                    Editar
                  </a>
                  {trans
                    .filter((t) => t !== 'COMPLETADA')
                    .map((est) => {
                      const cfg = ESTADO_CFG[est];
                      return (
                        <button
                          key={est}
                          onClick={() => handleCambioEstado(est)}
                          disabled={accionLoading}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '8px',
                            border: `1px solid ${cfg.border}`,
                            background: cfg.bg,
                            color: cfg.color,
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontFamily: "'DM Sans',sans-serif",
                            opacity: accionLoading ? 0.6 : 1,
                          }}
                        >
                          {cfg.icon} → {cfg.label}
                        </button>
                      );
                    })}
                  {trans.includes('COMPLETADA') && (
                    <button
                      onClick={() => setModalCierre(true)}
                      disabled={accionLoading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background:
                          'linear-gradient(135deg,rgba(74,222,128,0.8),rgba(34,197,94,0.8))',
                        color: '#0f172a',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                        boxShadow: '0 4px 12px rgba(74,222,128,0.15)',
                      }}
                    >
                      ✅ Cerrar orden
                    </button>
                  )}
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
                Orden no encontrada
              </div>
            )}
          </div>

          {orden && (
            <div className='grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px] xl:items-start'>
              {/* Columna principal */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Datos generales */}
                <div style={{ ...card, padding: '20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      marginBottom: '16px',
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>📋</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#475569',
                      }}
                    >
                      Datos generales
                    </span>
                  </div>
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3'>
                    <InfoPar
                      label='Fecha inicio'
                      value={fmtFecha(orden.fecha_inicio)}
                    />
                    <InfoPar label='Fin estimado'>
                      <div>
                        <div
                          style={{
                            fontSize: '13px',
                            color: '#94a3b8',
                            fontFamily: "'DM Mono',monospace",
                          }}
                        >
                          {fmtFecha(orden.fecha_fin_estimada)}
                        </div>
                        {dias !== null && orden.estado === 'EN_PROGRESO' && (
                          <div
                            style={{
                              fontSize: '11px',
                              marginTop: '2px',
                              color: vencida
                                ? '#f87171'
                                : dias <= 3
                                  ? '#f59e0b'
                                  : '#475569',
                            }}
                          >
                            {vencida
                              ? `${Math.abs(dias)} días vencida`
                              : `${dias} días restantes`}
                          </div>
                        )}
                      </div>
                    </InfoPar>
                    <InfoPar
                      label='Fin real'
                      value={fmtFecha(orden.fecha_fin_real)}
                    />
                  </div>
                  {orden.objetivo_tecnico && (
                    <div
                      style={{
                        marginTop: '16px',
                        paddingTop: '16px',
                        borderTop: '1px solid rgba(148,163,184,0.06)',
                      }}
                    >
                      <InfoPar
                        label='Objetivo técnico'
                        value={orden.objetivo_tecnico}
                      />
                    </div>
                  )}
                  {orden.descripcion && (
                    <div style={{ marginTop: '14px' }}>
                      <InfoPar
                        label='Descripción / alcance'
                        value={orden.descripcion}
                      />
                    </div>
                  )}
                </div>

                {/* Avance */}
                <PanelAvance orden={orden} onUpdate={cargar} />

                {/* Notas técnicas */}
                <PanelNotas
                  orden={orden}
                  onUpdate={cargar}
                  showToast={showToast}
                />

                {/* Observaciones de cierre */}
                {orden.observaciones_cierre && (
                  <div style={{ ...card, padding: '20px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        marginBottom: '12px',
                      }}
                    >
                      <span style={{ fontSize: '13px' }}>📝</span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: '700',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: '#4ade80',
                        }}
                      >
                        Observaciones de cierre
                      </span>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        color: '#64748b',
                        lineHeight: '1.7',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {orden.observaciones_cierre}
                    </p>
                  </div>
                )}
              </div>

              {/* Columna lateral */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* KPIs laterales */}
                <div style={{ ...card, padding: '18px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#334155',
                      marginBottom: '14px',
                    }}
                  >
                    Resumen
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {[
                      {
                        label: 'Creada el',
                        value: fmtFecha(orden.creado_en),
                        mono: true,
                      },
                      {
                        label: 'Actualizada',
                        value: fmtFecha(orden.actualizado_en),
                        mono: true,
                      },
                      {
                        label: 'Técnicos',
                        value: String(orden.tecnicos.length),
                        mono: true,
                      },
                    ].map(({ label, value, mono }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingBottom: '8px',
                          borderBottom: '1px solid rgba(148,163,184,0.05)',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#334155' }}>
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#64748b',
                            fontFamily: mono
                              ? "'DM Mono',monospace"
                              : "'DM Sans',sans-serif",
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Técnicos */}
                <PanelTecnicos
                  orden={orden}
                  onUpdate={cargar}
                  showToast={showToast}
                />

                {/* Notas para el cliente */}
                {orden.notas_cliente && (
                  <div style={{ ...card, padding: '18px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#475569',
                        marginBottom: '10px',
                      }}
                    >
                      Notas al cliente
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '12px',
                        color: '#64748b',
                        lineHeight: '1.7',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {orden.notas_cliente}
                    </p>
                  </div>
                )}

                {/* Acceso rápido */}
                <div style={{ ...card, padding: '18px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#334155',
                      marginBottom: '12px',
                    }}
                  >
                    Accesos rápidos
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    {[
                      {
                        href: `/clientes/${orden.cliente_id}`,
                        label: 'Ver ficha del cliente',
                        icon: '👤',
                      },
                      ...(orden.presupuesto_id
                        ? [
                            {
                              href: `/presupuestos/${orden.presupuesto_id}`,
                              label: 'Ver presupuesto',
                              icon: '📄',
                            },
                          ]
                        : []),
                      {
                        href: `/facturas/nueva?orden=${orden.id}&cliente=${orden.cliente_id}`,
                        label: 'Generar factura',
                        icon: '🧾',
                      },
                    ].map(({ href, label, icon }) => (
                      <a
                        key={href}
                        href={href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          borderRadius: '7px',
                          textDecoration: 'none',
                          fontSize: '12px',
                          color: '#64748b',
                          border: '1px solid rgba(148,163,184,0.07)',
                          background: 'rgba(8,16,35,0.3)',
                          transition: 'all 0.12s',
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            'rgba(148,163,184,0.05)';
                          e.currentTarget.style.color = '#94a3b8';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background =
                            'rgba(8,16,35,0.3)';
                          e.currentTarget.style.color = '#64748b';
                        }}
                      >
                        <span style={{ fontSize: '12px' }}>{icon}</span>
                        {label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de cierre */}
      {modalCierre && (
        <ModalCierre
          loading={accionLoading}
          onCancelar={() => setModalCierre(false)}
          onConfirmar={(obs, fecha) =>
            handleCambioEstado('COMPLETADA', {
              observaciones_cierre: obs,
              fecha_fin_real: fecha,
            })
          }
        />
      )}

      {toast && (
        <Toast
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
