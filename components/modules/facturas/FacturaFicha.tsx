'use client';

// ============================================================
// components/modules/facturas/FacturaFicha.tsx
// Vista detalle de factura: ítems, historial de cobros,
// formulario de nuevo recibo, emitir/anular.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import type {
  FacturaCompleta,
  FacturaItem,
  Recibo,
  EstadoFactura,
  TipoComprobanteAFIP,
  TipoPago,
  TipoRecibo,
} from '@/types';
import {
  obtenerFactura,
  emitirFactura,
  anularFactura,
  registrarRecibo,
  eliminarRecibo,
} from '@/app/actions/facturas';
import {
  getMockFacturaDetalle,
  shouldUsePlatformMocks,
} from '@/app/actions/platform-mocks';
import { formatearMonto } from '@/lib/calculos';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  facturaId: string;
}
type FCompleta = FacturaCompleta & {
  razon_social: string;
  numero_presupuesto: string | null;
  numero_orden: string | null;
};

// ─── Constantes ───────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<
  EstadoFactura,
  { label: string; color: string; bg: string; border: string }
> = {
  BORRADOR: {
    label: 'Borrador',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.15)',
  },
  EMITIDA: {
    label: 'Emitida',
    color: '#60a5fa',
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.2)',
  },
  PENDIENTE_COBRO: {
    label: 'Pend. cobro',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    border: 'rgba(245,158,11,0.2)',
  },
  COBRADA_PARCIAL: {
    label: 'Cobro parcial',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.08)',
    border: 'rgba(167,139,250,0.2)',
  },
  COBRADA: {
    label: 'Cobrada',
    color: '#4ade80',
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.2)',
  },
  ANULADA: {
    label: 'Anulada',
    color: '#f87171',
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.2)',
  },
};

const COMP_LABEL: Record<TipoComprobanteAFIP, string> = {
  FACTURA_A: 'Factura A',
  FACTURA_B: 'Factura B',
  FACTURA_C: 'Factura C',
  NOTA_DEBITO_A: 'Nota Débito A',
  NOTA_DEBITO_B: 'Nota Débito B',
  NOTA_CREDITO_A: 'Nota Crédito A',
  NOTA_CREDITO_B: 'Nota Crédito B',
  REMITO_R: 'Remito R',
};

const TIPO_PAGO_CFG: Record<TipoPago, { label: string; icon: string }> = {
  EFECTIVO: { label: 'Efectivo', icon: '💵' },
  TRANSFERENCIA: { label: 'Transferencia', icon: '🏦' },
  CHEQUE: { label: 'Cheque', icon: '📋' },
  TARJETA_DEBITO: { label: 'Débito', icon: '💳' },
  TARJETA_CREDITO: { label: 'Crédito', icon: '💳' },
  CREDITO_CUENTA: { label: 'Cta. cte.', icon: '📒' },
};

