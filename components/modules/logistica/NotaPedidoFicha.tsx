'use client';

// ============================================================
// components/modules/logistica/NotaPedidoFicha.tsx
// Ficha de nota de pedido: detalle de ítems con recepción
// por línea, historial de estado, acciones de cierre.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react';
import type { NotaPedidoCompleta, NotaPedidoItem } from '@/types';
import {
  obtenerNotaPedido,
  cambiarEstadoNotaPedido,
  actualizarRecepcionItem,
} from '@/app/actions/logistica';
import {
  getMockNotaPedidoDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoNP = 'PENDIENTE' | 'PARCIAL' | 'RECIBIDO' | 'ANULADO';
type FullNP = NotaPedidoCompleta & { numero_orden: string | null };

interface Props {
  notaId: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<
  EstadoNP,
  { label: string; color: string; bg: string; border: string }
> = {
  PENDIENTE: {
    label: 'Pendiente',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
  PARCIAL: {
    label: 'Parcial',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.2)',
  },
  RECIBIDO: {
    label: 'Recibido',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
  },
  ANULADO: {
    label: 'Anulado',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
  },
};

const TRANSICIONES: Record<EstadoNP, EstadoNP[]> = {
  PENDIENTE: ['PARCIAL', 'RECIBIDO', 'ANULADO'],
  PARCIAL: ['RECIBIDO', 'ANULADO'],
  RECIBIDO: [],
  ANULADO: [],
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const card: CSSProperties = {
  background: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(148,163,184,0.08)',
  borderRadius: '12px',
  backdropFilter: 'blur(12px)',
};
const labelSt: CSSProperties = {
  fontSize: '10px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: '#475569',
};

const fmtFecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

// ─── Item row con recepción inline ────────────────────────────────────────────

function ItemRecepcion({
  item,
  notaId,
  canEdit,
  onUpdate,
  showToast,
}: {
  item: NotaPedidoItem;
  notaId: string;
  canEdit: boolean;
  onUpdate: () => void;
  showToast: (m: string, t: 'ok' | 'error') => void;
}) {
  const [cantidad, setCantidad] = useState(String(item.cantidad_recibida));
  const [saving, setSaving] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setCantidad(String(item.cantidad_recibida));
  }, [item.cantidad_recibida]);

  const handleChange = (v: string) => {
    setCantidad(v);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const num = parseFloat(v);
      if (isNaN(num) || num < 0) return;
      const capped = Math.min(num, item.cantidad_pedida);
      setSaving(true);
      const res = await actualizarRecepcionItem(item.id, notaId, capped);
      setSaving(false);
      if (res.error) showToast(res.error, 'error');
      else onUpdate();
    }, 600);
  };

  const pct =
    item.cantidad_pedida > 0
      ? Math.min(100, (item.cantidad_recibida / item.cantidad_pedida) * 100)
      : 0;
  const completo = item.cantidad_recibida >= item.cantidad_pedida;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 100px 140px 32px',
        gap: '12px',
        padding: '12px 16px',
        alignItems: 'center',
        borderBottom: '1px solid rgba(148,163,184,0.05)',
      }}
    >
      {/* Descripción */}
      <div>
        <div style={{ fontSize: '13px', color: '#94a3b8' }}>
          {item.descripcion}
        </div>
        {item.notas && (
          <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
            {item.notas}
          </div>
        )}
      </div>

      {/* Pedido */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#64748b',
            fontFamily: "'DM Mono',monospace",
          }}
        >
          {item.cantidad_pedida}
        </div>
        <div style={{ fontSize: '9px', color: '#334155', marginTop: '1px' }}>
          {item.unidad_medida}
        </div>
      </div>

      {/* Recibido — editable */}
      <div style={{ textAlign: 'center' }}>
        {canEdit ? (
          <div style={{ position: 'relative' }}>
            <input
              type='number'
              value={cantidad}
              onChange={(e) => handleChange(e.target.value)}
              min={0}
              max={item.cantidad_pedida}
              step='0.01'
              style={{
                width: '80px',
                padding: '5px 8px',
                background: 'rgba(8,16,35,0.6)',
                border: `1px solid ${completo ? 'rgba(74,222,128,0.3)' : 'rgba(148,163,184,0.1)'}`,
                borderRadius: '6px',
                color: '#e2e8f0',
                fontSize: '12px',
                fontFamily: "'DM Mono',monospace",
                outline: 'none',
                textAlign: 'center',
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = 'rgba(96,165,250,0.35)')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = completo
                  ? 'rgba(74,222,128,0.3)'
                  : 'rgba(148,163,184,0.1)')
              }
            />
            {saving && (
              <div
                style={{
                  position: 'absolute',
                  right: '-16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              >
                <svg
                  width='10'
                  height='10'
                  viewBox='0 0 10 10'
                  style={{
                    animation: 'spin 0.8s linear infinite',
                    color: '#60a5fa',
                  }}
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
              </div>
            )}
          </div>
        ) : (
          <span
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: completo ? '#4ade80' : '#64748b',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {item.cantidad_recibida}
          </span>
        )}
        <div style={{ fontSize: '9px', color: '#334155', marginTop: '1px' }}>
          {item.unidad_medida}
        </div>
      </div>

      {/* Barra de progreso */}
      <div>
        <div
          style={{
            height: '6px',
            background: 'rgba(148,163,184,0.08)',
            borderRadius: '3px',
            overflow: 'hidden',
            marginBottom: '3px',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              background: completo
                ? '#4ade80'
                : pct > 0
                  ? '#a78bfa'
                  : 'transparent',
              borderRadius: '3px',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
        <div
          style={{
            fontSize: '9px',
            color: completo ? '#4ade80' : '#475569',
            textAlign: 'right',
          }}
        >
          {Math.round(pct)}%
        </div>
      </div>

      {/* Estado ítem */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {completo ? (
          <span style={{ fontSize: '14px' }} title='Completo'>
            ✅
          </span>
        ) : item.cantidad_recibida > 0 ? (
          <span style={{ fontSize: '14px' }} title='Parcial'>
            🔶
          </span>
        ) : (
          <span style={{ fontSize: '14px' }} title='Pendiente'>
            ⏳
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function NotaPedidoFicha({ notaId }: Props) {
  const [nota, setNota] = useState<FullNP | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionLoad, setAccionLoad] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [menuEstado, setMenuEstado] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string, tipo: 'ok' | 'error') => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const cargar = useCallback(async () => {
    if (shouldUsePlatformMocks) {
      setNota(getMockNotaPedidoDetalle(notaId) as FullNP | null);
      setLoading(false);
      return;
    }
    const res = await obtenerNotaPedido(notaId);
    setLoading(false);
    if (res.data) setNota(res.data as FullNP);
  }, [notaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuEstado(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleCambiarEstado = async (estado: EstadoNP) => {
    if (!nota) return;
    setAccionLoad(true);
    setMenuEstado(false);
    const res = await cambiarEstadoNotaPedido(nota.id, estado);
    setAccionLoad(false);
    if (res.error) showToast(res.error, 'error');
    else {
      showToast(res.mensaje ?? 'Estado actualizado', 'ok');
      cargar();
    }
  };

  const n = nota;
  const canEdit = n && !['RECIBIDO', 'ANULADO'].includes(n.estado);
  const totalItems = n?.items.length ?? 0;
  const itemsCompletos =
    n?.items.filter((i) => i.cantidad_recibida >= i.cantidad_pedida).length ??
    0;
  const pctGeneral =
    totalItems > 0 ? Math.round((itemsCompletos / totalItems) * 100) : 0;
  const posibles = n ? TRANSICIONES[n.estado as EstadoNP] : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box}body{margin:0;background:#060d1a;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        option{background:#0f172a;color:#e2e8f0}input:focus{outline:none!important}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scaleIn{from{transform:scale(0.96);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <div className='px-3 py-3 pb-10 sm:px-5 sm:py-4 sm:pb-12 lg:px-4 lg:py-2 lg:pb-3'>
        <div style={{ width: '100%', margin: '0 auto', minWidth: 0 }}>
          {/* Breadcrumb */}
          <div className='mb-3 flex items-center gap-2 lg:mb-2'>
            <a
              href='/logistica'
              style={{
                fontSize: '11px',
                color: '#334155',
                textDecoration: 'none',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Logística
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
              Notas de pedido
            </span>
            <span style={{ color: '#1e293b' }}>›</span>
            <span
              style={{
                fontSize: '11px',
                color: '#64748b',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {loading ? '...' : n?.numero}
            </span>
          </div>

          {/* Header */}
          <div style={{ ...card, padding: '16px', marginBottom: '12px' }}>
            {loading ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div
                  style={{
                    height: '12px',
                    borderRadius: '4px',
                    background: 'rgba(148,163,184,0.07)',
                    width: '120px',
                    animation: 'shimmer 1.4s ease infinite',
                  }}
                />
                <div
                  style={{
                    height: '22px',
                    borderRadius: '4px',
                    background: 'rgba(148,163,184,0.07)',
                    width: '280px',
                    animation: 'shimmer 1.4s ease infinite',
                  }}
                />
              </div>
            ) : n ? (
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
                      marginBottom: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: '#60a5fa',
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {n.numero}
                    </span>
                    {/* Badge estado */}
                    {(() => {
                      const cfg = ESTADO_CFG[n.estado as EstadoNP];
                      return (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 11px',
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
                    })()}
                    {n.numero_orden && (
                      <a
                        href={`/ordenes/${n.orden_id}`}
                        style={{
                          fontSize: '11px',
                          color: '#60a5fa',
                          fontFamily: "'DM Mono',monospace",
                          textDecoration: 'none',
                          background: 'rgba(96,165,250,0.06)',
                          border: '1px solid rgba(96,165,250,0.15)',
                          borderRadius: '4px',
                          padding: '1px 7px',
                        }}
                      >
                        ⚙️ {n.numero_orden}
                      </a>
                    )}
                  </div>

                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: '600',
                      color: '#94a3b8',
                      marginBottom: '4px',
                    }}
                  >
                    {n.proveedor ?? 'Sin proveedor asignado'}
                  </div>

                  {/* Barra de recepción general */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      marginTop: '10px',
                    }}
                  >
                    <div
                      style={{
                        width: '180px',
                        height: '6px',
                        background: 'rgba(148,163,184,0.08)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pctGeneral}%`,
                          background:
                            pctGeneral === 100 ? '#4ade80' : '#a78bfa',
                          borderRadius: '3px',
                          transition: 'width 0.5s ease',
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: '12px',
                        color: '#475569',
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {itemsCompletos}/{totalItems} ítems recibidos
                    </span>
                  </div>
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  {posibles.length > 0 && (
                    <div ref={menuRef} style={{ position: 'relative' }}>
                      <button
                        onClick={() => setMenuEstado((p) => !p)}
                        disabled={accionLoad}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          border: '1px solid rgba(96,165,250,0.3)',
                          background: 'rgba(96,165,250,0.06)',
                          color: '#60a5fa',
                          fontSize: '12px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        Cambiar estado
                        <svg
                          width='8'
                          height='8'
                          viewBox='0 0 8 8'
                          fill='none'
                          style={{
                            transition: 'transform 0.15s',
                            transform: menuEstado ? 'rotate(180deg)' : 'none',
                          }}
                        >
                          <path
                            d='M1 3L4 6L7 3'
                            stroke='currentColor'
                            strokeWidth='1.2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                          />
                        </svg>
                      </button>
                      {menuEstado && (
                        <div
                          style={{
                            position: 'absolute',
                            right: 0,
                            top: 'calc(100% + 4px)',
                            zIndex: 30,
                            background: '#0f172a',
                            border: '1px solid rgba(148,163,184,0.12)',
                            borderRadius: '9px',
                            padding: '4px',
                            minWidth: '170px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            animation: 'scaleIn 0.12s ease',
                          }}
                        >
                          {posibles.map((e) => {
                            const cfg = ESTADO_CFG[e];
                            return (
                              <button
                                key={e}
                                onClick={() => handleCambiarEstado(e)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '8px 11px',
                                  borderRadius: '6px',
                                  width: '100%',
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  color: '#94a3b8',
                                  fontFamily: "'DM Sans',sans-serif",
                                  transition: 'background 0.1s',
                                }}
                                onMouseEnter={(el) => {
                                  el.currentTarget.style.background =
                                    'rgba(148,163,184,0.06)';
                                  el.currentTarget.style.color = '#e2e8f0';
                                }}
                                onMouseLeave={(el) => {
                                  el.currentTarget.style.background =
                                    'transparent';
                                  el.currentTarget.style.color = '#94a3b8';
                                }}
                              >
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: cfg.color,
                                    flexShrink: 0,
                                  }}
                                />
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: '#475569' }}>
                Nota de pedido no encontrada
              </div>
            )}
          </div>

          {n && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 270px',
                gap: '16px',
                alignItems: 'start',
              }}
            >
              {/* Ítems con recepción */}
              <div style={{ ...card, overflow: 'hidden' }}>
                {/* Header tabla */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 100px 140px 32px',
                    gap: '12px',
                    padding: '10px 16px',
                    background: 'rgba(8,16,35,0.4)',
                    borderBottom: '1px solid rgba(148,163,184,0.07)',
                  }}
                >
                  {['Descripción', 'Pedido', 'Recibido', 'Avance', ''].map(
                    (h, i) => (
                      <span
                        key={i}
                        style={{
                          ...labelSt,
                          textAlign: i > 0 ? 'center' : 'left',
                        }}
                      >
                        {h}
                      </span>
                    ),
                  )}
                </div>
                {n.items.length === 0 ? (
                  <div
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: '#334155',
                      fontSize: '13px',
                    }}
                  >
                    Sin ítems
                  </div>
                ) : (
                  n.items.map((item) => (
                    <ItemRecepcion
                      key={item.id}
                      item={item}
                      notaId={n.id}
                      canEdit={!!canEdit}
                      onUpdate={cargar}
                      showToast={showToast}
                    />
                  ))
                )}
              </div>

              {/* Panel lateral */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                {/* Datos del documento */}
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
                    Datos
                  </div>
                  {[
                    { label: 'Número', value: n.numero, mono: true },
                    { label: 'Proveedor', value: n.proveedor ?? '—' },
                    {
                      label: 'Fecha pedido',
                      value: fmtFecha(n.fecha_pedido),
                      mono: true,
                    },
                    {
                      label: 'Fecha requerida',
                      value: fmtFecha(n.fecha_requerida),
                      mono: true,
                    },
                    {
                      label: 'Fecha recepción',
                      value: fmtFecha(n.fecha_recepcion),
                      mono: true,
                    },
                    ...(n.orden_id
                      ? [
                          {
                            label: 'OS vinculada',
                            value: n.numero_orden ?? '—',
                            mono: true,
                          },
                        ]
                      : []),
                  ].map(({ label, value, mono }) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '8px',
                        paddingBottom: '7px',
                        borderBottom: '1px solid rgba(148,163,184,0.05)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#334155',
                          flexShrink: 0,
                        }}
                      >
                        {label}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          fontFamily: mono ? "'DM Mono',monospace" : undefined,
                          textAlign: 'right',
                        }}
                      >
                        {value || '—'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Resumen recepción */}
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
                    Recepción
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {[
                      { label: 'Total ítems', value: String(totalItems) },
                      {
                        label: 'Recibidos compl.',
                        value: String(itemsCompletos),
                        color:
                          itemsCompletos === totalItems ? '#4ade80' : '#94a3b8',
                      },
                      {
                        label: 'Pendientes',
                        value: String(totalItems - itemsCompletos),
                        color:
                          totalItems - itemsCompletos > 0
                            ? '#f59e0b'
                            : '#334155',
                      },
                    ].map(({ label, value, color }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#475569' }}>
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: '700',
                            color: color ?? '#94a3b8',
                            fontFamily: "'DM Mono',monospace",
                          }}
                        >
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notas */}
                {n.notas && (
                  <div style={{ ...card, padding: '16px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#334155',
                        marginBottom: '8px',
                      }}
                    >
                      Notas
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
                      {n.notas}
                    </p>
                  </div>
                )}

                {/* Accesos rápidos */}
                {n.orden_id && (
                  <div style={{ ...card, padding: '14px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: '700',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#334155',
                        marginBottom: '8px',
                      }}
                    >
                      Accesos
                    </div>
                    <a
                      href={`/ordenes/${n.orden_id}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '8px 10px',
                        borderRadius: '7px',
                        textDecoration: 'none',
                        fontSize: '12px',
                        color: '#64748b',
                        border: '1px solid rgba(148,163,184,0.07)',
                        background: 'rgba(8,16,35,0.3)',
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          'rgba(148,163,184,0.05)';
                        e.currentTarget.style.color = '#94a3b8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(8,16,35,0.3)';
                        e.currentTarget.style.color = '#64748b';
                      }}
                    >
                      ⚙️ Ver orden de servicio
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
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
            animation: 'slideUp 0.25s ease',
          }}
        >
          <span
            style={{
              color: toast.tipo === 'ok' ? '#4ade80' : '#f87171',
              fontWeight: '600',
              fontSize: '13px',
            }}
          >
            {toast.tipo === 'ok' ? '✓' : '✕'}
          </span>
          <span
            style={{
              color: toast.tipo === 'ok' ? '#4ade80' : '#f87171',
              fontSize: '13px',
            }}
          >
            {toast.msg}
          </span>
        </div>
      )}
    </>
  );
}
