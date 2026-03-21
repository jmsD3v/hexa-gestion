'use client';

// ============================================================
// components/modules/presupuestos/PresupuestoFicha.tsx
// Vista detalle de presupuesto: ítems, incidencias, desglose
// económico, OS vinculada, acciones de estado y PDF.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type {
  PresupuestoCompleto,
  PresupuestoItem,
  PresupuestoIncidencia,
  TipoIncidencia,
  EstadoPresupuesto,
  TipoOperacion,
} from '@/types';
import {
  obtenerPresupuestoCompleto,
  cambiarEstadoPresupuesto,
  aprobarPresupuesto,
  duplicarPresupuesto,
} from '@/app/actions/presupuestos';
import {
  getMockPresupuestoDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  presupuestoId: string;
}

type PCompleto = PresupuestoCompleto & { razon_social?: string };

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<
  EstadoPresupuesto,
  { label: string; color: string; bg: string; border: string; icon: string }
> = {
  BORRADOR: {
    label: 'Borrador',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.15)',
    icon: '📝',
  },
  ENVIADO: {
    label: 'Enviado',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
    icon: '📤',
  },
  APROBADO: {
    label: 'Aprobado',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
    icon: '✅',
  },
  RECHAZADO: {
    label: 'Rechazado',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
    icon: '❌',
  },
  VENCIDO: {
    label: 'Vencido',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
    icon: '⏰',
  },
};

const TIPO_LABEL: Record<TipoOperacion, string> = {
  SERVICIO: 'Servicio',
  PRODUCTO: 'Producto',
  PRODUCTO_SERVICIO: 'Producto + Servicio',
};

const INCIDENCIA_CFG: Record<
  TipoIncidencia,
  { label: string; icon: string; color: string }
> = {
  traslado: { label: 'Traslado', icon: '🚗', color: '#60a5fa' },
  viatico: { label: 'Viático', icon: '💼', color: '#f59e0b' },
  hospedaje: { label: 'Hospedaje', icon: '🏨', color: '#a78bfa' },
  combustible: { label: 'Combustible', icon: '⛽', color: '#f97316' },
  vianda: { label: 'Vianda', icon: '🍱', color: '#34d399' },
  equipamiento: { label: 'Equipamiento', icon: '🛠', color: '#94a3b8' },
  sanidad: { label: 'Sanidad / Seguros', icon: '🏥', color: '#f87171' },
  honorario_externo: {
    label: 'Honorario Externo',
    icon: '👤',
    color: '#e879f9',
  },
  pago_tercero: { label: 'Pago a Tercero', icon: '💸', color: '#fbbf24' },
  otro: { label: 'Otro', icon: '📎', color: '#64748b' },
};

// ─── Estilos ──────────────────────────────────────────────────────────────────