const TIPO_RECIBO_CFG: Record<TipoRecibo, { label: string; color: string }> = {
  ANTICIPO: { label: 'Anticipo', color: '#a78bfa' },
  PAGO_PARCIAL: { label: 'Pago parcial', color: '#60a5fa' },
  PAGO_FINAL: { label: 'Pago final', color: '#4ade80' },
  DEVOLUCION: { label: 'Devolución', color: '#f87171' },
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
const selectWrap: CSSProperties = { position: 'relative' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtFecha = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

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

function BadgeEstado({ estado }: { estado: EstadoFactura }) {
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

function ModalConfirm({
  titulo,
  desc,
  emoji,
  colorBtn,
  labelBtn,
  onOk,
  onCancel,
  loading,
  conTexto = false,
}: {
  titulo: string;
  desc: string;
  emoji: string;
  colorBtn: string;
  labelBtn: string;
  onOk: (t?: string) => void;
  onCancel: () => void;
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
          {desc}
        </p>
        {conTexto && (
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder='Motivo (opcional)...'
            rows={3}
            style={{
              ...inputSt,
              resize: 'vertical',
              lineHeight: '1.6',
              marginBottom: '16px',
            }}
          />
        )}
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}
        >
          <button
            onClick={onCancel}
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
            onClick={() => onOk(texto || undefined)}
            disabled={loading}
            style={{
              padding: '8px 20px',
              borderRadius: '8px',
              border: 'none',
              background: colorBtn,
              color: '#fff',
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

// ─── Tabla ítems ──────────────────────────────────────────────────────────────

function TablaItems({ items }: { items: FacturaItem[] }) {
  return (
    <div
      style={{
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 70px 80px 90px 60px 60px 100px',
            gap: '8px',
            padding: '9px 14px',
            background: 'rgba(8,16,35,0.4)',
            borderBottom: '1px solid rgba(148,163,184,0.07)',
            minWidth: '600px',
          }}
        >
          {[
            '#',
            'Descripción',
            'Cant.',
            'Unidad',
            'P. Unit.',
            'Dto.',
            'IVA',
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
        {items
          .sort((a, b) => a.orden - b.orden)
          .map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px 1fr 70px 80px 90px 60px 60px 100px',
                gap: '8px',
                padding: '11px 14px',
                alignItems: 'center',
                borderBottom:
                  idx < items.length - 1
                    ? '1px solid rgba(148,163,184,0.05)'
                    : 'none',
                minWidth: '600px',
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '5px',
                  background: 'rgba(74,222,128,0.07)',
                  border: '1px solid rgba(74,222,128,0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '700',
                  color: '#4ade80',
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                {idx + 1}
              </div>
              <div>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#94a3b8',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.descripcion}
                </div>
                {item.detalle && (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#475569',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.detalle}
                  </div>
                )}
              </div>
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
              <span
                style={{
                  fontSize: '11px',
                  color: '#64748b',
                  fontFamily: "'DM Mono',monospace",
                  textAlign: 'right',
                }}
              >
                {item.iva_pct}%
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
                {formatearMonto(item.subtotal)}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Formulario recibo ────────────────────────────────────────────────────────

function FormRecibo({
  factura,
  onSuccess,
  showToast,
}: {
  factura: FCompleta;
  onSuccess: () => void;
  showToast: (m: string, t: 'ok' | 'error') => void;
}) {
  const saldoMax = factura.saldo_pendiente;

  const [form, setForm] = useState({
    tipo: 'PAGO_PARCIAL' as TipoRecibo,
    tipo_pago: 'TRANSFERENCIA' as TipoPago,
    monto: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: '',
    notas: '',
    cheque_banco: '',
    cheque_numero: '',
    cheque_fecha: '',
    cheque_titular: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const esCheque = form.tipo_pago === 'CHEQUE';
  const montoNum = parseFloat(form.monto) || 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.monto || montoNum <= 0) e.monto = 'Ingresá un monto válido';
    if (montoNum > saldoMax + 0.01)
      e.monto = `Supera el saldo pendiente (${formatearMonto(saldoMax)})`;
    if (esCheque && !form.cheque_banco.trim()) e.cheque_banco = 'Requerido';
    if (esCheque && !form.cheque_numero.trim()) e.cheque_numero = 'Requerido';
    if (esCheque && !form.cheque_fecha) e.cheque_fecha = 'Requerido';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    const res = await registrarRecibo({
      factura_id: factura.id,
      cliente_id: factura.cliente_id,
      tipo: form.tipo,
      tipo_pago: form.tipo_pago,
      monto: montoNum,
      fecha: form.fecha,
      concepto: form.concepto || undefined,
      notas: form.notas || undefined,
      cheque_banco: esCheque ? form.cheque_banco : undefined,
      cheque_numero: esCheque ? form.cheque_numero : undefined,
      cheque_fecha: esCheque ? form.cheque_fecha : undefined,
      cheque_titular: esCheque ? form.cheque_titular : undefined,
    });
    setLoading(false);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Recibo registrado', 'ok');
    setForm((p) => ({
      ...p,
      monto: '',
      concepto: '',
      notas: '',
      cheque_banco: '',
      cheque_numero: '',
      cheque_fecha: '',
      cheque_titular: '',
    }));
    onSuccess();
  };

  const field = (
    key: string,
    v: string,
    set: (v: string) => void,
    label: string,
    type = 'text',
    placeholder = '',
  ) => (
    <div>
      <label style={{ ...labelSt, color: errors[key] ? '#f59e0b' : '#475569' }}>
        {label}
      </label>
      <input
        type={type}
        value={v}
        onChange={(e) => set(e.target.value)}
        placeholder={placeholder}
        style={{
          ...inputSt,
          borderColor: errors[key]
            ? 'rgba(245,158,11,0.4)'
            : 'rgba(148,163,184,0.1)',
          colorScheme: type === 'date' ? 'dark' : (undefined as any),
        }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.35)')
        }
        onBlur={(e) =>
          (e.currentTarget.style.borderColor = errors[key]
            ? 'rgba(245,158,11,0.4)'
            : 'rgba(148,163,184,0.1)')
        }
      />
      {errors[key] && (
        <span
          style={{
            fontSize: '10px',
            color: '#f59e0b',
            display: 'block',
            marginTop: '3px',
          }}
        >
          {errors[key]}
        </span>
      )}
    </div>
  );

  const selectField = (
    key: string,
    value: string,
    onChange: (v: string) => void,
    label: string,
    opts: Array<{ value: string; label: string }>,
  ) => (
    <div>
      <label style={labelSt}>{label}</label>
      <div style={selectWrap}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            ...inputSt,
            appearance: 'none',
            paddingRight: '26px',
            cursor: 'pointer',
          }}
        >
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <svg
          width='9'
          height='9'
          viewBox='0 0 9 9'
          fill='none'
          style={{
            position: 'absolute',
            right: '9px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
            color: '#475569',
          }}
        >
          <path
            d='M1 3L4.5 6.5L8 3'
            stroke='currentColor'
            strokeWidth='1.2'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </div>
    </div>
  );

  return (
    <div
      id='cobros'
      style={{
        ...card,
        padding: '20px',
        border: '1px solid rgba(74,222,128,0.1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '18px',
        }}
      >
        <span style={{ fontSize: '14px' }}>💰</span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#4ade80',
          }}
        >
          Registrar cobro
        </span>
        <span
          style={{
            fontSize: '12px',
            color: '#334155',
            marginLeft: 'auto',
            fontFamily: "'DM Mono',monospace",
          }}
        >
          Saldo:{' '}
          <span style={{ color: '#f59e0b', fontWeight: '700' }}>
            {formatearMonto(saldoMax)}
          </span>
        </span>
      </div>

      <div className='mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {selectField(
          'tipo',
          form.tipo,
          (v) => setForm((p) => ({ ...p, tipo: v as TipoRecibo })),
          'Tipo de recibo',
          Object.entries(TIPO_RECIBO_CFG).map(([k, v]) => ({
            value: k,
            label: v.label,
          })),
        )}
        {selectField(
          'tipo_pago',
          form.tipo_pago,
          (v) => setForm((p) => ({ ...p, tipo_pago: v as TipoPago })),
          'Medio de pago',
          Object.entries(TIPO_PAGO_CFG).map(([k, v]) => ({
            value: k,
            label: `${v.icon} ${v.label}`,
          })),
        )}
      </div>

      <div className='mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2'>
        {field(
          'monto',
          form.monto,
          (v) => setForm((p) => ({ ...p, monto: v })),
          'Monto *',
          'number',
          '0.00',
        )}
        {field(
          'fecha',
          form.fecha,
          (v) => setForm((p) => ({ ...p, fecha: v })),
          'Fecha *',
          'date',
        )}
      </div>

      {/* Campos de cheque */}
      {esCheque && (
        <div
          style={{
            padding: '12px',
            background: 'rgba(148,163,184,0.03)',
            border: '1px solid rgba(148,163,184,0.08)',
            borderRadius: '8px',
            marginBottom: '12px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div
            style={{
              fontSize: '10px',
              fontWeight: '600',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#475569',
              marginBottom: '10px',
            }}
          >
            Datos del cheque
          </div>
          <div className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'>
            {field(
              'cheque_banco',
              form.cheque_banco,
              (v) => setForm((p) => ({ ...p, cheque_banco: v })),
              'Banco *',
              'text',
              'Ej: BBVA',
            )}
            {field(
              'cheque_numero',
              form.cheque_numero,
              (v) => setForm((p) => ({ ...p, cheque_numero: v })),
              'Número *',
              'text',
              '00001234',
            )}
            {field(
              'cheque_fecha',
              form.cheque_fecha,
              (v) => setForm((p) => ({ ...p, cheque_fecha: v })),
              'Fecha *',
              'date',
            )}
            {field(
              'cheque_titular',
              form.cheque_titular,
              (v) => setForm((p) => ({ ...p, cheque_titular: v })),
              'Titular',
              'text',
              'Nombre del titular',
            )}
          </div>
        </div>
      )}

      {field(
        'concepto',
        form.concepto,
        (v) => setForm((p) => ({ ...p, concepto: v })),
        'Concepto',
        'text',
        'Ej: Pago parcial OS-024',
      )}

      <div className='mt-3.5 flex justify-end'>
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '10px 22px',
            borderRadius: '9px',
            border: 'none',
            background:
              'linear-gradient(135deg,rgba(74,222,128,0.85),rgba(34,197,94,0.85))',
            color: '#0f172a',
            fontSize: '13px',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans',sans-serif",
            opacity: loading ? 0.6 : 1,
            boxShadow: '0 4px 12px rgba(74,222,128,0.15)',
            justifyContent: 'center',
          }}
          className='w-full sm:w-auto'
        >
          {loading && (
            <svg
              width='13'
              height='13'
              viewBox='0 0 13 13'
              style={{ animation: 'spin 0.8s linear infinite' }}
            >
              <circle
                cx='6.5'
                cy='6.5'
                r='5'
                stroke='currentColor'
                strokeWidth='1.5'
                fill='none'
                strokeDasharray='15'
                strokeDashoffset='5'
              />
            </svg>
          )}
          {loading ? 'Guardando...' : 'Registrar cobro'}
        </button>
      </div>
    </div>
  );
}

// ─── Historial de cobros ──────────────────────────────────────────────────────

function HistorialCobros({
  recibos,
  onEliminar,
  canEdit,
}: {
  recibos: Recibo[];
  onEliminar: (id: string) => void;
  canEdit: boolean;
}) {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  if (recibos.length === 0) {
    return (
      <div
        style={{
          padding: '20px',
          textAlign: 'center',
          border: '1px dashed rgba(148,163,184,0.1)',
          borderRadius: '8px',
        }}
      >
        <p style={{ margin: 0, fontSize: '12px', color: '#334155' }}>
          Sin cobros registrados
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {recibos
        .sort(
          (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime(),
        )
        .map((r) => {
          const tipoCfg = TIPO_RECIBO_CFG[r.tipo];
          const pagoCfg = TIPO_PAGO_CFG[r.tipo_pago];
          return (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '11px 14px',
                background: 'rgba(8,16,35,0.4)',
                border: '1px solid rgba(148,163,184,0.07)',
                borderRadius: '9px',
              }}
            >
              {/* Icono */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: `${tipoCfg.color}10`,
                  border: `1px solid ${tipoCfg.color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  flexShrink: 0,
                }}
              >
                {pagoCfg.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    marginBottom: '2px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#94a3b8',
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {r.numero}
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: '700',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      background: `${tipoCfg.color}10`,
                      border: `1px solid ${tipoCfg.color}20`,
                      color: tipoCfg.color,
                    }}
                  >
                    {tipoCfg.label}
                  </span>
                  <span style={{ fontSize: '11px', color: '#475569' }}>
                    {pagoCfg.icon} {pagoCfg.label}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#334155',
                      fontFamily: "'DM Mono',monospace",
                    }}
                  >
                    {fmtFecha(r.fecha)}
                  </span>
                  {r.concepto && (
                    <span style={{ fontSize: '11px', color: '#475569' }}>
                      · {r.concepto}
                    </span>
                  )}
                  {r.cheque_banco && (
                    <span style={{ fontSize: '10px', color: '#334155' }}>
                      Cheque {r.cheque_banco} #{r.cheque_numero}
                    </span>
                  )}
                </div>
              </div>

              {/* Monto */}
              <span
                style={{
                  fontSize: '15px',
                  fontWeight: '800',
                  color: r.tipo === 'DEVOLUCION' ? '#f87171' : '#4ade80',
                  fontFamily: "'DM Mono',monospace",
                  flexShrink: 0,
                }}
              >
                {r.tipo === 'DEVOLUCION' ? '−' : ''}
                {formatearMonto(r.monto)}
              </span>

              {/* Eliminar */}
              {canEdit && (
                <button
                  onClick={async () => {
                    setLoadingId(r.id);
                    await onEliminar(r.id);
                    setLoadingId(null);
                  }}
                  disabled={loadingId === r.id}
                  style={{
                    width: '26px',
                    height: '26px',
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
                    e.currentTarget.style.borderColor =
                      'rgba(148,163,184,0.08)';
                  }}
                >
                  {loadingId === r.id ? (
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
          );
        })}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FacturaFicha({ facturaId }: Props) {
  const [factura, setFactura] = useState<FCompleta | null>(null);
  const [loading, setLoading] = useState(true);
  const [accionLoading, setAccionLoading] = useState(false);
  const [toast, setToast] = useState<{
    mensaje: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [modal, setModal] = useState<'emitir' | 'anular' | null>(null);

  const showToast = useCallback(
    (m: string, t: 'ok' | 'error') => setToast({ mensaje: m, tipo: t }),
    [],
  );

  const cargar = useCallback(async () => {
    if (shouldUsePlatformMocks) {
      setFactura(getMockFacturaDetalle(facturaId) as FCompleta | null);
      setLoading(false);
      return;
    }
    const res = await obtenerFactura(facturaId);
    setLoading(false);
    if (res.data) setFactura(res.data as FCompleta);
  }, [facturaId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const handleEmitir = async () => {
    if (!factura) return;
    setAccionLoading(true);
    const res = await emitirFactura(factura.id);
    setAccionLoading(false);
    setModal(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Factura emitida', 'ok');
    cargar();
  };

  const handleAnular = async (motivo?: string) => {
    if (!factura) return;
    setAccionLoading(true);
    const res = await anularFactura(factura.id, motivo);
    setAccionLoading(false);
    setModal(null);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast('Factura anulada', 'ok');
    cargar();
  };

  const handleEliminarRecibo = async (reciboId: string) => {
    const res = await eliminarRecibo(reciboId);
    if (res.error) {
      showToast(res.error, 'error');
      return;
    }
    showToast(res.mensaje ?? 'Recibo eliminado', 'ok');
    cargar();
  };

  const f = factura;
  const cobrado = f
    ? f.recibos
        .filter((r) => r.tipo !== 'DEVOLUCION')
        .reduce((a, r) => a + r.monto, 0)
    : 0;
  const devoluciones = f
    ? f.recibos
        .filter((r) => r.tipo === 'DEVOLUCION')
        .reduce((a, r) => a + r.monto, 0)
    : 0;
  const pctCobrado =
    f && f.total > 0 ? Math.min(100, Math.round((cobrado / f.total) * 100)) : 0;
  const canAddCobro =
    f && !['COBRADA', 'ANULADA'].includes(f.estado) && f.saldo_pendiente > 0;
  const canEdit = f && !['COBRADA', 'ANULADA'].includes(f.estado);
  const isVencida =
    f &&
    ['EMITIDA', 'PENDIENTE_COBRO', 'COBRADA_PARCIAL'].includes(f.estado) &&
    !!f.fecha_vencimiento &&
    new Date(f.fecha_vencimiento) < new Date();

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

      <div className='px-3 py-3 pb-10 sm:px-5 sm:py-4 sm:pb-12 lg:px-4 lg:py-2 lg:pb-3'>
        <div style={{ width: '100%', margin: '0 auto', minWidth: 0 }}>
          {/* Breadcrumb */}
          <div className='mb-3 flex items-center gap-2 lg:mb-2'>
            <a
              href='/facturas'
              style={{
                fontSize: '11px',
                color: '#334155',
                textDecoration: 'none',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              Facturas
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
              {loading ? '...' : f?.numero}
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
                <Skeleton w='120px' h='13px' />
                <Skeleton w='280px' h='22px' />
                <Skeleton w='180px' h='13px' />
              </div>
            ) : f ? (
              <div className='flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between'>
                <div style={{ minWidth: 0 }}>
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
                        color: '#4ade80',
                        fontFamily: "'DM Mono',monospace",
                        letterSpacing: '0.02em',
                      }}
                    >
                      {f.numero}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '600',
                        color: '#94a3b8',
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {COMP_LABEL[f.tipo_comprobante]}
                    </span>
                    <BadgeEstado estado={f.estado} />
                    {isVencida && (
                      <span
                        style={{
                          fontSize: '10px',
                          color: '#f87171',
                          background: 'rgba(248,113,113,0.08)',
                          border: '1px solid rgba(248,113,113,0.2)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontWeight: '600',
                        }}
                      >
                        ⚠ Vencida
                      </span>
                    )}
                    {/* Vínculos */}
                    {f.numero_presupuesto && (
                      <a
                        href={`/presupuestos/${f.presupuesto_id}`}
                        style={{
                          fontSize: '11px',
                          color: '#f59e0b',
                          fontFamily: "'DM Mono',monospace",
                          textDecoration: 'none',
                          background: 'rgba(245,158,11,0.06)',
                          border: '1px solid rgba(245,158,11,0.15)',
                          borderRadius: '4px',
                          padding: '1px 7px',
                        }}
                      >
                        📄 {f.numero_presupuesto}
                      </a>
                    )}
                    {f.numero_orden && (
                      <a
                        href={`/ordenes/${f.orden_id}`}
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
                        ⚙️ {f.numero_orden}
                      </a>
                    )}
                  </div>
                  <a
                    href={`/clientes/${f.cliente_id}`}
                    style={{
                      fontSize: '16px',
                      fontWeight: '700',
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
                    {f.razon_social}
                  </a>
                  <span
                    style={{
                      fontSize: '22px',
                      fontWeight: '800',
                      color: '#4ade80',
                      fontFamily: "'DM Mono',monospace",
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {formatearMonto(f.total)}
                  </span>
                </div>

                {/* Acciones */}
                <div className='flex w-full flex-wrap gap-2 lg:w-auto lg:flex-shrink-0'>
                  <a
                    href={`/facturas/${f.id}/pdf`}
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
                      justifyContent: 'center',
                    }}
                    className='w-full sm:w-auto'
                  >
                    📄 PDF
                  </a>
                  {f.estado === 'BORRADOR' && (
                    <>
                      <a
                        href={`/facturas/${f.id}/editar`}
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
                          justifyContent: 'center',
                        }}
                        className='w-full sm:w-auto'
                      >
                        ✏️ Editar
                      </a>
                      <button
                        onClick={() => setModal('emitir')}
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
                          justifyContent: 'center',
                        }}
                        className='w-full sm:w-auto'
                      >
                        📤 Emitir factura
                      </button>
                    </>
                  )}
                  {!['COBRADA', 'ANULADA'].includes(f.estado) && (
                    <button
                      onClick={() => setModal('anular')}
                      disabled={accionLoading}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        border: '1px solid rgba(248,113,113,0.2)',
                        background: 'rgba(248,113,113,0.05)',
                        color: '#f87171',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        fontFamily: "'DM Sans',sans-serif",
                        justifyContent: 'center',
                      }}
                      className='w-full sm:w-auto'
                    >
                      ❌ Anular
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
                Factura no encontrada
              </div>
            )}
          </div>

          {f && (
            <div className='grid grid-cols-1 gap-2.5 xl:grid-cols-[minmax(0,1fr)_280px] xl:items-start'>
              {/* Columna principal */}
              <div className='flex min-w-0 flex-col gap-2.5'>
                {/* Ítems */}
                <div style={{ ...card, padding: '14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
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
                      Ítems facturados
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        color: '#475569',
                        background: 'rgba(148,163,184,0.08)',
                        border: '1px solid rgba(148,163,184,0.1)',
                        borderRadius: '10px',
                        padding: '1px 6px',
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {f.items.length}
                    </span>
                  </div>
                  <TablaItems items={f.items} />
                </div>

                {/* Cobros */}
                <div style={{ ...card, padding: '14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '16px',
                    }}
                  >
                    <span style={{ fontSize: '13px' }}>💳</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: '#475569',
                      }}
                    >
                      Historial de cobros
                    </span>
                    {f.recibos.length > 0 && (
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: '700',
                          color: '#4ade80',
                          background: 'rgba(74,222,128,0.08)',
                          border: '1px solid rgba(74,222,128,0.12)',
                          borderRadius: '10px',
                          padding: '1px 6px',
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        {f.recibos.length}
                      </span>
                    )}
                  </div>
                  <HistorialCobros
                    recibos={f.recibos}
                    onEliminar={handleEliminarRecibo}
                    canEdit={!!canEdit}
                  />
                </div>

                {/* Formulario nuevo cobro */}
                {canAddCobro && (
                  <FormRecibo
                    factura={f}
                    onSuccess={cargar}
                    showToast={showToast}
                  />
                )}

                {/* Notas */}
                {f.notas && (
                  <div style={{ ...card, padding: '14px' }}>
                    <div
                      style={{
                        fontSize: '10px',
                        fontWeight: '600',
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
                        fontSize: '13px',
                        color: '#64748b',
                        lineHeight: '1.7',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {f.notas}
                    </p>
                  </div>
                )}
              </div>

              {/* Panel lateral */}
              <div className='flex min-w-0 flex-col gap-2.5'>
                {/* Barra de cobro */}
                <div style={{ ...card, padding: '14px' }}>
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
                    Estado de cobro
                  </div>

                  {/* Barra */}
                  <div
                    style={{
                      height: '8px',
                      background: 'rgba(148,163,184,0.08)',
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginBottom: '10px',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${pctCobrado}%`,
                        background:
                          pctCobrado === 100
                            ? '#4ade80'
                            : pctCobrado > 50
                              ? '#60a5fa'
                              : '#f59e0b',
                        borderRadius: '4px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                    }}
                  >
                    <span style={{ fontSize: '11px', color: '#475569' }}>
                      Cobrado
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: pctCobrado === 100 ? '#4ade80' : '#f59e0b',
                        fontFamily: "'DM Mono',monospace' ",
                      }}
                    >
                      {pctCobrado}%
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {[
                      {
                        label: 'Total facturado',
                        value: f.total,
                        color: '#94a3b8',
                      },
                      {
                        label: 'Total cobrado',
                        value: cobrado,
                        color: '#4ade80',
                      },
                      ...(devoluciones > 0
                        ? [
                            {
                              label: 'Devoluciones',
                              value: devoluciones,
                              color: '#f87171',
                            },
                          ]
                        : []),
                      {
                        label: 'Saldo pendiente',
                        value: f.saldo_pendiente,
                        color: f.saldo_pendiente > 0 ? '#f59e0b' : '#334155',
                        bold: true,
                      },
                    ].map(({ label, value, color, bold }) => (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingBottom: '6px',
                          borderBottom: '1px solid rgba(148,163,184,0.05)',
                        }}
                      >
                        <span style={{ fontSize: '11px', color: '#475569' }}>
                          {label}
                        </span>
                        <span
                          style={{
                            fontSize: bold ? '14px' : '12px',
                            fontWeight: bold ? '800' : '500',
                            color,
                            fontFamily: "'DM Mono',monospace",
                          }}
                        >
                          {formatearMonto(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Datos del documento */}
                <div style={{ ...card, padding: '14px' }}>
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
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    {[
                      { label: 'Número', value: f.numero, mono: true },
                      {
                        label: 'Comprobante',
                        value: COMP_LABEL[f.tipo_comprobante],
                      },
                      {
                        label: 'Emisión',
                        value: fmtFecha(f.fecha_emision),
                        mono: true,
                      },
                      {
                        label: 'Vencimiento',
                        value: fmtFecha(f.fecha_vencimiento),
                        mono: true,
                      },
                      { label: 'Cond. venta', value: f.condicion_venta ?? '—' },
                      ...(f.periodo_desde
                        ? [
                            {
                              label: 'Período',
                              value: `${fmtFecha(f.periodo_desde)} – ${fmtFecha(f.periodo_hasta)}`,
                              mono: true,
                            },
                          ]
                        : []),
                      ...(f.cae
                        ? [{ label: 'CAE', value: f.cae, mono: true }]
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
                            fontFamily: mono
                              ? "'DM Mono',monospace"
                              : undefined,
                            textAlign: 'right',
                          }}
                        >
                          {value || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Desglose */}
                <div style={{ ...card, padding: '14px' }}>
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
                    Desglose
                  </div>
                  {[
                    { label: 'Subtotal', value: f.subtotal },
                    { label: `IVA ${f.iva_pct}%`, value: f.iva_monto },
                    ...(f.otros_impuestos > 0
                      ? [{ label: 'Otros imp.', value: f.otros_impuestos }]
                      : []),
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <span style={{ fontSize: '11px', color: '#475569' }}>
                        {label}
                      </span>
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          fontFamily: "'DM Mono',monospace",
                        }}
                      >
                        {formatearMonto(value)}
                      </span>
                    </div>
                  ))}
                  <div
                    style={{
                      height: '1px',
                      background: 'rgba(148,163,184,0.06)',
                      margin: '8px 0',
                    }}
                  />
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between' }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#94a3b8',
                      }}
                    >
                      TOTAL
                    </span>
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: '800',
                        color: '#4ade80',
                        fontFamily: "'DM Mono',monospace",
                      }}
                    >
                      {formatearMonto(f.total)}
                    </span>
                  </div>
                </div>

                {/* Accesos rápidos */}
                <div style={{ ...card, padding: '12px' }}>
                  <div
                    style={{
                      fontSize: '10px',
                      fontWeight: '700',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: '#334155',
                      marginBottom: '10px',
                    }}
                  >
                    Accesos rápidos
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '5px',
                    }}
                  >
                    {[
                      {
                        href: `/clientes/${f.cliente_id}`,
                        label: 'Ver cliente',
                        icon: '👤',
                      },
                      ...(f.presupuesto_id
                        ? [
                            {
                              href: `/presupuestos/${f.presupuesto_id}`,
                              label: 'Ver presupuesto',
                              icon: '📄',
                            },
                          ]
                        : []),
                      ...(f.orden_id
                        ? [
                            {
                              href: `/ordenes/${f.orden_id}`,
                              label: 'Ver orden de servicio',
                              icon: '⚙️',
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

      {modal === 'emitir' && (
        <ModalConfirm
          titulo='Emitir factura'
          desc='La factura pasará al estado Emitida. Podés registrar cobros a partir de este momento.'
          emoji='📤'
          colorBtn='rgba(74,222,128,0.9)'
          labelBtn='Emitir'
          loading={accionLoading}
          onOk={handleEmitir}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'anular' && (
        <ModalConfirm
          titulo='Anular factura'
          desc='La factura quedará anulada. No se puede deshacer.'
          emoji='❌'
          colorBtn='rgba(248,113,113,0.15)'
          labelBtn='Anular'
          loading={accionLoading}
          conTexto
          onOk={handleAnular}
          onCancel={() => setModal(null)}
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
