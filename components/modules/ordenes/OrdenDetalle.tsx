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
import { obtenerTecnicos, type Tecnico as TecnicoCatalogo } from '@/app/actions/tecnicos';
import { generarRemitoDesdeOrden } from '@/app/actions/logistica';
import { generarFacturaDesdeRemito } from '@/app/actions/facturas';
import {
  getMockOrdenDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import {
  ArrowLeft,
  Settings,
  CheckCircle2,
  XCircle,
  User,
  FileText,
  ClipboardList,
  PenLine,
  Wrench,
  AlertTriangle,
  Truck,
  Loader2,
} from 'lucide-react';
import { descargarPDF } from '@/lib/pdf-client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type OrdenCompleta = OrdenServicioCompleta & {
  razon_social: string;
  numero_presupuesto: string | null;
};

interface Props {
  ordenId: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<EstadoOrden, { label: string; badge: string; dot: string; icon: ReactNode }> = {
  PENDIENTE:   { label: 'Pendiente',   badge: 'text-slate-400 bg-slate-400/[0.08] border-slate-400/15',  dot: 'bg-slate-400',  icon: <span className="text-[10px]">⏳</span> },
  EN_PROGRESO: { label: 'En Progreso', badge: 'text-blue-400 bg-blue-400/[0.08] border-blue-400/20',     dot: 'bg-blue-400',   icon: <Settings className="w-3 h-3" /> },
  COMPLETADA:  { label: 'Completada',  badge: 'text-green-400 bg-green-400/[0.08] border-green-400/20',  dot: 'bg-green-400',  icon: <CheckCircle2 className="w-3 h-3" /> },
  CANCELADA:   { label: 'Cancelada',   badge: 'text-red-400 bg-red-400/[0.08] border-red-400/20',        dot: 'bg-red-400',    icon: <XCircle className="w-3 h-3" /> },
  SUSPENDIDA:  { label: 'Suspendida',  badge: 'text-amber-500 bg-amber-500/[0.08] border-amber-500/20',  dot: 'bg-amber-500',  icon: <span className="text-[10px]">⏸</span> },
};

const TRANSICIONES: Partial<Record<EstadoOrden, EstadoOrden[]>> = {
  PENDIENTE: ['EN_PROGRESO', 'CANCELADA'],
  EN_PROGRESO: ['COMPLETADA', 'SUSPENDIDA', 'CANCELADA'],
  SUSPENDIDA: ['EN_PROGRESO', 'CANCELADA'],
  CANCELADA: ['PENDIENTE'],
  COMPLETADA: [],
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const cardClass = 'bg-slate-900/70 border border-slate-400/10 rounded-xl backdrop-blur-sm';
const inputClass = 'w-full px-[11px] py-2 bg-slate-950/60 border border-slate-400/10 rounded-[7px] text-slate-200 text-xs outline-none transition-colors duration-150';
const labelClass = 'text-[10px] font-semibold tracking-widest uppercase text-slate-600 block mb-1';

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
      className='animate-pulse bg-slate-400/[0.07] w-[var(--sk-w)] h-[var(--sk-h)] rounded-[var(--sk-r)]'
      style={
        {
          '--sk-w': w,
          '--sk-h': h,
          '--sk-r': r,
        } as React.CSSProperties
      }
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
    <div className='flex flex-col gap-[3px]'>
      <span className='text-[10px] font-semibold tracking-widest uppercase text-slate-700'>
        {label}
      </span>
      {children ?? (
        <span className={`text-[13px] ${value ? 'text-slate-400' : 'text-slate-800'}`}>
          {value || '—'}
        </span>
      )}
    </div>
  );
}