const card: CSSProperties = {
  background: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(148,163,184,0.08)',
  borderRadius: '12px',
  backdropFilter: 'blur(12px)',
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

const isVencido = (p: PCompleto) =>
  p.estado === 'ENVIADO' &&
  p.fecha_vencimiento &&
  new Date(p.fecha_vencimiento) < new Date();

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

function BadgeEstado({ estado }: { estado: EstadoPresupuesto }) {
  const cfg = ESTADO_CFG[estado];
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

function SectionTitle({
  icon,
  title,
  count,
}: {
  icon: string;
  title: string;
  count?: number;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        marginBottom: '16px',
      }}
    >
      <span style={{ fontSize: '14px' }}>{icon}</span>
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
      {count !== undefined && count > 0 && (
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
          {count}
        </span>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: '1px',
        background:
          'linear-gradient(to right,transparent,rgba(148,163,184,0.08),transparent)',
        margin: '2px 0',
      }}
    />
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
    const t = setTimeout(onClose, 4000);
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

// ─── Tabla de ítems ───────────────────────────────────────────────────────────

function TablaItems({ items }: { items: PresupuestoItem[] }) {
  const [expandido, setExpandido] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          border: '1px dashed rgba(148,163,184,0.1)',
          borderRadius: '8px',
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', color: '#334155' }}>
          Sin ítems
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      {/* Encabezado */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '32px 1fr 70px 80px 90px 70px 100px',
          gap: '8px',
          padding: '9px 14px',
          background: 'rgba(8,16,35,0.4)',
          borderBottom: '1px solid rgba(148,163,184,0.07)',
        }}
      >
        {[
          '#',
          'Descripción',
          'Cant.',
          'Unidad',
          'P. Unit.',
          'Desc.',
          'Subtotal',
        ].map((h, i) => (
          <span
            key={h}
            style={{
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#334155',
              textAlign: i >= 4 ? 'right' : 'left',
            }}
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
              borderBottom:
                idx < items.length - 1
                  ? '1px solid rgba(148,163,184,0.05)'
                  : 'none',
            }}
          >
            {/* Fila principal */}
            <div
              onClick={() =>
                item.detalle
                  ? setExpandido(expandido === item.id ? null : item.id)
                  : undefined
              }
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 70px 80px 90px 70px 100px',
                gap: '8px',
                padding: '11px 14px',
                alignItems: 'center',
                cursor: item.detalle ? 'pointer' : 'default',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (item.detalle)
                  e.currentTarget.style.background = 'rgba(148,163,184,0.02)';
              }}
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              {/* Número */}
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '5px',
                  background: 'rgba(245,158,11,0.07)',
                  border: '1px solid rgba(245,158,11,0.12)',
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

              {/* Descripción */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: '13px',
                    color: '#94a3b8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.descripcion}
                </span>
                {item.detalle && (
                  <svg
                    width='10'
                    height='10'
                    viewBox='0 0 10 10'
                    fill='none'
                    style={{
                      color: '#334155',
                      flexShrink: 0,
                      transition: 'transform 0.15s',
                      transform:
                        expandido === item.id ? 'rotate(180deg)' : 'none',
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
                )}
              </div>

              {/* Cantidad */}
              <span
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontFamily: "'DM Mono',monospace",
                  textAlign: 'right',
                }}
              >
                {item.cantidad}
              </span>

              {/* Unidad */}
              <span
                style={{
                  fontSize: '11px',
                  color: '#475569',
                  fontFamily: "'DM Mono',monospace",
                  textAlign: 'right',
                }}
              >
                {item.unidad_medida}
              </span>

              {/* Precio unitario */}
              <span
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  fontFamily: "'DM Mono',monospace",
                  textAlign: 'right',
                }}
              >
                {formatearMonto(item.precio_unitario)}
              </span>

              {/* Descuento */}
              <span
                style={{
                  fontSize: '11px',
                  color: item.descuento_pct > 0 ? '#f59e0b' : '#334155',
                  fontFamily: "'DM Mono',monospace",
                  textAlign: 'right',
                }}
              >
                {item.descuento_pct > 0 ? `${item.descuento_pct}%` : '—'}
              </span>

              {/* Subtotal */}
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#94a3b8',
                  fontFamily: "'DM Mono',monospace",
                  textAlign: 'right',
                }}
              >
                {formatearMonto(item.subtotal)}
              </span>
            </div>

            {/* Detalle expandido */}
            {expandido === item.id && item.detalle && (
              <div
                style={{
                  padding: '0 14px 12px 52px',
                  animation: 'fadeIn 0.15s ease',
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: '12px',
                    color: '#475569',
                    lineHeight: '1.7',
                    fontStyle: 'italic',
                    borderLeft: '2px solid rgba(245,158,11,0.2)',
                    paddingLeft: '10px',
                  }}
                >
                  {item.detalle}
                </p>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}

// ─── Tabla de incidencias ─────────────────────────────────────────────────────

function TablaIncidencias({
  incidencias,
}: {
  incidencias: PresupuestoIncidencia[];
}) {
  const externas = incidencias.filter((i) => !i.es_interno);
  const internas = incidencias.filter((i) => i.es_interno);

  if (incidencias.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          border: '1px dashed rgba(148,163,184,0.1)',
          borderRadius: '8px',
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', color: '#334155' }}>
          Sin incidencias registradas
        </p>
      </div>
    );
  }

  const FilaInc = ({
    inc,
    interna,
  }: {
    inc: PresupuestoIncidencia;
    interna: boolean;
  }) => {
    const cfg = INCIDENCIA_CFG[inc.tipo];
    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 60px 50px 60px 90px 100px',
          gap: '8px',
          padding: '10px 14px',
          borderBottom: '1px solid rgba(148,163,184,0.04)',
          alignItems: 'center',
        }}
      >
        {/* Badge tipo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '2px 8px',
            borderRadius: '5px',
            background: `${cfg.color}10`,
            border: `1px solid ${cfg.color}20`,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: '10px' }}>{cfg.icon}</span>
          <span
            style={{
              fontSize: '9px',
              fontWeight: '700',
              color: cfg.color,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {cfg.label}
          </span>
        </div>
        <span
          style={{
            fontSize: '12px',
            color: '#94a3b8',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {inc.descripcion}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: '#64748b',
            fontFamily: "'DM Mono',monospace",
            textAlign: 'right',
          }}
        >
          {inc.cantidad}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: '#64748b',
            fontFamily: "'DM Mono',monospace",
            textAlign: 'right',
          }}
        >
          {inc.dias > 1 ? `${inc.dias}d` : '—'}
        </span>
        <span
          style={{
            fontSize: '11px',
            color: '#64748b',
            fontFamily: "'DM Mono',monospace",
            textAlign: 'right',
          }}
        >
          {inc.distancia_km ? `${inc.distancia_km}km` : '—'}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: '#64748b',
            fontFamily: "'DM Mono',monospace",
            textAlign: 'right',
          }}
        >
          {formatearMonto(inc.monto_unitario)}
        </span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: interna ? '#475569' : '#94a3b8',
            fontFamily: "'DM Mono',monospace",
            textAlign: 'right',
          }}
        >
          {formatearMonto(inc.subtotal)}
        </span>
      </div>
    );
  };

  return (
    <div
      style={{
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 60px 50px 60px 90px 100px',
          gap: '8px',
          padding: '9px 14px',
          background: 'rgba(8,16,35,0.4)',
          borderBottom: '1px solid rgba(148,163,184,0.07)',
        }}
      >
        {[
          'Tipo',
          'Descripción',
          'Cant.',
          'Días',
          'Km',
          'Monto',
          'Subtotal',
        ].map((h, i) => (
          <span
            key={h}
            style={{
              fontSize: '10px',
              fontWeight: '700',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#334155',
              textAlign: i >= 5 ? 'right' : 'left',
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Externas */}
      {externas.length > 0 && (
        <>
          <div
            style={{
              padding: '6px 14px 4px',
              background: 'rgba(96,165,250,0.03)',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: '700',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#60a5fa',
              }}
            >
              Visibles al cliente ({externas.length})
            </span>
          </div>
          {externas.map((inc) => (
            <FilaInc key={inc.id} inc={inc} interna={false} />
          ))}
        </>
      )}

      {/* Internas */}
      {internas.length > 0 && (
        <>
          <div
            style={{
              padding: '6px 14px 4px',
              background: 'rgba(148,163,184,0.02)',
              borderTop:
                externas.length > 0
                  ? '1px solid rgba(148,163,184,0.05)'
                  : 'none',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: '700',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: '#334155',
              }}
            >
              Solo costo interno ({internas.length})
            </span>
          </div>
          {internas.map((inc) => (
            <FilaInc key={inc.id} inc={inc} interna={true} />
          ))}
        </>
      )}
    </div>
  );
}

