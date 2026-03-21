'use client';

// ============================================================
// components/modules/presupuestos/PresupuestoBuilder.tsx
// Builder completo de presupuestos: cabecera + ítems +
// matriz de incidencias + panel de totales en tiempo real
// ============================================================

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type ChangeEvent,
} from 'react';
import type {
  TipoOperacion,
  TipoIncidencia,
  CrearPresupuestoDTO,
  CrearPresupuestoItemDTO,
  CrearPresupuestoIncidenciaDTO,
  ClienteListaItem,
} from '@/types';
import {
  calcularTotalesPresupuesto,
  formatearMonto,
  redondear,
} from '@/lib/calculos';
import { crearPresupuesto } from '@/app/actions/presupuestos';
import { obtenerClientes } from '@/app/actions/clientes';

// ─── Constantes ───────────────────────────────────────────────────────────────

const TIPOS_OPERACION: { value: TipoOperacion; label: string; icon: string }[] =
  [
    { value: 'SERVICIO', label: 'Servicio', icon: '🔧' },
    { value: 'PRODUCTO', label: 'Producto', icon: '📦' },
    { value: 'PRODUCTO_SERVICIO', label: 'Producto + Servicio', icon: '🔧📦' },
  ];

const UNIDADES = [
  'UN',
  'HS',
  'DÍA',
  'M²',
  'ML',
  'KG',
  'LT',
  'GL',
  'JGO',
  'KIT',
];

const INCIDENCIA_CONFIG: Record<
  TipoIncidencia,
  {
    label: string;
    icon: string;
    color: string;
    usaDias: boolean;
    usaKm: boolean;
  }
> = {
  traslado: {
    label: 'Traslado',
    icon: '🚗',
    color: '#60a5fa',
    usaDias: false,
    usaKm: true,
  },
  viatico: {
    label: 'Viático',
    icon: '💼',
    color: '#f59e0b',
    usaDias: true,
    usaKm: false,
  },
  hospedaje: {
    label: 'Hospedaje',
    icon: '🏨',
    color: '#a78bfa',
    usaDias: true,
    usaKm: false,
  },
  combustible: {
    label: 'Combustible',
    icon: '⛽',
    color: '#f97316',
    usaDias: false,
    usaKm: true,
  },
  vianda: {
    label: 'Vianda',
    icon: '🍱',
    color: '#34d399',
    usaDias: true,
    usaKm: false,
  },
  equipamiento: {
    label: 'Equipamiento',
    icon: '🛠',
    color: '#94a3b8',
    usaDias: false,
    usaKm: false,
  },
  sanidad: {
    label: 'Sanidad / Seguros',
    icon: '🏥',
    color: '#f87171',
    usaDias: false,
    usaKm: false,
  },
  honorario_externo: {
    label: 'Honorario Externo',
    icon: '👤',
    color: '#e879f9',
    usaDias: false,
    usaKm: false,
  },
  pago_tercero: {
    label: 'Pago a Tercero',
    icon: '💸',
    color: '#fbbf24',
    usaDias: false,
    usaKm: false,
  },
  otro: {
    label: 'Otro',
    icon: '📎',
    color: '#64748b',
    usaDias: false,
    usaKm: false,
  },
};

const IVA_OPCIONES = [0, 10.5, 21, 27];

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface ItemForm {
  _id: string; // id local para React key
  descripcion: string;
  detalle: string;
  cantidad: string;
  unidad_medida: string;
  precio_unitario: string;
  costo_unitario: string;
  descuento_pct: string;
}

interface IncidenciaForm {
  _id: string;
  tipo: TipoIncidencia;
  descripcion: string;
  cantidad: string;
  dias: string;
  distancia_km: string;
  monto_unitario: string;
  es_interno: boolean;
  notas: string;
}

interface CabeceraForm {
  cliente_id: string;
  titulo: string;
  objetivo_servicio: string;
  tipo_operacion: TipoOperacion;
  descripcion: string;
  fecha_vencimiento: string;
  descuento_pct: string;
  iva_pct: string;
  condiciones_pago: string;
  tiempo_ejecucion: string;
  garantia: string;
  notas_internas: string;
  notas_cliente: string;
}

type FormErrors = Partial<Record<string, string>>;
type TabActiva = 'cabecera' | 'items' | 'incidencias' | 'condiciones';

// ─── Estado inicial ───────────────────────────────────────────────────────────

const nuevaIncidencia = (
  tipo: TipoIncidencia = 'traslado',
): IncidenciaForm => ({
  _id: crypto.randomUUID(),
  tipo,
  descripcion: INCIDENCIA_CONFIG[tipo].label,
  cantidad: '1',
  dias: '1',
  distancia_km: '',
  monto_unitario: '',
  es_interno: true,
  notas: '',
});

const nuevoItem = (): ItemForm => ({
  _id: crypto.randomUUID(),
  descripcion: '',
  detalle: '',
  cantidad: '1',
  unidad_medida: 'UN',
  precio_unitario: '',
  costo_unitario: '',
  descuento_pct: '0',
});

