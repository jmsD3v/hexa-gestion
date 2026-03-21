'use client';

// ============================================================
// components/modules/clientes/ClientesListado.tsx
// Listado paginado de clientes con búsqueda, filtros y acciones
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useTransition,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type { ClienteListaItem, FiltrosCliente, CondicionIVA } from '@/types';
import type { PaginatedResponse, ApiResponse } from '@/types';
import {
  obtenerClientes,
  desactivarCliente,
  reactivarCliente,
} from '@/app/actions/clientes';
import {
  getMockClientes,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';

// ─── Constantes ───────────────────────────────────────────────────────────────

const CONDICIONES_IVA: { value: CondicionIVA | ''; label: string }[] = [
  { value: '', label: 'Todas las condiciones' },
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Resp. Inscripto' },
  { value: 'MONOTRIBUTISTA', label: 'Monotributista' },
  { value: 'EXENTO', label: 'Exento' },
  { value: 'CONSUMIDOR_FINAL', label: 'Consumidor Final' },
  { value: 'NO_RESPONSABLE', label: 'No Responsable' },
];

const SEGMENTOS = [
  '',
  'HVAC / Climatización',
  'Energía Solar / Fotovoltaica',
  'Obra Civil',
  'Instalaciones Eléctricas',
  'Automatización Industrial',
  'Servicios Técnicos',
  'Otros',
];

const IVA_BADGE: Record<
  CondicionIVA,
  { label: string; color: string; bg: string }
> = {
  RESPONSABLE_INSCRIPTO: {
    label: 'RI',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.1)',
  },
  MONOTRIBUTISTA: {
    label: 'MT',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.1)',
  },
  EXENTO: { label: 'EX', color: '#34d399', bg: 'rgba(52,211,153,0.1)' },
  CONSUMIDOR_FINAL: {
    label: 'CF',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
  },
  NO_RESPONSABLE: {
    label: 'NR',
    color: '#64748b',
    bg: 'rgba(100,116,139,0.08)',
  },
};

const POR_PAGINA_OPCIONES = [10, 20, 50];

// ─── Tipos locales ────────────────────────────────────────────────────────────

type OrdenCol =
  | 'razon_social'
  | 'cuit'
  | 'condicion_iva'
  | 'segmento'
  | 'ultima_actividad';
type OrdenDir = 'asc' | 'desc';

interface EstadoFiltros {
  busqueda: string;
  condicion_iva: CondicionIVA | '';
  segmento: string;
  activo: boolean;
  pagina: number;
  por_pagina: number;
  orden_por: OrdenCol;
  orden_dir: OrdenDir;
}

interface AccionConfirmacion {
  tipo: 'desactivar' | 'reactivar';
  cliente: ClienteListaItem;
}

// ─── Hook: debounce ───────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatearFecha(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

function formatearMonto(n: number): string {
  if (n === 0) return '—';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n);
}

function avatarLetra(razon_social: string): string {
  return razon_social.charAt(0).toUpperCase();
}

