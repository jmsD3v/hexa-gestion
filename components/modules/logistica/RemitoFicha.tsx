'use client';

// ============================================================
// components/modules/logistica/RemitoFicha.tsx
// Ficha de remito: ítems, datos de transporte, estado,
// vínculos a OS / NP / factura.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react';
import type { RemitoCompleto, RemitoItem } from '@/types';
import { obtenerRemito, cambiarEstadoRemito } from '@/app/actions/logistica';
import {
  getMockRemitoDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type EstadoRemito = 'BORRADOR' | 'EMITIDO' | 'ENTREGADO' | 'ANULADO';
type FullRemito = RemitoCompleto & {
  numero_orden: string | null;
  razon_social: string | null;
};
interface Props {
  remitoId: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<
  EstadoRemito,
  { label: string; color: string; bg: string; border: string }
> = {
  BORRADOR: {
    label: 'Borrador',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.15)',
  },
  EMITIDO: {
    label: 'En camino',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
  },
  ENTREGADO: {
    label: 'Entregado',
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

const TIPO_CFG: Record<string, { label: string; icon: string; color: string }> =
  {
    INTERNO_ENTRADA: { label: 'Interno Entrada', icon: '📥', color: '#a78bfa' },
    INTERNO_SALIDA: { label: 'Interno Salida', icon: '📤', color: '#60a5fa' },
    LEGAL_ENTRADA: { label: 'Legal Entrada', icon: '📦', color: '#4ade80' },
    LEGAL_SALIDA: { label: 'Legal Salida', icon: '🚚', color: '#f59e0b' },
  };

const TRANSICIONES: Record<EstadoRemito, EstadoRemito[]> = {
  BORRADOR: ['EMITIDO', 'ANULADO'],
  EMITIDO: ['ENTREGADO', 'ANULADO'],
  ENTREGADO: [],
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

// ─── Tabla ítems ──────────────────────────────────────────────────────────────

function TablaItems({ items }: { items: RemitoItem[] }) {
  const tienePrecios = items.some((i) => i.precio_unitario != null);
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: tienePrecios
            ? '28px 1fr 80px 80px 90px 100px'
            : '28px 1fr 80px 80px',
          gap: '10px',
          padding: '10px 16px',
          background: 'rgba(8,16,35,0.4)',
          borderBottom: '1px solid rgba(148,163,184,0.07)',
        }}
      >
        {[
          '#',
          'Descripción',
          'Cant.',
          'Unidad',
          ...(tienePrecios ? ['P. Unit.', 'Subtotal'] : []),
        ].map((h, i) => (
          <span
            key={i}
            style={{ ...labelSt, textAlign: i >= 4 ? 'right' : 'left' }}
          >
            {h}
          </span>
        ))}
      </div>
      {items
        .sort((a, b) => a.orden - b.orden)
        .map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: 'grid',
              gridTemplateColumns: tienePrecios
                ? '28px 1fr 80px 80px 90px 100px'
                : '28px 1fr 80px 80px',
              gap: '10px',
              padding: '11px 16px',
              alignItems: 'center',
              borderBottom:
                idx < items.length - 1
                  ? '1px solid rgba(148,163,184,0.05)'
                  : 'none',
            }}
          >
            <div
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '5px',
                background: 'rgba(245,158,11,0.07)',
                border: '1px solid rgba(245,158,11,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: '700',
                color: '#f59e0b',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {idx + 1}
            </div>
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>
              {item.descripcion}
            </span>
            <span
              style={{
                fontSize: '12px',
                color: '#64748b',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {item.cantidad}
            </span>
            <span
              style={{
                fontSize: '11px',
                color: '#475569',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {item.unidad_medida}
            </span>
            {tienePrecios && (
              <>
                <span
                  style={{
                    fontSize: '12px',
                    color: '#64748b',
                    fontFamily: "'DM Mono',monospace",
                    textAlign: 'right',
                  }}
                >
                  {item.precio_unitario != null
                    ? formatearMonto(item.precio_unitario)
                    : '—'}
                </span>
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#94a3b8',
                    fontFamily: "'DM Mono',monospace",
                    textAlign: 'right',
                  }}
                >
                  {item.subtotal != null ? formatearMonto(item.subtotal) : '—'}
                </span>
              </>
            )}
          </div>
        ))}
      {tienePrecios && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '12px 16px',
            borderTop: '1px solid rgba(148,163,184,0.07)',
          }}
        >
          <span
            style={{
              fontSize: '15px',
              fontWeight: '800',
              color: '#f59e0b',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {formatearMonto(items.reduce((a, i) => a + (i.subtotal ?? 0), 0))}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RemitoFicha({ remitoId }: Props) {
  const [remito, setRemito] = useState<FullRemito | null>(null);
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
      setRemito(getMockRemitoDetalle(remitoId) as FullRemito | null);
      setLoading(false);
      return;
    }
    const res = await obtenerRemito(remitoId);
    setLoading(false);
    if (res.data) setRemito(res.data as FullRemito);
  }, [remitoId]);

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

  const handleCambiarEstado = async (estado: EstadoRemito) => {
    if (!remito) return;
    setAccionLoad(true);
    setMenuEstado(false);
    const res = await cambiarEstadoRemito(remito.id, estado);
    setAccionLoad(false);
    if (res.error) showToast(res.error, 'error');
    else {
      showToast(res.mensaje ?? 'Estado actualizado', 'ok');
      cargar();
    }
  };

  const r = remito;
  const tipoCfg = r
    ? (TIPO_CFG[r.tipo] ?? { label: r.tipo, icon: '📄', color: '#94a3b8' })
    : null;
  const posibles = r ? TRANSICIONES[r.estado as EstadoRemito] : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box}body{margin:0;background:#060d1a;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scaleIn{from{transform:scale(0.96);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
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
              Remitos
            </span>
            <span style={{ color: '#1e293b' }}>›</span>
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              {loading ? '...' : r?.numero}
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
            ) : r ? (
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
                        color: '#f59e0b',
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {r.numero}
                    </span>

                    {/* Tipo */}
                    {tipoCfg && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '2px 9px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          color: tipoCfg.color,
                          background: `${tipoCfg.color}10`,
                          border: `1px solid ${tipoCfg.color}20`,
                        }}
                      >
                        {tipoCfg.icon} {tipoCfg.label}
                      </span>
                    )}

                    {/* Estado */}
                    {(() => {
                      const cfg = ESTADO_CFG[r.estado as EstadoRemito];
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

                    {/* Vínculos */}
                    {r.numero_orden && (
                      <a
                        href={`/ordenes/${r.orden_id}`}
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
                        ⚙️ {r.numero_orden}
                      </a>
                    )}
                    {r.factura_id && (
                      <a
                        href={`/facturas/${r.factura_id}`}
                        style={{
                          fontSize: '11px',
                          color: '#4ade80',
                          fontFamily: "'DM Mono',monospace",
                          textDecoration: 'none',
                          background: 'rgba(74,222,128,0.06)',
                          border: '1px solid rgba(74,222,128,0.15)',
                          borderRadius: '4px',
                          padding: '1px 7px',
                        }}
                      >
                        🧾 Factura
                      </a>
                    )}
                  </div>

                  {r.razon_social && (
                    <a
                      href={`/clientes/${r.cliente_id}`}
                      style={{
                        fontSize: '15px',
                        fontWeight: '600',
                        color: '#94a3b8',
                        textDecoration: 'none',
                        display: 'block',
                        marginBottom: '4px',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = '#e2e8f0')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = '#94a3b8')
                      }
                    >
                      {r.razon_social}
                    </a>
                  )}
                  {!r.razon_social && r.proveedor && (
                    <div
                      style={{
                        fontSize: '14px',
                        color: '#64748b',
                        marginBottom: '4px',
                      }}
                    >
                      {r.proveedor}
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <a
                    href={`/logistica/remitos/${r.id}/pdf`}
                    target='_blank'
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
                    📄 PDF
                  </a>
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
                          border: 'none',
                          background:
                            'linear-gradient(135deg,rgba(245,158,11,0.8),rgba(234,179,8,0.8))',
                          color: '#0f172a',
                          fontSize: '12px',
                          fontWeight: '700',
                          cursor: 'pointer',
                          fontFamily: "'DM Sans',sans-serif",
                        }}
                      >
                        Actualizar estado
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
                            minWidth: '160px',
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
              <div style={{ color: '#475569' }}>Remito no encontrado</div>
            )}
          </div>

          {r && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 270px',
                gap: '16px',
                alignItems: 'start',
              }}
            >
              {/* Ítems */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <TablaItems items={r.items} />

                {/* Notas */}
                {r.notas && (
                  <div style={{ ...card, padding: '18px' }}>
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
                      {r.notas}
                    </p>
                  </div>
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
                    Documento
                  </div>
                  {[
                    { label: 'Número', value: r.numero, mono: true },
                    { label: 'Tipo', value: tipoCfg?.label ?? r.tipo },
                    {
                      label: 'Emisión',
                      value: fmtFecha(r.fecha_emision),
                      mono: true,
                    },
                    ...(r.cae
                      ? [{ label: 'CAE', value: r.cae, mono: true }]
                      : []),
                    ...(r.cae_vencimiento
                      ? [
                          {
                            label: 'Venc. CAE',
                            value: fmtFecha(r.cae_vencimiento),
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

                {/* Datos de entrega */}
                {(r.direccion_entrega ||
                  r.transportista ||
                  r.patente_vehiculo ||
                  r.chofer) && (
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
                      🚚 Entrega
                    </div>
                    {[
                      { label: 'Dirección', value: r.direccion_entrega },
                      { label: 'Transportista', value: r.transportista },
                      {
                        label: 'Patente',
                        value: r.patente_vehiculo,
                        mono: true,
                      },
                      { label: 'Chofer', value: r.chofer },
                    ]
                      .filter(({ value }) => !!value)
                      .map(({ label, value, mono }) => (
                        <div
                          key={label}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '8px',
                            paddingBottom: '7px',
                            marginBottom: '7px',
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
                              fontFamily: mono
                                ? "'DM Mono',monospace"
                                : undefined,
                              textAlign: 'right',
                              maxWidth: '150px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {value}
                          </span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Accesos rápidos */}
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
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                    }}
                  >
                    {[
                      ...(r.cliente_id
                        ? [
                            {
                              href: `/clientes/${r.cliente_id}`,
                              label: 'Ver cliente',
                              icon: '👤',
                            },
                          ]
                        : []),
                      ...(r.orden_id
                        ? [
                            {
                              href: `/ordenes/${r.orden_id}`,
                              label: 'Ver OS',
                              icon: '⚙️',
                            },
                          ]
                        : []),
                      ...(r.nota_pedido_id
                        ? [
                            {
                              href: `/logistica/notas/${r.nota_pedido_id}`,
                              label: 'Ver nota de pedido',
                              icon: '📋',
                            },
                          ]
                        : []),
                      ...(r.factura_id
                        ? [
                            {
                              href: `/facturas/${r.factura_id}`,
                              label: 'Ver factura',
                              icon: '🧾',
                            },
                          ]
                        : []),
                    ].map(({ href, label, icon }) => (
                      <a
                        key={href}
                        href={href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '7px',
                          padding: '7px 9px',
                          borderRadius: '6px',
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
                          e.currentTarget.style.background =
                            'rgba(8,16,35,0.3)';
                          e.currentTarget.style.color = '#64748b';
                        }}
                      >
                        <span>{icon}</span>
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