const initialCabecera: CabeceraForm = {
  cliente_id: '',
  titulo: '',
  objetivo_servicio: '',
  tipo_operacion: 'SERVICIO',
  descripcion: '',
  fecha_vencimiento: '',
  descuento_pct: '0',
  iva_pct: '21',
  condiciones_pago: '',
  tiempo_ejecucion: '',
  garantia: '',
  notas_internas: '',
  notas_cliente: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const n = (s: string): number => parseFloat(s) || 0;

function subtotalItem(it: ItemForm): number {
  return redondear(
    n(it.cantidad) * n(it.precio_unitario) * (1 - n(it.descuento_pct) / 100),
  );
}

function subtotalIncidencia(inc: IncidenciaForm): number {
  return redondear(n(inc.cantidad) * n(inc.dias) * n(inc.monto_unitario));
}

function uid(): string {
  return crypto.randomUUID().slice(0, 8);
}

// ─── Estilos base ─────────────────────────────────────────────────────────────

const card: CSSProperties = {
  background: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(148,163,184,0.08)',
  borderRadius: '12px',
  backdropFilter: 'blur(12px)',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'rgba(8,16,35,0.6)',
  border: '1px solid rgba(148,163,184,0.1)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '13px',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  boxSizing: 'border-box' as const,
  transition: 'border-color 0.2s',
};

const monoInput: CSSProperties = {
  ...inputStyle,
  fontFamily: "'DM Mono', monospace",
  fontSize: '12px',
  textAlign: 'right' as const,
};

const labelStyle: CSSProperties = {
  fontSize: '10px',
  fontWeight: '600' as const,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#475569',
  marginBottom: '5px',
  display: 'block',
};

// ─── Subcomponentes de UI ─────────────────────────────────────────────────────

function Field({
  label,
  error,
  required,
  children,
}: {
  label?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label style={{ ...labelStyle, color: error ? '#f59e0b' : '#475569' }}>
          {label}
          {required && (
            <span style={{ color: '#f59e0b', marginLeft: '3px' }}>●</span>
          )}
        </label>
      )}
      {children}
      {error && (
        <span
          style={{
            fontSize: '11px',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <svg width='9' height='9' viewBox='0 0 9 9'>
            <circle cx='4.5' cy='4.5' r='4' stroke='#f59e0b' fill='none' />
            <line
              x1='4.5'
              y1='3'
              x2='4.5'
              y2='5.5'
              stroke='#f59e0b'
              strokeWidth='1.1'
              strokeLinecap='round'
            />
            <circle cx='4.5' cy='6.5' r='.5' fill='#f59e0b' />
          </svg>
          {error}
        </span>
      )}
    </div>
  );
}

function Inp({
  value,
  onChange,
  placeholder,
  type = 'text',
  style: extraStyle,
  error,
  onFocus,
  onBlur,
  ...rest
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  style?: CSSProperties;
  error?: string;
  onFocus?: () => void;
  onBlur?: () => void;
  min?: string;
  max?: string;
  step?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      style={{
        ...(extraStyle ?? inputStyle),
        borderColor: error
          ? 'rgba(245,158,11,0.5)'
          : focused
            ? 'rgba(245,158,11,0.35)'
            : 'rgba(148,163,184,0.1)',
        boxShadow: focused ? '0 0 0 3px rgba(245,158,11,0.06)' : 'none',
      }}
      {...rest}
    />
  );
}

function Sel({
  value,
  onChange,
  children,
  style: extraStyle,
}: {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...(extraStyle ?? inputStyle),
          appearance: 'none',
          cursor: 'pointer',
          paddingRight: '28px',
          borderColor: focused
            ? 'rgba(245,158,11,0.35)'
            : 'rgba(148,163,184,0.1)',
          boxSizing: 'border-box',
        }}
      >
        {children}
      </select>
      <svg
        width='10'
        height='10'
        viewBox='0 0 10 10'
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
          d='M2 4L5 7L8 4'
          stroke='currentColor'
          strokeWidth='1.3'
          strokeLinecap='round'
          strokeLinejoin='round'
        />
      </svg>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  onAdd,
  addLabel,
}: {
  icon: string;
  title: string;
  count?: number;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '14px' }}>{icon}</span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: '700',
            color: '#94a3b8',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </span>
        {count !== undefined && count > 0 && (
          <span
            style={{
              fontSize: '10px',
              fontWeight: '700',
              color: '#475569',
              background: 'rgba(148,163,184,0.08)',
              border: '1px solid rgba(148,163,184,0.12)',
              borderRadius: '20px',
              padding: '1px 7px',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {count}
          </span>
        )}
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
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
            transition: 'all 0.15s',
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
          {addLabel ?? 'Agregar'}
        </button>
      )}
    </div>
  );
}

function MontoDisplay({
  label,
  value,
  size = 'sm',
  accent = false,
  total = false,
}: {
  label: string;
  value: number;
  size?: 'sm' | 'md' | 'lg';
  accent?: boolean;
  total?: boolean;
}) {
  const sizes = { sm: '12px', md: '13px', lg: '16px' };
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: total ? '10px 0' : '5px 0',
        borderTop: total ? '1px solid rgba(148,163,184,0.1)' : 'none',
      }}
    >
      <span
        style={{
          fontSize: '11px',
          color: total ? '#94a3b8' : '#475569',
          fontWeight: total ? '600' : '400',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: sizes[size],
          fontFamily: "'DM Mono',monospace",
          fontWeight: total ? '700' : '500',
          color: total ? '#f59e0b' : accent ? '#4ade80' : '#64748b',
        }}
      >
        {formatearMonto(value)}
      </span>
    </div>
  );
}

// ─── Sección: Cabecera ────────────────────────────────────────────────────────

function SeccionCabecera({
  data,
  onChange,
  errors,
  clientes,
  loadingClientes,
}: {
  data: CabeceraForm;
  onChange: <K extends keyof CabeceraForm>(k: K, v: CabeceraForm[K]) => void;
  errors: FormErrors;
  clientes: ClienteListaItem[];
  loadingClientes: boolean;
}) {
  const set =
    <K extends keyof CabeceraForm>(k: K) =>
    (
      e: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >,
    ) =>
      onChange(k, e.target.value as CabeceraForm[K]);

  return (
    <div className='flex flex-col gap-4'>
      {/* Tipo de operación */}
      <div>
        <label style={labelStyle}>
          Tipo de operación <span style={{ color: '#f59e0b' }}>●</span>
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {TIPOS_OPERACION.map((t) => (
            <button
              key={t.value}
              onClick={() => onChange('tipo_operacion', t.value)}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                border:
                  data.tipo_operacion === t.value
                    ? '1px solid rgba(245,158,11,0.5)'
                    : '1px solid rgba(148,163,184,0.1)',
                background:
                  data.tipo_operacion === t.value
                    ? 'rgba(245,158,11,0.08)'
                    : 'rgba(8,16,35,0.4)',
                color: data.tipo_operacion === t.value ? '#f59e0b' : '#475569',
                fontSize: '12px',
                fontWeight: '600',
                fontFamily: "'DM Sans',sans-serif",
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s',
              }}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        {/* Cliente */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label='Cliente' required error={errors.cliente_id}>
            <Sel
              value={data.cliente_id}
              onChange={(e) => onChange('cliente_id', e.target.value)}
            >
              <option value=''>
                {loadingClientes ? 'Cargando...' : 'Seleccionar cliente...'}
              </option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.razon_social}
                  {c.cuit ? ` — ${c.cuit}` : ''}
                </option>
              ))}
            </Sel>
          </Field>
        </div>

        {/* Título */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label='Título del presupuesto' required error={errors.titulo}>
            <Inp
              value={data.titulo}
              onChange={set('titulo')}
              placeholder='Ej: Instalación sistema HVAC Planta Norte'
              error={errors.titulo}
            />
          </Field>
        </div>

        {/* Objetivo */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field
            label='Objetivo del servicio'
            required
            error={errors.objetivo_servicio}
          >
            <textarea
              value={data.objetivo_servicio}
              onChange={set('objetivo_servicio')}
              placeholder='Descripción técnica del objetivo a cumplir...'
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: '1.6',
                minHeight: '70px',
              }}
            />
          </Field>
        </div>

        {/* Descripción */}
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label='Descripción / Alcance'>
            <textarea
              value={data.descripcion}
              onChange={set('descripcion')}
              placeholder='Descripción detallada del alcance del trabajo...'
              rows={3}
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: '1.6',
                minHeight: '70px',
              }}
            />
          </Field>
        </div>

        <Field label='Fecha de vencimiento'>
          <Inp
            type='date'
            value={data.fecha_vencimiento}
            onChange={set('fecha_vencimiento')}
          />
        </Field>

        <Field label='Tiempo de ejecución'>
          <Inp
            value={data.tiempo_ejecucion}
            onChange={set('tiempo_ejecucion')}
            placeholder='Ej: 15 días hábiles'
          />
        </Field>

        <Field label='Condiciones de pago'>
          <Inp
            value={data.condiciones_pago}
            onChange={set('condiciones_pago')}
            placeholder='Ej: 50% anticipo, 50% a entrega'
          />
        </Field>

        <Field label='Garantía'>
          <Inp
            value={data.garantia}
            onChange={set('garantia')}
            placeholder='Ej: 12 meses de garantía'
          />
        </Field>
      </div>

      {/* Notas */}
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Field label='Notas para el cliente' hint='Visible en el documento PDF'>
          <textarea
            value={data.notas_cliente}
            onChange={set('notas_cliente')}
            placeholder='Aclaraciones, condiciones especiales...'
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: '1.6',
              fontSize: '12px',
            }}
          />
        </Field>
        <Field label='Notas internas' hint='Solo visible en el sistema'>
          <textarea
            value={data.notas_internas}
            onChange={set('notas_internas')}
            placeholder='Notas de contexto, estrategia de precio...'
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: '1.6',
              fontSize: '12px',
            }}
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Sección: Ítems ───────────────────────────────────────────────────────────

