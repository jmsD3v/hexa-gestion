'use client';

// ============================================================
// components/modules/facturas/FacturaBuilder.tsx
// Formulario de creación de factura: selector de cliente con
// búsqueda, tipo de comprobante inteligente según condición
// IVA, ítems con cálculo en tiempo real, panel de totales.
// ============================================================

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  User,
  Calendar,
  ClipboardList,
  PenLine,
} from 'lucide-react';
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
  cuit: string | null;
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

const cardClass = 'bg-slate-900/70 border border-slate-400/10 rounded-xl backdrop-blur-sm';
const inputClass = 'w-full px-[11px] py-2 bg-slate-950/60 border border-slate-400/10 rounded-[7px] text-slate-200 text-xs outline-none transition-colors duration-150';
const labelClass = 'text-[10px] font-semibold tracking-widest uppercase text-slate-600 block mb-1';
const errClass = 'text-[10px] text-amber-500 block mt-[3px]';

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${cardClass} p-5`}>
      <div className='flex items-center gap-2 mb-[18px]'>
        <span className='flex items-center text-slate-500'>{icon}</span>
        <span className='text-[11px] font-bold tracking-widest uppercase text-slate-600'>
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
      <label className={`text-[10px] font-semibold tracking-widest uppercase block mb-1 ${error ? 'text-amber-500' : 'text-slate-600'}`}>
        {label}
      </label>
      {children}
      {error && <span className={errClass}>{error}</span>}
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
      className={`w-full px-[11px] py-2 bg-slate-950/60 rounded-[7px] text-slate-200 text-xs outline-none transition-colors duration-150 border focus:border-emerald-400/35 ${error ? 'border-amber-500/40' : 'border-slate-400/10'}`}
      {...(type === 'date' ? { style: { colorScheme: 'dark' } as React.CSSProperties } : {})}
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
    <div className='relative'>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none pr-[26px] cursor-pointer`}
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
        className='absolute right-[9px] top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
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
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
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
    <div ref={ref} className='relative'>
      <div className='relative'>
        <svg
          width='13'
          height='13'
          viewBox='0 0 13 13'
          fill='none'
          className='absolute left-[10px] top-1/2 -translate-y-1/2 text-slate-700'
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
          className={`w-full pl-[30px] pr-[11px] py-2 bg-slate-950/60 rounded-[7px] text-slate-200 text-xs outline-none transition-colors duration-150 border ${value ? 'border-emerald-400/30' : 'border-slate-400/10'} focus:border-emerald-400/35`}
        />
        {loading && (
          <svg
            width='12'
            height='12'
            viewBox='0 0 12 12'
            className='absolute right-[10px] top-1/2 -translate-y-1/2 text-slate-600 animate-spin'
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
          className='mt-2 px-3 py-[10px] rounded-lg flex items-center justify-between bg-emerald-400/[0.06] border border-emerald-400/20 animate-fade-in'
        >
          <div>
            <div className='text-[13px] font-semibold text-slate-400'>
              {value.razon_social}
            </div>
            <div className='text-[11px] text-slate-600 mt-[2px] flex gap-2.5'>
              <span>{value.cuit}</span>
              <span className='rounded px-[5px] bg-slate-400/[0.08] border border-slate-400/10'>
                {CONDICION_IVA_LABEL[value.condicion_iva]}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              onChange(null);
              setQuery('');
            }}
            className='flex items-center bg-transparent border-0 cursor-pointer p-[3px] text-slate-700 hover:text-red-400 transition-colors duration-[120ms]'
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
          className='absolute top-[calc(100%+4px)] left-0 right-0 z-40 rounded-[9px] p-1 bg-slate-950 border border-slate-400/[0.12] shadow-[0_8px_24px_rgba(0,0,0,0.5)] animate-modal-in'
        >
          {opciones.map((c) => (
            <button
              key={c.id}
              onClick={() => seleccionar(c)}
              className='flex flex-col gap-[2px] w-full px-[11px] py-[9px] rounded-md border-0 bg-transparent cursor-pointer text-left transition-colors duration-100 hover:bg-slate-400/[0.06]'
            >
              <span className='text-[13px] font-semibold text-slate-400'>
                {c.razon_social}
              </span>
              <div className='flex gap-2'>
                <span className='text-[11px] text-slate-600'>{c.cuit}</span>
                <span className='text-[10px] text-slate-700'>
                  {CONDICION_IVA_LABEL[c.condicion_iva]}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
      {abierto && query.length >= 2 && opciones.length === 0 && !loading && (
        <div
          className='absolute top-[calc(100%+4px)] left-0 right-0 z-40 rounded-[9px] p-4 text-center bg-slate-950 border border-slate-400/[0.12] shadow-[0_8px_24px_rgba(0,0,0,0.5)]'
        >
          <span className='text-xs text-slate-700'>
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
      className={`w-full px-[11px] py-2 bg-slate-950/60 rounded-[7px] text-slate-200 outline-none transition-colors duration-150 border focus:border-emerald-400/35 ${small ? 'text-[11px]' : 'text-xs'} ${errors[`${item.id}.${field}`] ? 'border-amber-500/40' : 'border-slate-400/10'}`}
      {...(type === 'date' ? { style: { colorScheme: 'dark' } as React.CSSProperties } : {})}
    />
  );

  return (
    <div className='rounded-[10px] overflow-hidden mb-2.5 border border-slate-400/[0.08]'>
      {/* Fila principal */}
      <div
        className='grid grid-cols-[24px_1fr_70px_90px_90px_70px_80px_90px_32px] gap-2 px-3 py-[11px] items-center bg-slate-950/30'
      >
        {/* Número */}
        <div
          className='flex items-center justify-center text-[9px] font-extrabold text-emerald-400 w-5 h-5 rounded-[4px] bg-emerald-400/[0.07] border border-emerald-400/[0.12]'
        >
          {idx + 1}
        </div>

        {/* Descripción */}
        <div>
          {inp('descripcion', 'text', 'Descripción del servicio / producto')}
          {errors[`${item.id}.descripcion`] && (
            <span className={errClass}>{errors[`${item.id}.descripcion`]}</span>
          )}
        </div>

        {/* Cantidad */}
        {inp('cantidad', 'number', '1', true)}

        {/* Unidad */}
        <div className='relative'>
          <select
            value={item.unidad_medida}
            onChange={(e) => onChange(item.id, 'unidad_medida', e.target.value)}
            className={`${inputClass} text-[11px] appearance-none pr-[22px] cursor-pointer`}
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
            className='absolute right-[7px] top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
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
            <span className={errClass}>{errors[`${item.id}.precio_unitario`]}</span>
          )}
        </div>

        {/* Descuento */}
        <div className='relative'>
          {inp('descuento_pct', 'number', '0', true)}
          <span className='absolute right-[9px] top-1/2 -translate-y-1/2 text-[10px] text-slate-700 pointer-events-none'>
            %
          </span>
        </div>

        {/* IVA */}
        <div className='relative'>
          <select
            value={item.iva_pct}
            onChange={(e) => onChange(item.id, 'iva_pct', e.target.value)}
            className={`${inputClass} text-[11px] appearance-none pr-[22px] cursor-pointer`}
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
            className='absolute right-[7px] top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
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
        <div className='text-right'>
          <div className='text-xs font-bold text-slate-400 whitespace-nowrap'>
            {formatearMonto(total)}
          </div>
          {parseFloat(item.iva_pct) > 0 && (
            <div className='text-[9px] text-slate-700 mt-[1px]'>
              IVA {formatearMonto(ivaItem)}
            </div>
          )}
        </div>

        {/* Botones */}
        <div className='flex flex-col gap-[3px]'>
          <button
            onClick={() => onChange(item.id, '_expandido', !item._expandido)}
            title='Detalle técnico'
            className={`flex items-center justify-center cursor-pointer transition-all duration-[120ms] w-6 h-6 rounded-[5px] border border-slate-400/[0.08] ${item._expandido ? 'bg-emerald-400/[0.07] text-green-400' : 'bg-transparent text-slate-800'}`}
          >
            <svg
              width='10'
              height='10'
              viewBox='0 0 10 10'
              fill='none'
              className={`transition-transform duration-150 ${item._expandido ? 'rotate-180' : ''}`}
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
              className='flex items-center justify-center cursor-pointer bg-transparent transition-all duration-[120ms] w-6 h-6 rounded-[5px] border border-slate-400/[0.08] text-slate-700 hover:text-red-400 hover:border-red-400/20'
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
          className='px-3 pt-[10px] pb-3 bg-emerald-400/[0.02] border-t border-slate-400/[0.06] animate-fade-in'
        >
          <label className='text-[10px] font-semibold tracking-widest uppercase text-slate-800 block mb-1'>
            Detalle técnico / descripción adicional
          </label>
          <textarea
            value={item.detalle}
            onChange={(e) => onChange(item.id, 'detalle', e.target.value)}
            placeholder='Descripción técnica que aparecerá en la factura...'
            rows={2}
            className={`${inputClass} resize-y leading-[1.6] text-xs focus:border-emerald-400/35`}
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
    <div className={`${cardClass} p-5 sticky top-5`}>
      <div className='flex items-center gap-2 mb-4'>
        <span className='text-[13px]'>🧮</span>
        <span className='text-[11px] font-bold tracking-widest uppercase text-slate-600'>
          Totales
        </span>
      </div>

      <div className='flex flex-col gap-[2px] mb-[14px]'>
        {[
          { label: 'Subtotal bruto', value: totales.subtotal,   textCls: 'text-slate-600' },
          ...(totales.descuento > 0 ? [{ label: 'Descuentos', value: -totales.descuento, textCls: 'text-amber-500' }] : []),
          { label: 'Subtotal s/IVA', value: totales.base_iva,   textCls: 'text-slate-500' },
          ...(esA ? [{ label: 'IVA (promedio)', value: totales.iva_monto, textCls: 'text-slate-600' }] : []),
        ].map(({ label, value, textCls }) => (
          <div key={label} className='flex justify-between items-center py-[5px]'>
            <span className='text-[11px] text-slate-600'>{label}</span>
            <span className={`text-xs font-medium whitespace-nowrap ${textCls}`}>
              {value < 0 ? `−${formatearMonto(Math.abs(value))}` : formatearMonto(value)}
            </span>
          </div>
        ))}
      </div>

      <div className='h-px mb-3 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent' />

      <div className='flex justify-between items-center mb-1'>
        <span className='text-[13px] font-bold text-slate-400'>TOTAL</span>
        <span className='text-2xl font-extrabold text-emerald-400 tracking-[-0.02em]'>
          {formatearMonto(totales.total)}
        </span>
      </div>

      {!esA && totales.iva_monto > 0 && (
        <div className='text-[10px] text-slate-700 text-right mb-[2px]'>
          incl. IVA {formatearMonto(totales.iva_monto)}
        </div>
      )}

      {/* IVA desglosado por alícuota */}
      {totales.iva_monto > 0 && (
        <div
          className='mt-3 p-2.5 rounded-[7px] bg-slate-950/40 border border-slate-400/[0.07]'
        >
          <div className='text-[9px] font-bold tracking-widest uppercase text-slate-700 mb-1.5'>
            {esA ? 'IVA discriminado' : 'IVA incluido'}
          </div>
          <div className='text-[11px] text-slate-600'>
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
      <div
        className='min-h-screen pb-20 px-3 pt-6 sm:px-5 sm:pt-8 lg:px-6 bg-slate-950 bg-gradient-to-b from-emerald-950/5 to-slate-950'
      >
        <div className='max-w-[1200px] mx-auto'>
          {/* Header */}
          <div className='flex items-center justify-between mb-6 gap-4 flex-wrap'>
            <div>
              <div className='flex items-center gap-2 mb-1'>
                <a
                  href='/facturas'
                  className='text-[11px] text-slate-700 no-underline tracking-widest uppercase'
                >
                  Facturas
                </a>
                <span className='text-[#1e293b]'>›</span>
                <span className='text-[11px] text-slate-600 tracking-widest uppercase'>
                  Nueva factura
                </span>
              </div>
              <h1 className='m-0 text-[22px] font-bold text-slate-200 tracking-[-0.02em]'>
                Nueva factura
              </h1>
            </div>
          </div>

          <div className='grid grid-cols-[1fr_280px] gap-4 items-start'>
            {/* Columna principal */}
            <div
              suppressHydrationWarning
              className='flex flex-col gap-4'
            >
              {/* ── Cliente y tipo de comprobante ── */}
              <SectionCard icon={<User className="w-3.5 h-3.5" />} title='Cliente y comprobante'>
                <div className='flex flex-col gap-[14px]'>
                  <Field label='Cliente *' error={errors.cliente}>
                    <BuscadorCliente value={cliente} onChange={setCliente} />
                  </Field>

                  <div className='grid grid-cols-2 gap-3'>
                    <Field
                      label='Tipo de comprobante *'
                      error={errors.tipoComp}
                    >
                      <div className='relative'>
                        <select
                          value={tipoComp}
                          onChange={(e) =>
                            setTipoComp(e.target.value as TipoComprobanteAFIP)
                          }
                          className={`${inputClass} appearance-none pr-[26px] cursor-pointer ${sugerencia && tipoComp === sugerencia ? 'border-emerald-400/30' : ''}`}
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
                          className='absolute right-[9px] top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
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
                        <div className='text-[10px] text-emerald-400 mt-1 flex items-center gap-1'>
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
                      <div className='relative'>
                        <select
                          value={condicion}
                          onChange={(e) => setCondicion(e.target.value)}
                          className={`${inputClass} appearance-none pr-[26px] cursor-pointer`}
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
                          className='absolute right-[9px] top-1/2 -translate-y-1/2 pointer-events-none text-slate-600'
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
              <SectionCard icon={<Calendar className="w-3.5 h-3.5" />} title='Fechas'>
                <div className='grid grid-cols-2 gap-3'>
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
                <div className='grid grid-cols-2 gap-3'>
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
                <p className='mt-2.5 mb-0 text-[11px] text-slate-700 leading-[1.6]'>
                  Si creás la factura desde la ficha de un presupuesto u OS, los
                  campos se completan automáticamente.
                </p>
              </SectionCard>

              {/* ── Ítems ── */}
              <div className={`${cardClass} p-5`}>
                <div className='flex items-center gap-2 mb-1.5'>
                  <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                  <span className='text-[11px] font-bold tracking-widest uppercase text-slate-600'>
                    Ítems
                  </span>
                  <span className='text-[9px] font-bold text-emerald-400 rounded-[10px] px-1.5 py-[1px] bg-emerald-400/[0.08] border border-emerald-400/[0.12]'>
                    {items.length}
                  </span>
                </div>

                {/* Encabezado columnas */}
                <div className='grid grid-cols-[24px_1fr_70px_90px_90px_70px_80px_90px_32px] gap-2 px-3 pb-[10px] pt-1.5 mb-1'>
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
                      className={`text-[9px] font-bold tracking-[0.07em] uppercase text-slate-700 ${i >= 7 ? 'text-right' : 'text-left'}`}
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
                  className='flex items-center gap-[7px] px-[14px] py-2 rounded-lg text-emerald-400 text-xs font-semibold cursor-pointer transition-colors duration-[120ms] mt-1.5 w-full justify-center border border-dashed border-emerald-400/20 bg-emerald-400/[0.04] hover:bg-emerald-400/[0.07]'
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
              <SectionCard icon={<PenLine className="w-3.5 h-3.5" />} title='Notas internas'>
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder='Observaciones, aclaraciones, notas que no aparecen en el PDF...'
                  rows={3}
                  className={`${inputClass} resize-y leading-[1.7] focus:border-emerald-400/35`}
                />
              </SectionCard>

              {/* ── Acciones ── */}
              <div className='flex gap-2.5 justify-end flex-wrap'>
                <a
                  href='/facturas'
                  className='inline-flex items-center px-[18px] py-[10px] rounded-[9px] text-[13px] font-semibold text-slate-500 no-underline bg-transparent border border-slate-400/[0.12]'
                >
                  Cancelar
                </a>
                <button
                  onClick={() => handleGuardar(false)}
                  disabled={loading}
                  className={`px-[22px] py-[10px] rounded-[9px] text-slate-400 text-[13px] font-semibold border border-slate-400/[0.15] bg-slate-950/80 ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  Guardar borrador
                </button>
                <button
                  onClick={() => handleGuardar(true)}
                  disabled={loading}
                  className={`inline-flex items-center gap-[7px] px-6 py-[10px] rounded-[9px] border-0 text-slate-900 text-[13px] font-bold bg-gradient-to-br from-green-400/85 to-green-500/85 shadow-[0_4px_14px_rgba(74,222,128,0.2)] ${loading ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {loading ? (
                    <>
                      <svg
                        width='13'
                        height='13'
                        viewBox='0 0 13 13'
                        className='animate-spin'
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
          className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2.5 px-[18px] py-3 rounded-[10px] backdrop-blur-sm bg-slate-950/[0.97] shadow-[0_8px_32px_rgba(0,0,0,0.4)] animate-modal-in ${toast.tipo === 'ok' ? 'border border-emerald-400/30' : 'border border-red-400/30'}`}
        >
          <span
            className={`text-[13px] font-semibold ${toast.tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {toast.tipo === 'ok' ? '✓' : '✕'}
          </span>
          <span
            className={`text-[13px] ${toast.tipo === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
          >
            {toast.msg}
          </span>
        </div>
      )}
    </>
  );
}