function BadgeEstado({ estado }: { estado: EstadoOrden }) {
  const cfg = ESTADO_CFG[estado];
  return (
    <span className={`inline-flex items-center gap-[5px] px-[10px] py-[3px] rounded-full text-[11px] font-semibold border ${cfg.badge}`}>
      <span className='inline-block w-[5px] h-[5px] rounded-full bg-current' />
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
      className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-[18px] py-3 rounded-[10px] backdrop-blur-sm bg-slate-950/[0.97] shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-[slideUp_0.25s_cubic-bezier(0.34,1.56,0.64,1)] ${tipo === 'ok' ? 'border border-emerald-400/30' : 'border border-red-400/30'}`}
    >
      <span
        className={`text-[13px] font-semibold ${tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
      >
        {tipo === 'ok' ? '✓' : '✕'}
      </span>
      <span
        className={`text-[13px] ${tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
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
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  const colorCls    = valor >= 100 ? 'text-green-400'  : valor >= 50 ? 'text-blue-400'  : 'text-amber-500';
  const colorBgCls  = valor >= 100 ? 'bg-green-400'    : valor >= 50 ? 'bg-blue-400'    : 'bg-amber-500';
  const gradCls     = valor >= 100 ? 'bg-gradient-to-r from-amber-500 to-green-400'
                    : valor >= 50  ? 'bg-gradient-to-r from-amber-500 to-blue-400'
                    : 'bg-amber-500';
  const thumbShadow = valor >= 100 ? 'shadow-[0_0_0_3px_#4ade8030]'
                    : valor >= 50  ? 'shadow-[0_0_0_3px_#60a5fa30]'
                    : 'shadow-[0_0_0_3px_#f59e0b30]';
  const hitoBorderA = valor >= 100 ? 'border-green-400/30'   : valor >= 50 ? 'border-blue-400/30'   : 'border-amber-500/30';
  const hitoBgA     = valor >= 100 ? 'bg-green-400/[0.07]'   : valor >= 50 ? 'bg-blue-400/[0.07]'   : 'bg-amber-500/[0.07]';

  return (
    <div className={`${cardClass} p-5`}>
      <div className='flex items-center justify-between mb-4'>
        <span className='text-[11px] font-bold tracking-widest uppercase text-slate-600'>
          Avance de la orden
        </span>
        <div className='flex items-center gap-2'>
          {loading && (
            <svg
              width='12'
              height='12'
              viewBox='0 0 12 12'
              className='text-slate-600 animate-spin'
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
          <span className={`text-[28px] font-extrabold tracking-[-0.03em] transition-colors duration-300 ${colorCls}`}>
            {valor}%
          </span>
        </div>
      </div>

      {/* Slider */}
      {orden.estado !== 'COMPLETADA' && orden.estado !== 'CANCELADA' ? (
        <div className='relative mb-[14px]'>
          <div className='h-2 rounded relative overflow-visible bg-slate-400/[0.08]'>
            <div
              className={`absolute left-0 top-0 h-full rounded transition-[width] duration-200 w-[var(--bar-w)] ${gradCls}`}
              style={{ '--bar-w': `${valor}%` } as React.CSSProperties}
            />
          </div>
          <input
            type='range'
            min={0}
            max={100}
            step={5}
            value={valor}
            onChange={(e) => handleChange(Number(e.target.value))}
            className='absolute top-[-6px] left-0 w-full h-5 cursor-pointer opacity-0 z-[1] m-0'
          />
          {/* Thumb visual */}
          <div
            className={`absolute pointer-events-none transition-[left] duration-200 top-[-3px] w-[14px] h-[14px] rounded-full border-2 border-slate-950 left-[var(--thumb-left)] ${colorBgCls} ${thumbShadow}`}
            style={{ '--thumb-left': `calc(${valor}% - 7px)` } as React.CSSProperties}
          />
        </div>
      ) : (
        <div className='h-2 rounded overflow-hidden mb-[14px] bg-slate-400/[0.08]'>
          <div
            className={`h-full rounded w-[var(--bar-w)] ${colorBgCls}`}
            style={{ '--bar-w': `${valor}%` } as React.CSSProperties}
          />
        </div>
      )}

      {/* Hitos */}
      <div className='flex justify-between'>
        {[0, 25, 50, 75, 100].map((h) => (
          <button
            key={h}
            disabled={
              orden.estado === 'COMPLETADA' || orden.estado === 'CANCELADA'
            }
            onClick={() => handleChange(h)}
            className={`px-[7px] py-[3px] rounded-[5px] cursor-pointer text-[10px] font-semibold transition-all duration-150 border ${valor === h ? `${hitoBorderA} ${hitoBgA} ${colorCls}` : 'border-slate-400/[0.08] bg-transparent text-slate-700'}`}
          >
            {h}%
          </button>
        ))}
      </div>

      {valor === 100 && orden.estado !== 'COMPLETADA' && (
        <div className='mt-[14px] px-[14px] py-[10px] rounded-lg text-xs text-emerald-400 bg-emerald-400/[0.06] border border-emerald-400/20'>
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
  const [catalogo, setCatalogo] = useState<TecnicoCatalogo[]>([]);
  const [form, setForm] = useState({
    nombre: '',
    rol: '',
    fecha_desde: '',
    fecha_hasta: '',
    notas: '',
    tecnico_catalogo_id: '',
  });
  const [errors, setErrors] = useState<{ nombre?: string }>({});

  // Cargar catálogo al abrir el formulario
  useEffect(() => {
    if (agregando && catalogo.length === 0) {
      obtenerTecnicos(true).then(res => {
        if (res.data) setCatalogo(res.data);
      });
    }
  }, [agregando, catalogo.length]);

  const handleSeleccionarCatalogo = (id: string) => {
    const tec = catalogo.find(t => t.id === id);
    if (tec) {
      setForm(p => ({ ...p, nombre: tec.nombre, rol: tec.cargo ?? '', tecnico_catalogo_id: id }));
    } else {
      setForm(p => ({ ...p, nombre: '', rol: '', tecnico_catalogo_id: '' }));
    }
  };

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
      tecnico_catalogo_id: form.tecnico_catalogo_id || undefined,
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
      tecnico_catalogo_id: '',
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
    <div className={`${cardClass} p-5`}>
      <div className='flex items-center justify-between mb-4'>
        <div className='flex items-center gap-[7px]'>
          <span className='text-[13px]'>👷</span>
          <span className='text-[11px] font-bold tracking-widest uppercase text-slate-600'>
            Equipo técnico
          </span>
          {orden.tecnicos.length > 0 && (
            <span className='text-[9px] font-bold text-slate-600 rounded-[10px] px-1.5 py-[1px] bg-slate-400/[0.08] border border-slate-400/[0.12]'>
              {orden.tecnicos.length}
            </span>
          )}
        </div>
        {canEdit && !agregando && (
          <button
            onClick={() => setAgregando(true)}
            className='flex items-center gap-[5px] px-[10px] py-[5px] rounded-md text-blue-400 text-[11px] font-semibold cursor-pointer border border-blue-400/25 bg-blue-400/[0.06]'
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
        <div className='p-5 text-center rounded-lg border border-dashed border-slate-400/10'>
          <p className='m-0 text-xs text-slate-700'>Sin técnicos asignados</p>
        </div>
      )}

      <div className='flex flex-col gap-2'>
        {orden.tecnicos.map((tec) => (
          <div
            key={tec.id}
            className='flex items-center gap-2.5 px-3 py-[10px] rounded-lg bg-slate-950/40 border border-slate-400/[0.07]'
          >
            <div
              className='flex items-center justify-center text-[13px] font-bold text-slate-400 shrink-0 w-8 h-8 rounded-[8px] bg-[var(--avatar-bg)]'
              style={{ '--avatar-bg': avatarColor(tec.nombre) } as React.CSSProperties}
            >
              {avatarLetra(tec.nombre)}
            </div>
            <div className='flex-1 min-w-0'>
              <div className='text-[13px] font-semibold text-slate-400'>
                {tec.nombre}
              </div>
              {tec.rol && (
                <div className='text-[11px] text-slate-600'>{tec.rol}</div>
              )}
              {(tec.fecha_desde || tec.fecha_hasta) && (
                <div className='text-[10px] text-slate-700 mt-[2px]'>
                  {tec.fecha_desde ? fmtFecha(tec.fecha_desde) : '—'} →{' '}
                  {tec.fecha_hasta ? fmtFecha(tec.fecha_hasta) : '—'}
                </div>
              )}
            </div>
            {canEdit && (
              <button
                onClick={() => handleEliminar(tec.id)}
                disabled={loadingId === tec.id}
                className='flex items-center justify-center shrink-0 cursor-pointer bg-transparent transition-all duration-[120ms] w-6 h-6 rounded-[5px] border border-slate-400/[0.08] text-slate-700 hover:text-red-400 hover:border-red-400/20'
              >
                {loadingId === tec.id ? (
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
        <div className='mt-2.5 p-[14px] rounded-[9px] bg-slate-950/50 border border-blue-400/15 animate-[slideUp_0.2s_ease]'>
          {/* Selector catálogo */}
          <div className='mb-3'>
            <label className={labelClass}>Seleccionar del catálogo</label>
            <select
              value={form.tecnico_catalogo_id}
              onChange={(e) => handleSeleccionarCatalogo(e.target.value)}
              className={`${inputClass} focus:border-blue-400/35`}
            >
              <option value=''>— Ingresar manualmente —</option>
              {catalogo.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nombre}{t.cargo ? ` · ${t.cargo}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2 mb-2.5'>
            <div>
              <label
                className={`text-[10px] font-semibold tracking-widest uppercase block mb-1 ${errors.nombre ? 'text-amber-500' : 'text-slate-600'}`}
              >
                Nombre *
              </label>
              <input
                value={form.nombre}
                onChange={(e) =>
                  setForm((p) => ({ ...p, nombre: e.target.value, tecnico_catalogo_id: '' }))
                }
                placeholder='Ej: Juan Pérez'
                className={`w-full px-[11px] py-2 bg-slate-950/60 rounded-[7px] text-slate-200 text-xs outline-none transition-colors duration-150 focus:border-blue-400/35 border ${errors.nombre ? 'border-amber-500/40' : 'border-slate-400/10'}`}
              />
              {errors.nombre && (
                <span className='text-[10px] text-amber-500'>
                  {errors.nombre}
                </span>
              )}
            </div>
            <div>
              <label className={labelClass}>Rol / función</label>
              <input
                value={form.rol}
                onChange={(e) =>
                  setForm((p) => ({ ...p, rol: e.target.value }))
                }
                placeholder='Ej: Electricista'
                className={`${inputClass} focus:border-blue-400/35`}
              />
            </div>
            <div>
              <label className={labelClass}>Desde</label>
              <input
                type='date'
                value={form.fecha_desde}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha_desde: e.target.value }))
                }
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
            <div>
              <label className={labelClass}>Hasta</label>
              <input
                type='date'
                value={form.fecha_hasta}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fecha_hasta: e.target.value }))
                }
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
          </div>
          <div className='flex justify-end gap-[7px]'>
            <button
              onClick={() => {
                setAgregando(false);
                setErrors({});
                setForm({ nombre: '', rol: '', fecha_desde: '', fecha_hasta: '', notas: '', tecnico_catalogo_id: '' });
              }}
              className='px-3 py-1.5 rounded-md text-[11px] text-slate-500 cursor-pointer bg-transparent border border-slate-400/[0.12]'
            >
              Cancelar
            </button>
            <button
              onClick={handleAgregar}
              disabled={loadingId === 'nueva'}
              className='px-[14px] py-1.5 rounded-md border-0 text-blue-400 text-[11px] font-bold cursor-pointer bg-blue-400/[0.15]'
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
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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
    <div className={`${cardClass} p-5`}>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-[7px]'>
          <Wrench className='w-3 h-3 text-slate-600' />
          <span className='text-[11px] font-bold tracking-widest uppercase text-slate-600'>
            Notas técnicas
          </span>
        </div>
        <div className='flex items-center gap-1.5'>
          {loading && (
            <svg
              width='11'
              height='11'
              viewBox='0 0 11 11'
              className='text-slate-600 animate-spin'
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
            <span className='text-[10px] text-slate-600'>Guardando...</span>
          )}
          {!dirty && !loading && texto && (
            <span className='text-[10px] text-slate-700'>✓ Guardado</span>
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
        className={`w-full px-[11px] py-2 bg-slate-950/60 rounded-[7px] outline-none transition-colors duration-150 resize-y leading-[1.7] text-[13px] min-h-[120px] ${texto ? 'text-slate-400' : 'text-slate-700'} ${canEdit ? 'cursor-text' : 'cursor-default'} ${dirty ? 'border border-blue-400/25' : 'border border-slate-400/10'}`}
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
    <div className='fixed inset-0 flex items-center justify-center z-[100] backdrop-blur-sm bg-black/70 animate-[fadeIn_0.15s_ease]'>
      <div className='rounded-2xl p-7 w-[90%] max-w-[420px] bg-slate-900 border border-slate-400/[0.12] animate-[scaleIn_0.2s_cubic-bezier(0.34,1.56,0.64,1)]'>
        <div className='mb-[10px]'><CheckCircle2 className='w-8 h-8 text-emerald-400' /></div>
        <h3 className='m-0 mb-[6px] text-[15px] font-bold text-slate-200'>
          Cerrar orden de servicio
        </h3>
        <p className='m-0 mb-5 text-[13px] text-slate-500 leading-[1.6]'>
          La orden se marcará como completada. Este estado no se puede revertir
          fácilmente.
        </p>
        <div className='flex flex-col gap-[14px]'>
          <div>
            <label className={labelClass}>Fecha de cierre real</label>
            <input
              type='date'
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
          <div>
            <label className={labelClass}>Observaciones de cierre</label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder='Trabajo completado, entregables, observaciones finales...'
              rows={3}
              className={`${inputClass} resize-y leading-[1.6]`}
            />
          </div>
        </div>
        <div className='flex justify-end gap-2.5 mt-5'>
          <button
            onClick={onCancelar}
            className='px-4 py-2 rounded-lg text-[13px] text-slate-500 cursor-pointer bg-transparent border border-slate-400/[0.12]'
          >
            Cancelar
          </button>
          <button
            onClick={() => onConfirmar(obs, fecha)}
            disabled={loading}
            className={`flex items-center gap-1.5 px-5 py-2 rounded-lg border-0 text-slate-900 text-[13px] font-bold bg-gradient-to-br from-emerald-400/80 to-green-500/80 ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {loading && (
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
  const [generandoRemito,  setGenerandoRemito]  = useState(false);
  const [generandoFactura, setGenerandoFactura] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
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

  const handleGenerarRemito = async () => {
    if (!orden) return;
    setGenerandoRemito(true);
    const res = await generarRemitoDesdeOrden(orden.id);
    setGenerandoRemito(false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Remito generado', 'ok');
    window.location.href = `/logistica/remitos/${res.data!.id}`;
  };

  const handleGenerarFactura = async () => {
    if (!orden) return;
    const remito = (orden as any).remito;
    if (!remito) { showToast('Primero generá el remito de esta orden', 'error'); return; }
    if (remito.factura_id) { window.location.href = `/facturas/${remito.factura_id}`; return; }
    setGenerandoFactura(true);
    const res = await generarFacturaDesdeRemito(remito.id);
    setGenerandoFactura(false);
    if (res.error) { showToast(res.error, 'error'); return; }
    showToast('Factura generada correctamente', 'ok');
    window.location.href = `/facturas/${res.data!.id}`;
  };

  const handlePDF = async () => {
    if (!orden) return;
    setPdfLoading(true);
    const err = await descargarPDF('orden_servicio', orden.id, `OS-${orden.numero}.pdf`);
    setPdfLoading(false);
    if (err) showToast(`Error al generar PDF: ${err}`, 'error');
  };

  const trans = orden ? (TRANSICIONES[orden.estado] ?? []) : [];
  const dias = orden ? diasRestantes(orden.fecha_fin_estimada) : null;
  const vencida = dias !== null && dias < 0 && orden?.estado === 'EN_PROGRESO';

  return (
    <>
      <div className='px-3 py-3 pb-10 sm:px-5 sm:py-4 sm:pb-12 lg:px-5'>
        <div className='w-full mx-auto'>
          {/* Breadcrumb */}
          <div className='flex items-center gap-2 mb-5'>
            <a
              href='/ordenes'
              className='flex items-center gap-1 text-[11px] text-slate-700 no-underline tracking-widest uppercase hover:text-slate-400 transition-colors'
            >
              <ArrowLeft className='w-3 h-3' />
              Órdenes
            </a>
            <span className='text-[#1e293b]'>›</span>
            <span className='text-[11px] text-slate-600 tracking-widest uppercase'>
              {loading ? '...' : orden?.numero}
            </span>
          </div>

          {/* Header */}
          <div className={`${cardClass} p-6 mb-5`}>
            {loading ? (
              <div className='flex gap-[14px] items-center'>
                <div className='flex-1 flex flex-col gap-2'>
                  <Skeleton w='150px' h='13px' />
                  <Skeleton w='300px' h='20px' />
                  <Skeleton w='200px' h='13px' />
                </div>
              </div>
            ) : orden ? (
              <div className='flex items-start justify-between gap-4 flex-wrap'>
                <div>
                  <div className='flex items-center gap-2.5 mb-1.5 flex-wrap'>
                    <span className='text-[13px] font-bold text-blue-400'>
                      {orden.numero}
                    </span>
                    {orden.numero_presupuesto && (
                      <a
                        href={`/presupuestos/${orden.presupuesto_id}`}
                        className='inline-flex items-center gap-1 text-[11px] text-slate-600 no-underline rounded px-[7px] py-[1px] bg-amber-500/[0.06] border border-amber-500/[0.15] transition-colors duration-150 hover:text-amber-500'
                      >
                        <FileText className='w-3 h-3' /> {orden.numero_presupuesto}
                      </a>
                    )}
                    <BadgeEstado estado={orden.estado} />
                    {vencida && (
                      <span className='inline-flex items-center gap-1 text-[10px] text-red-400 rounded px-[7px] py-[1px] font-semibold bg-red-400/[0.08] border border-red-400/20'>
                        <AlertTriangle className='w-3 h-3' /> Vencida hace {Math.abs(dias!)} días
                      </span>
                    )}
                  </div>
                  <h1 className='m-0 mb-1.5 text-xl font-bold text-slate-200 tracking-[-0.02em]'>
                    {orden.titulo}
                  </h1>
                  <a
                    href={`/clientes/${orden.cliente_id}`}
                    className='inline-flex items-center gap-1 text-[13px] text-slate-500 no-underline transition-colors duration-150 hover:text-slate-400'
                  >
                    <User className='w-3 h-3' /> {orden.razon_social}
                  </a>
                </div>

                {/* Acciones de estado */}
                <div className='flex gap-2 flex-wrap shrink-0'>
                  <a
                    href={`/ordenes/${orden.id}/editar`}
                    className='inline-flex items-center gap-1.5 px-[14px] py-2 rounded-lg text-xs font-semibold text-slate-500 no-underline border border-slate-400/[0.15] bg-slate-950/60'
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
                          className={`inline-flex items-center gap-1.5 px-[14px] py-2 rounded-lg text-xs font-semibold cursor-pointer border ${cfg.badge} ${accionLoading ? 'opacity-60' : ''}`}
                        >
                          {cfg.icon} <span>→ {cfg.label}</span>
                        </button>
                      );
                    })}
                  {trans.includes('COMPLETADA') && (
                    <button
                      onClick={() => setModalCierre(true)}
                      disabled={accionLoading}
                      className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-0 text-slate-900 text-xs font-bold cursor-pointer bg-gradient-to-br from-emerald-400/80 to-green-500/80 shadow-[0_4px_12px_rgba(74,222,128,0.15)]'
                    >
                      <CheckCircle2 className='w-4 h-4' /> Cerrar orden
                    </button>
                  )}
                  {orden.estado === 'COMPLETADA' && (
                    <button
                      onClick={handleGenerarRemito}
                      disabled={generandoRemito}
                      className='inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-0 text-slate-900 text-xs font-bold cursor-pointer bg-gradient-to-br from-amber-400/80 to-orange-500/80 disabled:opacity-60'
                    >
                      {generandoRemito
                        ? <Loader2 className='w-4 h-4 animate-spin' />
                        : <Truck className='w-4 h-4' />}
                      Generar Remito
                    </button>
                  )}
                  <button
                    onClick={handlePDF}
                    disabled={pdfLoading}
                    className='inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-400/[0.15] bg-slate-900/60 text-slate-500 text-xs font-semibold cursor-pointer disabled:opacity-50'
                  >
                    {pdfLoading ? <Loader2 className='w-3.5 h-3.5 animate-spin' /> : <FileText className='w-3.5 h-3.5' />}
                    PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className='text-center p-5 text-slate-600'>
                Orden no encontrada
              </div>
            )}
          </div>

          {orden && (
            <div className='grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px] xl:items-start'>
              {/* Columna principal */}
              <div className='flex flex-col gap-4'>
                {/* Datos generales */}
                <div className={`${cardClass} p-5`}>
                  <div className='flex items-center gap-[7px] mb-4'>
                    <ClipboardList className='w-3 h-3 text-slate-600' />
                    <span className='text-[11px] font-bold tracking-widest uppercase text-slate-600'>
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
                        <div className='text-[13px] text-slate-400'>
                          {fmtFecha(orden.fecha_fin_estimada)}
                        </div>
                        {dias !== null && orden.estado === 'EN_PROGRESO' && (
                          <div className={`text-[11px] mt-[2px] ${vencida ? 'text-red-400' : dias! <= 3 ? 'text-amber-500' : 'text-slate-600'}`}>
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
                    <div className='mt-4 pt-4 border-t border-slate-400/[0.06]'>
                      <InfoPar
                        label='Objetivo técnico'
                        value={orden.objetivo_tecnico}
                      />
                    </div>
                  )}
                  {orden.descripcion && (
                    <div className='mt-[14px]'>
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
                  <div className={`${cardClass} p-5`}>
                    <div className='flex items-center gap-[7px] mb-3'>
                      <PenLine className='w-3 h-3 text-emerald-400' />
                      <span className='text-[11px] font-bold tracking-widest uppercase text-emerald-400'>
                        Observaciones de cierre
                      </span>
                    </div>
                    <p className='m-0 text-[13px] text-slate-500 leading-[1.7] whitespace-pre-wrap'>
                      {orden.observaciones_cierre}
                    </p>
                  </div>
                )}
              </div>

              {/* Columna lateral */}
              <div className='flex flex-col gap-4'>
                {/* KPIs laterales */}
                <div className={`${cardClass} p-[18px]`}>
                  <div className='text-[10px] font-bold tracking-widest uppercase text-slate-700 mb-[14px]'>
                    Resumen
                  </div>
                  <div className='flex flex-col gap-2.5'>
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
                        className='flex justify-between items-center pb-2 border-b border-slate-400/[0.05]'
                      >
                        <span className='text-[11px] text-slate-700'>
                          {label}
                        </span>
                        <span className='text-xs text-slate-500'>
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
                  <div className={`${cardClass} p-[18px]`}>
                    <div className='text-[10px] font-bold tracking-widest uppercase text-slate-600 mb-2.5'>
                      Notas al cliente
                    </div>
                    <p className='m-0 text-xs text-slate-500 leading-[1.7] whitespace-pre-wrap'>
                      {orden.notas_cliente}
                    </p>
                  </div>
                )}

                {/* Acceso rápido */}
                <div className={`${cardClass} p-[18px]`}>
                  <div className='text-[10px] font-bold tracking-widest uppercase text-slate-700 mb-3'>
                    Accesos rápidos
                  </div>
                  <div className='flex flex-col gap-1.5'>
                    {/* Links estáticos */}
                    {([
                      {
                        href: `/clientes/${orden.cliente_id}`,
                        label: 'Ver ficha del cliente',
                        icon: <User className='w-4 h-4' />,
                      },
                      ...(orden.presupuesto_id
                        ? [{ href: `/presupuestos/${orden.presupuesto_id}`, label: 'Ver presupuesto', icon: <FileText className='w-4 h-4' /> }]
                        : []),
                      ...((orden as any).remito
                        ? [{ href: `/logistica/remitos/${(orden as any).remito.id}`, label: `Ver remito ${(orden as any).remito.numero}`, icon: <FileText className='w-4 h-4' /> }]
                        : []),
                      ...((orden as any).remito?.factura_id
                        ? [{ href: `/facturas/${(orden as any).remito.factura_id}`, label: 'Ver factura', icon: <span className='text-xs'>🧾</span> }]
                        : []),
                    ] as { href: string; label: string; icon: ReactNode }[]).map(({ href, label, icon }) => (
                      <a
                        key={href}
                        href={href}
                        className='flex items-center gap-2 px-[10px] py-2 rounded-[7px] no-underline text-xs text-slate-500 transition-all duration-[120ms] border border-slate-400/[0.07] bg-slate-950/30 hover:bg-slate-400/[0.05] hover:text-slate-400'
                      >
                        {icon}
                        {label}
                      </a>
                    ))}

                    {/* Botón generar factura — solo si hay remito sin factura */}
                    {!(orden as any).remito?.factura_id && (
                      <button
                        onClick={handleGenerarFactura}
                        disabled={generandoFactura}
                        className='flex items-center gap-2 px-[10px] py-2 rounded-[7px] text-xs text-slate-500 transition-all duration-[120ms] border border-slate-400/[0.07] bg-slate-950/30 hover:bg-slate-400/[0.05] hover:text-slate-400 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed text-left'
                      >
                        {generandoFactura
                          ? <Loader2 className='w-4 h-4 animate-spin' />
                          : <span className='text-xs'>🧾</span>
                        }
                        {generandoFactura ? 'Generando…' : 'Generar factura'}
                      </button>
                    )}
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