function SeccionItems({
  items,
  onChange,
  onAdd,
  onRemove,
  errors,
}: {
  items: ItemForm[];
  onChange: (idx: number, field: keyof ItemForm, value: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  errors: FormErrors;
}) {
  return (
    <div>
      <SectionHeader
        icon='📋'
        title='Ítems'
        count={items.length}
        onAdd={onAdd}
        addLabel='Agregar ítem'
      />

      {items.length === 0 && (
        <div
          style={{
            padding: '32px',
            textAlign: 'center',
            border: '1px dashed rgba(148,163,184,0.12)',
            borderRadius: '10px',
          }}
        >
          <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
            Sin ítems aún — agregá el primer ítem de servicio o producto
          </p>
        </div>
      )}

      {errors.items && (
        <div
          style={{
            padding: '10px 14px',
            background: 'rgba(245,158,11,0.06)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderRadius: '8px',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#f59e0b',
          }}
        >
          {errors.items}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {items.map((item, idx) => (
          <FilaItem
            key={item._id}
            item={item}
            idx={idx}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>

      {items.length > 0 && (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#475569' }}>
              Subtotal ítems:
            </span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#e2e8f0',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {formatearMonto(items.reduce((a, it) => a + subtotalItem(it), 0))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaItem({
  item,
  idx,
  onChange,
  onRemove,
}: {
  item: ItemForm;
  idx: number;
  onChange: (i: number, f: keyof ItemForm, v: string) => void;
  onRemove: (i: number) => void;
}) {
  const [expanded, setExpanded] = useState(idx === 0);
  const subtotal = subtotalItem(item);

  return (
    <div
      style={{
        background: 'rgba(8,16,35,0.5)',
        border: '1px solid rgba(148,163,184,0.08)',
        borderRadius: '10px',
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Fila principal */}
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr 80px 90px 90px 70px 80px 32px',
            gap: '8px',
            padding: '10px 12px',
            alignItems: 'center',
            minWidth: '520px',
          }}
        >
          {/* Núm */}
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '6px',
              background: 'rgba(245,158,11,0.08)',
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

          {/* Descripción */}
          <Inp
            value={item.descripcion}
            onChange={(e) => onChange(idx, 'descripcion', e.target.value)}
            placeholder='Descripción del ítem...'
            style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }}
          />

          {/* Cantidad */}
          <Inp
            type='number'
            min='0'
            step='0.01'
            value={item.cantidad}
            onChange={(e) => onChange(idx, 'cantidad', e.target.value)}
            placeholder='Cant.'
            style={{ ...monoInput, padding: '7px 8px', fontSize: '12px' }}
          />

          {/* Unidad */}
          <Sel
            value={item.unidad_medida}
            onChange={(e) => onChange(idx, 'unidad_medida', e.target.value)}
            style={{
              ...inputStyle,
              padding: '7px 24px 7px 8px',
              fontSize: '11px',
            }}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Sel>

          {/* Precio */}
          <Inp
            type='number'
            min='0'
            step='0.01'
            value={item.precio_unitario}
            onChange={(e) => onChange(idx, 'precio_unitario', e.target.value)}
            placeholder='Precio'
            style={{ ...monoInput, padding: '7px 8px', fontSize: '12px' }}
          />

          {/* Descuento */}
          <div style={{ position: 'relative' }}>
            <Inp
              type='number'
              min='0'
              max='100'
              step='0.5'
              value={item.descuento_pct}
              onChange={(e) => onChange(idx, 'descuento_pct', e.target.value)}
              placeholder='0'
              style={{
                ...monoInput,
                padding: '7px 20px 7px 8px',
                fontSize: '12px',
              }}
            />
            <span
              style={{
                position: 'absolute',
                right: '7px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '10px',
                color: '#475569',
                pointerEvents: 'none',
              }}
            >
              %
            </span>
          </div>

          {/* Subtotal */}
          <div
            style={{
              textAlign: 'right',
              fontSize: '12px',
              fontWeight: '600',
              color: subtotal > 0 ? '#94a3b8' : '#334155',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {subtotal > 0 ? formatearMonto(subtotal) : '—'}
          </div>

          {/* Acciones */}
          <div
            style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end' }}
          >
            <button
              onClick={() => setExpanded((p) => !p)}
              style={{ ...btnIcon, color: expanded ? '#f59e0b' : '#334155' }}
            >
              <svg width='12' height='12' viewBox='0 0 12 12'>
                <path
                  d={expanded ? 'M2 8L6 4L10 8' : 'M2 4L6 8L10 4'}
                  stroke='currentColor'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </button>
            <button
              onClick={() => onRemove(idx)}
              style={{ ...btnIcon, color: '#475569' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
            >
              <svg width='12' height='12' viewBox='0 0 12 12'>
                <path
                  d='M2 2L10 10M10 2L2 10'
                  stroke='currentColor'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Detalle expandido */}
      {expanded && (
        <div
          className='grid grid-cols-1 gap-2.5 sm:grid-cols-2'
          style={{
            padding: '0 12px 12px',
            borderTop: '1px solid rgba(148,163,184,0.05)',
          }}
        >
          <Field label='Detalle / especificaciones técnicas'>
            <textarea
              value={item.detalle}
              onChange={(e) => onChange(idx, 'detalle', e.target.value)}
              placeholder='Especificaciones técnicas, marca, modelo...'
              rows={2}
              style={{
                ...inputStyle,
                resize: 'vertical',
                fontSize: '12px',
                lineHeight: '1.5',
              }}
            />
          </Field>
          <Field
            label='Costo unitario interno'
            hint='Solo visible en el sistema'
          >
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  fontSize: '11px',
                  color: '#334155',
                  pointerEvents: 'none',
                  fontFamily: "'DM Mono',monospace",
                }}
              >
                $
              </span>
              <Inp
                type='number'
                min='0'
                step='0.01'
                value={item.costo_unitario}
                onChange={(e) =>
                  onChange(idx, 'costo_unitario', e.target.value)
                }
                placeholder='0.00'
                style={{ ...monoInput, paddingLeft: '22px' }}
              />
            </div>
          </Field>
        </div>
      )}
    </div>
  );
}

const btnIcon: CSSProperties = {
  width: '26px',
  height: '26px',
  borderRadius: '6px',
  border: '1px solid rgba(148,163,184,0.08)',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.12s',
  color: '#475569',
};

// ─── Sección: Incidencias ─────────────────────────────────────────────────────

function SeccionIncidencias({
  incidencias,
  onChange,
  onAdd,
  onRemove,
}: {
  incidencias: IncidenciaForm[];
  onChange: (
    idx: number,
    field: keyof IncidenciaForm,
    value: string | boolean,
  ) => void;
  onAdd: (tipo: TipoIncidencia) => void;
  onRemove: (idx: number) => void;
}) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>📊</span>
          <span
            style={{ fontSize: '13px', fontWeight: '700', color: '#94a3b8' }}
          >
            Incidencias
          </span>
          {incidencias.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: '700',
                color: '#475569',
                background: 'rgba(148,163,184,0.08)',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: '20px',
                padding: '1px 7px',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {incidencias.length}
            </span>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuAbierto((p) => !p)}
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
            Agregar
          </button>
          {menuAbierto && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                marginTop: '4px',
                background: '#0f172a',
                border: '1px solid rgba(148,163,184,0.12)',
                borderRadius: '10px',
                padding: '4px',
                minWidth: '200px',
                zIndex: 20,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                animation: 'scaleIn 0.12s ease',
              }}
            >
              {(
                Object.entries(INCIDENCIA_CONFIG) as [
                  TipoIncidencia,
                  (typeof INCIDENCIA_CONFIG)[TipoIncidencia],
                ][]
              ).map(([tipo, cfg]) => (
                <button
                  key={tipo}
                  onClick={() => {
                    onAdd(tipo);
                    setMenuAbierto(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '7px',
                    border: 'none',
                    background: 'transparent',
                    color: '#94a3b8',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(148,163,184,0.06)';
                    e.currentTarget.style.color = '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                >
                  <span style={{ fontSize: '13px' }}>{cfg.icon}</span>
                  <span style={{ color: cfg.color, fontWeight: '500' }}>
                    {cfg.label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          marginBottom: '12px',
          padding: '10px 14px',
          background: 'rgba(99,102,241,0.04)',
          border: '1px solid rgba(99,102,241,0.1)',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#475569',
          lineHeight: '1.6',
        }}
      >
        <span style={{ color: '#a5b4fc', fontWeight: '600' }}>Incidencias</span>{' '}
        — costos operativos del servicio: traslados, viáticos, hospedaje,
        combustible, etc. Las marcadas como{' '}
        <span style={{ color: '#94a3b8' }}>internas</span> afectan el costo pero
        no se muestran al cliente.
      </div>

      {incidencias.length === 0 && (
        <div
          style={{
            padding: '28px',
            textAlign: 'center',
            border: '1px dashed rgba(148,163,184,0.1)',
            borderRadius: '10px',
          }}
        >
          <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
            Sin incidencias — el presupuesto no incluye costos operativos
            adicionales
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {incidencias.map((inc, idx) => (
          <FilaIncidencia
            key={inc._id}
            inc={inc}
            idx={idx}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>

      {incidencias.length > 0 && (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', color: '#475569' }}>
              Subtotal incidencias:
            </span>
            <span
              style={{
                fontSize: '14px',
                fontWeight: '700',
                color: '#e2e8f0',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {formatearMonto(
                incidencias.reduce((a, i) => a + subtotalIncidencia(i), 0),
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function FilaIncidencia({
  inc,
  idx,
  onChange,
  onRemove,
}: {
  inc: IncidenciaForm;
  idx: number;
  onChange: (i: number, f: keyof IncidenciaForm, v: string | boolean) => void;
  onRemove: (i: number) => void;
}) {
  const cfg = INCIDENCIA_CONFIG[inc.tipo];
  const subtotal = subtotalIncidencia(inc);
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      style={{
        background: 'rgba(8,16,35,0.5)',
        border: `1px solid ${cfg.color}18`,
        borderRadius: '10px',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'auto 32px 1fr 80px 70px 70px 80px 80px 32px',
            gap: '8px',
            padding: '10px 12px',
            alignItems: 'center',
            minWidth: '600px',
          }}
        >
          {/* Tipo badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '6px',
              background: `${cfg.color}12`,
              border: `1px solid ${cfg.color}25`,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '11px' }}>{cfg.icon}</span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '700',
                color: cfg.color,
                letterSpacing: '0.05em',
              }}
            >
              {cfg.label}
            </span>
          </div>

          {/* Núm */}
          <div
            style={{
              width: '22px',
              height: '22px',
              borderRadius: '6px',
              background: 'rgba(148,163,184,0.06)',
              border: '1px solid rgba(148,163,184,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: '700',
              color: '#475569',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {idx + 1}
          </div>

          {/* Descripción */}
          <Inp
            value={inc.descripcion}
            onChange={(e) => onChange(idx, 'descripcion', e.target.value)}
            placeholder='Descripción...'
            style={{ ...inputStyle, fontSize: '12px', padding: '7px 10px' }}
          />

          {/* Cantidad */}
          <div>
            <Inp
              type='number'
              min='0'
              step='1'
              value={inc.cantidad}
              onChange={(e) => onChange(idx, 'cantidad', e.target.value)}
              placeholder='Cant.'
              style={{ ...monoInput, padding: '7px 8px', fontSize: '12px' }}
            />
          </div>

          {/* Días (si aplica) */}
          <div>
            {cfg.usaDias ? (
              <div style={{ position: 'relative' }}>
                <Inp
                  type='number'
                  min='1'
                  step='1'
                  value={inc.dias}
                  onChange={(e) => onChange(idx, 'dias', e.target.value)}
                  placeholder='Días'
                  style={{
                    ...monoInput,
                    padding: '7px 22px 7px 8px',
                    fontSize: '12px',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '9px',
                    color: '#475569',
                    pointerEvents: 'none',
                  }}
                >
                  d
                </span>
              </div>
            ) : (
              <div
                style={{
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '11px', color: '#1e293b' }}>—</span>
              </div>
            )}
          </div>

          {/* Km (si aplica) */}
          <div>
            {cfg.usaKm ? (
              <div style={{ position: 'relative' }}>
                <Inp
                  type='number'
                  min='0'
                  step='1'
                  value={inc.distancia_km}
                  onChange={(e) =>
                    onChange(idx, 'distancia_km', e.target.value)
                  }
                  placeholder='km'
                  style={{
                    ...monoInput,
                    padding: '7px 22px 7px 8px',
                    fontSize: '12px',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    right: '6px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: '9px',
                    color: '#475569',
                    pointerEvents: 'none',
                  }}
                >
                  km
                </span>
              </div>
            ) : (
              <div
                style={{
                  height: '34px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: '11px', color: '#1e293b' }}>—</span>
              </div>
            )}
          </div>

          {/* Monto unitario */}
          <div style={{ position: 'relative' }}>
            <span
              style={{
                position: 'absolute',
                left: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: '10px',
                color: '#334155',
                pointerEvents: 'none',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              $
            </span>
            <Inp
              type='number'
              min='0'
              step='0.01'
              value={inc.monto_unitario}
              onChange={(e) => onChange(idx, 'monto_unitario', e.target.value)}
              placeholder='0.00'
              style={{
                ...monoInput,
                paddingLeft: '18px',
                padding: '7px 8px 7px 18px',
                fontSize: '12px',
              }}
            />
          </div>

          {/* Subtotal */}
          <div
            style={{
              textAlign: 'right',
              fontSize: '12px',
              fontWeight: '600',
              color: subtotal > 0 ? '#94a3b8' : '#334155',
              fontFamily: "'DM Mono',monospace",
            }}
          >
            {subtotal > 0 ? formatearMonto(subtotal) : '—'}
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: '3px' }}>
            <button
              onClick={() => setExpanded((p) => !p)}
              style={{ ...btnIcon, color: expanded ? '#f59e0b' : '#334155' }}
            >
              <svg width='12' height='12' viewBox='0 0 12 12'>
                <path
                  d={expanded ? 'M2 8L6 4L10 8' : 'M2 4L6 8L10 4'}
                  stroke='currentColor'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                />
              </svg>
            </button>
            <button
              onClick={() => onRemove(idx)}
              style={{ ...btnIcon }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#475569')}
            >
              <svg width='12' height='12' viewBox='0 0 12 12'>
                <path
                  d='M2 2L10 10M10 2L2 10'
                  stroke='currentColor'
                  strokeWidth='1.4'
                  strokeLinecap='round'
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Toggle interno / externo */}
      {expanded && (
        <div
          className='flex flex-col gap-3 sm:flex-row sm:items-center'
          style={{
            padding: '0 12px 10px',
            borderTop: '1px solid rgba(148,163,184,0.05)',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer',
            }}
          >
            <div
              onClick={() => onChange(idx, 'es_interno', !inc.es_interno)}
              style={{
                width: '32px',
                height: '18px',
                borderRadius: '9px',
                background: inc.es_interno
                  ? 'rgba(245,158,11,0.4)'
                  : 'rgba(148,163,184,0.12)',
                border: `1px solid ${inc.es_interno ? 'rgba(245,158,11,0.5)' : 'rgba(148,163,184,0.15)'}`,
                position: 'relative',
                cursor: 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: inc.es_interno ? '15px' : '2px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: inc.es_interno ? '#f59e0b' : '#475569',
                  transition: 'all 0.2s',
                }}
              />
            </div>
            <span
              style={{
                fontSize: '11px',
                color: inc.es_interno ? '#f59e0b' : '#475569',
                fontWeight: '500',
              }}
            >
              {inc.es_interno
                ? 'Incidencia interna (solo costo)'
                : 'Incidencia externa (visible al cliente)'}
            </span>
          </label>
          {inc.notas !== undefined && (
            <Inp
              value={inc.notas}
              onChange={(e) => onChange(idx, 'notas', e.target.value)}
              placeholder='Notas opcionales...'
              style={{
                ...inputStyle,
                fontSize: '11px',
                padding: '5px 10px',
                flex: 1,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Panel de totales ─────────────────────────────────────────────────────────

function PanelTotales({
  items,
  incidencias,
  cabecera,
  onChangeCabecera,
}: {
  items: ItemForm[];
  incidencias: IncidenciaForm[];
  cabecera: CabeceraForm;
  onChangeCabecera: <K extends keyof CabeceraForm>(
    k: K,
    v: CabeceraForm[K],
  ) => void;
}) {
  const dtos: CrearPresupuestoItemDTO[] = items.map((it) => ({
    descripcion: it.descripcion || '—',
    cantidad: n(it.cantidad),
    precio_unitario: n(it.precio_unitario),
    descuento_pct: n(it.descuento_pct),
    costo_unitario: n(it.costo_unitario) || undefined,
    unidad_medida: it.unidad_medida,
  }));

  const incDtos: CrearPresupuestoIncidenciaDTO[] = incidencias.map((inc) => ({
    tipo: inc.tipo,
    descripcion: inc.descripcion,
    cantidad: n(inc.cantidad),
    dias: n(inc.dias) || 1,
    distancia_km: n(inc.distancia_km) || undefined,
    monto_unitario: n(inc.monto_unitario),
    es_interno: inc.es_interno,
  }));

  const totales = calcularTotalesPresupuesto(dtos, incDtos, {
    descuento_pct: n(cabecera.descuento_pct),
    iva_pct: n(cabecera.iva_pct),
  });

  const margenColor =
    totales.margen_pct >= 30
      ? '#4ade80'
      : totales.margen_pct >= 10
        ? '#f59e0b'
        : '#f87171';

  return (
    <div className='p-4 lg:p-3 xl:sticky xl:top-4' style={card}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          marginBottom: '18px',
        }}
      >
        <span style={{ fontSize: '13px' }}>🧮</span>
        <span
          style={{
            fontSize: '12px',
            fontWeight: '700',
            color: '#64748b',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Resumen
        </span>
      </div>

      {/* Cliente seleccionado */}
      {cabecera.titulo && (
        <div
          style={{
            padding: '10px 12px',
            background: 'rgba(245,158,11,0.05)',
            border: '1px solid rgba(245,158,11,0.12)',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{ fontSize: '11px', color: '#475569', marginBottom: '2px' }}
          >
            Presupuesto
          </div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#cbd5e1',
              lineHeight: '1.4',
            }}
          >
            {cabecera.titulo}
          </div>
        </div>
      )}

      {/* Ítems e incidencias */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          marginBottom: '12px',
        }}
      >
        <MontoDisplay
          label={`Ítems (${items.length})`}
          value={totales.subtotal_items}
        />
        {incidencias.filter((i) => !i.es_interno).length > 0 && (
          <MontoDisplay
            label={`Incidencias externas (${incidencias.filter((i) => !i.es_interno).length})`}
            value={incidencias
              .filter((i) => !i.es_interno)
              .reduce((a, i) => a + subtotalIncidencia(i), 0)}
          />
        )}
        {incidencias.filter((i) => i.es_interno).length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
            }}
          >
            <span
              style={{
                fontSize: '10px',
                color: '#334155',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>
                Incidencias internas (
                {incidencias.filter((i) => i.es_interno).length})
              </span>
              <span
                style={{
                  background: 'rgba(148,163,184,0.08)',
                  border: '1px solid rgba(148,163,184,0.12)',
                  borderRadius: '3px',
                  padding: '0 4px',
                  fontSize: '9px',
                }}
              >
                interno
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
                incidencias
                  .filter((i) => i.es_interno)
                  .reduce((a, i) => a + subtotalIncidencia(i), 0),
              )}
            </span>
          </div>
        )}
      </div>

      {/* Descuento global */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span
          style={{ fontSize: '11px', color: '#475569', whiteSpace: 'nowrap' }}
        >
          Descuento global
        </span>
        <div style={{ position: 'relative', flex: 1 }}>
          <Inp
            type='number'
            min='0'
            max='100'
            step='0.5'
            value={cabecera.descuento_pct}
            onChange={(e) => onChangeCabecera('descuento_pct', e.target.value)}
            style={{
              ...monoInput,
              padding: '5px 20px 5px 8px',
              fontSize: '12px',
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: '7px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '10px',
              color: '#475569',
              pointerEvents: 'none',
            }}
          >
            %
          </span>
        </div>
      </div>

      {/* IVA */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '16px',
        }}
      >
        <span
          style={{ fontSize: '11px', color: '#475569', whiteSpace: 'nowrap' }}
        >
          IVA
        </span>
        <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
          {IVA_OPCIONES.map((pct) => (
            <button
              key={pct}
              onClick={() => onChangeCabecera('iva_pct', String(pct))}
              style={{
                flex: 1,
                padding: '5px 4px',
                borderRadius: '5px',
                cursor: 'pointer',
                border:
                  n(cabecera.iva_pct) === pct
                    ? '1px solid rgba(245,158,11,0.4)'
                    : '1px solid rgba(148,163,184,0.1)',
                background:
                  n(cabecera.iva_pct) === pct
                    ? 'rgba(245,158,11,0.08)'
                    : 'transparent',
                color: n(cabecera.iva_pct) === pct ? '#f59e0b' : '#475569',
                fontSize: '10px',
                fontWeight: '600',
                fontFamily: "'DM Mono',monospace",
                transition: 'all 0.15s',
              }}
            >
              {pct}%
            </button>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div
        style={{
          borderTop: '1px solid rgba(148,163,184,0.08)',
          paddingTop: '10px',
        }}
      >
        {n(cabecera.descuento_pct) > 0 && (
          <MontoDisplay
            label={`Descuento (${cabecera.descuento_pct}%)`}
            value={-totales.descuento_monto}
          />
        )}
        <MontoDisplay label='Subtotal sin IVA' value={totales.subtotal} />
        <MontoDisplay
          label={`IVA ${cabecera.iva_pct}%`}
          value={totales.iva_monto}
        />
        <MontoDisplay label='TOTAL' value={totales.total} size='lg' total />
      </div>

      {/* Margen interno */}
      <div
        style={{
          marginTop: '14px',
          padding: '12px',
          background: 'rgba(8,16,35,0.5)',
          border: '1px solid rgba(148,163,184,0.07)',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            color: '#334155',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '8px',
          }}
        >
          Análisis interno
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#334155' }}>
              Costo estimado
            </span>
            <span
              style={{
                fontSize: '11px',
                color: '#334155',
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {formatearMonto(totales.costo_total)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#475569' }}>
              Margen bruto
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: margenColor,
                fontFamily: "'DM Mono',monospace",
              }}
            >
              {formatearMonto(totales.margen_monto)} (
              {totales.margen_pct.toFixed(1)}%)
            </span>
          </div>
          {/* Barra de margen */}
          <div
            style={{
              height: '4px',
              background: 'rgba(148,163,184,0.08)',
              borderRadius: '2px',
              marginTop: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: '2px',
                width: `${Math.min(100, Math.max(0, totales.margen_pct))}%`,
                background: margenColor,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function PresupuestoBuilder() {
  const [cabecera, setCabecera] = useState<CabeceraForm>(initialCabecera);
  const [items, setItems] = useState<ItemForm[]>([nuevoItem()]);
  const [incidencias, setIncidencias] = useState<IncidenciaForm[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [tabActiva, setTabActiva] = useState<TabActiva>('cabecera');
  const [clientes, setClientes] = useState<ClienteListaItem[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);

  // Cargar clientes al montar
  useEffect(() => {
    obtenerClientes({
      activo: true,
      por_pagina: 100,
      orden_por: 'razon_social',
      orden_dir: 'asc',
    }).then((res) => {
      if (res.data) setClientes(res.data.data);
      setLoadingClientes(false);
    });
  }, []);

  // ── Handlers cabecera ──────────────────────────────────────────

  const setCab = useCallback(
    <K extends keyof CabeceraForm>(k: K, v: CabeceraForm[K]) => {
      setCabecera((prev) => ({ ...prev, [k]: v }));
      if (errors[k])
        setErrors((prev) => {
          const e = { ...prev };
          delete e[k];
          return e;
        });
    },
    [errors],
  );

  // ── Handlers ítems ────────────────────────────────────────────

  const handleItemChange = useCallback(
    (idx: number, field: keyof ItemForm, value: string) => {
      setItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)),
      );
    },
    [],
  );

  const handleAddItem = useCallback(() => {
    setItems((prev) => [...prev, nuevoItem()]);
    setTabActiva('items');
  }, []);

  const handleRemoveItem = useCallback((idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Handlers incidencias ──────────────────────────────────────

  const handleIncidenciaChange = useCallback(
    (idx: number, field: keyof IncidenciaForm, value: string | boolean) => {
      setIncidencias((prev) =>
        prev.map((inc, i) => (i === idx ? { ...inc, [field]: value } : inc)),
      );
    },
    [],
  );

  const handleAddIncidencia = useCallback((tipo: TipoIncidencia) => {
    setIncidencias((prev) => [...prev, nuevaIncidencia(tipo)]);
    setTabActiva('incidencias');
  }, []);

  const handleRemoveIncidencia = useCallback((idx: number) => {
    setIncidencias((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Validación ────────────────────────────────────────────────

  const validar = (): boolean => {
    const e: FormErrors = {};
    if (!cabecera.cliente_id) e.cliente_id = 'Seleccioná un cliente';
    if (!cabecera.titulo.trim()) e.titulo = 'El título es requerido';
    if (!cabecera.objetivo_servicio.trim())
      e.objetivo_servicio = 'El objetivo es requerido';
    if (items.length === 0) e.items = 'Agregá al menos un ítem';
    if (items.some((it) => !it.descripcion.trim()))
      e.items = 'Todos los ítems deben tener descripción';
    if (items.some((it) => !it.precio_unitario || n(it.precio_unitario) <= 0))
      e.items = 'Todos los ítems deben tener precio mayor a 0';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      if (e.cliente_id || e.titulo || e.objetivo_servicio)
        setTabActiva('cabecera');
      else if (e.items) setTabActiva('items');
    }
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────

  const handleSubmit = async (estado: 'borrador' | 'enviar') => {
    if (!validar()) return;
    setSubmitting(true);

    const dto: CrearPresupuestoDTO = {
      cliente_id: cabecera.cliente_id,
      titulo: cabecera.titulo,
      objetivo_servicio: cabecera.objetivo_servicio,
      tipo_operacion: cabecera.tipo_operacion,
      descripcion: cabecera.descripcion || undefined,
      fecha_vencimiento: cabecera.fecha_vencimiento || undefined,
      descuento_pct: n(cabecera.descuento_pct),
      iva_pct: n(cabecera.iva_pct),
      condiciones_pago: cabecera.condiciones_pago || undefined,
      tiempo_ejecucion: cabecera.tiempo_ejecucion || undefined,
      garantia: cabecera.garantia || undefined,
      notas_internas: cabecera.notas_internas || undefined,
      notas_cliente: cabecera.notas_cliente || undefined,
      items: items.map((it) => ({
        descripcion: it.descripcion,
        detalle: it.detalle || undefined,
        cantidad: n(it.cantidad),
        unidad_medida: it.unidad_medida,
        precio_unitario: n(it.precio_unitario),
        costo_unitario: n(it.costo_unitario) || undefined,
        descuento_pct: n(it.descuento_pct),
      })),
      incidencias: incidencias.map((inc) => ({
        tipo: inc.tipo,
        descripcion: inc.descripcion,
        cantidad: n(inc.cantidad),
        dias: n(inc.dias) || 1,
        distancia_km: n(inc.distancia_km) || undefined,
        monto_unitario: n(inc.monto_unitario),
        es_interno: inc.es_interno,
        notas: inc.notas || undefined,
      })),
    };

    try {
      const result = await crearPresupuesto(dto);
      if (result.error) {
        setErrors({ _global: result.mensaje ?? result.error });
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      setErrors({ _global: 'Error inesperado. Intentá de nuevo.' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Tabs ──────────────────────────────────────────────────────

  const TABS: {
    id: TabActiva;
    label: string;
    icon: string;
    badge?: number;
    hasError?: boolean;
  }[] = [
    {
      id: 'cabecera',
      label: 'Cabecera',
      icon: '📝',
      hasError: !!(
        errors.cliente_id ||
        errors.titulo ||
        errors.objetivo_servicio
      ),
    },
    {
      id: 'items',
      label: 'Ítems',
      icon: '📋',
      badge: items.length,
      hasError: !!errors.items,
    },
    {
      id: 'incidencias',
      label: 'Incidencias',
      icon: '📊',
      badge: incidencias.length,
    },
    { id: 'condiciones', label: 'Condiciones', icon: '📄' },
  ];

  if (submitted)
    return (
      <PantallaExito
        onNuevo={() => {
          setCabecera(initialCabecera);
          setItems([nuevoItem()]);
          setIncidencias([]);
          setSubmitted(false);
        }}
      />
    );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@300;400;500&display=swap');
        * { box-sizing:border-box; }
        body { margin:0; background:#060d1a; font-family:'DM Sans',sans-serif; -webkit-font-smoothing:antialiased; }
        ::placeholder { color:#1e293b !important; }
        option { background:#0f172a; color:#e2e8f0; }
        input:focus, select:focus, textarea:focus { outline:none !important; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(148,163,184,0.15); border-radius:2px; }
        @keyframes scaleIn { from{transform:scale(0.96);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes slideUp { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes spin    { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>

      <div
        className='px-3 py-3 pb-10 sm:px-5 sm:py-4 sm:pb-12 lg:px-4 lg:py-2 lg:pb-3'
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(ellipse 120% 70% at 8% 0%,rgba(245,158,11,0.04) 0%,transparent 55%),#060d1a',
        }}
      >
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          {/* Header */}
          <div className='mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between lg:mb-3'>
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
                  Presupuestos
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
                  Nuevo
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
                Nuevo Presupuesto
              </h1>
            </div>
            <div className='flex w-full flex-wrap gap-2 sm:w-auto sm:flex-nowrap'>
              <button
                onClick={() => handleSubmit('borrador')}
                disabled={submitting}
                className='w-full sm:w-auto'
                style={{
                  padding: '9px 18px',
                  borderRadius: '9px',
                  border: '1px solid rgba(148,163,184,0.15)',
                  background: 'rgba(15,23,42,0.8)',
                  color: '#64748b',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  opacity: submitting ? 0.6 : 1,
                }}
              >
                Guardar borrador
              </button>
              <button
                onClick={() => handleSubmit('enviar')}
                disabled={submitting}
                className='w-full sm:w-auto'
                style={{
                  padding: '9px 20px',
                  borderRadius: '9px',
                  border: 'none',
                  background: submitting
                    ? 'rgba(245,158,11,0.3)'
                    : 'linear-gradient(135deg,rgba(245,158,11,0.9),rgba(217,119,6,0.9))',
                  color: '#0f172a',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px',
                  boxShadow: submitting
                    ? 'none'
                    : '0 4px 12px rgba(245,158,11,0.2)',
                }}
              >
                {submitting && (
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
                      stroke='rgba(15,23,42,0.5)'
                      strokeWidth='1.5'
                      fill='none'
                    />
                    <path
                      d='M6.5 1.5A5 5 0 0 1 11.5 6.5'
                      stroke='#0f172a'
                      strokeWidth='1.5'
                      strokeLinecap='round'
                      fill='none'
                    />
                  </svg>
                )}
                Crear y enviar
              </button>
            </div>
          </div>

          {/* Error global */}
          {errors._global && (
            <div
              style={{
                marginBottom: '16px',
                padding: '12px 16px',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.25)',
                borderRadius: '10px',
                fontSize: '13px',
                color: '#f87171',
                animation: 'slideUp 0.2s ease',
              }}
            >
              {errors._global}
            </div>
          )}

          {/* Layout principal */}
          <div className='grid grid-cols-1 gap-4 lg:gap-3 xl:grid-cols-[1fr_280px] xl:items-start'>
            {/* Panel izquierdo */}
            <div className='flex flex-col gap-4 lg:gap-3'>
              {/* Tabs */}
              <div
                style={{
                  ...card,
                  overflow: 'hidden',
                }}
              >
                {/* Tab bar */}
                <div
                  className='flex overflow-x-auto'
                  style={{
                    borderBottom: '1px solid rgba(148,163,184,0.07)',
                    background: 'rgba(8,16,35,0.3)',
                    scrollbarWidth: 'none',
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
                            color: tabActiva === tab.id ? '#f59e0b' : '#475569',
                            fontFamily: "'DM Mono',monospace",
                          }}
                        >
                          {tab.badge}
                        </span>
                      )}
                      {tab.hasError && (
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
                  ))}
                </div>

                {/* Contenido del tab */}
                <div
                  className='p-4 sm:p-5 lg:max-h-[calc(100vh-230px)] lg:overflow-y-auto lg:p-4'
                  style={{ animation: 'fadeIn 0.15s ease' }}
                  key={tabActiva}
                >
                  {tabActiva === 'cabecera' && (
                    <SeccionCabecera
                      data={cabecera}
                      onChange={setCab}
                      errors={errors}
                      clientes={clientes}
                      loadingClientes={loadingClientes}
                    />
                  )}
                  {tabActiva === 'items' && (
                    <SeccionItems
                      items={items}
                      onChange={handleItemChange}
                      onAdd={handleAddItem}
                      onRemove={handleRemoveItem}
                      errors={errors}
                    />
                  )}
                  {tabActiva === 'incidencias' && (
                    <SeccionIncidencias
                      incidencias={incidencias}
                      onChange={handleIncidenciaChange}
                      onAdd={handleAddIncidencia}
                      onRemove={handleRemoveIncidencia}
                    />
                  )}
                  {tabActiva === 'condiciones' && (
                    <SeccionCondiciones cabecera={cabecera} onChange={setCab} />
                  )}
                </div>
              </div>

              {/* Accesos rápidos desde ítems */}
              {tabActiva !== 'items' && items.length > 0 && (
                <div
                  className='flex flex-wrap items-center gap-2'
                  style={{ padding: '0 4px' }}
                >
                  <span style={{ fontSize: '11px', color: '#334155' }}>
                    Acceso rápido:
                  </span>
                  <button
                    onClick={handleAddItem}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(148,163,184,0.1)',
                      background: 'rgba(15,23,42,0.5)',
                      color: '#475569',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    + Ítem
                  </button>
                  <button
                    onClick={() => handleAddIncidencia('traslado')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(148,163,184,0.1)',
                      background: 'rgba(15,23,42,0.5)',
                      color: '#475569',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    + Traslado
                  </button>
                  <button
                    onClick={() => handleAddIncidencia('viatico')}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(148,163,184,0.1)',
                      background: 'rgba(15,23,42,0.5)',
                      color: '#475569',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontFamily: "'DM Sans',sans-serif",
                    }}
                  >
                    + Viático
                  </button>
                </div>
              )}
            </div>

            {/* Panel de totales sticky */}
            <PanelTotales
              items={items}
              incidencias={incidencias}
              cabecera={cabecera}
              onChangeCabecera={setCab}
            />
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Sección condiciones (tab 4) ──────────────────────────────────────────────

function SeccionCondiciones({
  cabecera,
  onChange,
}: {
  cabecera: CabeceraForm;
  onChange: <K extends keyof CabeceraForm>(k: K, v: CabeceraForm[K]) => void;
}) {
  const set =
    <K extends keyof CabeceraForm>(k: K) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(k, e.target.value as CabeceraForm[K]);

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Field label='Condiciones de pago'>
          <textarea
            value={cabecera.condiciones_pago}
            onChange={set('condiciones_pago')}
            placeholder='Ej: 50% anticipo al inicio, 50% a la entrega...'
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: '1.6',
              fontSize: '12px',
            }}
          />
        </Field>
        <Field label='Tiempo de ejecución'>
          <textarea
            value={cabecera.tiempo_ejecucion}
            onChange={set('tiempo_ejecucion')}
            placeholder='Ej: 15 días hábiles a partir del anticipo...'
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: '1.6',
              fontSize: '12px',
            }}
          />
        </Field>
        <Field label='Garantía'>
          <textarea
            value={cabecera.garantia}
            onChange={set('garantia')}
            placeholder='Ej: 12 meses sobre mano de obra y materiales...'
            rows={3}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: '1.6',
              fontSize: '12px',
            }}
          />
        </Field>
        <Field label='Fecha de vencimiento del presupuesto'>
          <Inp
            type='date'
            value={cabecera.fecha_vencimiento}
            onChange={set('fecha_vencimiento')}
          />
          <span
            style={{ fontSize: '11px', color: '#334155', marginTop: '4px' }}
          >
            Fecha límite para la validez del precio ofrecido
          </span>
        </Field>
      </div>
      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
        <Field
          label='Notas para el cliente'
          hint='Visible en el PDF del presupuesto'
        >
          <textarea
            value={cabecera.notas_cliente}
            onChange={set('notas_cliente')}
            placeholder='Aclaraciones, condiciones especiales, alcance...'
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: '1.6',
              fontSize: '12px',
            }}
          />
        </Field>
        <Field label='Notas internas' hint='Solo visible en el sistema'>
          <textarea
            value={cabecera.notas_internas}
            onChange={set('notas_internas')}
            placeholder='Contexto, estrategia de precio, observaciones del equipo...'
            rows={4}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: '1.6',
              fontSize: '12px',
            }}
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Pantalla de éxito ────────────────────────────────────────────────────────

function PantallaExito({ onNuevo }: { onNuevo: () => void }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#060d1a',
        flexDirection: 'column',
        gap: '24px',
        padding: '40px',
      }}
    >
      <div
        style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          background: 'rgba(34,197,94,0.1)',
          border: '2px solid rgba(34,197,94,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        <svg width='32' height='32' viewBox='0 0 32 32' fill='none'>
          <path
            d='M8 16L13 21L24 10'
            stroke='#4ade80'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            margin: '0 0 8px',
            fontSize: '20px',
            fontWeight: '700',
            color: '#e2e8f0',
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          Presupuesto creado
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: '14px',
            color: '#64748b',
            lineHeight: '1.6',
          }}
        >
          El presupuesto fue guardado exitosamente en el sistema.
        </p>
      </div>
      <div className='flex w-full flex-col gap-3 sm:flex-row sm:w-auto'>
        <button
          onClick={onNuevo}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: '1px solid rgba(148,163,184,0.15)',
            background: 'rgba(15,23,42,0.6)',
            color: '#94a3b8',
            fontSize: '13px',
            cursor: 'pointer',
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          + Nuevo presupuesto
        </button>
        <a
          href='/presupuestos'
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background:
              'linear-gradient(135deg,rgba(245,158,11,0.9),rgba(217,119,6,0.9))',
            color: '#0f172a',
            fontSize: '13px',
            fontWeight: '700',
            cursor: 'pointer',
            fontFamily: "'DM Sans',sans-serif",
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Ver presupuestos →
        </a>
      </div>
    </div>
  );
}