// ─── Panel de totales ─────────────────────────────────────────────────────────

function PanelTotales({ p }: { p: PCompleto }) {
  const margenColor = !p.margen_pct
    ? '#334155'
    : p.margen_pct >= 30
      ? '#4ade80'
      : p.margen_pct >= 10
        ? '#f59e0b'
        : '#f87171';

  return (
    <div style={{ ...card, padding: '20px' }}>
      <SectionTitle icon='🧮' title='Desglose económico' />

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {/* Ítems */}
        <Row label={`Ítems (${p.items.length})`} value={p.subtotal_items} />

        {/* Incidencias externas */}
        {p.incidencias.filter((i) => !i.es_interno).length > 0 && (
          <Row
            label={`Incidencias externas (${p.incidencias.filter((i) => !i.es_interno).length})`}
            value={p.incidencias
              .filter((i) => !i.es_interno)
              .reduce((a, i) => a + i.subtotal, 0)}
          />
        )}

        <Divider />

        {/* Descuento */}
        {p.descuento_pct > 0 && (
          <Row
            label={`Descuento (${p.descuento_pct}%)`}
            value={-p.descuento_monto}
            accent='amber'
          />
        )}

        {/* Subtotal */}
        <Row label='Subtotal sin IVA' value={p.subtotal} />

        {/* IVA */}
        <Row label={`IVA (${p.iva_pct}%)`} value={p.iva_monto} />

        <Divider />

        {/* TOTAL */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0 4px',
          }}
        >
          <span
            style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}
          >
            TOTAL
          </span>
          <span
            style={{
              fontSize: '22px',
              fontWeight: '800',
              color: '#f59e0b',
              fontFamily: "'DM Mono',monospace",
              letterSpacing: '-0.02em',
            }}
          >
            {formatearMonto(p.total)}
          </span>
        </div>
      </div>

      {/* Análisis interno */}
      {p.costo_total !== null && p.costo_total > 0 && (
        <div
          style={{
            marginTop: '16px',
            padding: '14px',
            background: 'rgba(8,16,35,0.5)',
            border: '1px solid rgba(148,163,184,0.07)',
            borderRadius: '9px',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#334155',
              marginBottom: '10px',
            }}
          >
            Análisis interno
          </div>

          {/* Incidencias internas */}
          {p.incidencias.filter((i) => i.es_interno).length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '6px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                Incidencias internas
                <span
                  style={{
                    fontSize: '9px',
                    background: 'rgba(148,163,184,0.07)',
                    border: '1px solid rgba(148,163,184,0.1)',
                    borderRadius: '3px',
                    padding: '0 4px',
                  }}
                >
                  costo
                </span>
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: '#334155',
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                {formatearMonto(
                  p.incidencias
                    .filter((i) => i.es_interno)
                    .reduce((a, i) => a + i.subtotal, 0),
                )}
              </span>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#475569' }}>
              Costo estimado total
            </span>
            <span
              style={{
                fontSize: '11px',
                color: '#475569',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {formatearMonto(p.costo_total)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <span style={{ fontSize: '11px', color: '#64748b' }}>
              Margen bruto
            </span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '700',
                color: margenColor,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {formatearMonto(p.margen_monto ?? 0)} (
              {(p.margen_pct ?? 0).toFixed(1)}%)
            </span>
          </div>

          {/* Barra de margen */}
          <div
            style={{
              height: '4px',
              background: 'rgba(148,163,184,0.08)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, p.margen_pct ?? 0))}%`,
                background: margenColor,
                borderRadius: '2px',
                transition: 'width 0.5s ease',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'amber';
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0',
      }}
    >
      <span style={{ fontSize: '12px', color: '#475569' }}>{label}</span>
      <span
        style={{
          fontSize: '13px',
          fontWeight: '500',
          color: accent === 'amber' ? '#f59e0b' : '#64748b',
          fontFamily: "'DM Mono',monospace",
        }}
      >
        {value < 0
          ? `−${formatearMonto(Math.abs(value))}`
          : formatearMonto(value)}
      </span>
    </div>
  );
}

// ─── Modal rechazo ────────────────────────────────────────────────────────────

function ModalAccion({
  titulo,
  descripcion,
  emoji,
  colorBtn,
  labelBtn,
  onConfirmar,
  onCancelar,
  loading,
  conTexto = false,
}: {
  titulo: string;
  descripcion: string;
  emoji: string;
  colorBtn: string;
  labelBtn: string;
  onConfirmar: (texto?: string) => void;
  onCancelar: () => void;
  loading: boolean;
  conTexto?: boolean;
}) {
  const [texto, setTexto] = useState('');
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
          maxWidth: '400px',
          width: '90%',
          animation: 'scaleIn 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <div style={{ fontSize: '32px', marginBottom: '10px' }}>{emoji}</div>
        <h3
          style={{
            margin: '0 0 6px',
            fontSize: '15px',
            fontWeight: '700',
            color: '#e2e8f0',
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          {titulo}
        </h3>
        <p
          style={{
            margin: '0 0 18px',
            fontSize: '13px',
            color: '#64748b',
            lineHeight: '1.6',
          }}
        >
          {descripcion}
        </p>
        {conTexto && (
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder='Motivo (opcional)...'
            rows={3}
            style={{
              width: '100%',
              padding: '9px 11px',
              background: 'rgba(8,16,35,0.6)',
              border: '1px solid rgba(148,163,184,0.1)',
              borderRadius: '7px',
              color: '#e2e8f0',
              fontSize: '12px',
              fontFamily: "'DM Sans',sans-serif",
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              marginBottom: '16px',
            }}
          />
        )}
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}
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
            onClick={() => onConfirmar(texto || undefined)}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: colorBtn,
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
            {labelBtn}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PresupuestoFicha({ presupuestoId }: Props) {
  const [presupuesto, setPresupuesto] = useState<PCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionLoading, setAccionLoading] = useState(false);
  const [toast, setToast] = useState<{
    mensaje: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [modal, setModal] = useState<'enviar' | 'aprobar' | 'rechazar' | null>(
    null,
  );
  const [tabActiva, setTabActiva] = useState<
    'items' | 'incidencias' | 'condiciones'
  >('items');

  const showToast = useCallback(
    (mensaje: string, tipo: 'ok' | 'error') => setToast({ mensaje, tipo }),
    [],
  );

  const cargar = useCallback(async () => {
    if (shouldUsePlatformMocks) {
      setPresupuesto(
        getMockPresupuestoDetalle(presupuestoId) as PCompleto | null,
      );
      setLoading(false);
      return;
    }
    const res = await obtenerPresupuestoCompleto(presupuestoId);
    setLoading(false);
    if (res.data) setPresupuesto(res.data as PCompleto);
  }, [presupuestoId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleCambioEstado = async (estado: EstadoPresupuesto) => {
    if (!presupuesto) return;
    setAccionLoading(true);
    const res = await cambiarEstadoPresupuesto(presupuesto.id, estado);
    setAccionLoading(false);
    setModal(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Estado actualizado', 'ok');
    cargar();
  };

  const handleAprobar = async () => {
    if (!presupuesto) return;
    setAccionLoading(true);
    const res = await aprobarPresupuesto(presupuesto.id, true);
    setAccionLoading(false);
    setModal(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Aprobado — OS generada', 'ok');
    cargar();
  };

  const handleDuplicar = async () => {
    if (!presupuesto) return;
    setAccionLoading(true);
    const res = await duplicarPresupuesto(presupuesto.id);
    setAccionLoading(false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Presupuesto duplicado', 'ok');
    if (res.data?.id)
      setTimeout(
        () => (window.location.href = `/presupuestos/${res.data!.id}`),
        1200,
      );
  };

  const vencido = presupuesto ? isVencido(presupuesto) : false;
  const p = presupuesto;

  const TABS = [
    {
      id: 'items' as const,
      label: 'Ítems',
      icon: '📋',
      badge: p?.items.length,
    },
    {
      id: 'incidencias' as const,
      label: 'Incidencias',
      icon: '📊',
      badge: p?.incidencias.length,
    },
    { id: 'condiciones' as const, label: 'Condiciones', icon: '📄' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box}body{margin:0;background:#060d1a;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        option{background:#0f172a;color:#e2e8f0}input:focus,select:focus,textarea:focus{outline:none!important}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}@keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes scaleIn{from{transform:scale(0.96);opacity:0}to{transform:scale(1);opacity:1}}
        ::placeholder{color:#1e293b!important}
      `}</style>

      <div style={{ padding: '14px 20px 40px' }}>
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
              href='/presupuestos'
              style={{
                fontSize: '11px',
                color: '#334155',
                textDecoration: 'none',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Presupuestos
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
              {loading ? '...' : p?.numero}
            </span>
          </div>

          {/* ── Header ── */}
          <div style={{ ...card, padding: '24px', marginBottom: '20px' }}>
            {loading ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <Skeleton w='120px' h='13px' />
                <Skeleton w='320px' h='22px' />
                <Skeleton w='200px' h='13px' />
              </div>
            ) : p ? (
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
                  {/* Número + estado + tipo */}
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
                        fontSize: '14px',
                        fontWeight: '700',
                        color: '#f59e0b',
                        fontFamily: "'DM Mono',monospace",
                        letterSpacing: '0.02em',
                      }}
                    >
                      {p.numero}
                    </span>
                    <BadgeEstado estado={p.estado} />
                    <span
                      style={{
                        fontSize: '11px',
                        color: '#475569',
                        background: 'rgba(148,163,184,0.07)',
                        border: '1px solid rgba(148,163,184,0.1)',
                        borderRadius: '5px',
                        padding: '2px 8px',
                      }}
                    >
                      {TIPO_LABEL[p.tipo_operacion]}
                    </span>
                    {vencido && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#f59e0b',
                          background: 'rgba(245,158,11,0.08)',
                          border: '1px solid rgba(245,158,11,0.2)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontWeight: '600',
                        }}
                      >
                        ⏰ Vencido
                      </span>
                    )}
                  </div>

                  {/* Título */}
                  <h1
                    style={{
                      margin: '0 0 6px',
                      fontSize: '20px',
                      fontWeight: '700',
                      color: '#e2e8f0',
                      letterSpacing: '-0.02em',
                      lineHeight: '1.3',
                    }}
                  >
                    {p.titulo}
                  </h1>

                  {/* Cliente */}
                  <a
                    href={`/clientes/${p.cliente_id}`}
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
                    👤 {(p as any).razon_social ?? p.cliente_id}
                  </a>
                </div>

                {/* Acciones */}
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    flexShrink: 0,
                  }}
                >
                  {/* Editar (solo en borrador) */}
                  {p.estado === 'BORRADOR' && (
                    <a
                      href={`/presupuestos/${p.id}/editar`}
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
                  )}

                  {/* PDF */}
                  <a
                    href={`/presupuestos/${p.id}/pdf`}
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
                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                      <path
                        d='M2 1H7L10 4V11H2V1Z'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinejoin='round'
                      />
                      <path
                        d='M7 1V4H10'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinejoin='round'
                      />
                    </svg>
                    PDF
                  </a>

                  {/* Duplicar */}
                  <button
                    onClick={handleDuplicar}
                    disabled={accionLoading}
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
                      cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                      opacity: accionLoading ? 0.6 : 1,
                    }}
                  >
                    <svg width='12' height='12' viewBox='0 0 12 12' fill='none'>
                      <rect
                        x='1'
                        y='3'
                        width='7'
                        height='8'
                        rx='1'
                        stroke='currentColor'
                        strokeWidth='1.2'
                      />
                      <path
                        d='M4 3V2a1 1 0 011-1h5a1 1 0 011 1v7a1 1 0 01-1 1H9'
                        stroke='currentColor'
                        strokeWidth='1.2'
                        strokeLinecap='round'
                      />
                    </svg>
                    Duplicar
                  </button>

                  {/* Enviar */}
                  {p.estado === 'BORRADOR' && (
                    <button
                      onClick={() => setModal('enviar')}
                      disabled={accionLoading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: '1px solid rgba(96,165,250,0.3)',
                        background: 'rgba(96,165,250,0.08)',
                        color: '#60a5fa',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      📤 Enviar al cliente
                    </button>
                  )}

                  {/* Aprobar */}
                  {['BORRADOR', 'ENVIADO'].includes(p.estado) && (
                    <button
                      onClick={() => setModal('aprobar')}
                      disabled={accionLoading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 18px',
                        borderRadius: '8px',
                        border: 'none',
                        background:
                          'linear-gradient(135deg,rgba(74,222,128,0.85),rgba(34,197,94,0.85))',
                        color: '#0f172a',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                        boxShadow: '0 4px 12px rgba(74,222,128,0.15)',
                      }}
                    >
                      ✅ Aprobar → OS
                    </button>
                  )}

                  {/* Rechazar */}
                  {p.estado === 'ENVIADO' && (
                    <button
                      onClick={() => setModal('rechazar')}
                      disabled={accionLoading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(248,113,113,0.25)',
                        background: 'rgba(248,113,113,0.06)',
                        color: '#f87171',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                      }}
                    >
                      ❌ Rechazar
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
                Presupuesto no encontrado
              </div>
            )}
          </div>

          {p && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 300px',
                gap: '16px',
                alignItems: 'start',
              }}
            >
              {/* ── Columna principal ── */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Objetivo */}
                <div style={{ ...card, padding: '20px' }}>
                  <SectionTitle icon='🎯' title='Objetivo del servicio' />
                  <p
                    style={{
                      margin: '0 0 14px',
                      fontSize: '13px',
                      color: '#94a3b8',
                      lineHeight: '1.8',
                    }}
                  >
                    {p.objetivo_servicio}
                  </p>
                  {p.descripcion && (
                    <div
                      style={{
                        paddingTop: '14px',
                        borderTop: '1px solid rgba(148,163,184,0.06)',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          color: '#334155',
                          display: 'block',
                          marginBottom: '6px',
                        }}
                      >
                        Descripción / Alcance
                      </span>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          color: '#64748b',
                          lineHeight: '1.8',
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {p.descripcion}
                      </p>
                    </div>
                  )}
                </div>

                {/* Tabs: ítems / incidencias / condiciones */}
                <div style={{ ...card, overflow: 'hidden' }}>
                  {/* Tab bar */}
                  <div
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid rgba(148,163,184,0.07)',
                      background: 'rgba(8,16,35,0.3)',
                    }}
                  >
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setTabActiva(tab.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '13px 20px',
                          border: 'none',
                          cursor: 'pointer',
                          background: 'transparent',
                          fontSize: '12px',
                          fontWeight: '600',
                          fontFamily: "'DM Sans',sans-serif",
                          color: tabActiva === tab.id ? '#e2e8f0' : '#334155',
                          borderBottom:
                            tabActiva === tab.id
                              ? '2px solid #f59e0b'
                              : '2px solid transparent',
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontSize: '13px' }}>{tab.icon}</span>
                        {tab.label}
                        {tab.badge !== undefined && tab.badge > 0 && (
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
                            {tab.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Contenido */}
                  <div
                    style={{ padding: '20px', animation: 'fadeIn 0.15s ease' }}
                    key={tabActiva}
                  >
                    {tabActiva === 'items' && <TablaItems items={p.items} />}
                    {tabActiva === 'incidencias' && (
                      <TablaIncidencias incidencias={p.incidencias} />
                    )}
                    {tabActiva === 'condiciones' && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '20px',
                        }}
                      >
                        <InfoPar
                          label='Condiciones de pago'
                          value={p.condiciones_pago}
                        />
                        <InfoPar
                          label='Tiempo de ejecución'
                          value={p.tiempo_ejecucion}
                        />
                        <InfoPar label='Garantía' value={p.garantia} />
                        <InfoPar label='Fecha de vencimiento'>
                          <span
                            style={{
                              fontSize: '13px',
                              color: vencido ? '#f59e0b' : '#94a3b8',
                              fontFamily: "'DM Mono',monospace",
                            }}
                          >
                            {fmtFecha(p.fecha_vencimiento)}
                            {vencido && ' ⚠'}
                          </span>
                        </InfoPar>
                        {p.notas_cliente && (
                          <div style={{ gridColumn: '1/-1' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: '#334155',
                                display: 'block',
                                marginBottom: '6px',
                              }}
                            >
                              Notas al cliente
                            </span>
                            <p
                              style={{
                                margin: 0,
                                fontSize: '13px',
                                color: '#64748b',
                                lineHeight: '1.7',
                                whiteSpace: 'pre-wrap',
                                padding: '12px',
                                background: 'rgba(8,16,35,0.4)',
                                borderRadius: '8px',
                                border: '1px solid rgba(148,163,184,0.07)',
                              }}
                            >
                              {p.notas_cliente}
                            </p>
                          </div>
                        )}
                        {p.notas_internas && (
                          <div style={{ gridColumn: '1/-1' }}>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: '600',
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                color: '#334155',
                                display: 'block',
                                marginBottom: '6px',
                              }}
                            >
                              Notas internas{' '}
                              <span
                                style={{
                                  fontSize: '9px',
                                  background: 'rgba(148,163,184,0.07)',
                                  border: '1px solid rgba(148,163,184,0.1)',
                                  borderRadius: '3px',
                                  padding: '0 5px',
                                  marginLeft: '4px',
                                }}
                              >
                                solo interno
                              </span>
                            </span>
                            <p
                              style={{
                                margin: 0,
                                fontSize: '13px',
                                color: '#475569',
                                lineHeight: '1.7',
                                whiteSpace: 'pre-wrap',
                                padding: '12px',
                                background: 'rgba(8,16,35,0.4)',
                                borderRadius: '8px',
                                border: '1px solid rgba(148,163,184,0.07)',
                              }}
                            >
                              {p.notas_internas}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Aprobación */}
                {p.estado === 'APROBADO' && p.aprobado_en && (
                  <div
                    style={{
                      ...card,
                      padding: '16px 20px',
                      border: '1px solid rgba(74,222,128,0.15)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                      }}
                    >
                      <span style={{ fontSize: '18px' }}>✅</span>
                      <div>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#4ade80',
                          }}
                        >
                          Presupuesto aprobado
                        </div>
                        <div
                          style={{
                            fontSize: '11px',
                            color: '#475569',
                            marginTop: '2px',
                          }}
                        >
                          {fmtFecha(p.aprobado_en)}
                          {' · '}
                          <a
                            href='/ordenes'
                            style={{ color: '#60a5fa', textDecoration: 'none' }}
                          >
                            Ver orden de servicio generada →
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Panel lateral ── */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {/* Totales */}
                <PanelTotales p={p} />

                {/* Datos del documento */}
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
                    Documento
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    {[
                      { label: 'Número', value: p.numero, mono: true },
                      {
                        label: 'Emisión',
                        value: fmtFecha(p.fecha_emision),
                        mono: true,
                      },
                      {
                        label: 'Vence',
                        value: fmtFecha(p.fecha_vencimiento),
                        mono: true,
                      },
                      {
                        label: 'Tipo',
                        value: TIPO_LABEL[p.tipo_operacion],
                        mono: false,
                      },
                      {
                        label: 'Ítems',
                        value: String(p.items.length),
                        mono: true,
                      },
                      {
                        label: 'Incidencias',
                        value: String(p.incidencias.length),
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
                          {value || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Accesos rápidos */}
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
                        href: `/clientes/${p.cliente_id}`,
                        label: 'Ver ficha del cliente',
                        icon: '👤',
                      },
                      {
                        href: `/presupuestos/${p.id}/pdf`,
                        label: 'Descargar PDF',
                        icon: '📄',
                        target: '_blank',
                      },
                      {
                        href: `/ordenes?presupuesto=${p.id}`,
                        label: 'Ver órdenes vinculadas',
                        icon: '⚙️',
                      },
                      {
                        href: `/facturas/nueva?presupuesto=${p.id}&cliente=${p.cliente_id}`,
                        label: 'Generar factura',
                        icon: '🧾',
                      },
                    ].map(({ href, label, icon, target }) => (
                      <a
                        key={href}
                        href={href}
                        target={target}
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

                {/* Metadatos */}
                <div style={{ ...card, padding: '16px' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#1e293b',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                        }}
                      >
                        Creado
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#334155',
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        {fmtFecha(p.creado_en)}
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#1e293b',
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                        }}
                      >
                        Actualizado
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: '#334155',
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        {fmtFecha(p.actualizado_en)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {modal === 'enviar' && (
        <ModalAccion
          titulo='Enviar presupuesto al cliente'
          descripcion='El presupuesto pasará al estado Enviado. Podrás aprobarlo o rechazarlo una vez que el cliente responda.'
          emoji='📤'
          colorBtn='rgba(96,165,250,0.9)'
          labelBtn='Enviar'
          loading={accionLoading}
          onCancelar={() => setModal(null)}
          onConfirmar={() => handleCambioEstado('ENVIADO')}
        />
      )}
      {modal === 'aprobar' && (
        <ModalAccion
          titulo='Aprobar presupuesto'
          descripcion='Se generará automáticamente una Orden de Servicio vinculada a este presupuesto.'
          emoji='✅'
          colorBtn='rgba(74,222,128,0.9)'
          labelBtn='Aprobar y generar OS'
          loading={accionLoading}
          onCancelar={() => setModal(null)}
          onConfirmar={handleAprobar}
        />
      )}
      {modal === 'rechazar' && (
        <ModalAccion
          titulo='Rechazar presupuesto'
          descripcion='El presupuesto pasará al estado Rechazado. Podés volver a borrarlo si necesitás modificarlo.'
          emoji='❌'
          colorBtn='rgba(248,113,113,0.15)'
          labelBtn='Rechazar'
          loading={accionLoading}
          conTexto
          onCancelar={() => setModal(null)}
          onConfirmar={() => handleCambioEstado('RECHAZADO')}
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