function avatarColor(razon_social: string): string {
  const hue = (razon_social.charCodeAt(0) * 7) % 360;
  return `hsl(${hue}, 35%, 22%)`;
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function IVABadge({ condicion }: { condicion: CondicionIVA }) {
  const cfg = IVA_BADGE[condicion];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: '700',
        letterSpacing: '0.06em',
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.color}22`,
        fontFamily: "'DM Mono', monospace",
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

function SaldoBadge({ monto }: { monto: number }) {
  if (monto === 0)
    return <span style={{ color: '#334155', fontSize: '12px' }}>—</span>;
  return (
    <span
      style={{
        color: '#f87171',
        fontSize: '12px',
        fontFamily: "'DM Mono', monospace",
        fontWeight: '500',
      }}
    >
      {formatearMonto(monto)}
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[44, 120, 100, 60, 80, 70, 70, 60].map((w, i) => (
        <td
          key={i}
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(148,163,184,0.05)',
          }}
        >
          <div
            style={{
              height: '12px',
              width: `${w}px`,
              borderRadius: '4px',
              background: 'rgba(148,163,184,0.06)',
              animation: `shimmer 1.5s ease-in-out infinite`,
              animationDelay: `${i * 60}ms`,
            }}
          />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ filtrado }: { filtrado: boolean }) {
  return (
    <tr>
      <td colSpan={8} style={{ padding: '64px 32px', textAlign: 'center' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              background: 'rgba(148,163,184,0.06)',
              border: '1px solid rgba(148,163,184,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
            }}
          >
            {filtrado ? '🔍' : '👥'}
          </div>
          <div>
            <p
              style={{
                margin: '0 0 4px',
                fontSize: '13px',
                fontWeight: '600',
                color: '#475569',
              }}
            >
              {filtrado ? 'Sin resultados' : 'Sin clientes aún'}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: '#334155' }}>
              {filtrado
                ? 'Probá con otros términos de búsqueda o filtros'
                : 'Creá el primer cliente con el botón de arriba'}
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}

function ModalConfirmacion({
  accion,
  loading,
  onConfirmar,
  onCancelar,
}: {
  accion: AccionConfirmacion;
  loading: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const esDesactivar = accion.tipo === 'desactivar';
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
          maxWidth: '380px',
          width: '90%',
          animation: 'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: esDesactivar
                ? 'rgba(248,113,113,0.1)'
                : 'rgba(74,222,128,0.1)',
              border: `1px solid ${esDesactivar ? 'rgba(248,113,113,0.3)' : 'rgba(74,222,128,0.3)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              marginBottom: '14px',
            }}
          >
            {esDesactivar ? '⚠️' : '✅'}
          </div>
          <h3
            style={{
              margin: '0 0 6px',
              fontSize: '15px',
              fontWeight: '700',
              color: '#e2e8f0',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {esDesactivar ? 'Desactivar cliente' : 'Reactivar cliente'}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: '13px',
              color: '#64748b',
              lineHeight: '1.6',
            }}
          >
            {esDesactivar ? (
              <>
                ¿Confirmás que querés desactivar a{' '}
                <strong style={{ color: '#94a3b8' }}>
                  {accion.cliente.razon_social}
                </strong>
                ? No podrá ser seleccionado en nuevos documentos.
              </>
            ) : (
              <>
                ¿Reactivar a{' '}
                <strong style={{ color: '#94a3b8' }}>
                  {accion.cliente.razon_social}
                </strong>
                ? Volvera a estar disponible en el sistema.
              </>
            )}
          </p>
        </div>
        <div
          style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}
        >
          <button
            onClick={onCancelar}
            disabled={loading}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid rgba(148,163,184,0.12)',
              background: 'transparent',
              color: '#64748b',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={loading}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: esDesactivar
                ? 'rgba(248,113,113,0.15)'
                : 'linear-gradient(135deg,rgba(74,222,128,0.8),rgba(34,197,94,0.8))',
              color: esDesactivar ? '#f87171' : '#0f172a',
              fontSize: '13px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: loading ? 0.6 : 1,
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
            {esDesactivar ? 'Desactivar' : 'Reactivar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastNotificacion({
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
        animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 18px',
        borderRadius: '10px',
        background:
          tipo === 'ok' ? 'rgba(15,23,42,0.95)' : 'rgba(15,23,42,0.95)',
        border: `1px solid ${tipo === 'ok' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: '320px',
      }}
    >
      <span style={{ fontSize: '14px' }}>{tipo === 'ok' ? '✓' : '✕'}</span>
      <span
        style={{
          fontSize: '13px',
          color: tipo === 'ok' ? '#4ade80' : '#f87171',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {mensaje}
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ClientesListado() {
  const [filtros, setFiltros] = useState<EstadoFiltros>({
    busqueda: '',
    condicion_iva: '',
    segmento: '',
    activo: true,
    pagina: 1,
    por_pagina: 20,
    orden_por: 'razon_social',
    orden_dir: 'asc',
  });

  const [resultado, setResultado] =
    useState<PaginatedResponse<ClienteListaItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionPending, setAccionPending] = useState<AccionConfirmacion | null>(
    null,
  );
  const [accionLoading, setAccionLoading] = useState(false);
  const [toast, setToast] = useState<{
    mensaje: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [filtrosOpen, setFiltrosOpen] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const busquedaDebounced = useDebounce(filtros.busqueda, 350);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Fetch datos ──────────────────────────────────────────────

  const cargarClientes = useCallback(
    async (f: EstadoFiltros, busqueda: string) => {
      setLoading(true);
      const params: FiltrosCliente = {
        busqueda: busqueda || undefined,
        condicion_iva: f.condicion_iva || undefined,
        segmento: f.segmento || undefined,
        activo: f.activo,
        pagina: f.pagina,
        por_pagina: f.por_pagina,
        orden_por: f.orden_por as keyof import('@/types').Cliente,
        orden_dir: f.orden_dir,
      };
      if (shouldUsePlatformMocks) {
        setResultado(getMockClientes(params));
        setLoading(false);
        return;
      }
      const res: ApiResponse<PaginatedResponse<ClienteListaItem>> =
        await obtenerClientes(params);
      setLoading(false);
      if (res.data) setResultado(res.data);
    },
    [],
  );

  useEffect(() => {
    startTransition(() => {
      cargarClientes(filtros, busquedaDebounced);
    });
  }, [
    filtros.pagina,
    filtros.por_pagina,
    filtros.condicion_iva,
    filtros.segmento,
    filtros.activo,
    filtros.orden_por,
    filtros.orden_dir,
    busquedaDebounced,
    cargarClientes,
  ]);

  // Resetear página al cambiar filtros o búsqueda
  useEffect(() => {
    setFiltros((prev) => ({ ...prev, pagina: 1 }));
  }, [
    busquedaDebounced,
    filtros.condicion_iva,
    filtros.segmento,
    filtros.activo,
  ]);

  // Cerrar menú al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────

  const setFiltro = <K extends keyof EstadoFiltros>(
    k: K,
    v: EstadoFiltros[K],
  ) => {
    setFiltros((prev) => ({ ...prev, [k]: v }));
  };

  const toggleOrden = (col: OrdenCol) => {
    setFiltros((prev) => ({
      ...prev,
      orden_por: col,
      orden_dir:
        prev.orden_por === col && prev.orden_dir === 'asc' ? 'desc' : 'asc',
      pagina: 1,
    }));
  };

  const handleConfirmarAccion = async () => {
    if (!accionPending) return;
    if (shouldUsePlatformMocks) {
      setAccionPending(null);
      setResultado((prev) => {
        if (!prev) return prev;
        const nextData = prev.data.filter(
          (cliente) => cliente.id !== accionPending.cliente.id,
        );
        return {
          ...prev,
          data: nextData,
          total: Math.max(0, prev.total - 1),
        };
      });
      setToast({
        mensaje:
          accionPending.tipo === 'desactivar'
            ? 'Cliente desactivado en modo mock'
            : 'Cliente reactivado en modo mock',
        tipo: 'ok',
      });
      return;
    }
    setAccionLoading(true);

    const res =
      accionPending.tipo === 'desactivar'
        ? await desactivarCliente(accionPending.cliente.id)
        : await reactivarCliente(accionPending.cliente.id);

    setAccionLoading(false);
    setAccionPending(null);

    if (res.error) {
      setToast({ mensaje: res.mensaje ?? res.error, tipo: 'error' });
    } else {
      setToast({ mensaje: res.mensaje ?? 'Operación exitosa', tipo: 'ok' });
      cargarClientes(filtros, busquedaDebounced);
    }
  };

  const hayFiltrosActivos =
    !!filtros.condicion_iva || !!filtros.segmento || !filtros.activo;

  const clientes = resultado?.data ?? [];
  const total = resultado?.total ?? 0;
  const totalPaginas = resultado?.total_paginas ?? 1;
  const hayResultados = clientes.length > 0;
  const filtradoActivo = !!filtros.busqueda || hayFiltrosActivos;

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin:0; background:#060d1a; font-family:'DM Sans',sans-serif; -webkit-font-smoothing:antialiased; }

        @keyframes shimmer {
          0%,100% { opacity:0.4 }
          50%      { opacity:0.8 }
        }
        @keyframes fadeIn {
          from { opacity:0 }
          to   { opacity:1 }
        }
        @keyframes scaleIn {
          from { transform:scale(0.92); opacity:0 }
          to   { transform:scale(1);   opacity:1 }
        }
        @keyframes slideUp {
          from { transform:translateY(12px); opacity:0 }
          to   { transform:translateY(0);    opacity:1 }
        }
        @keyframes spin {
          from { transform:rotate(0deg) }
          to   { transform:rotate(360deg) }
        }

        .fila-cliente { transition: background 0.12s ease; }
        .fila-cliente:hover { background: rgba(245,158,11,0.03) !important; }
        .fila-cliente:hover .acciones-fila { opacity:1 !important; }

        .btn-col-orden { cursor:pointer; user-select:none; }
        .btn-col-orden:hover { color:#94a3b8 !important; }

        option { background:#0f172a; color:#e2e8f0; }

        ::-webkit-scrollbar       { height:4px; width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(148,163,184,0.15); border-radius:2px; }
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(ellipse 100% 60% at 5% 0%,rgba(245,158,11,0.03) 0%,transparent 55%), #060d1a',
          padding: '36px 24px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* ── Header ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: '24px',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: '#334155',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Sistema
                </span>
                <span style={{ color: '#1e293b' }}>›</span>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#475569',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Clientes
                </span>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: '700',
                  color: '#e2e8f0',
                  letterSpacing: '-0.02em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                Clientes
                {total > 0 && (
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#475569',
                      background: 'rgba(148,163,184,0.08)',
                      border: '1px solid rgba(148,163,184,0.12)',
                      borderRadius: '20px',
                      padding: '2px 10px',
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {total}
                  </span>
                )}
              </h1>
            </div>

            <a
              href='/clientes/nuevo'
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '9px 18px',
                borderRadius: '9px',
                border: 'none',
                background:
                  'linear-gradient(135deg,rgba(245,158,11,0.9),rgba(217,119,6,0.9))',
                color: '#0f172a',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                fontFamily: "'DM Sans',sans-serif",
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(245,158,11,0.15)',
                whiteSpace: 'nowrap',
              }}
            >
              <svg width='13' height='13' viewBox='0 0 13 13' fill='none'>
                <path
                  d='M6.5 1.5V11.5M1.5 6.5H11.5'
                  stroke='currentColor'
                  strokeWidth='2'
                  strokeLinecap='round'
                />
              </svg>
              Nuevo cliente
            </a>
          </div>

          {/* ── Barra de búsqueda + filtros ── */}
          <div
            style={{
              background: 'rgba(15,23,42,0.7)',
              border: '1px solid rgba(148,163,184,0.08)',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '12px',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {/* Búsqueda */}
              <div style={{ flex: 1, position: 'relative' }}>
                <svg
                  width='14'
                  height='14'
                  viewBox='0 0 14 14'
                  fill='none'
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#334155',
                    pointerEvents: 'none',
                  }}
                >
                  <circle
                    cx='6'
                    cy='6'
                    r='4.5'
                    stroke='currentColor'
                    strokeWidth='1.4'
                  />
                  <path
                    d='M9.5 9.5L12 12'
                    stroke='currentColor'
                    strokeWidth='1.4'
                    strokeLinecap='round'
                  />
                </svg>
                <input
                  type='text'
                  value={filtros.busqueda}
                  onChange={(e) => setFiltro('busqueda', e.target.value)}
                  placeholder='Buscar por razón social, CUIT o nombre...'
                  style={{
                    width: '100%',
                    padding: '9px 12px 9px 34px',
                    background: 'rgba(8,16,35,0.6)',
                    border: '1px solid rgba(148,163,184,0.1)',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    fontFamily: "'DM Sans',sans-serif",
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(245,158,11,0.35)')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(148,163,184,0.1)')
                  }
                />
                {filtros.busqueda && (
                  <button
                    onClick={() => setFiltro('busqueda', '')}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#475569',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                      <path
                        d='M2 2L10 10M10 2L2 10'
                        stroke='currentColor'
                        strokeWidth='1.5'
                        strokeLinecap='round'
                      />
                    </svg>
                  </button>
                )}
              </div>

              {/* Toggle filtros */}
              <button
                onClick={() => setFiltrosOpen((p) => !p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: hayFiltrosActivos
                    ? '1px solid rgba(245,158,11,0.35)'
                    : '1px solid rgba(148,163,184,0.1)',
                  background: hayFiltrosActivos
                    ? 'rgba(245,158,11,0.08)'
                    : 'rgba(8,16,35,0.6)',
                  color: hayFiltrosActivos ? '#f59e0b' : '#64748b',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                <svg width='13' height='13' viewBox='0 0 13 13' fill='none'>
                  <path
                    d='M1 3H12M3 6.5H10M5 10H8'
                    stroke='currentColor'
                    strokeWidth='1.4'
                    strokeLinecap='round'
                  />
                </svg>
                Filtros
                {hayFiltrosActivos && (
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#f59e0b',
                      display: 'inline-block',
                    }}
                  />
                )}
              </button>

              {/* Toggle activos / inactivos */}
              <button
                onClick={() => setFiltro('activo', !filtros.activo)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 14px',
                  borderRadius: '8px',
                  border: !filtros.activo
                    ? '1px solid rgba(248,113,113,0.3)'
                    : '1px solid rgba(148,163,184,0.1)',
                  background: !filtros.activo
                    ? 'rgba(248,113,113,0.08)'
                    : 'rgba(8,16,35,0.6)',
                  color: !filtros.activo ? '#f87171' : '#64748b',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {filtros.activo ? 'Activos' : 'Inactivos'}
              </button>
            </div>

            {/* Panel de filtros expandible */}
            {filtrosOpen && (
              <div
                style={{
                  marginTop: '12px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(148,163,184,0.06)',
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  animation: 'fadeIn 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Condición IVA
                  </label>
                  <select
                    value={filtros.condicion_iva}
                    onChange={(e) =>
                      setFiltro(
                        'condicion_iva',
                        e.target.value as CondicionIVA | '',
                      )
                    }
                    style={{
                      padding: '7px 28px 7px 10px',
                      background: 'rgba(8,16,35,0.8)',
                      border: '1px solid rgba(148,163,184,0.1)',
                      borderRadius: '7px',
                      color: '#94a3b8',
                      fontSize: '12px',
                      fontFamily: "'DM Sans',sans-serif",
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 10 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 4L5 7L8 4' stroke='%2364748b' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 8px center',
                    }}
                  >
                    {CONDICIONES_IVA.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '10px',
                      fontWeight: '600',
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                  >
                    Segmento
                  </label>
                  <select
                    value={filtros.segmento}
                    onChange={(e) => setFiltro('segmento', e.target.value)}
                    style={{
                      padding: '7px 28px 7px 10px',
                      background: 'rgba(8,16,35,0.8)',
                      border: '1px solid rgba(148,163,184,0.1)',
                      borderRadius: '7px',
                      color: '#94a3b8',
                      fontSize: '12px',
                      fontFamily: "'DM Sans',sans-serif",
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='10' viewBox='0 0 10 10' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 4L5 7L8 4' stroke='%2364748b' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 8px center',
                    }}
                  >
                    <option value=''>Todos los segmentos</option>
                    {SEGMENTOS.filter(Boolean).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {hayFiltrosActivos && (
                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      onClick={() => {
                        setFiltro('condicion_iva', '');
                        setFiltro('segmento', '');
                        setFiltro('activo', true);
                      }}
                      style={{
                        padding: '7px 12px',
                        borderRadius: '7px',
                        border: '1px solid rgba(148,163,184,0.1)',
                        background: 'transparent',
                        color: '#475569',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      Limpiar filtros
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Tabla ── */}
          <div
            style={{
              background: 'rgba(15,23,42,0.7)',
              border: '1px solid rgba(148,163,184,0.08)',
              borderRadius: '12px',
              overflow: 'hidden',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: '700px',
                }}
              >
                <thead>
                  <tr
                    style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}
                  >
                    {(
                      [
                        { col: null, label: '', w: '44px' },
                        { col: 'razon_social', label: 'Cliente', w: 'auto' },
                        { col: 'cuit', label: 'CUIT', w: '130px' },
                        { col: 'condicion_iva', label: 'IVA', w: '70px' },
                        { col: 'segmento', label: 'Segmento', w: '160px' },
                        { col: null, label: 'Contacto', w: '140px' },
                        {
                          col: 'ultima_actividad',
                          label: 'Últ. actividad',
                          w: '110px',
                        },
                        { col: null, label: 'Saldo', w: '100px' },
                      ] as { col: OrdenCol | null; label: string; w: string }[]
                    ).map(({ col, label, w }, i) => (
                      <th
                        key={i}
                        className={col ? 'btn-col-orden' : ''}
                        onClick={col ? () => toggleOrden(col) : undefined}
                        style={{
                          padding: '11px 16px',
                          textAlign: 'left',
                          fontSize: '10px',
                          fontWeight: '700',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color:
                            col && filtros.orden_por === col
                              ? '#f59e0b'
                              : '#334155',
                          width: w,
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {label}
                          {col && filtros.orden_por === col && (
                            <svg
                              width='9'
                              height='9'
                              viewBox='0 0 9 9'
                              fill='none'
                            >
                              {filtros.orden_dir === 'asc' ? (
                                <path
                                  d='M4.5 7V2M2 4.5L4.5 2L7 4.5'
                                  stroke='#f59e0b'
                                  strokeWidth='1.3'
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                />
                              ) : (
                                <path
                                  d='M4.5 2V7M2 4.5L4.5 7L7 4.5'
                                  stroke='#f59e0b'
                                  strokeWidth='1.3'
                                  strokeLinecap='round'
                                  strokeLinejoin='round'
                                />
                              )}
                            </svg>
                          )}
                        </span>
                      </th>
                    ))}
                    <th style={{ padding: '11px 16px', width: '40px' }} />
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    Array.from({ length: filtros.por_pagina > 10 ? 8 : 5 }).map(
                      (_, i) => <SkeletonRow key={i} />,
                    )
                  ) : !hayResultados ? (
                    <EmptyState filtrado={filtradoActivo} />
                  ) : (
                    clientes.map((c, idx) => (
                      <tr
                        key={c.id}
                        className='fila-cliente'
                        style={{
                          borderBottom: '1px solid rgba(148,163,184,0.04)',
                          background:
                            idx % 2 === 0 ? 'transparent' : 'rgba(8,16,35,0.2)',
                        }}
                      >
                        {/* Avatar */}
                        <td style={{ padding: '10px 8px 10px 16px' }}>
                          <div
                            style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              background: avatarColor(c.razon_social),
                              border: '1px solid rgba(245,158,11,0.12)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: '700',
                              color: '#f59e0b',
                              fontFamily: "'DM Sans',sans-serif",
                              flexShrink: 0,
                            }}
                          >
                            {avatarLetra(c.razon_social)}
                          </div>
                        </td>

                        {/* Razón social */}
                        <td style={{ padding: '10px 16px' }}>
                          <a
                            href={`/clientes/${c.id}`}
                            style={{
                              textDecoration: 'none',
                              display: 'block',
                            }}
                          >
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#cbd5e1',
                                lineHeight: '1.3',
                                marginBottom: '1px',
                                transition: 'color 0.15s',
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.color = '#f59e0b')
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.color = '#cbd5e1')
                              }
                            >
                              {c.razon_social}
                            </div>
                            {c.nombre_fantasia && (
                              <div
                                style={{ fontSize: '11px', color: '#475569' }}
                              >
                                {c.nombre_fantasia}
                              </div>
                            )}
                          </a>
                        </td>

                        {/* CUIT */}
                        <td style={{ padding: '10px 16px' }}>
                          <span
                            style={{
                              fontSize: '12px',
                              color: c.cuit ? '#64748b' : '#1e293b',
                              fontFamily: "'DM Mono',monospace",
                            }}
                          >
                            {c.cuit ?? '—'}
                          </span>
                        </td>

                        {/* IVA badge */}
                        <td style={{ padding: '10px 16px' }}>
                          <IVABadge condicion={c.condicion_iva} />
                        </td>

                        {/* Segmento */}
                        <td style={{ padding: '10px 16px' }}>
                          {c.segmento ? (
                            <span
                              style={{
                                fontSize: '11px',
                                color: '#64748b',
                                background: 'rgba(148,163,184,0.06)',
                                border: '1px solid rgba(148,163,184,0.1)',
                                borderRadius: '4px',
                                padding: '2px 7px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {c.segmento}
                            </span>
                          ) : (
                            <span
                              style={{ color: '#1e293b', fontSize: '12px' }}
                            >
                              —
                            </span>
                          )}
                        </td>

                        {/* Contacto */}
                        <td style={{ padding: '10px 16px' }}>
                          <div
                            style={{
                              fontSize: '12px',
                              color: '#475569',
                              lineHeight: '1.4',
                            }}
                          >
                            {c.email ? (
                              <div
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '130px',
                                }}
                              >
                                {c.email}
                              </div>
                            ) : null}
                            {c.telefono ? (
                              <div
                                style={{
                                  color: '#334155',
                                  fontFamily: "'DM Mono',monospace",
                                  fontSize: '11px',
                                }}
                              >
                                {c.telefono}
                              </div>
                            ) : null}
                            {!c.email && !c.telefono && (
                              <span style={{ color: '#1e293b' }}>—</span>
                            )}
                          </div>
                        </td>

                        {/* Última actividad */}
                        <td style={{ padding: '10px 16px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              color: '#334155',
                              fontFamily: "'DM Mono',monospace",
                            }}
                          >
                            {formatearFecha(c.ultima_actividad)}
                          </span>
                        </td>

                        {/* Saldo */}
                        <td style={{ padding: '10px 16px' }}>
                          <SaldoBadge monto={c.saldo_pendiente} />
                        </td>

                        {/* Acciones */}
                        <td
                          style={{ padding: '10px 12px', position: 'relative' }}
                          ref={menuAbierto === c.id ? menuRef : null}
                        >
                          <button
                            onClick={() =>
                              setMenuAbierto((prev) =>
                                prev === c.id ? null : c.id,
                              )
                            }
                            className='acciones-fila'
                            style={{
                              opacity: menuAbierto === c.id ? 1 : 0,
                              width: '28px',
                              height: '28px',
                              borderRadius: '6px',
                              border: '1px solid rgba(148,163,184,0.12)',
                              background:
                                menuAbierto === c.id
                                  ? 'rgba(148,163,184,0.08)'
                                  : 'transparent',
                              color: '#64748b',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}
                          >
                            <svg
                              width='14'
                              height='14'
                              viewBox='0 0 14 14'
                              fill='none'
                            >
                              <circle cx='7' cy='3' r='1' fill='currentColor' />
                              <circle cx='7' cy='7' r='1' fill='currentColor' />
                              <circle
                                cx='7'
                                cy='11'
                                r='1'
                                fill='currentColor'
                              />
                            </svg>
                          </button>

                          {menuAbierto === c.id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: '8px',
                                top: '100%',
                                zIndex: 50,
                                minWidth: '160px',
                                background: '#0f172a',
                                border: '1px solid rgba(148,163,184,0.12)',
                                borderRadius: '10px',
                                padding: '4px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                animation: 'scaleIn 0.15s ease',
                              }}
                            >
                              <MenuOpcion
                                icon='👁'
                                label='Ver ficha'
                                onClick={() => {
                                  window.location.href = `/clientes/${c.id}`;
                                }}
                              />
                              <MenuOpcion
                                icon='✏️'
                                label='Editar'
                                onClick={() => {
                                  window.location.href = `/clientes/${c.id}/editar`;
                                }}
                              />
                              <MenuOpcion
                                icon='📄'
                                label='Nuevo presupuesto'
                                onClick={() => {
                                  window.location.href = `/presupuestos/nuevo?cliente=${c.id}`;
                                }}
                              />
                              <div
                                style={{
                                  height: '1px',
                                  background: 'rgba(148,163,184,0.06)',
                                  margin: '4px 0',
                                }}
                              />
                              {c.activo ? (
                                <MenuOpcion
                                  icon='🔴'
                                  label='Desactivar'
                                  danger
                                  onClick={() => {
                                    setMenuAbierto(null);
                                    setAccionPending({
                                      tipo: 'desactivar',
                                      cliente: c,
                                    });
                                  }}
                                />
                              ) : (
                                <MenuOpcion
                                  icon='🟢'
                                  label='Reactivar'
                                  onClick={() => {
                                    setMenuAbierto(null);
                                    setAccionPending({
                                      tipo: 'reactivar',
                                      cliente: c,
                                    });
                                  }}
                                />
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Footer / Paginación ── */}
            {!loading && hayResultados && (
              <div
                style={{
                  padding: '12px 16px',
                  borderTop: '1px solid rgba(148,163,184,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                {/* Info */}
                <span
                  style={{
                    fontSize: '11px',
                    color: '#334155',
                    fontFamily: "'DM Mono',monospace",
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(filtros.pagina - 1) * filtros.por_pagina + 1}–
                  {Math.min(filtros.pagina * filtros.por_pagina, total)} de{' '}
                  {total}
                </span>

                {/* Controles */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {/* Por página */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#334155' }}>
                      por pág.
                    </span>
                    <select
                      value={filtros.por_pagina}
                      onChange={(e) => {
                        setFiltro('por_pagina', Number(e.target.value));
                        setFiltro('pagina', 1);
                      }}
                      style={{
                        padding: '4px 8px',
                        background: 'rgba(8,16,35,0.8)',
                        border: '1px solid rgba(148,163,184,0.1)',
                        borderRadius: '6px',
                        color: '#64748b',
                        fontSize: '11px',
                        fontFamily: "'DM Mono',monospace",
                        outline: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {POR_PAGINA_OPCIONES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Páginas */}
                  <div
                    style={{
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center',
                    }}
                  >
                    <BtnPag
                      onClick={() => setFiltro('pagina', filtros.pagina - 1)}
                      disabled={filtros.pagina <= 1}
                    >
                      <svg
                        width='12'
                        height='12'
                        viewBox='0 0 12 12'
                        fill='none'
                      >
                        <path
                          d='M8 10L4 6L8 2'
                          stroke='currentColor'
                          strokeWidth='1.4'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        />
                      </svg>
                    </BtnPag>

                    {Array.from(
                      { length: Math.min(totalPaginas, 5) },
                      (_, i) => {
                        let p = i + 1;
                        if (totalPaginas > 5) {
                          if (filtros.pagina <= 3) p = i + 1;
                          else if (filtros.pagina >= totalPaginas - 2)
                            p = totalPaginas - 4 + i;
                          else p = filtros.pagina - 2 + i;
                        }
                        return (
                          <BtnPag
                            key={p}
                            onClick={() => setFiltro('pagina', p)}
                            active={p === filtros.pagina}
                          >
                            {p}
                          </BtnPag>
                        );
                      },
                    )}

                    <BtnPag
                      onClick={() => setFiltro('pagina', filtros.pagina + 1)}
                      disabled={filtros.pagina >= totalPaginas}
                    >
                      <svg
                        width='12'
                        height='12'
                        viewBox='0 0 12 12'
                        fill='none'
                      >
                        <path
                          d='M4 2L8 6L4 10'
                          stroke='currentColor'
                          strokeWidth='1.4'
                          strokeLinecap='round'
                          strokeLinejoin='round'
                        />
                      </svg>
                    </BtnPag>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal confirmación ── */}
      {accionPending && (
        <ModalConfirmacion
          accion={accionPending}
          loading={accionLoading}
          onConfirmar={handleConfirmarAccion}
          onCancelar={() => setAccionPending(null)}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <ToastNotificacion
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}

// ─── Helpers de tabla ─────────────────────────────────────────────────────────

function MenuOpcion({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        padding: '7px 10px',
        borderRadius: '7px',
        border: 'none',
        background: hovered
          ? danger
            ? 'rgba(248,113,113,0.08)'
            : 'rgba(148,163,184,0.06)'
          : 'transparent',
        color: danger ? '#f87171' : '#94a3b8',
        fontSize: '12px',
        cursor: 'pointer',
        fontFamily: "'DM Sans',sans-serif",
        textAlign: 'left',
        transition: 'all 0.12s',
      }}
    >
      <span style={{ fontSize: '13px' }}>{icon}</span>
      {label}
    </button>
  );
}

function BtnPag({
  onClick,
  disabled = false,
  active = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '6px',
        border: active
          ? '1px solid rgba(245,158,11,0.4)'
          : '1px solid rgba(148,163,184,0.1)',
        background: active ? 'rgba(245,158,11,0.1)' : 'transparent',
        color: active ? '#f59e0b' : disabled ? '#1e293b' : '#475569',
        fontSize: '11px',
        fontFamily: "'DM Mono',monospace",
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}
