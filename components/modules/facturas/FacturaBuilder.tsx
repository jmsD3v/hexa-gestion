'use client';

// ============================================================
// components/modules/facturas/FacturaBuilder.tsx
// Formulario de creación de factura: selector de cliente con
// búsqueda, tipo de comprobante inteligente según condición
// IVA, ítems con cálculo en tiempo real, panel de totales.
// ============================================================

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type CSSProperties,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TipoComprobanteAFIP, CondicionIVA } from '@/types';
import { crearFactura } from '@/app/actions/facturas';
import { obtenerClientes } from '@/app/actions/clientes';
import { obtenerOrden } from '@/app/actions/ordenes';
import { obtenerPresupuestoCompleto } from '@/app/actions/presupuestos';
import { formatearMonto } from '@/lib/calculos';

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface ItemForm {
  id: string;
  descripcion: string;
  detalle: string;
  cantidad: string;
  unidad_medida: string;
  precio_unitario: string;
  descuento_pct: string;
  iva_pct: string;
  _expandido: boolean;
}

interface ClienteOpcion {
  id: string;
  razon_social: string;
  cuit: string;
  condicion_iva: CondicionIVA;
}

interface Totales {
  subtotal: number;
  descuento: number;
  base_iva: number;
  iva_monto: number;
  total: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const CONDICION_IVA_LABEL: Record<CondicionIVA, string> = {
  RESPONSABLE_INSCRIPTO: 'Resp. Inscripto',
  MONOTRIBUTISTA: 'Monotributista',
  EXENTO: 'Exento',
  CONSUMIDOR_FINAL: 'Consumidor Final',
  NO_RESPONSABLE: 'No Responsable',
};

// Tipo de comprobante sugerido según condición IVA del cliente
const COMPROBANTE_SUGERIDO: Record<CondicionIVA, TipoComprobanteAFIP> = {
  RESPONSABLE_INSCRIPTO: 'FACTURA_A',
  MONOTRIBUTISTA: 'FACTURA_B',
  EXENTO: 'FACTURA_B',
  CONSUMIDOR_FINAL: 'FACTURA_B',
  NO_RESPONSABLE: 'FACTURA_B',
};

const COMPROBANTES: {
  value: TipoComprobanteAFIP;
  label: string;
  grupo: string;
}[] = [
  { value: 'FACTURA_A', label: 'Factura A', grupo: 'Facturas' },
  { value: 'FACTURA_B', label: 'Factura B', grupo: 'Facturas' },
  { value: 'FACTURA_C', label: 'Factura C', grupo: 'Facturas' },
  { value: 'NOTA_DEBITO_A', label: 'Nota Débito A', grupo: 'Notas Débito' },
  { value: 'NOTA_DEBITO_B', label: 'Nota Débito B', grupo: 'Notas Débito' },
  { value: 'NOTA_CREDITO_A', label: 'Nota Crédito A', grupo: 'Notas Crédito' },
  { value: 'NOTA_CREDITO_B', label: 'Nota Crédito B', grupo: 'Notas Crédito' },
];

const UNIDADES = [
  'un',
  'hs',
  'días',
  'km',
  'kg',
  'm',
  'm²',
  'm³',
  'lt',
  'gl',
  'Hs prof.',
];

const IVA_OPCIONES = [
  { value: '0', label: '0%  — Exento / No gravado' },
  { value: '10.5', label: '10.5%' },
  { value: '21', label: '21%' },
  { value: '27', label: '27%' },
];

const CONDICIONES_PAGO = [
  'Contado',
  'A 15 días',
  'A 30 días',
  'A 60 días',
  'A 90 días',
  'Contra entrega',
  'Seña 50% + saldo',
  'Cheque a 30 días',
];

const uid = () => Math.random().toString(36).slice(2, 9);

const itemVacio = (): ItemForm => ({
  id: uid(),
  descripcion: '',
  detalle: '',
  cantidad: '1',
  unidad_medida: 'un',
  precio_unitario: '',
  descuento_pct: '0',
  iva_pct: '21',
  _expandido: false,
});

// ─── Cálculos ─────────────────────────────────────────────────────────────────

function calcularItem(item: ItemForm) {
  const cant = parseFloat(item.cantidad) || 0;
  const precio = parseFloat(item.precio_unitario) || 0;
  const dto = parseFloat(item.descuento_pct) || 0;
  const base = cant * precio * (1 - dto / 100);
  return { base, iva: base * (parseFloat(item.iva_pct) / 100) };
}

function calcularTotales(items: ItemForm[]): Totales {
  let subtotal = 0,
    descuento = 0,
    base_iva = 0,
    iva_monto = 0;
  for (const item of items) {
    const cant = parseFloat(item.cantidad) || 0;
    const precio = parseFloat(item.precio_unitario) || 0;
    const dto = parseFloat(item.descuento_pct) || 0;
    const bruto = cant * precio;
    const dtoMonto = (bruto * dto) / 100;
    const base = bruto - dtoMonto;
    const iva = base * (parseFloat(item.iva_pct) / 100);
    subtotal += bruto;
    descuento += dtoMonto;
    base_iva += base;
    iva_monto += iva;
  }
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    descuento: Math.round(descuento * 100) / 100,
    base_iva: Math.round(base_iva * 100) / 100,
    iva_monto: Math.round(iva_monto * 100) / 100,
    total: Math.round((base_iva + iva_monto) * 100) / 100,
  };
}

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
const errSt: CSSProperties = {
  fontSize: '10px',
  color: '#f59e0b',
  display: 'block',
  marginTop: '3px',
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...card, padding: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '18px',
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
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ ...labelSt, color: error ? '#f59e0b' : '#475569' }}>
        {label}
      </label>
      {children}
      {error && <span style={errSt}>{error}</span>}
    </div>
  );
}

function InputText({
  value,
  onChange,
  placeholder,
  error,
  type = 'text',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        ...inputSt,
        borderColor: error ? 'rgba(245,158,11,0.4)' : 'rgba(148,163,184,0.1)',
        colorScheme: type === 'date' ? 'dark' : (undefined as any),
      }}
      onFocus={(e) =>
        (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.35)')
      }
      onBlur={(e) =>
        (e.currentTarget.style.borderColor = error
          ? 'rgba(245,158,11,0.4)'
          : 'rgba(148,163,184,0.1)')
      }
    />
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string; group?: string }>;
  placeholder?: string;
}) {
  return (
    <div style={{ position: 'relative' }}>
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
        {placeholder && <option value=''>{placeholder}</option>}
        {options.map((o) => (
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
  );
}

// ─── Buscador de cliente ──────────────────────────────────────────────────────

function BuscadorCliente({
  value,
  onChange,
}: {
  value: ClienteOpcion | null;
  onChange: (c: ClienteOpcion | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [opciones, setOpciones] = useState<ClienteOpcion[]>([]);
  const [loading, setLoading] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setAbierto(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) {
      setOpciones([]);
      return;
    }
    setLoading(true);
    const res = await obtenerClientes({ busqueda: q, por_pagina: 8 });
    setLoading(false);
    if (res.data) {
      setOpciones(
        res.data.data.map((c) => ({
          id: c.id,
          razon_social: c.razon_social,
          cuit: c.cuit,
          condicion_iva: c.condicion_iva as CondicionIVA,
        })),
      );
    }
  }, []);

  const handleInput = (v: string) => {
    setQuery(v);
    setAbierto(true);
    if (value) onChange(null);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(v), 300);
  };

  const seleccionar = (c: ClienteOpcion) => {
    onChange(c);
    setQuery(c.razon_social);
    setAbierto(false);
    setOpciones([]);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <svg
          width='13'
          height='13'
          viewBox='0 0 13 13'
          fill='none'
          style={{
            position: 'absolute',
            left: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#334155',
          }}
        >
          <circle
            cx='5.5'
            cy='5.5'
            r='4'
            stroke='currentColor'
            strokeWidth='1.3'
          />
          <path
            d='M9 9L11.5 11.5'
            stroke='currentColor'
            strokeWidth='1.3'
            strokeLinecap='round'
          />
        </svg>
        <input
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onFocus={() => {
            if (query && !value) setAbierto(true);
          }}
          placeholder='Buscar por razón social o CUIT...'
          style={{
            ...inputSt,
            paddingLeft: '30px',
            borderColor: value
              ? 'rgba(74,222,128,0.3)'
              : 'rgba(148,163,184,0.1)',
          }}
        />
        {loading && (
          <svg
            width='12'
            height='12'
            viewBox='0 0 12 12'
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
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
      </div>

      {/* Seleccionado */}
      {value && (
        <div
          style={{
            marginTop: '8px',
            padding: '10px 12px',
            background: 'rgba(74,222,128,0.06)',
            border: '1px solid rgba(74,222,128,0.2)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div>
            <div
              style={{ fontSize: '13px', fontWeight: '600', color: '#94a3b8' }}
            >
              {value.razon_social}
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#475569',
                marginTop: '2px',
                display: 'flex',
                gap: '10px',
              }}
            >
              <span style={{ fontFamily: "'DM Mono',monospace" }}>
                {value.cuit}
              </span>
              <span
                style={{
                  background: 'rgba(148,163,184,0.08)',
                  border: '1px solid rgba(148,163,184,0.1)',
                  borderRadius: '4px',
                  padding: '0 5px',
                }}
              >
                {CONDICION_IVA_LABEL[value.condicion_iva]}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              onChange(null);
              setQuery('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#334155',
              cursor: 'pointer',
              padding: '3px',
              display: 'flex',
              alignItems: 'center',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#334155')}
          >
            <svg width='12' height='12' viewBox='0 0 12 12'>
              <path
                d='M1 1L11 11M11 1L1 11'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
              />
            </svg>
          </button>
        </div>
      )}

      {/* Dropdown */}
      {abierto && opciones.length > 0 && !value && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 40,
            background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.12)',
            borderRadius: '9px',
            padding: '4px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            animation: 'scaleIn 0.12s ease',
          }}
        >
          {opciones.map((c) => (
            <button
              key={c.id}
              onClick={() => seleccionar(c)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                width: '100%',
                padding: '9px 11px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: "'DM Sans',sans-serif",
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'rgba(148,163,184,0.06)')
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = 'transparent')
              }
            >
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#94a3b8',
                }}
              >
                {c.razon_social}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    color: '#475569',
                    fontFamily: "'DM Mono',monospace",
                  }}
                >
                  {c.cuit}
                </span>
                <span style={{ fontSize: '10px', color: '#334155' }}>
                  {CONDICION_IVA_LABEL[c.condicion_iva]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {abierto && query.length >= 2 && opciones.length === 0 && !loading && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 40,
            background: '#0f172a',
            border: '1px solid rgba(148,163,184,0.12)',
            borderRadius: '9px',
            padding: '16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '12px', color: '#334155' }}>
            Sin resultados para "{query}"
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Fila de ítem ─────────────────────────────────────────────────────────────

function FilaItem({
  item,
  idx,
  onChange,
  onRemove,
  canRemove,
  errors,
}: {
  item: ItemForm;
  idx: number;
  onChange: (
    id: string,
    field: keyof ItemForm,
    value: string | boolean,
  ) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
  errors: Record<string, string>;
}) {
  const { base, iva: ivaItem } = calcularItem(item);
  const total = base + ivaItem;

  const inp = (
    field: keyof ItemForm,
    type = 'text',
    placeholder = '',
    small = false,
  ) => (
    <input
      type={type}
      value={item[field] as string}
      onChange={(e) => onChange(item.id, field, e.target.value)}
      placeholder={placeholder}
      style={{
        ...inputSt,
        fontSize: small ? '11px' : '12px',
        colorScheme: type === 'date' ? 'dark' : (undefined as any),
        borderColor: errors[`${item.id}.${field}`]
          ? 'rgba(245,158,11,0.4)'
          : 'rgba(148,163,184,0.1)',
      }}
      onFocus={(e) =>
        (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.35)')
      }
      onBlur={(e) =>
        (e.currentTarget.style.borderColor = errors[`${item.id}.${field}`]
          ? 'rgba(245,158,11,0.4)'
          : 'rgba(148,163,184,0.1)')
      }
    />
  );

  return (
    <div
      style={{
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '10px',
      }}
    >
      {/* Fila principal */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 70px 90px 90px 70px 80px 90px 32px',
          gap: '8px',
          padding: '11px 12px',
          alignItems: 'center',
          background: 'rgba(8,16,35,0.3)',
        }}
      >
        {/* Número */}
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '4px',
            background: 'rgba(74,222,128,0.07)',
            border: '1px solid rgba(74,222,128,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            fontWeight: '800',
            color: '#4ade80',
            fontFamily: "'DM Mono',monospace",
          }}
        >
          {idx + 1}
        </div>

        {/* Descripción */}
        <div>
          {inp('descripcion', 'text', 'Descripción del servicio / producto')}
          {errors[`${item.id}.descripcion`] && (
            <span style={errSt}>{errors[`${item.id}.descripcion`]}</span>
          )}
        </div>

        {/* Cantidad */}
        {inp('cantidad', 'number', '1', true)}

        {/* Unidad */}
        <div style={{ position: 'relative' }}>
          <select
            value={item.unidad_medida}
            onChange={(e) => onChange(item.id, 'unidad_medida', e.target.value)}
            style={{
              ...inputSt,
              fontSize: '11px',
              appearance: 'none',
              paddingRight: '22px',
              cursor: 'pointer',
            }}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
          <svg
            width='8'
            height='8'
            viewBox='0 0 8 8'
            fill='none'
            style={{
              position: 'absolute',
              right: '7px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#475569',
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
        </div>

        {/* Precio unit */}
        <div>
          {inp('precio_unitario', 'number', '0.00', true)}
          {errors[`${item.id}.precio_unitario`] && (
            <span style={errSt}>{errors[`${item.id}.precio_unitario`]}</span>
          )}
        </div>

        {/* Descuento */}
        <div style={{ position: 'relative' }}>
          {inp('descuento_pct', 'number', '0', true)}
          <span
            style={{
              position: 'absolute',
              right: '9px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              color: '#334155',
              pointerEvents: 'none',
            }}
          >
            %
          </span>
        </div>

        {/* IVA */}
        <div style={{ position: 'relative' }}>
          <select
            value={item.iva_pct}
            onChange={(e) => onChange(item.id, 'iva_pct', e.target.value)}
            style={{
              ...inputSt,
              fontSize: '11px',
              appearance: 'none',
              paddingRight: '22px',
              cursor: 'pointer',
            }}
          >
            {IVA_OPCIONES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value}%
              </option>
            ))}
          </select>
          <svg
            width='8'
            height='8'
            viewBox='0 0 8 8'
            fill='none'
            style={{
              position: 'absolute',
              right: '7px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#475569',
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
        </div>

        {/* Subtotal */}
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: '700',
              color: '#94a3b8',
              fontFamily: "'DM Mono',monospace",
              whiteSpace: 'nowrap',
            }}
          >
            {formatearMonto(total)}
          </div>
          {parseFloat(item.iva_pct) > 0 && (
            <div
              style={{ fontSize: '9px', color: '#334155', marginTop: '1px' }}
            >
              IVA {formatearMonto(ivaItem)}
            </div>
          )}
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          <button
            onClick={() => onChange(item.id, '_expandido', !item._expandido)}
            title='Detalle técnico'
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '5px',
              border: '1px solid rgba(148,163,184,0.08)',
              background: item._expandido
                ? 'rgba(74,222,128,0.07)'
                : 'transparent',
              color: item._expandido ? '#4ade80' : '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.12s',
            }}
          >
            <svg
              width='10'
              height='10'
              viewBox='0 0 10 10'
              fill='none'
              style={{
                transition: 'transform 0.15s',
                transform: item._expandido ? 'rotate(180deg)' : 'none',
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
          </button>
          {canRemove && (
            <button
              onClick={() => onRemove(item.id)}
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
              <svg width='10' height='10' viewBox='0 0 10 10'>
                <path
                  d='M2 2L8 8M8 2L2 8'
                  stroke='currentColor'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Detalle expandido */}
      {item._expandido && (
        <div
          style={{
            padding: '10px 12px 12px',
            background: 'rgba(74,222,128,0.02)',
            borderTop: '1px solid rgba(148,163,184,0.06)',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <label style={{ ...labelSt, color: '#334155' }}>
            Detalle técnico / descripción adicional
          </label>
          <textarea
            value={item.detalle}
            onChange={(e) => onChange(item.id, 'detalle', e.target.value)}
            placeholder='Descripción técnica que aparecerá en la factura...'
            rows={2}
            style={{
              ...inputSt,
              resize: 'vertical',
              lineHeight: '1.6',
              fontSize: '12px',
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(74,222,128,0.35)')
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = 'rgba(148,163,184,0.1)')
            }
          />
        </div>
      )}
    </div>
  );
}

// ─── Panel de totales ─────────────────────────────────────────────────────────

function PanelTotales({
  totales,
  ivaGlobal,
  tipoComp,
}: {
  totales: Totales;
  ivaGlobal: number;
  tipoComp: TipoComprobanteAFIP;
}) {
  const esA =
    tipoComp === 'FACTURA_A' ||
    tipoComp === 'NOTA_DEBITO_A' ||
    tipoComp === 'NOTA_CREDITO_A';
  return (
    <div style={{ ...card, padding: '20px', position: 'sticky', top: '20px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <span style={{ fontSize: '13px' }}>🧮</span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#475569',
          }}
        >
          Totales
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          marginBottom: '14px',
        }}
      >
        {[
          {
            label: 'Subtotal bruto',
            value: totales.subtotal,
            color: '#475569',
          },
          ...(totales.descuento > 0
            ? [
                {
                  label: 'Descuentos',
                  value: -totales.descuento,
                  color: '#f59e0b',
                },
              ]
            : []),
          {
            label: 'Subtotal s/IVA',
            value: totales.base_iva,
            color: '#64748b',
          },
          ...(esA
            ? [
                {
                  label: `IVA (promedio)`,
                  value: totales.iva_monto,
                  color: '#475569',
                },
              ]
            : []),
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '5px 0',
            }}
          >
            <span style={{ fontSize: '11px', color: '#475569' }}>{label}</span>
            <span
              style={{
                fontSize: '12px',
                fontWeight: '500',
                color,
                fontFamily: "'DM Mono',monospace",
                whiteSpace: 'nowrap',
              }}
            >
              {value < 0
                ? `−${formatearMonto(Math.abs(value))}`
                : formatearMonto(value)}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          height: '1px',
          background:
            'linear-gradient(to right,transparent,rgba(74,222,128,0.2),transparent)',
          marginBottom: '12px',
        }}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}>
          TOTAL
        </span>
        <span
          style={{
            fontSize: '24px',
            fontWeight: '800',
            color: '#4ade80',
            fontFamily: "'DM Mono',monospace",
            letterSpacing: '-0.02em',
          }}
        >
          {formatearMonto(totales.total)}
        </span>
      </div>

      {!esA && totales.iva_monto > 0 && (
        <div
          style={{
            fontSize: '10px',
            color: '#334155',
            textAlign: 'right',
            marginBottom: '2px',
          }}
        >
          incl. IVA {formatearMonto(totales.iva_monto)}
        </div>
      )}

      {/* IVA desglosado por alícuota */}
      {totales.iva_monto > 0 && (
        <div
          style={{
            marginTop: '12px',
            padding: '10px',
            background: 'rgba(8,16,35,0.4)',
            borderRadius: '7px',
            border: '1px solid rgba(148,163,184,0.07)',
          }}
        >
          <div
            style={{
              fontSize: '9px',
              fontWeight: '700',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#334155',
              marginBottom: '6px',
            }}
          >
            {esA ? 'IVA discriminado' : 'IVA incluido'}
          </div>
          <div
            style={{
              fontSize: '11px',
              color: '#475569',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {formatearMonto(totales.iva_monto)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function FacturaBuilder() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-fill desde query params
  const preClienteId = searchParams.get('cliente');
  const prePresupuesto = searchParams.get('presupuesto');
  const preOrden = searchParams.get('orden');

  // Estado del formulario
  const [cliente, setCliente] = useState<ClienteOpcion | null>(null);
  const [tipoComp, setTipoComp] = useState<TipoComprobanteAFIP>('FACTURA_A');
  const [fechaEmision, setFechaEmision] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [fechaVencimiento, setFechaVence] = useState('');
  const [periodoDe, setPeriodoDe] = useState('');
  const [periodoHasta, setPeriodoHasta] = useState('');
  const [condicion, setCondicion] = useState('Contado');
  const [notas, setNotas] = useState('');
  const [presupuestoId, setPresupuestoId] = useState(prePresupuesto ?? '');
  const [ordenId, setOrdenId] = useState(preOrden ?? '');
  const [items, setItems] = useState<ItemForm[]>([itemVacio()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    tipo: 'ok' | 'error';
  } | null>(null);
  const [sugerencia, setSugerencia] = useState<TipoComprobanteAFIP | null>(
    null,
  );

  // Pre-cargar desde query
  useEffect(() => {
    if (prePresupuesto) {
      obtenerPresupuestoCompleto(prePresupuesto).then((res) => {
        if (!res.data) return;
        const p = res.data;
        // Poblar ítems desde el presupuesto
        if (p.items.length > 0) {
          setItems(
            p.items.map((it) => ({
              id: uid(),
              descripcion: it.descripcion,
              detalle: it.detalle ?? '',
              cantidad: String(it.cantidad),
              unidad_medida: it.unidad_medida,
              precio_unitario: String(it.precio_unitario),
              descuento_pct: String(it.descuento_pct),
              iva_pct: '21',
              _expandido: !!it.detalle,
            })),
          );
        }
        setPresupuestoId(prePresupuesto);
      });
    }
    if (preOrden) {
      obtenerOrden(preOrden).then((res) => {
        if (res.data) setOrdenId(preOrden);
      });
    }
  }, [prePresupuesto, preOrden]);

  // Sugerir tipo de comprobante al seleccionar cliente
  useEffect(() => {
    if (cliente) {
      const sugerido = COMPROBANTE_SUGERIDO[cliente.condicion_iva];
      setSugerencia(sugerido);
      setTipoComp(sugerido);
    } else {
      setSugerencia(null);
    }
  }, [cliente]);

  // ── Manejo de ítems ────────────────────────────────────────

  const handleItemChange = (
    id: string,
    field: keyof ItemForm,
    value: string | boolean,
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    );
    // Limpiar error del campo
    const errKey = `${id}.${String(field)}`;
    if (errors[errKey])
      setErrors((prev) => {
        const n = { ...prev };
        delete n[errKey];
        return n;
      });
  };

  const agregarItem = () => setItems((prev) => [...prev, itemVacio()]);

  const eliminarItem = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const totales = calcularTotales(items);

  // ── Validación ─────────────────────────────────────────────

  const validar = () => {
    const e: Record<string, string> = {};
    if (!cliente) e.cliente = 'Seleccioná un cliente';
    if (!tipoComp) e.tipoComp = 'Requerido';
    if (!fechaEmision) e.fechaEmision = 'Requerida';

    items.forEach((item) => {
      if (!item.descripcion.trim()) e[`${item.id}.descripcion`] = 'Requerida';
      if (!item.precio_unitario || parseFloat(item.precio_unitario) <= 0) {
        e[`${item.id}.precio_unitario`] = 'Ingresá un precio';
      }
      if (!item.cantidad || parseFloat(item.cantidad) <= 0) {
        e[`${item.id}.cantidad`] = 'Ingresá una cantidad';
      }
    });

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────

  const handleGuardar = async (emitir = false) => {
    if (!validar() || !cliente) return;
    setLoading(true);

    const res = await crearFactura({
      tipo_comprobante: tipoComp,
      cliente_id: cliente.id,
      presupuesto_id: presupuestoId || undefined,
      orden_id: ordenId || undefined,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento || undefined,
      periodo_desde: periodoDe || undefined,
      periodo_hasta: periodoHasta || undefined,
      condicion_venta: condicion,
      notas: notas || undefined,
      items: items.map((it) => ({
        descripcion: it.descripcion,
        detalle: it.detalle || undefined,
        cantidad: parseFloat(it.cantidad),
        unidad_medida: it.unidad_medida,
        precio_unitario: parseFloat(it.precio_unitario),
        descuento_pct: parseFloat(it.descuento_pct) || 0,
        iva_pct: parseFloat(it.iva_pct),
      })),
    });

    setLoading(false);

    if (res.error) {
      setToast({ msg: res.error, tipo: 'error' });
      return;
    }

    setToast({ msg: res.mensaje ?? 'Factura creada', tipo: 'ok' });
    setTimeout(() => router.push(`/facturas/${res.data!.id}`), 1000);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box}body{margin:0;background:#060d1a;font-family:'DM Sans',sans-serif;-webkit-font-smoothing:antialiased}
        option{background:#0f172a;color:#e2e8f0}input:focus,select:focus,textarea:focus{outline:none!important}
        ::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.15);border-radius:2px}
        @keyframes shimmer{0%,100%{opacity:.4}50%{opacity:.8}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes scaleIn{from{transform:scale(0.96);opacity:0}to{transform:scale(1);opacity:1}}
        @keyframes slideUp{from{transform:translateY(8px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        ::placeholder{color:#1e293b!important}
      `}</style>

      <div
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(ellipse 100% 60% at 5% 0%,rgba(74,222,128,0.03),transparent 55%),#060d1a',
          padding: '36px 24px 80px',
        }}
      >
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '24px',
              gap: '16px',
              flexWrap: 'wrap',
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
                  Nueva factura
                </span>
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: '22px',
                  fontWeight: '700',
                  color: '#e2e8f0',
                  letterSpacing: '-0.02em',
                }}
              >
                Nueva factura
              </h1>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 280px',
              gap: '16px',
              alignItems: 'start',
            }}
          >
            {/* Columna principal */}
            <div
              suppressHydrationWarning
              style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
            >
              {/* ── Cliente y tipo de comprobante ── */}
              <SectionCard icon='👤' title='Cliente y comprobante'>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <Field label='Cliente *' error={errors.cliente}>
                    <BuscadorCliente value={cliente} onChange={setCliente} />
                  </Field>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                    }}
                  >
                    <Field
                      label='Tipo de comprobante *'
                      error={errors.tipoComp}
                    >
                      <div style={{ position: 'relative' }}>
                        <select
                          value={tipoComp}
                          onChange={(e) =>
                            setTipoComp(e.target.value as TipoComprobanteAFIP)
                          }
                          style={{
                            ...inputSt,
                            appearance: 'none',
                            paddingRight: '26px',
                            cursor: 'pointer',
                            borderColor:
                              sugerencia && tipoComp === sugerencia
                                ? 'rgba(74,222,128,0.3)'
                                : 'rgba(148,163,184,0.1)',
                          }}
                        >
                          {COMPROBANTES.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
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
                      {sugerencia && (
                        <div
                          style={{
                            fontSize: '10px',
                            color: '#4ade80',
                            marginTop: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <svg width='9' height='9' viewBox='0 0 9 9'>
                            <path
                              d='M1 4.5L3.5 7L8 2'
                              stroke='currentColor'
                              strokeWidth='1.3'
                              strokeLinecap='round'
                              strokeLinejoin='round'
                            />
                          </svg>
                          Sugerido para{' '}
                          {cliente
                            ? CONDICION_IVA_LABEL[cliente.condicion_iva]
                            : ''}
                        </div>
                      )}
                    </Field>

                    <Field label='Condición de venta'>
                      <div style={{ position: 'relative' }}>
                        <select
                          value={condicion}
                          onChange={(e) => setCondicion(e.target.value)}
                          style={{
                            ...inputSt,
                            appearance: 'none',
                            paddingRight: '26px',
                            cursor: 'pointer',
                          }}
                        >
                          {CONDICIONES_PAGO.map((c) => (
                            <option key={c} value={c}>
                              {c}
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
                    </Field>
                  </div>
                </div>
              </SectionCard>

              {/* ── Fechas ── */}
              <SectionCard icon='📅' title='Fechas'>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  <Field label='Fecha de emisión *' error={errors.fechaEmision}>
                    <InputText
                      value={fechaEmision}
                      onChange={setFechaEmision}
                      type='date'
                      error={errors.fechaEmision}
                    />
                  </Field>
                  <Field label='Fecha de vencimiento'>
                    <InputText
                      value={fechaVencimiento}
                      onChange={setFechaVence}
                      type='date'
                    />
                  </Field>
                  <Field label='Período desde'>
                    <InputText
                      value={periodoDe}
                      onChange={setPeriodoDe}
                      type='date'
                    />
                  </Field>
                  <Field label='Período hasta'>
                    <InputText
                      value={periodoHasta}
                      onChange={setPeriodoHasta}
                      type='date'
                    />
                  </Field>
                </div>
              </SectionCard>

              {/* ── Vínculos opcionales ── */}
              <SectionCard icon='🔗' title='Vincular documentos (opcional)'>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                  }}
                >
                  <Field label='Número de presupuesto'>
                    <InputText
                      value={presupuestoId}
                      onChange={setPresupuestoId}
                      placeholder='ID del presupuesto'
                    />
                  </Field>
                  <Field label='Orden de servicio'>
                    <InputText
                      value={ordenId}
                      onChange={setOrdenId}
                      placeholder='ID de la OS'
                    />
                  </Field>
                </div>
                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: '11px',
                    color: '#334155',
                    lineHeight: '1.6',
                  }}
                >
                  Si creás la factura desde la ficha de un presupuesto u OS, los
                  campos se completan automáticamente.
                </p>
              </SectionCard>

              {/* ── Ítems ── */}
              <div style={{ ...card, padding: '20px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '6px',
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
                    Ítems
                  </span>
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
                    {items.length}
                  </span>
                </div>

                {/* Encabezado columnas */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '24px 1fr 70px 90px 90px 70px 80px 90px 32px',
                    gap: '8px',
                    padding: '6px 12px 10px',
                    marginBottom: '4px',
                  }}
                >
                  {[
                    '',
                    'Descripción',
                    'Cant.',
                    'Unidad',
                    'P. Unit.',
                    'Dto.',
                    'IVA',
                    'Subtotal',
                    '',
                  ].map((h, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '9px',
                        fontWeight: '700',
                        letterSpacing: '0.07em',
                        textTransform: 'uppercase',
                        color: '#334155',
                        textAlign: i >= 7 ? 'right' : 'left',
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>

                {items.map((item, idx) => (
                  <FilaItem
                    key={item.id}
                    item={item}
                    idx={idx}
                    onChange={handleItemChange}
                    onRemove={eliminarItem}
                    canRemove={items.length > 1}
                    errors={errors}
                  />
                ))}

                <button
                  onClick={agregarItem}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px dashed rgba(74,222,128,0.2)',
                    background: 'rgba(74,222,128,0.04)',
                    color: '#4ade80',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    transition: 'all 0.12s',
                    marginTop: '6px',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'rgba(74,222,128,0.07)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'rgba(74,222,128,0.04)')
                  }
                >
                  <svg width='10' height='10' viewBox='0 0 10 10'>
                    <path
                      d='M5 1V9M1 5H9'
                      stroke='currentColor'
                      strokeWidth='1.6'
                      strokeLinecap='round'
                    />
                  </svg>
                  Agregar ítem
                </button>
              </div>

              {/* ── Notas ── */}
              <SectionCard icon='📝' title='Notas internas'>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder='Observaciones, aclaraciones, notas que no aparecen en el PDF...'
                  rows={3}
                  style={{ ...inputSt, resize: 'vertical', lineHeight: '1.7' }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(74,222,128,0.35)')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor =
                      'rgba(148,163,184,0.1)')
                  }
                />
              </SectionCard>

              {/* ── Acciones ── */}
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  justifyContent: 'flex-end',
                  flexWrap: 'wrap',
                }}
              >
                <a
                  href='/facturas'
                  style={{
                    padding: '10px 18px',
                    borderRadius: '9px',
                    border: '1px solid rgba(148,163,184,0.12)',
                    background: 'transparent',
                    color: '#64748b',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  Cancelar
                </a>
                <button
                  onClick={() => handleGuardar(false)}
                  disabled={loading}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '9px',
                    border: '1px solid rgba(148,163,184,0.15)',
                    background: 'rgba(15,23,42,0.8)',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  Guardar borrador
                </button>
                <button
                  onClick={() => handleGuardar(true)}
                  disabled={loading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    padding: '10px 24px',
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
                    boxShadow: '0 4px 14px rgba(74,222,128,0.2)',
                  }}
                >
                  {loading ? (
                    <>
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
                      Guardando...
                    </>
                  ) : (
                    '📤 Crear y emitir'
                  )}
                </button>
              </div>
            </div>

            {/* Panel lateral */}
            <PanelTotales
              totales={totales}
              ivaGlobal={21}
              tipoComp={tipoComp}
            />
          </div>
        </div>
      </div>

      {/* Toast */}
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
            animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)',
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
            {toast.msg}
          </span>
        </div>
      )}
    </>
  );
}
